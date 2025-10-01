'use client';

import { useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import useSWR from 'swr';

import { fetchTrainingFrontiers } from '../lib/api';
import { formatDuration } from '../lib/utils';
import type {
  DurationPowerPoint,
  DurabilityEffort,
  EfficiencyWindow,
  RepeatabilityFrontier,
  RepeatabilitySequence,
  TimeInZoneFrontier,
  TrainingFrontiersResponse,
} from '../types/training-frontiers';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Skeleton } from './ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';

const WINDOW_OPTIONS = [60, 90, 180];

interface TrainingFrontiersClientProps {
  initialData: TrainingFrontiersResponse;
  defaultWindowDays?: number;
}

interface RepeatabilitySummary {
  best: RepeatabilitySequence | null;
  worst: RepeatabilitySequence | null;
}

function useTrainingFrontiers(windowDays: number, initial?: TrainingFrontiersResponse) {
  const { data: session, status } = useSession();
  const token = session?.accessToken;

  const { data, isLoading, error } = useSWR(
    status === 'loading' ? null : ['training-frontiers', windowDays, token],
    ([, days, authToken]) => fetchTrainingFrontiers(days as number, authToken as string | undefined),
    {
      keepPreviousData: true,
      fallbackData: initial,
      revalidateOnFocus: false,
    },
  );

  return { data, isLoading, error: error as Error | undefined };
}

function formatWatts(value: number | null | undefined, fractionDigits = 0) {
  if (value == null || Number.isNaN(value)) {
    return '—';
  }
  return value.toFixed(fractionDigits);
}

function formatPercent(value: number | null | undefined, fractionDigits = 1) {
  if (value == null || Number.isNaN(value)) {
    return '—';
  }
  return `${value.toFixed(fractionDigits)}%`;
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return '—';
  }
  const date = new Date(value);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

function formatTime(value: string | null | undefined) {
  if (!value) {
    return '—';
  }
  const date = new Date(value);
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: 'numeric',
  }).format(date);
}

function formatSeconds(seconds: number | null | undefined) {
  if (seconds == null || !Number.isFinite(seconds)) {
    return '—';
  }
  return formatDuration(seconds);
}

function groupDurabilityEfforts(efforts: DurabilityEffort[]) {
  const byFatigue = new Map<number, DurabilityEffort[]>();
  efforts.forEach((effort) => {
    const list = byFatigue.get(effort.fatigueKj) ?? [];
    list.push(effort);
    byFatigue.set(effort.fatigueKj, list);
  });
  return Array.from(byFatigue.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([fatigue, entries]) => ({
      fatigue,
      entries: entries.sort((a, b) => a.durationSec - b.durationSec),
    }));
}

function summarizeRepeatability(
  frontier: RepeatabilityFrontier,
  targetKey: string,
): RepeatabilitySummary {
  const sequences = frontier.sequences.filter((sequence) => sequence.targetKey === targetKey);
  if (sequences.length === 0) {
    return { best: null, worst: null };
  }
  const best = [...sequences].sort((a, b) => Math.abs(a.decaySlope) - Math.abs(b.decaySlope))[0] ?? null;
  const worst = [...sequences].sort((a, b) => a.decaySlope - b.decaySlope)[0] ?? null;
  return { best: best ?? null, worst: worst ?? null };
}

