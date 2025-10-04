'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import useSWR from 'swr';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import {
  fetchDurabilityAnalysis,
  type DurabilityAnalysisFilters,
} from '../lib/api';
import { formatDuration } from '../lib/utils';
import type { DurabilityAnalysisResponse, DurabilityRideAnalysis } from '../types/durability-analysis';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';

const DEFAULT_MIN_DURATION_MINUTES = 180;

type SortKey = 'date' | 'duration' | 'score';
type SortDirection = 'asc' | 'desc';

interface SortState {
  key: SortKey;
  direction: SortDirection;
}

interface DurabilityAnalysisClientProps {
  initialData: DurabilityAnalysisResponse | null;
  defaultMinDurationMinutes?: number;
}

type FiltersState = Required<Pick<DurabilityAnalysisFilters, 'minDurationMinutes'>> &
  Omit<DurabilityAnalysisFilters, 'minDurationMinutes'>;

function formatDate(value: string) {
  const date = new Date(value);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

function formatTimeOfDay(value: string) {
  const date = new Date(value);
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: 'numeric',
  }).format(date);
}

function formatNumber(value: number | null | undefined, fractionDigits = 1) {
  if (value == null || Number.isNaN(value)) {
    return '—';
  }
  return value.toFixed(fractionDigits);
}

function useDurabilityAnalysisData(
  filters: FiltersState,
  initialData: DurabilityAnalysisResponse | null,
) {
  const { data: session, status } = useSession();
  const token = session?.accessToken;

  const swrKey = useMemo(() => {
    if (status === 'loading') {
      return null;
    }
    return ['durability-analysis', filters, token] as const;
  }, [filters, status, token]);

  const { data, isLoading, error } = useSWR(
    swrKey,
    async ([, filterState, authToken]) =>
      fetchDurabilityAnalysis(filterState, authToken ?? undefined),
    {
      keepPreviousData: true,
      fallbackData: initialData ?? undefined,
      revalidateOnFocus: false,
    },
  );

  return { data: data ?? null, isLoading, error: error as Error | undefined };
}

function ScoreBadge({ score }: { score: number }) {
  let variant: 'default' | 'secondary' | 'outline' = 'default';
  let extraClass = '';
  if (score >= 85) {
    variant = 'default';
  } else if (score >= 70) {
    variant = 'secondary';
  } else {
    variant = 'outline';
    extraClass = 'border-destructive/40 text-destructive';
  }
  return (
    <Badge variant={variant} className={`font-semibold ${extraClass}`}>
      {score}
    </Badge>
  );
}

