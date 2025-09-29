'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useSession } from 'next-auth/react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { fetchPowerStream } from '../lib/api';
import {
  buildRecommendedZones,
  computeKjIntervalSummaries,
  type KjZoneSummary,
  type ZoneSettings,
  type ZoneRecommendation,
} from '../lib/kj-interval';
import { formatDuration } from '../lib/utils';
import type { ActivitySummary, PowerStreamSample } from '../types/activity';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';

interface KjIntervalTabProps {
  activities: ActivitySummary[];
  ftpEstimate: number | null;
}

type ZoneInput = {
  id: string;
  label: string;
  minWatts: number;
  maxWatts: number;
  minDurationSeconds: number;
  overshootRatio: number;
  overshootTolerancePercent: number;
};

type NumericZoneField =
  | 'minWatts'
  | 'maxWatts'
  | 'minDurationSeconds'
  | 'overshootRatio'
  | 'overshootTolerancePercent';

const ZONE_COLORS = ['#2563eb', '#22c55e', '#f97316', '#ef4444', '#a855f7', '#facc15'];

const TIMEFRAME_OPTIONS = [
  { id: '30d', label: 'Last 30 days', days: 30 },
  { id: '60d', label: 'Last 60 days', days: 60 },
  { id: '90d', label: 'Last 90 days', days: 90 },
  { id: '180d', label: 'Last 6 months', days: 180 },
  { id: '365d', label: 'Last 12 months', days: 365 },
  { id: 'all', label: 'All time', days: null },
] as const;

type TimeframeValue = (typeof TIMEFRAME_OPTIONS)[number]['id'];

interface TrendChartDatum {
  timestamp: number;
  activityId: string;
  activityLabel: string;
  [key: string]: string | number | null;
}

function toZoneInput(recommendation: ZoneRecommendation): ZoneInput {
  return {
    id: recommendation.id,
    label: recommendation.label,
    minWatts: recommendation.minWatts,
    maxWatts: recommendation.maxWatts,
    minDurationSeconds: recommendation.minDurationSeconds,
    overshootRatio: recommendation.overshootRatio,
    overshootTolerancePercent: recommendation.overshootTolerancePercent,
  };
}

function toZoneSettings(zones: ZoneInput[]): ZoneSettings[] {
  return zones.map((zone) => ({
    id: zone.id,
    label: zone.label,
    minWatts: Number.isFinite(zone.minWatts) ? zone.minWatts : 0,
    maxWatts: Number.isFinite(zone.maxWatts) ? zone.maxWatts : 0,
    minDurationSeconds: Math.max(0, Number.isFinite(zone.minDurationSeconds) ? zone.minDurationSeconds : 0),
    overshootRatio: Math.max(1, Number.isFinite(zone.overshootRatio) ? zone.overshootRatio : 1),
    overshootTolerance: Math.min(
      1,
      Math.max(0, Number.isFinite(zone.overshootTolerancePercent) ? zone.overshootTolerancePercent / 100 : 0),
    ),
  }));
}

