'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useSession } from 'next-auth/react';

import { fetchActivityComparison } from '../lib/api';
import { formatDuration } from '../lib/utils';
import type {
  ActivitySummary,
  ActivityComparisonResponse,
  ClimbProfilePoint,
  WPrimeBalancePoint,
} from '../types/activity';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Badge } from './ui/badge';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface ActivityComparisonClientProps {
  activities: ActivitySummary[];
}

function combineClimbSeries(
  first: ClimbProfilePoint[],
  second: ClimbProfilePoint[],
) {
  const map = new Map<number, { distance: number; firstElevation?: number; secondElevation?: number }>();

  const insert = (
    point: ClimbProfilePoint,
    key: 'firstElevation' | 'secondElevation',
  ) => {
    const rounded = Number(point.distanceKm.toFixed(3));
    const existing = map.get(rounded) ?? { distance: rounded };
    existing[key] = point.elevationM;
    map.set(rounded, existing);
  };

  first.forEach((point) => insert(point, 'firstElevation'));
  second.forEach((point) => insert(point, 'secondElevation'));

  return Array.from(map.values()).sort((a, b) => a.distance - b.distance);
}

function combineWPrimeSeries(first: WPrimeBalancePoint[], second: WPrimeBalancePoint[]) {
  const map = new Map<number, { elapsedSec: number; first?: number; second?: number }>();

  const insert = (
    point: WPrimeBalancePoint,
    key: 'first' | 'second',
  ) => {
    const existing = map.get(point.elapsedSec) ?? { elapsedSec: point.elapsedSec };
    existing[key] = point.balanceJ;
    map.set(point.elapsedSec, existing);
  };

  first.forEach((point) => insert(point, 'first'));
  second.forEach((point) => insert(point, 'second'));

  return Array.from(map.values()).sort((a, b) => a.elapsedSec - b.elapsedSec);
}

function interpolateTime(profile: ClimbProfilePoint[], targetDistanceKm: number) {
  if (profile.length === 0) {
    return null;
  }

  const sorted = [...profile].sort((a, b) => a.distanceKm - b.distanceKm);

  if (targetDistanceKm <= sorted[0]!.distanceKm) {
    return sorted[0]!.elapsedSec;
  }

  for (let index = 1; index < sorted.length; index += 1) {
    const previous = sorted[index - 1]!;
    const current = sorted[index]!;
    if (current.distanceKm >= targetDistanceKm) {
      const spanDistance = current.distanceKm - previous.distanceKm;
      const spanTime = current.elapsedSec - previous.elapsedSec;
      if (spanDistance === 0) {
        return current.elapsedSec;
      }
      const ratio = (targetDistanceKm - previous.distanceKm) / spanDistance;
      return previous.elapsedSec + ratio * spanTime;
    }
  }

  return null;
}

function formatSeconds(seconds: number | null | undefined) {
  if (seconds == null || Number.isNaN(seconds)) {
    return '—';
  }
  const absolute = Math.abs(seconds);
  const minutes = Math.floor(absolute / 60);
  const remainder = Math.round(absolute % 60);
  const sign = seconds < 0 ? '-' : '';
  if (minutes === 0) {
    return `${sign}${remainder}s`;
  }
  return `${sign}${minutes}m ${remainder}s`;
}

function formatNumber(value: number | null | undefined, fractionDigits = 1) {
  if (value == null || Number.isNaN(value)) {
    return '—';
  }
  return Number.parseFloat(value.toFixed(fractionDigits)).toLocaleString();
}