function FiltersPanel({
  pending,
  onChange,
  onSubmit,
  availableDisciplines,
}: {
  pending: FiltersState;
  onChange: (value: FiltersState) => void;
  onSubmit: () => void;
  availableDisciplines: string[];
}) {
  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="text-base font-semibold">Filter rides</CardTitle>
        <CardDescription>Focus on long rides and specific sessions to compare durability.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm font-medium text-foreground">
            <span>Minimum duration: {pending.minDurationMinutes} min</span>
            <span className="text-muted-foreground">
              {(pending.minDurationMinutes / 60).toFixed(1)} hours
            </span>
          </div>
          <input
            type="range"
            min={60}
            max={420}
            step={15}
            value={pending.minDurationMinutes}
            onChange={(event) =>
              onChange({ ...pending, minDurationMinutes: Number(event.target.value) })
            }
            className="w-full accent-primary"
            aria-label="Minimum ride duration in minutes"
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1 text-sm font-medium text-foreground">
            <span>Start date</span>
            <Input
              type="date"
              value={pending.startDate ?? ''}
              onChange={(event) => onChange({ ...pending, startDate: event.target.value || undefined })}
            />
          </label>
          <label className="space-y-1 text-sm font-medium text-foreground">
            <span>End date</span>
            <Input
              type="date"
              value={pending.endDate ?? ''}
              onChange={(event) => onChange({ ...pending, endDate: event.target.value || undefined })}
            />
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1 text-sm font-medium text-foreground">
            <span>Discipline / source</span>
            <div className="flex items-center gap-2">
              <Input
                list="durability-disciplines"
                placeholder="e.g. outdoor, trainer"
                value={pending.discipline ?? ''}
                onChange={(event) => onChange({ ...pending, discipline: event.target.value || undefined })}
              />
              <datalist id="durability-disciplines">
                {availableDisciplines.map((item) => (
                  <option key={item} value={item} />
                ))}
              </datalist>
            </div>
          </label>
          <label className="space-y-1 text-sm font-medium text-foreground">
            <span>Keyword search</span>
            <Input
              placeholder="Match ride source or metric key"
              value={pending.keyword ?? ''}
              onChange={(event) => onChange({ ...pending, keyword: event.target.value || undefined })}
            />
          </label>
        </div>

        <div className="flex justify-end">
          <Button type="button" onClick={onSubmit}>
            Apply filters
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function sortRides(rides: DurabilityRideAnalysis[], sort: SortState): DurabilityRideAnalysis[] {
  const sorted = [...rides];
  sorted.sort((a, b) => {
    let value = 0;
    if (sort.key === 'date') {
      value = new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
    } else if (sort.key === 'duration') {
      value = a.durationSec - b.durationSec;
    } else {
      value = a.durabilityScore - b.durabilityScore;
    }
    return sort.direction === 'asc' ? value : -value;
  });
  return sorted;
}

function toAriaSort(direction: SortDirection): 'ascending' | 'descending' {
  return direction === 'asc' ? 'ascending' : 'descending';
}

function SummaryHeader({ ride }: { ride: DurabilityRideAnalysis }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h2 className="text-2xl font-semibold text-foreground">Selected ride</h2>
        <p className="text-sm text-muted-foreground">
          {formatDate(ride.startTime)} · {formatTimeOfDay(ride.startTime)} · Source: {ride.source}
        </p>
      </div>
      <div className="flex items-center gap-3 text-sm">
        <div className="text-right">
          <p className="text-muted-foreground">Durability score</p>
          <ScoreBadge score={ride.durabilityScore} />
        </div>
        <div className="text-right">
          <p className="text-muted-foreground">Late 20-min power</p>
          <p className="font-semibold text-foreground">
            {formatNumber(ride.bestLateTwentyMinPctFtp, 1)}% FTP
          </p>
        </div>
        <div className="text-right">
          <p className="text-muted-foreground">HR drift</p>
          <p className="font-semibold text-foreground">
            {ride.heartRateDriftPct != null ? `${formatNumber(ride.heartRateDriftPct, 1)}%` : '—'}
          </p>
        </div>
      </div>
    </div>
  );
}