function RepeatabilityCard({
  frontier,
  targetKey,
  title,
}: {
  frontier: RepeatabilityFrontier;
  targetKey: string;
  title: string;
}) {
  const summary = summarizeRepeatability(frontier, targetKey);
  const repeatabilityRecord = frontier.bestRepeatability.find((entry) => entry.targetKey === targetKey);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
        <CardDescription>
          Longest set before a 10% power drop: {repeatabilityRecord?.reps ?? 0} reps
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {summary.best ? (
          <div className="rounded-md border border-muted p-4">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold">Most repeatable</h4>
              <Badge variant="secondary">{summary.best.reps} reps</Badge>
            </div>
            <p className="text-muted-foreground">
              {formatDate(summary.best.startTime)} · {formatSeconds(summary.best.startSec)} start
            </p>
            <div className="mt-2 grid gap-2 text-xs text-muted-foreground md:grid-cols-2">
              <span>Avg %FTP slope: {formatPercent(summary.best.decaySlope, 2)}</span>
              <span>Drop first→last: {formatPercent(summary.best.dropFromFirstToLast, 1)}</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1 text-xs">
              {summary.best.avgPctByRep.map((value, index) => (
                <Badge key={index} variant="outline">
                  Rep {index + 1}: {formatPercent(value, 1)}
                </Badge>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-muted-foreground">No qualifying sequences detected in this window.</p>
        )}
        {summary.worst && summary.worst !== summary.best ? (
          <div className="rounded-md border border-muted p-4">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold">Steepest decay</h4>
              <Badge variant="destructive">{summary.worst.reps} reps</Badge>
            </div>
            <p className="text-muted-foreground">
              {formatDate(summary.worst.startTime)} · {formatSeconds(summary.worst.startSec)} start
            </p>
            <div className="mt-2 grid gap-2 text-xs text-muted-foreground md:grid-cols-2">
              <span>Avg %FTP slope: {formatPercent(summary.worst.decaySlope, 2)}</span>
              <span>Drop first→last: {formatPercent(summary.worst.dropFromFirstToLast, 1)}</span>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function TimeInZoneCard({ frontier }: { frontier: TimeInZoneFrontier }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">Time-in-zone streaks</CardTitle>
        <CardDescription>
          Longest continuous blocks in each power zone using a 30s rolling average with 5% tolerance.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Zone</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Avg watts</TableHead>
              <TableHead>Avg HR</TableHead>
              <TableHead>Ride</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {frontier.streaks.map((streak) => (
              <TableRow key={streak.zoneKey}>
                <TableCell>
                  <div className="font-medium">{streak.label}</div>
                  <div className="text-xs text-muted-foreground">
                    {streak.minPct}–{streak.maxPct ?? '∞'}% FTP
                  </div>
                </TableCell>
                <TableCell>{formatSeconds(streak.durationSec)}</TableCell>
                <TableCell>{formatWatts(streak.averageWatts, 1)}</TableCell>
                <TableCell>{streak.averageHeartRate ? `${streak.averageHeartRate} bpm` : '—'}</TableCell>
                <TableCell>
                  {streak.startTime ? (
                    <div className="text-xs text-muted-foreground">
                      {formatDate(streak.startTime)} · {formatTime(streak.startTime)}
                    </div>
                  ) : (
                    '—'
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function DurationPowerCard({
  points,
  convexHull,
}: {
  points: DurationPowerPoint[];
  convexHull: DurationPowerPoint[];
}) {
  const hullDurations = new Set(convexHull.map((point) => point.durationSec));
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">Duration-power frontier</CardTitle>
        <CardDescription>Best rolling power outputs for standard durations within the selected window.</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Duration</TableHead>
              <TableHead>Best power</TableHead>
              <TableHead>% FTP</TableHead>
              <TableHead>On hull</TableHead>
              <TableHead>Ride</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {points.map((point) => (
              <TableRow key={point.durationSec}>
                <TableCell>{formatSeconds(point.durationSec)}</TableCell>
                <TableCell>{formatWatts(point.value, 1)} W</TableCell>
                <TableCell>{formatPercent(point.pctFtp)}</TableCell>
                <TableCell>
                  {hullDurations.has(point.durationSec) ? (
                    <Badge variant="outline">Hull</Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  {point.startTime ? (
                    <div className="text-xs text-muted-foreground">
                      {formatDate(point.startTime)} · {formatTime(point.startTime)}
                    </div>
                  ) : (
                    '—'
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function KjFrontierCard({ points, peak }: { points: TrainingFrontiersResponse['durationPower']['kjFrontier']; peak: TrainingFrontiersResponse['durationPower']['peakKjPerHour'] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">KJ throughput frontier</CardTitle>
        <CardDescription>
          Highest kJ per hour windows on rides lasting 2 hours or longer, plus the overall maximum.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Window</TableHead>
              <TableHead>kJ/hr</TableHead>
              <TableHead>Avg watts</TableHead>
              <TableHead>% FTP</TableHead>
              <TableHead>Ride</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {points.map((point) => (
              <TableRow key={point.durationHours}>
                <TableCell>{point.durationHours}h</TableCell>
                <TableCell>{formatWatts(point.value, 1)}</TableCell>
                <TableCell>{formatWatts(point.averageWatts, 1)} W</TableCell>
                <TableCell>{formatPercent(point.pctFtp)}</TableCell>
                <TableCell>
                  {point.startTime ? (
                    <div className="text-xs text-muted-foreground">
                      {formatDate(point.startTime)} · {formatTime(point.startTime)}
                    </div>
                  ) : (
                    '—'
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {peak ? (
          <div className="mt-4 rounded-md border border-primary/50 bg-primary/5 p-4 text-sm">
            <div className="font-semibold">Peak throughput</div>
            <p className="text-muted-foreground">
              {peak.value ? `${formatWatts(peak.value, 1)} kJ/hr` : '—'} during a {peak.durationHours}h window on{' '}
              {peak.startTime ? formatDate(peak.startTime) : '—'}.
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function EfficiencyCard({ windows }: { windows: EfficiencyWindow[] }) {
  const grouped = useMemo(() => {
    const map = new Map<number, EfficiencyWindow[]>();
    windows.forEach((window) => {
      const list = map.get(window.durationSec) ?? [];
      list.push(window);
      map.set(window.durationSec, list);
    });
    return Array.from(map.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([duration, list]) => ({ duration, list }));
  }, [windows]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">Efficiency frontier</CardTitle>
        <CardDescription>Top steady-state watts per heart beat windows at multi-hour durations.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {grouped.length === 0 ? (
          <p className="text-sm text-muted-foreground">No steady-state windows matched the efficiency criteria.</p>
        ) : (
          grouped.map(({ duration, list }) => (
            <div key={duration} className="space-y-2">
              <div className="font-semibold">{formatSeconds(duration)} windows</div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Watts</TableHead>
                    <TableHead>% FTP</TableHead>
                    <TableHead>W/HR</TableHead>
                    <TableHead>W/%HRR</TableHead>
                    <TableHead>Cadence coverage</TableHead>
                    <TableHead>Moving</TableHead>
                    <TableHead>Ride</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.map((window, index) => (
                    <TableRow key={index}>
                      <TableCell>{formatWatts(window.averageWatts, 1)}</TableCell>
                      <TableCell>{formatPercent(window.pctFtp)}</TableCell>
                      <TableCell>{formatWatts(window.wattsPerBpm, 2)}</TableCell>
                      <TableCell>{formatWatts(window.wattsPerHeartRateReserve, 2)}</TableCell>
                      <TableCell>{formatPercent(window.cadenceCoverage, 1)}</TableCell>
                      <TableCell>{formatPercent(window.movingCoverage, 1)}</TableCell>
                      <TableCell>
                        {window.startTime ? (
                          <div className="text-xs text-muted-foreground">
                            {formatDate(window.startTime)} · {formatTime(window.startTime)}
                          </div>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function DurabilityCard({ efforts }: { efforts: DurabilityEffort[] }) {
  const groups = groupDurabilityEfforts(efforts);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">Durability frontier</CardTitle>
        <CardDescription>Best power sustained after accumulating specific kJ fatigue levels.</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fatigue</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Power</TableHead>
              <TableHead>% FTP</TableHead>
              <TableHead>Δ fresh</TableHead>
              <TableHead>Ride</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {groups.map((group) =>
              group.entries.map((entry) => (
                <TableRow key={`${group.fatigue}-${entry.durationSec}`}>
                  <TableCell>{group.fatigue.toLocaleString()} kJ</TableCell>
                  <TableCell>{formatSeconds(entry.durationSec)}</TableCell>
                  <TableCell>{formatWatts(entry.value, 1)} W</TableCell>
                  <TableCell>{formatPercent(entry.pctFtp)}</TableCell>
                  <TableCell>
                    {entry.deltaWatts != null ? `${formatWatts(entry.deltaWatts, 1)} W` : '—'}
                    <span className="ml-1 text-xs text-muted-foreground">
                      {entry.deltaPct != null ? formatPercent(entry.deltaPct, 1) : ''}
                    </span>
                  </TableCell>
                  <TableCell>
                    {entry.startTime ? (
                      <div className="text-xs text-muted-foreground">
                        {formatDate(entry.startTime)} · {formatTime(entry.startTime)}
                      </div>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                </TableRow>
              )),
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export function TrainingFrontiersClient({
  initialData,
  defaultWindowDays = WINDOW_OPTIONS[1],
}: TrainingFrontiersClientProps) {
  const [windowDays, setWindowDays] = useState(defaultWindowDays);
  const { data, isLoading, error } = useTrainingFrontiers(windowDays, initialData);

  const response = data ?? initialData;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <CardTitle className="text-base font-semibold">Recency window</CardTitle>
            <CardDescription>Compare how your frontiers shift when focusing on the last 60, 90, or 180 days.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {WINDOW_OPTIONS.map((option) => (
              <Button
                key={option}
                variant={option === windowDays ? 'default' : 'outline'}
                onClick={() => setWindowDays(option)}
                disabled={isLoading && option === windowDays}
              >
                {option} days
              </Button>
            ))}
          </div>
        </CardHeader>
      </Card>

      {error ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold text-destructive">Failed to refresh data</CardTitle>
            <CardDescription>{error.message}</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {!response ? (
        <Skeleton className="h-48 w-full" />
      ) : (
        <div className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <DurationPowerCard points={response.durationPower.durations} convexHull={response.durationPower.convexHull} />
            <KjFrontierCard points={response.durationPower.kjFrontier} peak={response.durationPower.peakKjPerHour} />
          </div>
          <DurabilityCard efforts={response.durability.efforts} />
          <EfficiencyCard windows={response.efficiency.windows} />
          <div className="grid gap-6 lg:grid-cols-2">
            <RepeatabilityCard frontier={response.repeatability} targetKey="vo2" title="VO2 repeatability" />
            <RepeatabilityCard frontier={response.repeatability} targetKey="threshold" title="Threshold repeatability" />
          </div>
          <TimeInZoneCard frontier={response.timeInZone} />
        </div>
      )}
    </div>
  );
}
