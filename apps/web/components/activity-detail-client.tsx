'use client';

import { useState, useTransition } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';

import { computeMetrics, fetchMetricResult } from '../lib/api';
import type { ActivitySummary, MetricResultDetail } from '../types/activity';
import { HcsrChart } from './hcsr-chart';
import { MetricSummaryCard } from './metric-summary-card';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';

interface ActivityDetailClientProps {
  activity: ActivitySummary;
  initialHcsr?: MetricResultDetail | null;
}

type HcsrSummary = {
  slope?: number | null;
  intercept?: number | null;
  r2?: number | null;
  nonlinearity?: number | null;
  deltaSlope?: number | null;
  validSeconds?: number | null;
  bucketCount?: number | null;
};

type HcsrSeries = Array<{
  cadenceMid: number;
  medianHR: number;
  seconds: number;
  hr25?: number;
  hr75?: number;
}>;

function parseHcsrSummary(metric: MetricResultDetail | null | undefined): HcsrSummary {
  if (!metric) {
    return {};
  }
  const summary = metric.summary as Record<string, unknown>;
  return {
    slope: typeof summary.slope_bpm_per_rpm === 'number' ? summary.slope_bpm_per_rpm : null,
    intercept: typeof summary.intercept_bpm === 'number' ? summary.intercept_bpm : null,
    r2: typeof summary.r2 === 'number' ? summary.r2 : null,
    nonlinearity:
      typeof summary.nonlinearity_delta === 'number' ? summary.nonlinearity_delta : null,
    deltaSlope:
      typeof summary.half_split_delta_slope === 'number'
        ? summary.half_split_delta_slope
        : null,
    validSeconds:
      typeof summary.valid_seconds === 'number' ? summary.valid_seconds : null,
    bucketCount: typeof summary.bucket_count === 'number' ? summary.bucket_count : null,
  };
}

function parseHcsrSeries(metric: MetricResultDetail | null | undefined): HcsrSeries {
  if (!metric || !Array.isArray(metric.series)) {
    return [];
  }
  return metric.series.filter((entry): entry is HcsrSeries[number] => {
    return (
      typeof entry === 'object' &&
      entry !== null &&
      typeof (entry as any).cadenceMid === 'number' &&
      typeof (entry as any).medianHR === 'number'
    );
  });
}

export function ActivityDetailClient({ activity, initialHcsr }: ActivityDetailClientProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [metric, setMetric] = useState<MetricResultDetail | null | undefined>(initialHcsr);

  const summary = parseHcsrSummary(metric ?? null);
  const series = parseHcsrSeries(metric ?? null);

  const slopeDisplay = summary.slope != null ? summary.slope.toFixed(3) : '—';
  const r2Display = summary.r2 != null ? summary.r2.toFixed(3) : '—';
  const nonlinearityDisplay =
    summary.nonlinearity != null ? summary.nonlinearity.toFixed(3) : '—';

  const handleRecompute = () => {
    startTransition(async () => {
      setError(null);
      try {
        await computeMetrics(activity.id, ['hcsr']);
        const latest = await fetchMetricResult(activity.id, 'hcsr');
        setMetric(latest);
      } catch (err) {
        setError((err as Error).message);
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-3xl font-bold">Ride on {new Date(activity.startTime).toLocaleString()}</h1>
          <p className="text-muted-foreground">
            {activity.source} · duration {Math.round(activity.durationSec / 60)} minutes
          </p>
        </div>
        <Button onClick={handleRecompute} disabled={isPending} variant="secondary">
          {isPending ? (
            <span className="flex items-center space-x-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Recomputing…</span>
            </span>
          ) : (
            <span className="flex items-center space-x-2">
              <RefreshCw className="h-4 w-4" />
              <span>Recompute metrics</span>
            </span>
          )}
        </Button>
      </div>
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Computation failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <div className="grid gap-4 md:grid-cols-3">
        <MetricSummaryCard
          title="Slope"
          value={slopeDisplay}
          units="bpm/rpm"
          description="Heart rate cost per cadence rpm"
        />
        <MetricSummaryCard
          title="R²"
          value={r2Display}
          description="Goodness-of-fit across cadence buckets"
        />
        <MetricSummaryCard
          title="Nonlinearity delta"
          value={nonlinearityDisplay}
          description="Piecewise improvement vs linear fit"
        />
        <MetricSummaryCard
          title="Intercept"
          value={summary.intercept?.toFixed(1)}
          units="bpm"
          description="Estimated HR at zero cadence"
        />
        <MetricSummaryCard
          title="Half split Δ slope"
          value={summary.deltaSlope?.toFixed(3)}
          description="Fatigue signature between ride halves"
        />
        <MetricSummaryCard
          title="Valid seconds"
          value={summary.validSeconds ?? '—'}
          description="Data contributing to the analysis"
        />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>HR-to-Cadence Scaling Ratio buckets</CardTitle>
        </CardHeader>
        <CardContent>
          {series.length > 0 ? (
            <HcsrChart buckets={series} slope={summary.slope ?? null} intercept={summary.intercept ?? null} />
          ) : (
            <p className="text-sm text-muted-foreground">
              Upload a ride with valid cadence and heart rate data to visualize the scaling ratio.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
