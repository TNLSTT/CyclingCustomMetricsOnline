'use client';

import { useEffect, useMemo, useState, useId } from 'react';
import { Activity, ArrowRightLeft, BarChart2, Droplet, Search, X } from 'lucide-react';
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RechartTooltip,
  XAxis,
  YAxis,
  Legend,
} from 'recharts';

import type {
  ActivitySummary,
  IntervalEfficiencyInterval,
  PaginatedActivities,
  PowerStreamSample,
} from '../types/activity';
import { fetchActivities, fetchIntervalEfficiency, fetchPowerStream } from '../lib/api';
import { formatDuration } from '../lib/utils';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Input } from './ui/input';
import { Badge } from './ui/badge';

interface RideComparisonOverlayProps {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  accessToken?: string;
  baseActivity: ActivitySummary;
  baseIntervals: IntervalEfficiencyInterval[];
}

type ComparisonMetric = 'power' | 'hr';

type ActivityOption = ActivitySummary & { label: string };

type PowerSeries = Array<{ progress: number; base: number | null; compare: number | null }>; // 0-1 progress

type HrSeries = Array<{ indexLabel: string; base: number | null; compare: number | null }>;

export function RideComparisonOverlay({
  open,
  onOpenChange,
  accessToken,
  baseActivity,
  baseIntervals,
}: RideComparisonOverlayProps) {
  const [activities, setActivities] = useState<ActivityOption[]>([]);
  const [query, setQuery] = useState('');
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [activityError, setActivityError] = useState<string | null>(null);

  const [comparisonActivity, setComparisonActivity] = useState<ActivityOption | null>(null);
  const [comparisonMetric, setComparisonMetric] = useState<ComparisonMetric>('power');

  const [basePower, setBasePower] = useState<PowerStreamSample[]>([]);
  const [comparePower, setComparePower] = useState<PowerStreamSample[] | null>(null);
  const [compareIntervals, setCompareIntervals] = useState<IntervalEfficiencyInterval[] | null>(null);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [isStreamLoading, setIsStreamLoading] = useState(false);
  const headingId = useId();

  useEffect(() => {
    if (!open) {
      return;
    }
    setLoadingActivities(true);
    setActivityError(null);
    fetchActivities(1, 200, accessToken)
      .then((response: PaginatedActivities) => {
        const options = response.data
          .filter((item) => item.id !== baseActivity.id)
          .map((item) => ({
            ...item,
            label: `${new Date(item.startTime).toLocaleDateString()} • ${formatDuration(item.durationSec)} • ${item.source}`,
          }));
        setActivities(options);
      })
      .catch((error) => {
        setActivityError(error instanceof Error ? error.message : 'Unable to fetch rides.');
      })
      .finally(() => setLoadingActivities(false));
  }, [open, accessToken, baseActivity.id, baseActivity.durationSec, baseActivity.startTime, baseActivity.source]);

  useEffect(() => {
    if (!open) {
      return;
    }
    if (basePower.length > 0) {
      return;
    }
    setIsStreamLoading(true);
    fetchPowerStream(baseActivity.id, accessToken)
      .then((response) => {
        setBasePower(response.samples);
        setStreamError(null);
      })
      .catch((error) => {
        setStreamError(error instanceof Error ? error.message : 'Unable to load power stream.');
      })
      .finally(() => setIsStreamLoading(false));
  }, [open, baseActivity.id, accessToken, basePower.length]);

  useEffect(() => {
    if (!open || !comparisonActivity) {
      return;
    }
    setIsStreamLoading(true);
    setStreamError(null);
    Promise.all([
      fetchPowerStream(comparisonActivity.id, accessToken).catch((error) => {
        setStreamError(error instanceof Error ? error.message : 'Unable to load comparison power stream.');
        return { samples: [] };
      }),
      fetchIntervalEfficiency(comparisonActivity.id, accessToken).catch(() => null),
    ])
      .then(([powerResponse, intervalResponse]) => {
        setComparePower(powerResponse.samples);
        setCompareIntervals(intervalResponse?.intervals ?? null);
      })
      .finally(() => setIsStreamLoading(false));
  }, [open, comparisonActivity, accessToken]);

  const filteredActivities = useMemo(() => {
    if (!query.trim()) {
      return activities;
    }
    const normalizedQuery = query.trim().toLowerCase();
    return activities
      .map((item) => ({
        item,
        score: fuzzyScore(normalizedQuery, buildActivitySearchText(item)),
      }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .map(({ item }) => item);
  }, [activities, query]);

  const powerSeries: PowerSeries = useMemo(() => {
    if (basePower.length === 0 || !comparePower || comparePower.length === 0) {
      return [];
    }
    const normalizedBase = normalizePowerSeries(basePower);
    const normalizedCompare = normalizePowerSeries(comparePower);
    const length = Math.max(normalizedBase.length, normalizedCompare.length);
    const rows: PowerSeries = [];
    for (let index = 0; index < length; index += 1) {
      const basePoint = normalizedBase[Math.min(index, normalizedBase.length - 1)];
      const comparePoint = normalizedCompare[Math.min(index, normalizedCompare.length - 1)];
      rows.push({
        progress: length > 1 ? index / (length - 1) : 0,
        base: basePoint?.value ?? null,
        compare: comparePoint?.value ?? null,
      });
    }
    return rows;
  }, [basePower, comparePower]);

  const hrSeries: HrSeries = useMemo(() => {
    const baseSeries = normalizeHrSeries(baseIntervals);
    const compareSeries = normalizeHrSeries(compareIntervals ?? []);
    if (baseSeries.length === 0 || compareSeries.length === 0) {
      return [];
    }
    const length = Math.max(baseSeries.length, compareSeries.length);
    const rows: HrSeries = [];
    for (let index = 0; index < length; index += 1) {
      const basePoint = baseSeries[Math.min(index, baseSeries.length - 1)];
      const comparePoint = compareSeries[Math.min(index, compareSeries.length - 1)];
      rows.push({
        indexLabel: `Segment ${index + 1}`,
        base: basePoint ?? null,
        compare: comparePoint ?? null,
      });
    }
    return rows;
  }, [baseIntervals, compareIntervals]);

  const showChart = comparisonMetric === 'power' ? powerSeries.length > 0 : hrSeries.length > 0;

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-background/70 p-4 backdrop-blur"
      role="dialog"
      aria-modal="true"
      aria-labelledby={headingId}
    >
      <Card className="relative flex h-[90vh] w-full max-w-5xl flex-col border border-border/60 bg-background/95 shadow-xl">
        <header className="flex items-start justify-between gap-4 border-b border-border/60 px-6 py-4">
          <div>
            <h2 id={headingId} className="text-xl font-semibold">Compare rides</h2>
            <p className="text-sm text-muted-foreground">
              Overlay the selected ride against another activity to highlight pacing and aerobic drift differences.
            </p>
          </div>
          <Button variant="ghost" size="icon" aria-label="Close comparison" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        </header>

        <div className="grid flex-1 gap-6 overflow-y-auto p-6 md:grid-cols-[320px_1fr]">
          <aside className="space-y-4">
            <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Base ride</p>
              <p className="mt-1 font-semibold">{new Date(baseActivity.startTime).toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">{baseActivity.source}</p>
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                <Badge variant="outline">{formatDuration(baseActivity.durationSec)}</Badge>
                {baseActivity.distanceMeters ? (
                  <Badge variant="outline">{(baseActivity.distanceMeters / 1000).toFixed(1)} km</Badge>
                ) : null}
              </div>
            </div>

            <div>
              <label htmlFor="ride-search" className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Search className="h-3.5 w-3.5" aria-hidden="true" /> Find a ride
              </label>
              <Input
                id="ride-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by date, distance, or source"
                className="mt-2"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Fuzzy search matches route names, upload dates, and durations.
              </p>
            </div>

            <div className="max-h-64 space-y-2 overflow-y-auto rounded-lg border border-border/60 bg-background/60 p-2">
              {loadingActivities ? (
                <p className="p-3 text-xs text-muted-foreground">Loading rides…</p>
              ) : activityError ? (
                <p className="p-3 text-xs text-destructive">{activityError}</p>
              ) : filteredActivities.length === 0 ? (
                <p className="p-3 text-xs text-muted-foreground">No rides match the current query.</p>
              ) : (
                filteredActivities.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setComparisonActivity(item)}
                    className={`w-full rounded-md px-3 py-2 text-left text-xs transition-colors ${
                      comparisonActivity?.id === item.id
                        ? 'bg-primary/10 text-primary'
                        : 'hover:bg-muted'
                    }`}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-semibold">{new Date(item.startTime).toLocaleDateString()}</span>
                      <span>{formatDuration(item.durationSec)}</span>
                    </span>
                    <span className="mt-1 block text-[10px] uppercase tracking-wide text-muted-foreground">
                      {item.source}
                    </span>
                    {item.distanceMeters ? (
                      <span className="block text-[10px] text-muted-foreground">{(item.distanceMeters / 1000).toFixed(1)} km</span>
                    ) : null}
                    {item.name ? (
                      <span className="mt-1 block text-[11px] font-medium">{item.name}</span>
                    ) : null}
                  </button>
                ))
              )}
            </div>

            <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <ArrowRightLeft className="h-3.5 w-3.5" aria-hidden="true" /> Metric focus
              </p>
              <div className="mt-2 flex gap-2">
                <Button
                  size="sm"
                  variant={comparisonMetric === 'power' ? 'default' : 'outline'}
                  onClick={() => setComparisonMetric('power')}
                  aria-pressed={comparisonMetric === 'power'}
                >
                  <BarChart2 className="mr-2 h-3.5 w-3.5" aria-hidden="true" /> Power
                </Button>
                <Button
                  size="sm"
                  variant={comparisonMetric === 'hr' ? 'default' : 'outline'}
                  onClick={() => setComparisonMetric('hr')}
                  aria-pressed={comparisonMetric === 'hr'}
                >
                  <Droplet className="mr-2 h-3.5 w-3.5" aria-hidden="true" /> Heart rate
                </Button>
              </div>
            </div>
          </aside>

          <section className="flex flex-col gap-4">
            {comparisonActivity ? (
              <div className="rounded-lg border border-border/60 bg-muted/10 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Comparing against</p>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-sm font-semibold">
                  <Activity className="h-4 w-4 text-primary" aria-hidden="true" />
                  {new Date(comparisonActivity.startTime).toLocaleString()} · {comparisonActivity.source}
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-border/60 bg-muted/10 p-6 text-sm text-muted-foreground">
                Choose a ride from the list to unlock comparison charts.
              </div>
            )}

            <div className="flex-1 rounded-xl border border-border/60 bg-background/80 p-4 shadow-sm">
              {isStreamLoading ? (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  Loading comparison data…
                </div>
              ) : streamError ? (
                <div className="flex h-full items-center justify-center px-4 text-center text-sm text-destructive">
                  {streamError}
                </div>
              ) : showChart ? (
                <ResponsiveContainer width="100%" height={360}>
                  {comparisonMetric === 'power' ? (
                    <LineChart data={powerSeries} margin={{ top: 24, right: 24, left: 0, bottom: 16 }}>
                      <XAxis
                        dataKey="progress"
                        tickFormatter={(value) => `${Math.round(value * 100)}%`}
                        label={{ value: 'Ride progress', position: 'insideBottomRight', offset: -12 }}
                      />
                      <YAxis
                        tickFormatter={(value) => `${value.toFixed(0)} W`}
                        label={{ value: 'Watts', angle: -90, position: 'insideLeft' }}
                        allowDecimals={false}
                      />
                      <RechartTooltip
                        formatter={(value: number | string, name: string) => [
                          typeof value === 'number' ? `${value.toFixed(0)} W` : value,
                          name === 'base' ? 'This ride' : 'Comparison',
                        ]}
                        labelFormatter={(value) => `Progress ${Math.round(Number(value) * 100)}%`}
                      />
                      <Legend formatter={(value) => (value === 'base' ? 'This ride' : 'Comparison')} />
                      <Line type="monotone" dataKey="base" stroke="#38bdf8" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="compare" stroke="#f97316" strokeWidth={2} dot={false} strokeDasharray="4 4" />
                    </LineChart>
                  ) : (
                    <LineChart data={hrSeries} margin={{ top: 24, right: 24, left: 0, bottom: 16 }}>
                      <XAxis dataKey="indexLabel" label={{ value: 'Interval', position: 'insideBottomRight', offset: -12 }} />
                      <YAxis
                        tickFormatter={(value) => `${value.toFixed(0)} bpm`}
                        label={{ value: 'Heart rate', angle: -90, position: 'insideLeft' }}
                        allowDecimals={false}
                      />
                      <RechartTooltip
                        formatter={(value: number | string, name: string) => [
                          typeof value === 'number' ? `${value.toFixed(0)} bpm` : value,
                          name === 'base' ? 'This ride' : 'Comparison',
                        ]}
                      />
                      <Legend formatter={(value) => (value === 'base' ? 'This ride' : 'Comparison')} />
                      <Line type="monotone" dataKey="base" stroke="#ef4444" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="compare" stroke="#22c55e" strokeWidth={2} dot={false} strokeDasharray="4 4" />
                    </LineChart>
                  )}
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  Select a ride and metric to view overlays.
                </div>
              )}
            </div>
          </section>
        </div>
      </Card>
    </div>
  );
}