export function ActivityComparisonClient({ activities }: ActivityComparisonClientProps) {
  const { data: session } = useSession();
  const [firstId, setFirstId] = useState<string>(() => activities[0]?.id ?? '');
  const [secondId, setSecondId] = useState<string>(() => activities[1]?.id ?? activities[0]?.id ?? '');
  const [comparison, setComparison] = useState<ActivityComparisonResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetchedIds, setLastFetchedIds] = useState<{ first: string; second: string } | null>(null);

  useEffect(() => {
    if (!firstId || !secondId || firstId === secondId) {
      setComparison(null);
      setError(null);
      return;
    }

    if (lastFetchedIds && lastFetchedIds.first === firstId && lastFetchedIds.second === secondId) {
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    fetchActivityComparison(firstId, secondId, session?.accessToken)
      .then((response) => {
        if (cancelled) {
          return;
        }
        setComparison(response);
        setLastFetchedIds({ first: firstId, second: secondId });
      })
      .catch((err) => {
        if (cancelled) {
          return;
        }
        const message = err instanceof Error ? err.message : 'Unable to compare activities';
        setError(message);
        setComparison(null);
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [firstId, secondId, session?.accessToken, lastFetchedIds]);

  const combinedClimb = useMemo(() => {
    if (!comparison) {
      return [];
    }
    return combineClimbSeries(comparison.first.climbProfile, comparison.second.climbProfile);
  }, [comparison]);

  const combinedWPrime = useMemo(() => {
    if (!comparison) {
      return [];
    }
    return combineWPrimeSeries(comparison.first.wPrimeBalance, comparison.second.wPrimeBalance);
  }, [comparison]);

  const distanceMilestones = useMemo(() => {
    if (!comparison) {
      return [];
    }
    const maxSharedDistance = Math.min(
      comparison.first.totalDistanceKm ?? 0,
      comparison.second.totalDistanceKm ?? 0,
    );

    if (maxSharedDistance === 0) {
      return [];
    }

    const fractions = [0.25, 0.5, 0.75, 1];
    return fractions
      .map((fraction) => {
        const targetDistance = maxSharedDistance * fraction;
        const firstTime = interpolateTime(comparison.first.climbProfile, targetDistance);
        const secondTime = interpolateTime(comparison.second.climbProfile, targetDistance);
        if (firstTime == null || secondTime == null) {
          return null;
        }
        return {
          label: `${(targetDistance * 1000).toFixed(0)} m`,
          firstTime,
          secondTime,
          gap: secondTime - firstTime,
        };
      })
      .filter((entry): entry is { label: string; firstTime: number; secondTime: number; gap: number } => entry != null);
  }, [comparison]);

  const summaryCards = useMemo(() => {
    if (!comparison) {
      return null;
    }
    const cards = [
      {
        title: 'Average power gap',
        value: formatNumber(
          (comparison.second.averagePower ?? 0) - (comparison.first.averagePower ?? 0),
          1,
        ),
        description: `${formatNumber(comparison.first.averagePower, 1)} W vs ${formatNumber(
          comparison.second.averagePower,
          1,
        )} W`,
      },
      {
        title: 'Average HR gap',
        value: formatNumber(
          (comparison.second.averageHeartRate ?? 0) - (comparison.first.averageHeartRate ?? 0),
          1,
        ),
        description: `${formatNumber(comparison.first.averageHeartRate, 1)} bpm vs ${formatNumber(
          comparison.second.averageHeartRate,
          1,
        )} bpm`,
      },
      {
        title: 'Duration gap',
        value: formatSeconds(
          comparison.second.activity.durationSec - comparison.first.activity.durationSec,
        ),
        description: `${formatDuration(comparison.first.activity.durationSec)} vs ${formatDuration(
          comparison.second.activity.durationSec,
        )}`,
      },
      {
        title: "W' capacity gap",
        value: formatNumber(comparison.second.wPrimeCapacity - comparison.first.wPrimeCapacity, 0),
        description: `${formatNumber(comparison.first.wPrimeCapacity, 0)} J vs ${formatNumber(
          comparison.second.wPrimeCapacity,
          0,
        )} J`,
      },
    ];
    return cards;
  }, [comparison]);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Compare activities</h1>
        <p className="text-muted-foreground">
          Overlay power, heart rate, and climb profiles to understand how two rides differed.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Select rides to compare</CardTitle>
          <CardDescription>Choose two different activities to unlock comparison charts.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="first-activity" className="text-sm font-medium text-foreground">
              Reference activity
            </label>
            <select
              id="first-activity"
              className="flex h-10 w-full items-center rounded-md border border-input bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
              value={firstId}
              onChange={(event) => setFirstId(event.target.value)}
            >
              {activities.map((activity) => (
                <option key={activity.id} value={activity.id}>
                  {new Date(activity.startTime).toLocaleString()} · {formatDuration(activity.durationSec)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label htmlFor="second-activity" className="text-sm font-medium text-foreground">
              Comparison activity
            </label>
            <select
              id="second-activity"
              className="flex h-10 w-full items-center rounded-md border border-input bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
              value={secondId}
              onChange={(event) => setSecondId(event.target.value)}
            >
              {activities.map((activity) => (
                <option key={activity.id} value={activity.id}>
                  {new Date(activity.startTime).toLocaleString()} · {formatDuration(activity.durationSec)}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {firstId && secondId && firstId === secondId ? (
        <Alert variant="destructive">
          <AlertTitle>Select two distinct activities</AlertTitle>
          <AlertDescription>Pick a different ride in each dropdown to enable comparisons.</AlertDescription>
        </Alert>
      ) : null}

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Unable to compare activities</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Loading comparison data…</span>
        </div>
      ) : null}

      {comparison ? (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold">Reference ride</CardTitle>
                <CardDescription>
                  {new Date(comparison.first.activity.startTime).toLocaleString()} ·{' '}
                  {formatDuration(comparison.first.activity.durationSec)}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>
                  Avg power: <span className="font-medium text-foreground">
                    {formatNumber(comparison.first.averagePower, 1)} W
                  </span>
                </p>
                <p>
                  Avg heart rate:{' '}
                  <span className="font-medium text-foreground">
                    {formatNumber(comparison.first.averageHeartRate, 1)} bpm
                  </span>
                </p>
                <p>
                  Estimated CP:{' '}
                  <span className="font-medium text-foreground">
                    {formatNumber(comparison.first.cpEstimate, 1)} W
                  </span>
                </p>
                <p>
                  W&apos; capacity:{' '}
                  <span className="font-medium text-foreground">
                    {formatNumber(comparison.first.wPrimeCapacity, 0)} J
                  </span>
                </p>
                <p>
                  Distance analyzed:{' '}
                  <span className="font-medium text-foreground">
                    {formatNumber(comparison.first.totalDistanceKm, 2)} km
                  </span>
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold">Comparison ride</CardTitle>
                <CardDescription>
                  {new Date(comparison.second.activity.startTime).toLocaleString()} ·{' '}
                  {formatDuration(comparison.second.activity.durationSec)}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>
                  Avg power: <span className="font-medium text-foreground">
                    {formatNumber(comparison.second.averagePower, 1)} W
                  </span>
                </p>
                <p>
                  Avg heart rate:{' '}
                  <span className="font-medium text-foreground">
                    {formatNumber(comparison.second.averageHeartRate, 1)} bpm
                  </span>
                </p>
                <p>
                  Estimated CP:{' '}
                  <span className="font-medium text-foreground">
                    {formatNumber(comparison.second.cpEstimate, 1)} W
                  </span>
                </p>
                <p>
                  W&apos; capacity:{' '}
                  <span className="font-medium text-foreground">
                    {formatNumber(comparison.second.wPrimeCapacity, 0)} J
                  </span>
                </p>
                <p>
                  Distance analyzed:{' '}
                  <span className="font-medium text-foreground">
                    {formatNumber(comparison.second.totalDistanceKm, 2)} km
                  </span>
                </p>
              </CardContent>
            </Card>
          </div>

          {summaryCards ? (
            <div className="grid gap-4 md:grid-cols-4">
              {summaryCards.map((card) => (
                <Card key={card.title}>
                  <CardHeader>
                    <CardTitle className="text-base font-semibold">{card.title}</CardTitle>
                    <CardDescription>{card.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold text-foreground">{card.value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">Power vs heart rate overlay</CardTitle>
              <CardDescription>
                Compare how each ride balanced cardiovascular strain and power output.
              </CardDescription>
            </CardHeader>
            <CardContent className="h-[360px]">
              {comparison.first.powerHeartRate.length > 0 ||
              comparison.second.powerHeartRate.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 16, right: 24, bottom: 16, left: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" dataKey="power" name="Power" unit="W" />
                    <YAxis type="number" dataKey="heartRate" name="Heart rate" unit="bpm" />
                    <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                    <Legend />
                    <Scatter
                      name="Reference"
                      data={comparison.first.powerHeartRate}
                      fill="hsl(var(--primary))"
                      shape="circle"
                    />
                    <Scatter
                      name="Comparison"
                      data={comparison.second.powerHeartRate}
                      fill="hsl(var(--secondary))"
                      shape="triangle"
                    />
                  </ScatterChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Upload rides with power and heart rate data to unlock this overlay.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">Climb profile comparison</CardTitle>
              <CardDescription>
                Elevation versus distance for both rides. Use it to spot pacing differences on the climb.
              </CardDescription>
            </CardHeader>
            <CardContent className="h-[360px]">
              {combinedClimb.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={combinedClimb} margin={{ top: 16, right: 24, bottom: 16, left: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="distance"
                      unit="km"
                      label={{ value: 'Distance', position: 'insideBottom', offset: -8 }}
                    />
                    <YAxis
                      unit="m"
                      label={{ value: 'Elevation', angle: -90, position: 'insideLeft' }}
                    />
                    <Tooltip
                      formatter={(value: unknown) =>
                        typeof value === 'number' ? `${value.toFixed(1)} m` : String(value ?? '')
                      }
                      labelFormatter={(label) => `${label.toFixed(2)} km`}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="firstElevation"
                      name="Reference"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="secondElevation"
                      name="Comparison"
                      stroke="hsl(var(--secondary-foreground))"
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Elevation and speed samples are required to build a climb profile for comparison.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle className="text-base font-semibold">Difference view</CardTitle>
                <CardDescription>
                  Track time gaps at key distances and compare W&apos; balance trajectories between rides.
                </CardDescription>
              </div>
              <Badge variant="outline">Beta</Badge>
            </CardHeader>
            <CardContent className="space-y-6">
              {distanceMilestones.length > 0 ? (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-foreground">Time gaps</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Distance</TableHead>
                        <TableHead>Reference time</TableHead>
                        <TableHead>Comparison time</TableHead>
                        <TableHead>Gap</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {distanceMilestones.map((milestone) => (
                        <TableRow key={milestone.label}>
                          <TableCell>{milestone.label}</TableCell>
                          <TableCell>{formatSeconds(milestone.firstTime)}</TableCell>
                          <TableCell>{formatSeconds(milestone.secondTime)}</TableCell>
                          <TableCell className={
                            milestone.gap < 0
                              ? 'text-green-600 dark:text-green-400'
                              : milestone.gap > 0
                                ? 'text-destructive'
                                : 'text-foreground'
                          }>
                            {formatSeconds(milestone.gap)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  We need distance-aligned elevation data in both rides to compute time gaps.
                </p>
              )}

              <div className="h-[320px]">
                {combinedWPrime.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={combinedWPrime} margin={{ top: 16, right: 24, bottom: 16, left: 16 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="elapsedSec"
                        label={{ value: 'Elapsed time (s)', position: 'insideBottom', offset: -8 }}
                      />
                      <YAxis
                        unit="J"
                        label={{ value: "W' balance", angle: -90, position: 'insideLeft' }}
                      />
                      <Tooltip
                        formatter={(value: unknown) =>
                          typeof value === 'number' ? `${value.toFixed(0)} J` : String(value ?? '')
                        }
                        labelFormatter={(value) => `${value} s`}
                      />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="first"
                        name="Reference"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="second"
                        name="Comparison"
                        stroke="hsl(var(--secondary-foreground))"
                        strokeWidth={2}
                        strokeDasharray="5 5"
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Power samples are required throughout the ride to estimate W&apos; balance.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {!isLoading && !comparison && !error && firstId && secondId && firstId !== secondId ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">No comparison data yet</CardTitle>
            <CardDescription>
              Select rides with overlapping metrics (power, heart rate, elevation) to unlock the overlay.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}
    </div>
  );
}
