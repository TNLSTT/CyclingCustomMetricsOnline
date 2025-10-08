'use client';

import Link from 'next/link';
import { ArrowLeft, ArrowRight, CalendarDays, Flag, Gauge, MapPin, Route, Sparkles, TrendingUp } from 'lucide-react';
import { useMemo } from 'react';

import type {
  ActivitySummary,
  ActivityTrackBounds,
  ActivityTrackPoint,
  IntervalEfficiencyInterval,
} from '../types/activity';
import { formatDuration } from '../lib/utils';
import { Tooltip } from './ui/tooltip';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { RideTrackMap } from './ride-track-map';
import { Card } from './ui/card';

interface ActivitySummaryHeroProps {
  activity: ActivitySummary;
  normalizedPower?: number | null;
  averagePower?: number | null;
  variabilityIndex?: number | null;
  coastingShare?: number | null;
  lateWattsPerBpm?: number | null;
  intervalSummaries: IntervalEfficiencyInterval[];
  onOpenComparison: () => void;
  trackPoints: ActivityTrackPoint[];
  trackBounds: ActivityTrackBounds | null;
  isTrackLoading: boolean;
  trackError: string | null;
  previousActivityId: string | null;
  nextActivityId: string | null;
}

function formatNumber(value: number | null | undefined, digits = 0) {
  if (value == null || Number.isNaN(value)) {
    return '—';
  }
  return value.toFixed(digits);
}

function toKm(meters?: number | null) {
  if (meters == null || !Number.isFinite(meters)) {
    return null;
  }
  return meters / 1000;
}