function formatNumber(value: number, fractionDigits = 1) {
  if (!Number.isFinite(value)) {
    return '—';
  }
  return value.toLocaleString(undefined, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

function buildActivityLabel(activity: ActivitySummary) {
  const start = new Date(activity.startTime);
  const formatted = Number.isNaN(start.getTime()) ? activity.startTime : start.toLocaleString();
  const duration = formatDuration(activity.durationSec);
  return `${formatted} • ${duration}`;
}

export function KjIntervalTab({ activities, ftpEstimate }: KjIntervalTabProps) {
  const initialZones = useMemo(
    () => buildRecommendedZones(ftpEstimate ?? null).map(toZoneInput),
    [ftpEstimate],
  );
  const [zones, setZones] = useState<ZoneInput[]>(initialZones);
  const [ftpInput, setFtpInput] = useState<string>(
    ftpEstimate && ftpEstimate > 0 ? String(Math.round(ftpEstimate)) : '',
  );
  const [selectedActivityId, setSelectedActivityId] = useState<string>(activities[0]?.id ?? '');
  const [samples, setSamples] = useState<PowerStreamSample[] | null>(null);
  const [powerStreams, setPowerStreams] = useState<Record<string, PowerStreamSample[]>>({});
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [trendError, setTrendError] = useState<string | null>(null);
  const [trendLoading, setTrendLoading] = useState(false);
  const [timeframe, setTimeframe] = useState<TimeframeValue>('90d');
  const [movingAverageEnabled, setMovingAverageEnabled] = useState(false);
  const [movingAverageDaysInput, setMovingAverageDaysInput] = useState('7');
  const selectedActivity = useMemo(
    () => activities.find((activity) => activity.id === selectedActivityId) ?? null,
    [activities, selectedActivityId],
  );

  const { data: session, status } = useSession();

  const powerStreamPromises = useRef(new Map<string, Promise<PowerStreamSample[]>>());

  const movingAverageWindowDays = useMemo(() => {
    const parsed = Number.parseInt(movingAverageDaysInput, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return 1;
    }
    return Math.min(parsed, 365);
  }, [movingAverageDaysInput]);

  const loadPowerStream = useCallback(
    async (activityId: string) => {
      if (powerStreams[activityId]) {
        return powerStreams[activityId];
      }

      const existingPromise = powerStreamPromises.current.get(activityId);
      if (existingPromise) {
        return existingPromise;
      }

      const promise = fetchPowerStream(activityId, session?.accessToken)
        .then((response) => {
          setPowerStreams((previous) => {
            if (previous[activityId] === response.samples) {
              return previous;
            }
            return { ...previous, [activityId]: response.samples };
          });
          powerStreamPromises.current.delete(activityId);
          return response.samples;
        })
        .catch((error) => {
          powerStreamPromises.current.delete(activityId);
          throw error;
        });

      powerStreamPromises.current.set(activityId, promise);
      return promise;
    },
    [powerStreams, session?.accessToken],
  );

  useEffect(() => {
    setZones(initialZones);
  }, [initialZones]);

  useEffect(() => {
    if (!selectedActivityId) {
      setSamples(null);
      return;
    }
    const cached = powerStreams[selectedActivityId];
    if (cached) {
      setSamples(cached);
      setFetchError(null);
      setIsLoading(false);
      return;
    }
    if (status === 'loading') {
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setFetchError(null);

    loadPowerStream(selectedActivityId)
      .then((response) => {
        if (cancelled) {
          return;
        }
        setSamples(response);
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        const message = error instanceof Error ? error.message : 'Failed to load power stream.';
        setFetchError(message);
        setSamples(null);
      })
      .finally(() => {
        if (cancelled) {
          return;
        }
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedActivityId, powerStreams, loadPowerStream, status]);

  useEffect(() => {
    if (status === 'loading') {
      return;
    }

    const timeframeDefinition = TIMEFRAME_OPTIONS.find((option) => option.id === timeframe);
    const cutoff =
      timeframeDefinition?.days != null
        ? Date.now() - timeframeDefinition.days * 24 * 60 * 60 * 1000
        : Number.NEGATIVE_INFINITY;

    const relevantActivities = activities.filter((activity) => {
      const timestamp = new Date(activity.startTime).getTime();
      return Number.isFinite(timestamp) && timestamp >= cutoff;
    });

    const missing = relevantActivities
      .map((activity) => activity.id)
      .filter((activityId) => !powerStreams[activityId]);

    if (missing.length === 0) {
      setTrendLoading(false);
      return;
    }

    let cancelled = false;
    setTrendLoading(true);
    setTrendError(null);

    Promise.allSettled(missing.map((activityId) => loadPowerStream(activityId)))
      .then((results) => {
        if (cancelled) {
          return;
        }
        const failed = results.find((result) => result.status === 'rejected');
        if (failed) {
          const reason = failed.status === 'rejected' ? failed.reason : null;
          const message =
            reason instanceof Error ? reason.message : 'Failed to load one or more power streams.';
          setTrendError(message);
        }
      })
      .finally(() => {
        if (cancelled) {
          return;
        }
        setTrendLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activities, loadPowerStream, powerStreams, status, timeframe]);

  const zoneSettings = useMemo(() => toZoneSettings(zones), [zones]);

  useEffect(() => {
    setTrendError(null);
  }, [timeframe, zoneSettings]);

  const zoneSummaries: KjZoneSummary[] = useMemo(() => {
    if (!samples || samples.length === 0) {
      return zoneSettings.map((zone) => ({
        zoneId: zone.id,
        zoneLabel: zone.label,
        totalDurationSec: 0,
        totalInZoneDurationSec: 0,
        totalEnergyKj: 0,
        intervalCount: 0,
        intervals: [],
      }));
    }
    return computeKjIntervalSummaries(samples, zoneSettings);
  }, [samples, zoneSettings]);

  const allIntervals = useMemo(() => {
    return zoneSummaries
      .flatMap((summary) => summary.intervals)
      .sort((a, b) => a.startSec - b.startSec);
  }, [zoneSummaries]);

  const totalZoneDurationSec = useMemo(
    () => zoneSummaries.reduce((total, summary) => total + summary.totalDurationSec, 0),
    [zoneSummaries],
  );
  const totalInZoneDurationSec = useMemo(
    () => zoneSummaries.reduce((total, summary) => total + summary.totalInZoneDurationSec, 0),
    [zoneSummaries],
  );
  const totalZoneEnergyKj = useMemo(
    () => zoneSummaries.reduce((total, summary) => total + summary.totalEnergyKj, 0),
    [zoneSummaries],
  );
  const totalOvershootDurationSec = Math.max(0, totalZoneDurationSec - totalInZoneDurationSec);
  const totalIntervals = allIntervals.length;
  const averageIntervalPower =
    totalZoneDurationSec > 0 ? (totalZoneEnergyKj * 1000) / totalZoneDurationSec : null;
  const selectedActivityDuration = selectedActivity?.durationSec ?? null;
  const qualifyingShareOfRide =
    selectedActivityDuration != null && selectedActivityDuration > 0
      ? (totalZoneDurationSec / selectedActivityDuration) * 100
      : null;
  const inZoneShareOfQualifying =
    totalZoneDurationSec > 0 ? (totalInZoneDurationSec / totalZoneDurationSec) * 100 : null;
  const overshootShareOfQualifying =
    totalZoneDurationSec > 0 ? (totalOvershootDurationSec / totalZoneDurationSec) * 100 : null;

  const longestInterval = useMemo(() => {
    if (allIntervals.length === 0) {
      return null;
    }
    return allIntervals.reduce((previous, current) =>
      current.durationSec > previous.durationSec ? current : previous,
    );
  }, [allIntervals]);

  const highestEnergyInterval = useMemo(() => {
    if (allIntervals.length === 0) {
      return null;
    }
    return allIntervals.reduce((previous, current) =>
      current.energyKj > previous.energyKj ? current : previous,
    );
  }, [allIntervals]);

  const ftpNumber = Number.parseFloat(ftpInput);

  const timeframeActivities = useMemo(() => {
    const timeframeDefinition = TIMEFRAME_OPTIONS.find((option) => option.id === timeframe);
    const cutoff =
      timeframeDefinition?.days != null
        ? Date.now() - timeframeDefinition.days * 24 * 60 * 60 * 1000
        : Number.NEGATIVE_INFINITY;

    return activities
      .filter((activity) => {
        const timestamp = new Date(activity.startTime).getTime();
        return Number.isFinite(timestamp) && timestamp >= cutoff;
      })
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  }, [activities, timeframe]);

  const dateFormatter = useMemo(
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
        hour: '2-digit',
        minute: '2-digit',
      }),
    [],
  );

  const trendChartData: TrendChartDatum[] = useMemo(() => {
    if (timeframeActivities.length === 0 || zoneSettings.length === 0) {
      return [];
    }

    const data: TrendChartDatum[] = [];

    for (const activity of timeframeActivities) {
      const samplesForActivity = powerStreams[activity.id];
      if (!samplesForActivity) {
        continue;
      }

      const summaries = computeKjIntervalSummaries(samplesForActivity, zoneSettings);
      const timestamp = new Date(activity.startTime).getTime();
      if (!Number.isFinite(timestamp)) {
        continue;
      }

      const datum: TrendChartDatum = {
        timestamp,
        activityId: activity.id,
        activityLabel: buildActivityLabel(activity),
      };

      for (const zone of zoneSettings) {
        const summary = summaries.find((entry) => entry.zoneId === zone.id);
        const energy = summary?.totalEnergyKj ?? 0;
        datum[zone.id] = Number.isFinite(energy) ? Number(energy.toFixed(2)) : 0;
      }

      data.push(datum);
    }

    data.sort((a, b) => a.timestamp - b.timestamp);

    if (data.length === 0) {
      return data;
    }

    if (movingAverageEnabled) {
      const windowMs = movingAverageWindowDays * 24 * 60 * 60 * 1000;
      for (const zone of zoneSettings) {
        let startIndex = 0;
        let sum = 0;
        for (let index = 0; index < data.length; index += 1) {
          const current = data[index];
          const value = typeof current[zone.id] === 'number' ? (current[zone.id] as number) : 0;
          sum += value;

          while (
            startIndex <= index &&
            data[index].timestamp - data[startIndex].timestamp > windowMs
          ) {
            const removal =
              typeof data[startIndex][zone.id] === 'number'
                ? (data[startIndex][zone.id] as number)
                : 0;
            sum -= removal;
            startIndex += 1;
          }

          const count = index - startIndex + 1;
          const average = count > 0 ? sum / count : 0;
          current[`${zone.id}_ma`] = Number(average.toFixed(2));
        }
      }
    }

    return data;
  }, [movingAverageEnabled, movingAverageWindowDays, powerStreams, timeframeActivities, zoneSettings]);

  const hasTrendData = trendChartData.length > 0;

  const handleReset = () => {
    const recommended = buildRecommendedZones(
      Number.isFinite(ftpNumber) && ftpNumber > 0 ? ftpNumber : ftpEstimate ?? null,
    ).map(toZoneInput);
    setZones(recommended);
  };

  const handleZoneChange = (
    zoneId: string,
    field: NumericZoneField,
    value: number,
  ) => {
    setZones((prev) =>
      prev.map((zone) => {
        if (zone.id !== zoneId) {
          return zone;
        }
        const numericValue = Number.isFinite(value) ? value : zone[field];
        const clamped = (() => {
          if (field === 'overshootTolerancePercent') {
            return Math.min(100, Math.max(0, numericValue));
          }
          if (field === 'minDurationSeconds' || field === 'minWatts' || field === 'maxWatts') {
            return Math.max(0, numericValue);
          }
          if (field === 'overshootRatio') {
            return Math.max(1, numericValue);
          }
          return numericValue;
        })();
        return { ...zone, [field]: clamped } as ZoneInput;
      }),
    );
  };

  const hasIntervals = allIntervals.length > 0;

  const formatPercent = (value: number | null) => {
    if (value == null || !Number.isFinite(value)) {
      return '—';
    }
    return `${formatNumber(value, 1)}%`;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Configure detection</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="flex flex-col gap-1 text-sm font-medium" htmlFor="kj-ftp-input">
                FTP estimate (W)
                <Input
                  id="kj-ftp-input"
                  type="number"
                  min={0}
                  step="1"
                  value={ftpInput}
                  onChange={(event) => setFtpInput(event.target.value)}
                  placeholder="Enter FTP estimate"
                />
              </label>
              <Button variant="secondary" onClick={handleReset}>
                Reset to recommended
              </Button>
            </div>
            <div className="space-y-2">
              <label className="flex flex-col gap-1 text-sm font-medium" htmlFor="kj-activity-select">
                Activity
                <select
                  id="kj-activity-select"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  value={selectedActivityId}
                  onChange={(event) => setSelectedActivityId(event.target.value)}
                >
                  <option value="">Select activity</option>
                  {activities.map((activity) => (
                    <option key={activity.id} value={activity.id}>
                      {buildActivityLabel(activity)}
                    </option>
                  ))}
                </select>
              </label>
              <p className="text-xs text-muted-foreground">
                Choose a ride to evaluate contiguous time-in-zone blocks using the settings below.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Zone</TableHead>
                  <TableHead>Min W</TableHead>
                  <TableHead>Max W</TableHead>
                  <TableHead>Min duration (s)</TableHead>
                  <TableHead>Overshoot ×</TableHead>
                  <TableHead>Allowed overshoot %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {zones.map((zone) => (
                  <TableRow key={zone.id}>
                    <TableCell className="font-medium">{zone.label}</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={zone.minWatts}
                        min={0}
                        step="1"
                        onChange={(event) =>
                          handleZoneChange(zone.id, 'minWatts', Number.parseFloat(event.target.value))
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={zone.maxWatts}
                        min={0}
                        step="1"
                        onChange={(event) =>
                          handleZoneChange(zone.id, 'maxWatts', Number.parseFloat(event.target.value))
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={zone.minDurationSeconds}
                        min={0}
                        step="1"
                        onChange={(event) =>
                          handleZoneChange(zone.id, 'minDurationSeconds', Number.parseFloat(event.target.value))
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={zone.overshootRatio}
                        min={1}
                        step="0.1"
                        onChange={(event) =>
                          handleZoneChange(zone.id, 'overshootRatio', Number.parseFloat(event.target.value))
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={zone.overshootTolerancePercent}
                        min={0}
                        max={100}
                        step="1"
                        onChange={(event) =>
                          handleZoneChange(
                            zone.id,
                            'overshootTolerancePercent',
                            Number.parseFloat(event.target.value),
                          )
                        }
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Trend analysis</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex flex-col gap-1 text-sm font-medium">
              <label htmlFor="kj-timeframe-select">Timeframe</label>
              <select
                id="kj-timeframe-select"
                className="h-10 min-w-[180px] rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
                value={timeframe}
                onChange={(event) => setTimeframe(event.target.value as TimeframeValue)}
              >
                {TIMEFRAME_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={movingAverageEnabled}
                onChange={(event) => setMovingAverageEnabled(event.target.checked)}
              />
              Show moving average
            </label>
            <div className="flex flex-col gap-1 text-sm font-medium">
              <label htmlFor="kj-moving-average-days">Moving average window (days)</label>
              <Input
                id="kj-moving-average-days"
                type="number"
                min={1}
                max={365}
                step="1"
                value={movingAverageDaysInput}
                onChange={(event) => setMovingAverageDaysInput(event.target.value)}
                disabled={!movingAverageEnabled}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Trend data loads each ride&apos;s power stream. Longer ranges may take more time to fetch.
          </p>
          {trendLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Loading trend data...
            </div>
          ) : null}
          {trendError ? (
            <Alert variant="destructive">
              <AlertTitle>Unable to load all trend data</AlertTitle>
              <AlertDescription>{trendError}</AlertDescription>
            </Alert>
          ) : null}
          {!hasTrendData && !trendLoading ? (
            <p className="text-sm text-muted-foreground">
              Select a timeframe with activities containing power data to visualize zone energy trends.
            </p>
          ) : null}
          {hasTrendData ? (
            <div className="h-[360px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendChartData} margin={{ top: 12, right: 24, left: 12, bottom: 12 }}>
                  <CartesianGrid strokeDasharray="4 4" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="timestamp"
                    type="number"
                    domain={['auto', 'auto']}
                    tickFormatter={(value) => dateFormatter.format(new Date(value))}
                  />
                  <YAxis tickFormatter={(value) => `${formatNumber(value as number, 0)}`} />
                  <Tooltip
                    labelFormatter={(value, payload) => {
                      const first = payload && payload[0]?.payload;
                      if (first && typeof first === 'object' && 'activityLabel' in first) {
                        return String(first.activityLabel);
                      }
                      return fullDateFormatter.format(new Date(value));
                    }}
                    formatter={(value, name) => {
                      if (typeof value !== 'number') {
                        return [value, name];
                      }
                      return [`${formatNumber(value, 1)} kJ`, String(name)];
                    }}
                  />
                  <Legend />
                  {zoneSettings.map((zone, index) => (
                    <Line
                      key={zone.id}
                      type="monotone"
                      dataKey={zone.id}
                      name={zone.label}
                      stroke={ZONE_COLORS[index % ZONE_COLORS.length]}
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                    />
                  ))}
                  {movingAverageEnabled
                    ? zoneSettings.map((zone, index) => (
                        <Line
                          key={`${zone.id}-ma`}
                          type="monotone"
                          dataKey={`${zone.id}_ma`}
                          name={`${zone.label} (avg)`}
                          stroke={ZONE_COLORS[index % ZONE_COLORS.length]}
                          strokeWidth={2}
                          strokeDasharray="6 6"
                          dot={false}
                          isAnimationActive={false}
                        />
                      ))
                    : null}
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {fetchError ? (
        <Alert variant="destructive">
          <AlertTitle>Unable to load power stream</AlertTitle>
          <AlertDescription>{fetchError}</AlertDescription>
        </Alert>
      ) : null}

      {selectedActivity ? (
        <Card>
          <CardHeader>
            <CardTitle>Selected activity overview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-muted-foreground">
              {buildActivityLabel(selectedActivity)}
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border border-border bg-muted/40 p-3">
                <div className="text-xs uppercase text-muted-foreground">Ride duration</div>
                <div className="text-lg font-semibold">
                  {formatDuration(selectedActivity.durationSec)}
                </div>
              </div>
              <div className="rounded-lg border border-border bg-muted/40 p-3">
                <div className="text-xs uppercase text-muted-foreground">Qualifying time</div>
                <div className="text-lg font-semibold">
                  {formatDuration(totalZoneDurationSec)}
                </div>
                <div className="text-xs text-muted-foreground">
                  Share of ride: {formatPercent(qualifyingShareOfRide)}
                </div>
              </div>
              <div className="rounded-lg border border-border bg-muted/40 p-3">
                <div className="text-xs uppercase text-muted-foreground">In-zone time</div>
                <div className="text-lg font-semibold">
                  {formatDuration(totalInZoneDurationSec)}
                </div>
                <div className="text-xs text-muted-foreground">
                  Of qualifying time: {formatPercent(inZoneShareOfQualifying)}
                </div>
              </div>
              <div className="rounded-lg border border-border bg-muted/40 p-3">
                <div className="text-xs uppercase text-muted-foreground">Overshoot time</div>
                <div className="text-lg font-semibold">
                  {formatDuration(totalOvershootDurationSec)}
                </div>
                <div className="text-xs text-muted-foreground">
                  Of qualifying time: {formatPercent(overshootShareOfQualifying)}
                </div>
              </div>
              <div className="rounded-lg border border-border bg-muted/40 p-3">
                <div className="text-xs uppercase text-muted-foreground">Total energy</div>
                <div className="text-lg font-semibold">
                  {formatNumber(totalZoneEnergyKj, 1)} kJ
                </div>
              </div>
              <div className="rounded-lg border border-border bg-muted/40 p-3">
                <div className="text-xs uppercase text-muted-foreground">Average power</div>
                <div className="text-lg font-semibold">
                  {averageIntervalPower ? `${formatNumber(averageIntervalPower, 0)} W` : '—'}
                </div>
              </div>
              <div className="rounded-lg border border-border bg-muted/40 p-3">
                <div className="text-xs uppercase text-muted-foreground">Intervals found</div>
                <div className="text-lg font-semibold">{totalIntervals}</div>
              </div>
            </div>
            {totalIntervals > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {longestInterval ? (
                  <div className="rounded-lg border border-border bg-background p-4">
                    <div className="text-sm font-semibold">Longest interval</div>
                    <div className="text-xs text-muted-foreground">{longestInterval.zoneLabel}</div>
                    <div className="mt-2 text-sm">
                      {formatDuration(longestInterval.durationSec)} from {formatNumber(longestInterval.startSec, 0)}s to{' '}
                      {formatNumber(longestInterval.endSec, 0)}s
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Avg {formatNumber(longestInterval.averagePower, 0)} W • {formatNumber(longestInterval.energyKj, 1)} kJ
                    </div>
                  </div>
                ) : null}
                {highestEnergyInterval ? (
                  <div className="rounded-lg border border-border bg-background p-4">
                    <div className="text-sm font-semibold">Highest energy interval</div>
                    <div className="text-xs text-muted-foreground">{highestEnergyInterval.zoneLabel}</div>
                    <div className="mt-2 text-sm">
                      {formatNumber(highestEnergyInterval.energyKj, 1)} kJ over{' '}
                      {formatDuration(highestEnergyInterval.durationSec)}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Avg {formatNumber(highestEnergyInterval.averagePower, 0)} W • Overshoot{' '}
                      {formatPercent(highestEnergyInterval.overshootFraction * 100)}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Load an activity with power data to see time-in-zone and interval highlights.
              </p>
            )}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Zone summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Loading power stream...
            </div>
          ) : null}
          {!isLoading && (!samples || samples.length === 0) ? (
            <p className="text-sm text-muted-foreground">
              Select an activity with power data to calculate kilojoules per zone.
            </p>
          ) : null}
          {samples && samples.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Zone</TableHead>
                    <TableHead>Intervals</TableHead>
                    <TableHead>Total time</TableHead>
                    <TableHead>In-zone time</TableHead>
                    <TableHead>Overshoot time</TableHead>
                    <TableHead>Total kJ</TableHead>
                    <TableHead>Avg power (W)</TableHead>
                    <TableHead>Avg interval</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {zoneSummaries.map((summary) => (
                    <TableRow key={summary.zoneId}>
                      <TableCell className="font-medium">{summary.zoneLabel}</TableCell>
                      <TableCell>{summary.intervalCount}</TableCell>
                      <TableCell>{formatDuration(summary.totalDurationSec)}</TableCell>
                      <TableCell>{formatDuration(summary.totalInZoneDurationSec)}</TableCell>
                      <TableCell>
                        {formatDuration(Math.max(0, summary.totalDurationSec - summary.totalInZoneDurationSec))}
                      </TableCell>
                      <TableCell>{formatNumber(summary.totalEnergyKj, 1)}</TableCell>
                      <TableCell>
                        {summary.totalDurationSec > 0
                          ? formatNumber((summary.totalEnergyKj * 1000) / summary.totalDurationSec, 0)
                          : '—'}
                      </TableCell>
                      <TableCell>
                        {summary.intervalCount > 0
                          ? formatDuration(summary.totalDurationSec / summary.intervalCount)
                          : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Interval details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!hasIntervals ? (
            <p className="text-sm text-muted-foreground">
              Adjust your detection settings or choose a different activity to identify qualifying blocks.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                  <TableHead>Zone</TableHead>
                  <TableHead>Start (s)</TableHead>
                  <TableHead>End (s)</TableHead>
                  <TableHead>Total duration</TableHead>
                  <TableHead>In-zone</TableHead>
                  <TableHead>Overshoot</TableHead>
                  <TableHead>Avg power (W)</TableHead>
                  <TableHead>kJ</TableHead>
                  <TableHead>Overshoot %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allIntervals.map((interval) => (
                  <TableRow key={`${interval.zoneId}-${interval.startSec}-${interval.endSec}`}>
                    <TableCell className="font-medium">{interval.zoneLabel}</TableCell>
                    <TableCell>{formatNumber(interval.startSec, 0)}</TableCell>
                    <TableCell>{formatNumber(interval.endSec, 0)}</TableCell>
                    <TableCell>{formatDuration(interval.durationSec)}</TableCell>
                    <TableCell>{formatDuration(interval.inZoneDurationSec)}</TableCell>
                    <TableCell>{formatDuration(interval.overshootDurationSec)}</TableCell>
                    <TableCell>{formatNumber(interval.averagePower, 0)}</TableCell>
                    <TableCell>{formatNumber(interval.energyKj, 1)}</TableCell>
                    <TableCell>{formatNumber(interval.overshootFraction * 100, 1)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
