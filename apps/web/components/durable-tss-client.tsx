'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import useSWR from 'swr';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  TooltipProps,
  XAxis,
  YAxis,
} from 'recharts';

import { fetchDurableTss, type DurableTssFilters } from '../lib/api';
import { formatDuration } from '../lib/utils';
import type { DurableTssResponse } from '../types/durable-tss';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Button } from './ui/button';

const MIN_THRESHOLD_KJ = 1;
const MAX_THRESHOLD_KJ = 5000;

interface DurableTssClientProps {
  initialData: DurableTssResponse | null;
  defaultThresholdKj: number;
}

type FiltersState = DurableTssFilters;

type ChartPoint = {
  timestamp: number;
  dateLabel: string;
  source: string;
  durableTss: number | null;
  postThresholdKj: number | null;
  postThresholdDurationSec: number | null;
};

function clampThreshold(value: number): number {
  if (Number.isNaN(value)) {
    return MIN_THRESHOLD_KJ;
  }
  if (value < MIN_THRESHOLD_KJ) {
    return MIN_THRESHOLD_KJ;
  }
  if (value > MAX_THRESHOLD_KJ) {
    return MAX_THRESHOLD_KJ;
  }
  return Math.round(value);
}

function formatNumber(value: number | null | undefined, fractionDigits = 1): string {
  if (value == null || Number.isNaN(value)) {
    return '—';
  }
  return value.toFixed(fractionDigits);
}

function useDurableTssData(filters: FiltersState, initialData: DurableTssResponse | null) {
  const { data: session, status } = useSession();
  const token = session?.accessToken;

  const swrKey = useMemo(() => {
    if (status === 'loading') {
      return null;
    }
    return ['durable-tss', filters, token] as const;
  }, [filters, status, token]);

  const { data, isLoading, error } = useSWR(
    swrKey,
    async ([, filterState, authToken]) => fetchDurableTss(filterState, authToken ?? undefined),
    {
      keepPreviousData: true,
      fallbackData: initialData ?? undefined,
      revalidateOnFocus: false,
    },
  );

  return { data: data ?? null, isLoading, error: error as Error | undefined };
}

function DurableTssTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const point = payload[0]?.payload as ChartPoint | undefined;
  if (!point) {
    return null;
  }

  return (
    <div className="min-w-[200px] rounded-md border bg-background/95 p-3 text-xs shadow-lg">
      <p className="font-semibold text-foreground">{point.dateLabel}</p>
      <p className="text-muted-foreground">Source: {point.source}</p>
      <div className="mt-2 space-y-1">
        <p>
          Durable TSS: <span className="font-medium text-foreground">{formatNumber(point.durableTss, 1)}</span>
        </p>
        <p>
          Post-threshold energy:{' '}
          <span className="font-medium text-foreground">{formatNumber(point.postThresholdKj, 1)} kJ</span>
        </p>
        <p>
          Duration after threshold:{' '}
          <span className="font-medium text-foreground">
            {point.postThresholdDurationSec != null ? formatDuration(point.postThresholdDurationSec) : '—'}
          </span>
        </p>
      </div>
    </div>
  );
}