export function ActivitySummaryHero({
  activity,
  normalizedPower,
  averagePower,
  variabilityIndex,
  coastingShare,
  lateWattsPerBpm,
  intervalSummaries,
  onOpenComparison,
  trackPoints,
  trackBounds,
  isTrackLoading,
  trackError,
  previousActivityId,
  nextActivityId,
}: ActivitySummaryHeroProps) {
  const activityDate = useMemo(() => new Date(activity.startTime), [activity.startTime]);
  const formattedStart = useMemo(() => activityDate.toLocaleString(), [activityDate]);
  const distanceKm = useMemo(() => toKm(activity.distanceMeters ?? null), [activity.distanceMeters]);
  const elevation = activity.totalElevationGain ?? null;
  const cadence = activity.averageCadence ?? intervalSummaries[0]?.avg_cadence ?? null;
  const hr = activity.averageHeartRate ?? intervalSummaries[0]?.avg_hr ?? null;
  const avgPower = averagePower ?? activity.averagePower ?? null;

  const variabilityBadge = (() => {
    if (variabilityIndex == null || Number.isNaN(variabilityIndex)) {
      return { label: 'Variability unknown', tone: 'bg-muted text-muted-foreground', helper: 'Record a variability index to benchmark pacing.' };
    }
    if (variabilityIndex >= 1.1) {
      return {
        label: 'Highly stochastic',
        tone: 'bg-amber-500/20 text-amber-900 dark:text-amber-100 border border-amber-500/40',
        helper: 'Variability index above 1.10 indicates repeated surges or on/off pacing.',
      };
    }
    if (variabilityIndex >= 1.03) {
      return {
        label: 'Moderately variable',
        tone: 'bg-sky-500/20 text-sky-900 dark:text-sky-100 border border-sky-500/40',
        helper: 'Variability index between 1.03–1.10 suggests rolling terrain or purposeful tempo work.',
      };
    }
    return {
      label: 'Smooth & steady',
      tone: 'bg-emerald-500/20 text-emerald-900 dark:text-emerald-100 border border-emerald-500/40',
      helper: 'Variability index below 1.03 signals well-controlled pacing.',
    };
  })();

  const coastingBadge = (() => {
    if (coastingShare == null || Number.isNaN(coastingShare)) {
      return null;
    }
    if (coastingShare > 0.35) {
      return {
        label: 'Coast heavy',
        tone: 'bg-purple-500/20 text-purple-900 dark:text-purple-100 border border-purple-500/40',
        helper: 'More than a third of samples were under 5 W. Expect descents or recovery focus.',
      };
    }
    if (coastingShare > 0.18) {
      return {
        label: 'Balanced coasting',
        tone: 'bg-blue-500/20 text-blue-900 dark:text-blue-100 border border-blue-500/40',
        helper: 'Coasting share between 18–35% balances recovery without losing momentum.',
      };
    }
    return {
      label: 'Constant pressure',
      tone: 'bg-emerald-500/20 text-emerald-900 dark:text-emerald-100 border border-emerald-500/40',
      helper: 'Less than 18% coasting means you kept pressure on the pedals almost all ride.',
    };
  })();

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="rounded-2xl border bg-background/80 p-6 shadow-sm backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3 sm:items-center">
            <div className="flex items-center gap-2">
              <Tooltip content={previousActivityId ? 'View the previous activity' : 'No previous activity available'}>
                {previousActivityId ? (
                  <Button
                    asChild
                    variant="ghost"
                    size="icon"
                    className="rounded-full border border-border"
                    aria-label="Previous activity"
                  >
                    <Link href={`/activities/${previousActivityId}`} prefetch={false}>
                      <ArrowLeft className="h-4 w-4" />
                    </Link>
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full border border-dashed"
                    aria-label="No previous activity"
                    disabled
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                )}
              </Tooltip>
              <Tooltip content={nextActivityId ? 'View the next activity' : 'No next activity available'}>
                {nextActivityId ? (
                  <Button
                    asChild
                    variant="ghost"
                    size="icon"
                    className="rounded-full border border-border"
                    aria-label="Next activity"
                  >
                    <Link href={`/activities/${nextActivityId}`} prefetch={false}>
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full border border-dashed"
                    aria-label="No next activity"
                    disabled
                  >
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                )}
              </Tooltip>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{activity.source}</p>
              <h1 className="text-3xl font-bold tracking-tight">
                {activity.name ? activity.name : 'Ride overview'}
              </h1>
              <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                <CalendarDays className="h-4 w-4" aria-hidden="true" />
                <span>{formattedStart}</span>
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center">
            <Tooltip content="Launch an overlay to compare this ride with another activity's power or heart rate trends.">
              <Button onClick={onOpenComparison} className="shadow">Compare rides</Button>
            </Tooltip>
            <Tooltip content={`Ride lasted ${formatDuration(activity.durationSec)}.`}>
              <Badge variant="secondary" className="flex items-center gap-1 text-xs">
                <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
                {formatDuration(activity.durationSec)}
              </Badge>
            </Tooltip>
          </div>
        </div>

        <dl className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <SummaryStat
            title="Average power"
            value={avgPower != null ? `${formatNumber(avgPower, 0)} W` : '—'}
            description="Arithmetic mean of valid power samples across the full ride."
            icon={<Gauge className="h-4 w-4" aria-hidden="true" />}
          />
          <SummaryStat
            title="Average heart rate"
            value={hr != null ? `${formatNumber(hr, 0)} bpm` : '—'}
            description="Paired HR samples from the ride. Compare with late-ride drift."
            icon={<Sparkles className="h-4 w-4" aria-hidden="true" />}
          />
          <SummaryStat
            title="Average cadence"
            value={cadence != null ? `${formatNumber(cadence, 0)} rpm` : '—'}
            description="Valid cadence readings after cadence filtering."
            icon={<Route className="h-4 w-4" aria-hidden="true" />}
          />
          <SummaryStat
            title="Normalized power"
            value={normalizedPower != null ? `${formatNumber(normalizedPower, 0)} W` : '—'}
            description="30 s rolling average power to highlight intensity drift."
            icon={<TrendingUp className="h-4 w-4" aria-hidden="true" />}
          />
          <SummaryStat
            title="Ride distance"
            value={distanceKm != null ? `${formatNumber(distanceKm, 1)} km` : '—'}
            description="Distance derived from GPS track when available."
            icon={<MapPin className="h-4 w-4" aria-hidden="true" />}
          />
          <SummaryStat
            title="Elevation gain"
            value={elevation != null ? `${formatNumber(elevation, 0)} m` : '—'}
            description="Total ascent recorded by your head unit."
            icon={<Flag className="h-4 w-4" aria-hidden="true" />}
          />
        </dl>

        <div className="mt-6 flex flex-wrap gap-3">
          <Tooltip content={variabilityBadge.helper}>
            <Badge className={variabilityBadge.tone}>{variabilityBadge.label}</Badge>
          </Tooltip>
          {coastingBadge ? (
            <Tooltip content={coastingBadge.helper}>
              <Badge className={coastingBadge.tone}>{coastingBadge.label}</Badge>
            </Tooltip>
          ) : null}
          {lateWattsPerBpm != null ? (
            <Tooltip content="Late-ride watts per beat from the durability window.">
              <Badge className="bg-rose-500/15 text-rose-900 dark:text-rose-100 border border-rose-500/30">
                Late W/HR: {formatNumber(lateWattsPerBpm, 2)}
              </Badge>
            </Tooltip>
          ) : null}
        </div>
      </div>
      <Card className="h-full overflow-hidden border-dashed">
        <div className="flex h-full flex-col">
          <div className="px-6 pt-6">
            <h2 className="text-sm font-semibold">Route overview</h2>
            <p className="text-xs text-muted-foreground">
              Lightweight preview of the recorded GPS track with start (teal) and finish markers.
            </p>
          </div>
          <div className="relative mt-4 flex-1">
            {isTrackLoading ? (
              <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                Loading preview…
              </div>
            ) : trackError ? (
              <div className="flex h-full items-center justify-center px-4 text-xs text-muted-foreground">
                {trackError}
              </div>
            ) : trackPoints.length > 0 ? (
              <RideTrackMap points={trackPoints} bounds={trackBounds} className="h-full w-full" />
            ) : (
              <div className="flex h-full items-center justify-center px-4 text-xs text-muted-foreground">
                No GPS data available.
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}

interface SummaryStatProps {
  title: string;
  value: string;
  description: string;
  icon: React.ReactNode;
}

function SummaryStat({ title, value, description, icon }: SummaryStatProps) {
  return (
    <Tooltip content={description}>
      <div className="flex items-center justify-between rounded-lg border border-border/70 bg-background/60 p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md focus-within:-translate-y-0.5">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{title}</p>
          <p className="text-lg font-semibold">{value}</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
          {icon}
        </div>
      </div>
    </Tooltip>
  );
}
