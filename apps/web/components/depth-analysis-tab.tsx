'use client';

import { useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useSession } from 'next-auth/react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { fetchDepthAnalysis } from '../lib/api';
import type { DepthAnalysisResponse, DepthDaySummary } from '../types/depth-analysis';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';

const DEFAULT_THRESHOLD_KJ = 2000;
const DEFAULT_MIN_POWER = 180;

interface DepthAnalysisTabProps {
  initialData: DepthAnalysisResponse | null;
  initialThresholdKj?: number;
  initialMinPower?: number;
  initialError?: string | null;
}

type ChartDatum = {
  date: number;
  depth: number;
  movingAverage: number | null;
};

function parseThreshold(value: string, fallback: number): number {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }
  return Math.min(parsed, 100000);
}

function parseMinPower(value: string, fallback: number): number {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }
  return Math.min(parsed, 2000);
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

function buildChartData(days: DepthDaySummary[]): ChartDatum[] {
  return days.map((day) => ({
    date: new Date(day.date).getTime(),
    depth: day.depthKj,
    movingAverage: day.movingAverage90,
  }));
}

function formatKj(value: number, fractionDigits = 1): string {
  if (!Number.isFinite(value)) {
    return '—';
  }
  return value.toLocaleString(undefined, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

function computeLatestMovingAverage(days: DepthDaySummary[]): number | null {
  for (let index = days.length - 1; index >= 0; index -= 1) {
    const value = days[index]?.movingAverage90;
    if (value != null && Number.isFinite(value)) {
      return value;
    }
  }
  return null;
}

function computePeakMovingAverage(days: DepthDaySummary[]): number | null {
  return days.reduce<number | null>((max, day) => {
    if (day.movingAverage90 != null && Number.isFinite(day.movingAverage90)) {
      if (max == null || day.movingAverage90 > max) {
        return day.movingAverage90;
      }
    }
    return max;
  }, null);
}

function computeAverageDepth(days: DepthDaySummary[]): number | null {
  if (days.length === 0) {
    return null;
  }
  const sum = days.reduce((total, day) => total + day.depthKj, 0);
  return Number.isFinite(sum) ? Number.parseFloat((sum / days.length).toFixed(2)) : null;
}

export function DepthAnalysisTab({
  initialData,
  initialThresholdKj = DEFAULT_THRESHOLD_KJ,
  initialMinPower = DEFAULT_MIN_POWER,
  initialError = null,
}: DepthAnalysisTabProps) {
  const [thresholdInput, setThresholdInput] = useState<string>(String(initialThresholdKj));
  const [minPowerInput, setMinPowerInput] = useState<string>(String(initialMinPower));
  const [data, setData] = useState<DepthAnalysisResponse | null>(initialData);
  const [error, setError] = useState<string | null>(initialError);
  const [isLoading, setIsLoading] = useState(false);

  const { data: session } = useSession();

  const days = useMemo(() => data?.days ?? [], [data]);
  const chartData = useMemo(() => buildChartData(days), [days]);

  const latestMovingAverage = useMemo(() => computeLatestMovingAverage(days), [days]);
  const peakMovingAverage = useMemo(() => computePeakMovingAverage(days), [days]);
  const averageDepth = useMemo(() => computeAverageDepth(days), [days]);

  const shortDateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat('en', {
        month: 'short',
        day: 'numeric',
      }),
    [],
  );

  const fullDateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat('en', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
    [],
  );

  async function handleApplySettings() {
    const fallbackThreshold = data?.thresholdKj ?? initialThresholdKj;
    const fallbackMinPower = data?.minPowerWatts ?? initialMinPower;

    const threshold = parseThreshold(thresholdInput, fallbackThreshold);
    const minPower = parseMinPower(minPowerInput, fallbackMinPower);

    setThresholdInput(String(threshold));
    setMinPowerInput(String(minPower));
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetchDepthAnalysis(threshold, minPower, session?.accessToken);
      setData(response);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load depth analysis';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }

  const recentDays = useMemo(() => {
    const sorted = [...days].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return sorted.slice(0, 30);
  }, [days]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Depth parameters</CardTitle>
          <CardDescription>
            Adjust the late-ride workload threshold and the minimum power that qualifies as depth work.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 md:flex-row md:items-end">
            <div className="flex-1 space-y-2">
              <label htmlFor="depth-threshold" className="text-sm font-medium text-foreground">
                Depth threshold (kJ)
              </label>
              <Input
                id="depth-threshold"
                inputMode="decimal"
                value={thresholdInput}
                onChange={(event) => setThresholdInput(event.target.value)}
              />
            </div>
            <div className="flex-1 space-y-2">
              <label htmlFor="depth-min-power" className="text-sm font-medium text-foreground">
                Minimum power (W)
              </label>
              <Input
                id="depth-min-power"
                inputMode="decimal"
                value={minPowerInput}
                onChange={(event) => setMinPowerInput(event.target.value)}
              />
            </div>
            <Button onClick={handleApplySettings} disabled={isLoading} className="md:w-auto">
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading
                </>
              ) : (
                'Update depth analysis'
              )}
            </Button>
          </div>
          {error ? (
            <Alert variant="destructive" className="mt-4">
              <AlertTitle>Unable to load depth analysis</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>

      {days.length === 0 ? (
        <Alert>
          <AlertTitle>No depth data yet</AlertTitle>
          <AlertDescription>
            Upload rides and compute metrics to explore how much work you complete late in each session.
          </AlertDescription>
        </Alert>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Latest 90-day depth</CardDescription>
                <CardTitle className="text-2xl font-semibold">
                  {latestMovingAverage != null ? `${latestMovingAverage.toFixed(1)} kJ` : '—'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Rolling average of qualifying work over the most recent 90 days.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Peak 90-day depth</CardDescription>
                <CardTitle className="text-2xl font-semibold">
                  {peakMovingAverage != null ? `${peakMovingAverage.toFixed(1)} kJ` : '—'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Highest sustained block of late-ride work across the entire timeline.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Average depth per day</CardDescription>
                <CardTitle className="text-2xl font-semibold">
                  {averageDepth != null ? `${averageDepth.toFixed(1)} kJ` : '—'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Arithmetic average of all daily depth totals in the selected range.
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">Depth moving average</CardTitle>
              <CardDescription>
                Compare daily qualifying kilojoules against the 90-day moving average to understand how
                deep your training extends into long rides.
              </CardDescription>
            </CardHeader>
            <CardContent className="h-[360px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 12, bottom: 12, left: 12, right: 16 }}>
                  <CartesianGrid strokeDasharray="4 4" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="date"
                    type="number"
                    domain={['auto', 'auto']}
                    tickFormatter={(value) => shortDateFormatter.format(new Date(value))}
                  />
                  <YAxis tickFormatter={(value) => `${value}`} />
                  <Tooltip
                    formatter={(value, key) => {
                      if (typeof value !== 'number') {
                        return value;
                      }
                      const suffix = key === 'depth' ? 'kJ' : 'kJ';
                      return [`${value.toFixed(1)} ${suffix}`, key === 'depth' ? 'Daily depth' : '90-day MA'];
                    }}
                    labelFormatter={(value) => fullDateFormatter.format(new Date(value))}
                  />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="depth"
                    name="Daily depth"
                    stroke="#0ea5e9"
                    fill="#bae6fd"
                    fillOpacity={0.5}
                  />
                  <Area
                    type="monotone"
                    dataKey="movingAverage"
                    name="90-day moving average"
                    stroke="#22c55e"
                    fill="#bbf7d0"
                    fillOpacity={0.3}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">Recent depth days</CardTitle>
              <CardDescription>
                Review the most recent thirty days of rides that contribute to depth training.
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Depth (kJ)</TableHead>
                    <TableHead>90-day MA (kJ)</TableHead>
                    <TableHead>Total (kJ)</TableHead>
                    <TableHead>Depth share</TableHead>
                    <TableHead>Activities</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentDays.map((day) => (
                    <TableRow key={day.date}>
                      <TableCell className="whitespace-nowrap">{formatDate(new Date(day.date))}</TableCell>
                      <TableCell>{formatKj(day.depthKj, 1)}</TableCell>
                      <TableCell>
                        {day.movingAverage90 != null ? `${day.movingAverage90.toFixed(1)}` : '—'}
                      </TableCell>
                      <TableCell>{formatKj(day.totalKj, 1)}</TableCell>
                      <TableCell>
                        {day.depthRatio != null ? `${day.depthRatio.toFixed(1)}%` : '—'}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          {day.activities.length === 0 ? (
                            <Badge variant="secondary">Rest day</Badge>
                          ) : (
                            day.activities.map((activity) => {
                              const start = new Date(activity.startTime);
                              return (
                                <Badge key={activity.activityId} variant="outline">
                                  {`${formatKj(activity.depthKj, 1)} kJ • ${start.toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}`}
                                </Badge>
                              );
                            })
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