function DurabilityCharts({ ride }: { ride: DurabilityRideAnalysis }) {
  const earlyBoundary = ride.durationSec * 0.3;
  const lateBoundary = ride.durationSec * 0.7;

  const timeSeries = useMemo(() => {
    if (!ride.timeSeries || ride.timeSeries.length === 0) {
      return [] as typeof ride.timeSeries;
    }
    return ride.timeSeries.map((point) => ({
      ...point,
      minutes: point.t / 60,
    }));
  }, [ride.timeSeries]);

  const segmentComparison = [
    {
      segment: 'Early',
      value: ride.segments.early.normalizedPowerPctFtp ?? 0,
    },
    {
      segment: 'Late',
      value: ride.segments.late.normalizedPowerPctFtp ?? 0,
    },
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Power & heart rate over time</CardTitle>
          <CardDescription>
            Highlighted regions show the opening and closing thirds used for durability scoring.
          </CardDescription>
        </CardHeader>
        <CardContent className="h-[320px]">
          {timeSeries.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              No time-series data available for this ride.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timeSeries}>
                <defs>
                  <linearGradient id="powerGradient" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="minutes"
                  tickFormatter={(value) => `${value.toFixed(0)}m`}
                  className="text-xs"
                />
                <YAxis yAxisId="power" orientation="left" className="text-xs" width={48} />
                <YAxis yAxisId="hr" orientation="right" className="text-xs" width={48} />
                <Tooltip
                  contentStyle={{ fontSize: '0.75rem' }}
                  formatter={(value: number, key) => {
                    if (key === 'power') {
                      return [`${Math.round(value)} W`, 'Power'];
                    }
                    if (key === 'heartRate') {
                      return [`${Math.round(value)} bpm`, 'Heart rate'];
                    }
                    return [String(value), key];
                  }}
                  labelFormatter={(value) => `${value.toFixed(1)} min`}
                />
                <ReferenceArea x1={0} x2={earlyBoundary / 60} fill="var(--muted)" opacity={0.12} />
                <ReferenceArea
                  x1={lateBoundary / 60}
                  x2={ride.durationSec / 60}
                  fill="var(--muted)"
                  opacity={0.12}
                />
                <Area
                  type="monotone"
                  dataKey="power"
                  yAxisId="power"
                  stroke="var(--primary)"
                  fill="url(#powerGradient)"
                  name="Power"
                />
                <Line
                  type="monotone"
                  dataKey="heartRate"
                  yAxisId="hr"
                  stroke="hsl(var(--destructive))"
                  name="Heart rate"
                  dot={false}
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Early vs. late adjusted power</CardTitle>
          <CardDescription>Compare FTP-relative output across the opening and closing thirds.</CardDescription>
        </CardHeader>
        <CardContent className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={segmentComparison}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="segment" className="text-xs" />
              <YAxis className="text-xs" tickFormatter={(value) => `${value.toFixed(0)}%`} />
              <Tooltip
                formatter={(value: number) => [`${value.toFixed(1)}%`, 'AP vs FTP']}
                contentStyle={{ fontSize: '0.75rem' }}
              />
              <Bar dataKey="value" name="AP % FTP" fill="var(--primary)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Segment metrics</CardTitle>
          <CardDescription>Detailed breakdown across the early, middle, and late thirds.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Segment</TableHead>
                <TableHead>Adj. power (% FTP)</TableHead>
                <TableHead>Avg power (W)</TableHead>
                <TableHead>Avg HR (bpm)</TableHead>
                <TableHead>HR:Power</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(['early', 'middle', 'late'] as const).map((key) => {
                const segment = ride.segments[key];
                return (
                  <TableRow key={segment.label}>
                    <TableCell className="capitalize">{segment.label}</TableCell>
                    <TableCell>{formatNumber(segment.normalizedPowerPctFtp, 1)}</TableCell>
                    <TableCell>{formatNumber(segment.averagePowerWatts, 0)}</TableCell>
                    <TableCell>{formatNumber(segment.averageHeartRateBpm, 0)}</TableCell>
                    <TableCell>
                      {segment.heartRatePowerRatio != null
                        ? segment.heartRatePowerRatio.toFixed(3)
                        : '—'}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function ScatterAndTrend({ rides }: { rides: DurabilityRideAnalysis[] }) {
  const scatterData = useMemo(
    () =>
      rides.map((ride) => ({
        durationHours: ride.durationSec / 3600,
        score: ride.durabilityScore,
        label: `${formatDate(ride.startTime)} (${ride.source})`,
        startTime: new Date(ride.startTime).getTime(),
      })),
    [rides],
  );

  const trendData = useMemo(
    () =>
      [...rides]
        .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
        .map((ride) => ({
          date: formatDate(ride.startTime),
          score: ride.durabilityScore,
        })),
    [rides],
  );

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Duration vs. durability</CardTitle>
          <CardDescription>Each point represents a filtered ride.</CardDescription>
        </CardHeader>
        <CardContent className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="durationHours"
                name="Duration"
                tickFormatter={(value) => `${value.toFixed(1)}h`}
                className="text-xs"
              />
              <YAxis dataKey="score" name="Durability score" className="text-xs" domain={[0, 100]} />
              <Tooltip
                contentStyle={{ fontSize: '0.75rem' }}
                formatter={(value: number, key) => {
                  if (key === 'durationHours') {
                    return [`${value.toFixed(2)} h`, 'Duration'];
                  }
                  if (key === 'score') {
                    return [`${value.toFixed(0)}`, 'Durability score'];
                  }
                  return [String(value), key];
                }}
                labelFormatter={(_, payload) => payload?.[0]?.payload.label ?? ''}
              />
              <Scatter data={scatterData} fill="var(--primary)" />
            </ScatterChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Durability trend over time</CardTitle>
          <CardDescription>Track whether late-ride resilience is improving.</CardDescription>
        </CardHeader>
        <CardContent className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="date" interval="preserveStartEnd" className="text-xs" />
              <YAxis domain={[0, 100]} className="text-xs" />
              <Tooltip contentStyle={{ fontSize: '0.75rem' }} />
              <Legend wrapperStyle={{ fontSize: '0.75rem' }} />
              <Line type="monotone" dataKey="score" name="Durability score" stroke="var(--primary)" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

export function DurabilityAnalysisClient({
  initialData,
  defaultMinDurationMinutes = DEFAULT_MIN_DURATION_MINUTES,
}: DurabilityAnalysisClientProps) {
  const [pendingFilters, setPendingFilters] = useState<FiltersState>({
    minDurationMinutes: defaultMinDurationMinutes,
    startDate: undefined,
    endDate: undefined,
    discipline: undefined,
    keyword: undefined,
  });
  const [appliedFilters, setAppliedFilters] = useState<FiltersState>(pendingFilters);
  const [sort, setSort] = useState<SortState>({ key: 'date', direction: 'desc' });

  const { data, isLoading, error } = useDurabilityAnalysisData(appliedFilters, initialData);

  useEffect(() => {
    if (initialData) {
      const start = initialData.filters.startDate?.slice(0, 10);
      const end = initialData.filters.endDate?.slice(0, 10);
      setPendingFilters((current) => ({
        ...current,
        minDurationMinutes: Math.round(initialData.filters.minDurationSec / 60),
        startDate: start,
        endDate: end,
        discipline: initialData.filters.discipline,
        keyword: initialData.filters.keyword,
      }));
      setAppliedFilters((current) => ({
        ...current,
        minDurationMinutes: Math.round(initialData.filters.minDurationSec / 60),
        startDate: start,
        endDate: end,
        discipline: initialData.filters.discipline,
        keyword: initialData.filters.keyword,
      }));
    }
  }, [initialData]);

  const [selectedRideId, setSelectedRideId] = useState<string | null>(
    initialData?.rides?.[0]?.activityId ?? null,
  );

  useEffect(() => {
    if (!data?.rides) {
      setSelectedRideId(null);
      return;
    }
    if (!selectedRideId || !data.rides.find((ride) => ride.activityId === selectedRideId)) {
      setSelectedRideId(data.rides[0]?.activityId ?? null);
    }
  }, [data, selectedRideId]);

  const sortedRides = useMemo(() => {
    if (!data?.rides) {
      return [] as DurabilityRideAnalysis[];
    }
    return sortRides(data.rides, sort);
  }, [data, sort]);

  const selectedRide = useMemo(() => {
    if (!data?.rides || !selectedRideId) {
      return null;
    }
    return data.rides.find((ride) => ride.activityId === selectedRideId) ?? null;
  }, [data, selectedRideId]);

  function toggleSort(key: SortKey) {
    setSort((current) => {
      if (current.key === key) {
        return {
          key,
          direction: current.direction === 'asc' ? 'desc' : 'asc',
        };
      }
      return { key, direction: key === 'date' ? 'desc' : 'asc' };
    });
  }

  return (
    <div className="space-y-6">
      <FiltersPanel
        pending={pendingFilters}
        onChange={setPendingFilters}
        onSubmit={() => setAppliedFilters({ ...pendingFilters })}
        availableDisciplines={data?.disciplines ?? []}
      />

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Unable to load durability analysis</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      ) : null}

      {data?.ftpWatts == null ? (
        <Alert>
          <AlertTitle>Set your FTP to unlock full insights</AlertTitle>
          <AlertDescription>
            Enter your functional threshold power on the profile page to view FTP-relative durability
            metrics and scoring.
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader className="space-y-1">
          <CardTitle className="text-base font-semibold">Candidate rides</CardTitle>
          <CardDescription>
            {isLoading ? 'Updating ride list…' : `Showing ${sortedRides.length} rides that match the filters.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sortedRides.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No rides match the current filters. Widen the date range or reduce the minimum duration.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead
                    className="cursor-pointer"
                    onClick={() => toggleSort('date')}
                    aria-sort={sort.key === 'date' ? toAriaSort(sort.direction) : 'none'}
                  >
                    Date
                  </TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead
                    className="cursor-pointer"
                    onClick={() => toggleSort('duration')}
                    aria-sort={sort.key === 'duration' ? toAriaSort(sort.direction) : 'none'}
                  >
                    Duration
                  </TableHead>
                  <TableHead>Adj. power (W)</TableHead>
                  <TableHead>Avg HR</TableHead>
                  <TableHead
                    className="cursor-pointer"
                    onClick={() => toggleSort('score')}
                    aria-sort={sort.key === 'score' ? toAriaSort(sort.direction) : 'none'}
                  >
                    Durability score
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedRides.map((ride) => (
                  <TableRow
                    key={ride.activityId}
                    onClick={() => setSelectedRideId(ride.activityId)}
                    className={
                      selectedRideId === ride.activityId ? 'bg-muted/70 cursor-pointer' : 'cursor-pointer'
                    }
                    data-state={selectedRideId === ride.activityId ? 'selected' : undefined}
                  >
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium text-foreground">{formatDate(ride.startTime)}</span>
                        <span className="text-xs text-muted-foreground">{formatTimeOfDay(ride.startTime)}</span>
                      </div>
                    </TableCell>
                    <TableCell>{ride.source}</TableCell>
                    <TableCell>{formatDuration(ride.durationSec)}</TableCell>
                    <TableCell>{formatNumber(ride.normalizedPowerWatts, 0)}</TableCell>
                    <TableCell>{formatNumber(ride.averageHeartRateBpm, 0)}</TableCell>
                    <TableCell>
                      <ScoreBadge score={ride.durabilityScore} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableCaption>Click a ride to view detailed durability diagnostics and charts.</TableCaption>
            </Table>
          )}
        </CardContent>
      </Card>

      {selectedRide ? (
        <div className="space-y-6">
          <Card>
            <CardContent className="space-y-4 pt-6">
              <SummaryHeader ride={selectedRide} />
              <div className="grid gap-4 md:grid-cols-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Duration</p>
                  <p className="font-semibold text-foreground">{formatDuration(selectedRide.durationSec)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Training load (est)</p>
                  <p className="font-semibold text-foreground">{formatNumber(selectedRide.tss, 0)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Total energy</p>
                  <p className="font-semibold text-foreground">{formatNumber(selectedRide.totalKj, 1)} kJ</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Adjusted power</p>
                  <p className="font-semibold text-foreground">
                    {formatNumber(selectedRide.normalizedPowerWatts, 0)} W (
                    {formatNumber(selectedRide.normalizedPowerPctFtp, 1)}% FTP)
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <DurabilityCharts ride={selectedRide} />
        </div>
      ) : null}

      {data && data.rides.length > 0 ? <ScatterAndTrend rides={data.rides} /> : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Durability score formula</CardTitle>
          <CardDescription>How we translate the metrics above into a single 0–100 score.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            Scores start at 100 points. We subtract half a point for each percentage point drop in
            adjusted power (as % FTP) from the opening to closing thirds, and we deduct 0.75 points
            for every percentage point of positive heart-rate drift. To recognize strong finishes, we
            add half a point for every percentage point that the best 20-minute power in the final
            third exceeds FTP. The score is clamped between 0 and 100.
          </p>
          <p>
            These insights assume the rider maintained a steady pacing intent throughout the ride and
            leveraged the recorded FTP value. Large coasting sections or inaccurate FTP entries may
            skew the analysis.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