function buildActivitySearchText(activity: ActivityOption): string {
  return [
    activity.label,
    activity.name ?? '',
    activity.source,
    activity.distanceMeters ? `${activity.distanceMeters / 1000} km` : '',
    new Date(activity.startTime).toLocaleString(),
  ]
    .join(' ')
    .toLowerCase();
}

function fuzzyScore(query: string, text: string): number {
  if (!query) {
    return 1;
  }
  const chars = query.replace(/\s+/g, '');
  let score = 0;
  let index = 0;
  for (const char of chars) {
    const found = text.indexOf(char, index);
    if (found === -1) {
      return 0;
    }
    score += 1;
    index = found + 1;
  }
  return score / chars.length;
}

function normalizePowerSeries(samples: PowerStreamSample[]) {
  if (!samples || samples.length === 0) {
    return [] as Array<{ progress: number; value: number | null }>;
  }
  const sanitized = samples.filter((sample) => sample && typeof sample.power === 'number');
  if (sanitized.length === 0) {
    return [];
  }
  const maxIndex = sanitized.length - 1;
  const resolution = Math.min(240, sanitized.length);
  const step = Math.max(1, Math.floor(sanitized.length / resolution));
  const values: Array<{ progress: number; value: number | null }> = [];
  for (let index = 0; index <= maxIndex; index += step) {
    const sample = sanitized[index];
    values.push({ progress: maxIndex === 0 ? 1 : index / maxIndex, value: sample?.power ?? null });
  }
  const last = sanitized[sanitized.length - 1];
  if (values.length === 0 || values[values.length - 1]?.progress !== 1) {
    values.push({ progress: 1, value: last?.power ?? null });
  }
  return values;
}

function normalizeHrSeries(intervals: IntervalEfficiencyInterval[]) {
  if (!intervals || intervals.length === 0) {
    return [] as number[];
  }
  return intervals
    .map((interval) => (typeof interval.avg_hr === 'number' && Number.isFinite(interval.avg_hr) ? interval.avg_hr : null))
    .filter((value): value is number => value != null);
}