export function DurableTssClient({ initialData, defaultThresholdKj }: DurableTssClientProps) {
  const initialThreshold = clampThreshold(initialData?.thresholdKj ?? defaultThresholdKj);
  const initialStart = initialData?.filters.startDate?.slice(0, 10);
  const initialEnd = initialData?.filters.endDate?.slice(0, 10);

  const [pending, setPending] = useState<FiltersState>({
    thresholdKj: initialThreshold,
    startDate: initialStart,
    endDate: initialEnd,
  });
  const [filters, setFilters] = useState<FiltersState>(pending);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setFilters(pending);
    }, 300);
    return () => window.clearTimeout(handle);
  }, [pending]);

  const { data, isLoading, error } = useDurableTssData(filters, initialData);

  const chartDateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
    [],
  );

  const chartData = useMemo<ChartPoint[]>(() => {
    if (!data) {
      return [];
    }
    return data.rides
      .map((ride) => {
        const timestamp = new Date(ride.startTime).getTime();
        return {
          timestamp,
          dateLabel: chartDateFormatter.format(new Date(ride.startTime)),
          source: ride.source,
          durableTss: ride.durableTss,
          postThresholdKj: ride.postThresholdKj,
          postThresholdDurationSec: ride.postThresholdDurationSec,
        } satisfies ChartPoint;
      })
      .sort((a, b) => a.timestamp - b.timestamp);
  }, [chartDateFormatter, data]);

  const stats = useMemo(() => {
    if (!data) {
      return {
        rideCount: 0,
        averageDurableTss: null,
        averagePostKj: null,
        averageDurationSec: null,
      };
    }

    const ridesWithDurableTss = data.rides.filter((ride) => ride.durableTss != null);
    const rideCount = data.rides.length;
    if (ridesWithDurableTss.length === 0) {
      return {
        rideCount,
        averageDurableTss: null,
        averagePostKj: null,
        averageDurationSec: null,
      };
    }

    const totals = ridesWithDurableTss.reduce(
      (acc, ride) => {
        acc.durableTss += ride.durableTss ?? 0;
        acc.postKj += ride.postThresholdKj ?? 0;
        acc.durationSec += ride.postThresholdDurationSec ?? 0;
        return acc;
      },
      { durableTss: 0, postKj: 0, durationSec: 0 },
    );

    const count = ridesWithDurableTss.length;
    return {
      rideCount,
      averageDurableTss: totals.durableTss / count,
      averagePostKj: totals.postKj / count,
      averageDurationSec: totals.durationSec / count,
    };
  }, [data]);

  const startLabelFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
    [],
  );
  const timeLabelFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat('en-US', {
        hour: 'numeric',
        minute: 'numeric',
      }),
    [],
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="space-y-2">
          <CardTitle className="text-base font-semibold">Durable TSS filters</CardTitle>
          <CardDescription>
            Choose a date window and adjust the kilojoule threshold to focus on late-ride training load.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="durable-tss-start">
                Start date
              </label>
              <Input
                id="durable-tss-start"
                type="date"
                value={pending.startDate ?? ''}
                onChange={(event) =>
                  setPending((prev) => ({ ...prev, startDate: event.target.value || undefined }))
                }
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="durable-tss-end">
                End date
              </label>
              <Input
                id="durable-tss-end"
                type="date"
                value={pending.endDate ?? ''}
                onChange={(event) =>
                  setPending((prev) => ({ ...prev, endDate: event.target.value || undefined }))
                }
              />
            </div>
            <div className="flex items-end">
              <Button
                type="button"
                variant="secondary"
                className="w-full"
                onClick={() => setPending((prev) => ({ ...prev, startDate: undefined, endDate: undefined }))}
              >
                Clear dates
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <label className="font-medium text-foreground" htmlFor="durable-tss-threshold">
                Kilojoule threshold
              </label>
              <span className="text-muted-foreground">{pending.thresholdKj} kJ</span>
            </div>
            <input
              id="durable-tss-threshold"
              type="range"
              min={MIN_THRESHOLD_KJ}
              max={MAX_THRESHOLD_KJ}
              value={pending.thresholdKj}
              onChange={(event) =>
                setPending((prev) => ({ ...prev, thresholdKj: clampThreshold(Number(event.target.value)) }))
              }
              className="h-2 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary"
            />
            <Input
              type="number"
              min={MIN_THRESHOLD_KJ}
              max={MAX_THRESHOLD_KJ}
              value={pending.thresholdKj}
              onChange={(event) =>
                setPending((prev) => ({
                  ...prev,
                  thresholdKj: clampThreshold(Number(event.target.value)),
                }))
              }
            />
          </div>
        </CardContent>
      </Card>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Unable to load durable TSS</AlertTitle>
          <AlertDescription>
            {error.message || 'The analysis request failed. Try refreshing or adjusting your filters.'}
          </AlertDescription>
        </Alert>
      ) : null}

      {data?.ftpWatts == null ? (
        <Alert>
          <AlertTitle>Set your FTP to unlock TSS calculations</AlertTitle>
          <AlertDescription>
            Provide an FTP value in your profile so we can translate post-threshold intensity into training stress.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Rides analyzed</CardDescription>
            <CardTitle className="text-3xl font-semibold">{stats.rideCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Average durable TSS</CardDescription>
            <CardTitle className="text-3xl font-semibold">
              {formatNumber(stats.averageDurableTss, 1)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Average post-threshold energy</CardDescription>
            <CardTitle className="text-3xl font-semibold">
              {formatNumber(stats.averagePostKj, 1)} kJ
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Average time after threshold</CardDescription>
            <CardTitle className="text-3xl font-semibold">
              {stats.averageDurationSec != null
                ? formatDuration(stats.averageDurationSec)
                : '—'}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader className="space-y-2">
          <CardTitle className="text-base font-semibold">Durable TSS over time</CardTitle>
          <CardDescription>
            Track how much training load you generate after {filters.thresholdKj} kJ of work across your selected rides.
          </CardDescription>
        </CardHeader>
        <CardContent className="h-[360px]">
          {chartData.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              {isLoading ? 'Loading durable TSS trend…' : 'No rides match your current filters.'}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 12, right: 24, left: 8, bottom: 12 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="timestamp"
                  type="number"
                  tickFormatter={(value) => startLabelFormatter.format(new Date(value))}
                  domain={['auto', 'auto']}
                  className="text-xs"
                />
                <YAxis
                  dataKey="durableTss"
                  name="Durable TSS"
                  className="text-xs"
                  domain={[0, 'auto']}
                  tickFormatter={(value) => Number.isFinite(value) ? value.toFixed(0) : ''}
                />
                <Tooltip content={<DurableTssTooltip />} />
                <Line
                  type="monotone"
                  dataKey="durableTss"
                  stroke="var(--primary)"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-2">
          <CardTitle className="text-base font-semibold">Ride breakdown</CardTitle>
          <CardDescription>
            Review individual rides, late-ride duration, and energy accumulation beyond the selected threshold.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data && data.rides.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Durable TSS</TableHead>
                  <TableHead>Post-threshold kJ</TableHead>
                  <TableHead>Duration after threshold</TableHead>
                  <TableHead>Total kJ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rides
                  .slice()
                  .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
                  .map((ride) => (
                    <TableRow key={ride.activityId}>
                      <TableCell className="whitespace-nowrap">
                        <div className="font-medium text-foreground">{startLabelFormatter.format(new Date(ride.startTime))}</div>
                        <div className="text-xs text-muted-foreground">
                          {timeLabelFormatter.format(new Date(ride.startTime))}
                        </div>
                      </TableCell>
                      <TableCell>{ride.source}</TableCell>
                      <TableCell>{formatNumber(ride.durableTss, 1)}</TableCell>
                      <TableCell>{formatNumber(ride.postThresholdKj, 1)}</TableCell>
                      <TableCell>
                        {ride.postThresholdDurationSec != null
                          ? formatDuration(ride.postThresholdDurationSec)
                          : '—'}
                      </TableCell>
                      <TableCell>{formatNumber(ride.totalKj, 1)}</TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">
              {isLoading
                ? 'Loading ride breakdown…'
                : 'Upload endurance rides to see how much training load you generate after your chosen kilojoule marker.'}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
