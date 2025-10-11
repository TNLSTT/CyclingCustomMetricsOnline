'use client';

import { useEffect, useState, useTransition } from 'react';
import { Compass, Loader2, RefreshCw, Sparkles } from 'lucide-react';
import { useSession } from 'next-auth/react';

import {
  computeMetrics,
  fetchActivityTrack,
  fetchIntervalEfficiency,
  fetchMetricResult,
  generateActivityInsight,
  generateActivityRecommendation,
} from '../lib/api';
import { formatDuration } from '../lib/utils';
import type {
  ActivitySummary,
  IntervalEfficiencyResponse,
  MetricResultDetail,
  ActivityTrackPoint,
  ActivityTrackBounds,
  ActivityAiMessage,
} from '../types/activity';
import { ActivitySummaryHero } from './activity-summary-hero';
import { HcsrChart } from './hcsr-chart';
import { IntervalEfficiencyChart } from './interval-efficiency-chart';
import { WhrEfficiencyChart } from './whr-efficiency-chart';
import { MetricSummaryCard } from './metric-summary-card';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { RideTrackMap } from './ride-track-map';
import { RideComparisonOverlay } from './ride-comparison-overlay';

interface ActivityDetailClientProps {
  activity: ActivitySummary;
  initialHcsr?: MetricResultDetail | null;
  initialIntervalEfficiency?: IntervalEfficiencyResponse | null;
  initialNormalizedPower?: MetricResultDetail | null;
  initialLateAerobicEfficiency?: MetricResultDetail | null;
  initialWhrEfficiency?: MetricResultDetail | null;
}

type HcsrSummary = {
  slope?: number | null;
  intercept?: number | null;
  r2?: number | null;
  nonlinearity?: number | null;
  deltaSlope?: number | null;
  validSeconds?: number | null;
  bucketCount?: number | null;
  piecewiseR2?: number | null;
};

type HcsrSeries = Array<{
  cadenceMid: number;
  medianHR: number;
  seconds: number;
  hr25?: number;
  hr75?: number;
}>;

type NormalizedPowerSummary = {
  normalizedPower?: number | null;
  averagePower?: number | null;
  variabilityIndex?: number | null;
  coastingShare?: number | null;
  validPowerSamples?: number | null;
  totalSamples?: number | null;
  rollingWindowCount?: number | null;
  windowSampleCount?: number | null;
  windowSeconds?: number | null;
};

type NormalizedPowerSeries = Array<{
  t: number;
  rolling_avg_power_w: number;
}>;

type LateAerobicSummary = {
  wattsPerBpm?: number | null;
  averagePower?: number | null;
  averageHeartRate?: number | null;
  validSamples?: number | null;
  totalWindowSamples?: number | null;
  analyzedWindowSeconds?: number | null;
  requestedWindowSeconds?: number | null;
};

type WhrSummary = {
  median?: number | null;
  p25?: number | null;
  p75?: number | null;
  earlyMedian?: number | null;
  lateMedian?: number | null;
  driftPercent?: number | null;
  driftRatio?: number | null;
  coverageRatio?: number | null;
  validSampleCount?: number | null;
  totalSampleCount?: number | null;
  windowSeconds?: number | null;
  windowCount?: number | null;
  validWindowCount?: number | null;
  sampleRateHz?: number | null;
  earlySampleCount?: number | null;
  lateSampleCount?: number | null;
};

type WhrSeriesPoint = {
  windowIndex: number;
  startSec: number | null;
  endSec: number | null;
  midpointSec: number | null;
  midpointMinutes: number | null;
  durationSeconds: number | null;
  coverageRatio: number | null;
  sampleCount: number | null;
  validSampleCount: number | null;
  percentiles: Record<string, number | null>;
};

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
    piecewiseR2: typeof summary.piecewise_r2 === 'number' ? summary.piecewise_r2 : null,
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

function parseNormalizedPowerSummary(
  metric: MetricResultDetail | null | undefined,
): NormalizedPowerSummary {
  if (!metric) {
    return {};
  }
  const summary = metric.summary as Record<string, unknown>;
  const readNumber = (key: string) =>
    typeof summary[key] === 'number' ? (summary[key] as number) : null;

  return {
    normalizedPower: readNumber('normalized_power_w'),
    averagePower: readNumber('average_power_w'),
    variabilityIndex: readNumber('variability_index'),
    coastingShare: readNumber('coasting_share'),
    validPowerSamples: readNumber('valid_power_samples'),
    totalSamples: readNumber('total_samples'),
    rollingWindowCount: readNumber('rolling_window_count'),
    windowSampleCount: readNumber('window_sample_count'),
    windowSeconds: readNumber('window_seconds'),
  };
}

function parseNormalizedPowerSeries(
  metric: MetricResultDetail | null | undefined,
): NormalizedPowerSeries {
  if (!metric || !Array.isArray(metric.series)) {
    return [];
  }
  return metric.series.filter((entry): entry is NormalizedPowerSeries[number] => {
    return (
      typeof entry === 'object' &&
      entry !== null &&
      typeof (entry as any).t === 'number' &&
      typeof (entry as any).rolling_avg_power_w === 'number'
    );
  });
}

function parseLateAerobicSummary(metric: MetricResultDetail | null | undefined): LateAerobicSummary {
  if (!metric) {
    return {};
  }
  const summary = metric.summary as Record<string, unknown>;
  const readNumber = (key: string) =>
    typeof summary[key] === 'number' ? (summary[key] as number) : null;

  return {
    wattsPerBpm: readNumber('watts_per_bpm'),
    averagePower: readNumber('average_power_w'),
    averageHeartRate: readNumber('average_heart_rate_bpm'),
    validSamples: readNumber('valid_sample_count'),
    totalWindowSamples: readNumber('total_window_sample_count'),
    analyzedWindowSeconds: readNumber('analyzed_window_seconds'),
    requestedWindowSeconds: readNumber('requested_window_seconds'),
  };
}

function parseWhrSummary(metric: MetricResultDetail | null | undefined): WhrSummary {
  if (!metric) {
    return {};
  }
  const summary = metric.summary as Record<string, unknown>;
  const readNumber = (key: string) =>
    typeof summary[key] === 'number' ? (summary[key] as number) : null;

  return {
    median: readNumber('median_w_per_bpm'),
    p25: readNumber('p25_w_per_bpm'),
    p75: readNumber('p75_w_per_bpm'),
    earlyMedian: readNumber('early_median_w_per_bpm'),
    lateMedian: readNumber('late_median_w_per_bpm'),
    driftPercent: readNumber('drift_percent'),
    driftRatio: readNumber('drift_ratio'),
    coverageRatio: readNumber('coverage_ratio'),
    validSampleCount: readNumber('valid_sample_count'),
    totalSampleCount: readNumber('total_sample_count'),
    windowSeconds: readNumber('window_seconds'),
    windowCount: readNumber('window_count'),
    validWindowCount: readNumber('valid_window_count'),
    sampleRateHz: readNumber('sample_rate_hz'),
    earlySampleCount: readNumber('early_sample_count'),
    lateSampleCount: readNumber('late_sample_count'),
  };
}

function parseWhrSeries(metric: MetricResultDetail | null | undefined): WhrSeriesPoint[] {
  if (!metric || !Array.isArray(metric.series)) {
    return [];
  }

  return metric.series
    .map((entry) => {
      if (typeof entry !== 'object' || entry === null) {
        return null;
      }
      const payload = entry as Record<string, unknown>;
      const windowIndex = typeof payload.window_index === 'number' ? (payload.window_index as number) : null;
      if (windowIndex == null) {
        return null;
      }

      const percentiles: Record<string, number | null> = {};
      for (const [key, value] of Object.entries(payload)) {
        if (key.startsWith('p') && key.endsWith('_w_per_bpm')) {
          const percentileKey = key.slice(0, key.indexOf('_'));
          percentiles[percentileKey] = typeof value === 'number' ? (value as number) : null;
        }
      }

      const startSec = typeof payload.start_sec === 'number' ? (payload.start_sec as number) : null;
      const endSec = typeof payload.end_sec === 'number' ? (payload.end_sec as number) : null;
      const midpointSec = typeof payload.midpoint_sec === 'number' ? (payload.midpoint_sec as number) : null;
      const durationSeconds =
        typeof payload.duration_seconds === 'number' ? (payload.duration_seconds as number) : null;
      return {
        windowIndex,
        startSec,
        endSec,
        midpointSec,
        midpointMinutes: midpointSec != null ? midpointSec / 60 : null,
        durationSeconds,
        coverageRatio:
          typeof payload.coverage_ratio === 'number' ? (payload.coverage_ratio as number) : null,
        sampleCount: typeof payload.sample_count === 'number' ? (payload.sample_count as number) : null,
        validSampleCount:
          typeof payload.valid_sample_count === 'number' ? (payload.valid_sample_count as number) : null,
        percentiles,
      };
    })
    .filter((point): point is WhrSeriesPoint => point !== null)
    .sort((a, b) => a.windowIndex - b.windowIndex);
}

export function ActivityDetailClient({
  activity,
  initialHcsr,
  initialIntervalEfficiency,
  initialNormalizedPower,
  initialLateAerobicEfficiency,
  initialWhrEfficiency,
}: ActivityDetailClientProps) {
  const { data: session } = useSession();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [metric, setMetric] = useState<MetricResultDetail | null | undefined>(initialHcsr);
  const [intervalEfficiency, setIntervalEfficiency] = useState<IntervalEfficiencyResponse | null>(
    initialIntervalEfficiency ?? null,
  );
  const [normalizedMetric, setNormalizedMetric] = useState<MetricResultDetail | null | undefined>(
    initialNormalizedPower,
  );
  const [lateAerobicMetric, setLateAerobicMetric] = useState<MetricResultDetail | null | undefined>(
    initialLateAerobicEfficiency,
  );
  const [whrMetric, setWhrMetric] = useState<MetricResultDetail | null | undefined>(
    initialWhrEfficiency,
  );
  const [aiInsight, setAiInsight] = useState<ActivityAiMessage | null>(activity.aiInsight ?? null);
  const [aiInsightGeneratedAt, setAiInsightGeneratedAt] = useState<string | null>(
    activity.aiInsightGeneratedAt ?? null,
  );
  const [aiRecommendation, setAiRecommendation] = useState<ActivityAiMessage | null>(
    activity.aiRecommendation ?? null,
  );
  const [aiRecommendationGeneratedAt, setAiRecommendationGeneratedAt] = useState<string | null>(
    activity.aiRecommendationGeneratedAt ?? null,
  );
  const [aiError, setAiError] = useState<string | null>(null);
  const [recommendationError, setRecommendationError] = useState<string | null>(null);
  const [isInsightPending, startInsightTransition] = useTransition();
  const [isRecommendationPending, startRecommendationTransition] = useTransition();
  const [trackPoints, setTrackPoints] = useState<ActivityTrackPoint[]>([]);
  const [trackBounds, setTrackBounds] = useState<ActivityTrackBounds | null>(null);
  const [trackError, setTrackError] = useState<string | null>(null);
  const [isTrackLoading, setIsTrackLoading] = useState<boolean>(true);
  const [isComparisonOpen, setIsComparisonOpen] = useState(false);

  const createTrendHref = (metricId: string) =>
    `/activities/trends?metric=${encodeURIComponent(metricId)}`;

  const hcsrSummary = parseHcsrSummary(metric ?? null);
  const hcsrSeries = parseHcsrSeries(metric ?? null);
  const normalizedSummary = parseNormalizedPowerSummary(normalizedMetric ?? null);
  const normalizedSeries = parseNormalizedPowerSeries(normalizedMetric ?? null);
  const lateAerobicSummary = parseLateAerobicSummary(lateAerobicMetric ?? null);
  const whrSummary = parseWhrSummary(whrMetric ?? null);
  const whrSeries = parseWhrSeries(whrMetric ?? null);
  const intervalSummaries = intervalEfficiency?.intervals ?? [];
  const hasIntervalData = intervalSummaries.length > 0;

  const formatNumber = (value: number | null | undefined, fractionDigits = 0) => {
    if (value == null || Number.isNaN(value)) {
      return '—';
    }
    if (fractionDigits === 0) {
      return Math.round(value).toString();
    }
    const trimmed = Number.parseFloat(value.toFixed(fractionDigits));
    if (Number.isNaN(trimmed)) {
      return '—';
    }
    return trimmed.toString();
  };

  const detailValue = (value: string | null | undefined, suffix?: string) => {
    if (!value || value === '—') {
      return 'Not available';
    }
    return suffix ? `${value} ${suffix}` : value;
  };

  const slopeDisplay = hcsrSummary.slope != null ? hcsrSummary.slope.toFixed(3) : '—';
  const r2Display = hcsrSummary.r2 != null ? hcsrSummary.r2.toFixed(3) : '—';
  const nonlinearityDisplay =
    hcsrSummary.nonlinearity != null ? hcsrSummary.nonlinearity.toFixed(3) : '—';
  const nonlinearityDetail = detailValue(nonlinearityDisplay);
  const interceptDisplay =
    hcsrSummary.intercept != null ? hcsrSummary.intercept.toFixed(1) : '—';
  const deltaSlopeDisplay =
    hcsrSummary.deltaSlope != null ? hcsrSummary.deltaSlope.toFixed(3) : '—';
  const piecewiseR2Display =
    hcsrSummary.piecewiseR2 != null ? hcsrSummary.piecewiseR2.toFixed(3) : '—';
  const hcsrBucketCountDisplay = formatNumber(hcsrSummary.bucketCount);
  const hcsrValidSecondsDisplay = formatNumber(hcsrSummary.validSeconds);
  const hcsrBucketCountDetail = detailValue(hcsrBucketCountDisplay, 'buckets');
  const hcsrValidSecondsDetail = detailValue(hcsrValidSecondsDisplay, 's');
  const r2Detail = detailValue(r2Display);
  const piecewiseR2Detail = detailValue(piecewiseR2Display);
  const slopeDetail = detailValue(slopeDisplay, 'bpm/rpm');
  const interceptDetail = detailValue(interceptDisplay, 'bpm');
  const deltaSlopeDetail = detailValue(deltaSlopeDisplay, 'bpm/rpm');
  const rideDurationDisplay = formatDuration(activity.durationSec);
  const rideDurationDetail = detailValue(rideDurationDisplay);
  const halfSplitPointDisplay = formatDuration(Math.floor(activity.durationSec / 2));
  const halfSplitPointDetail = detailValue(halfSplitPointDisplay);

  useEffect(() => {
    setAiInsight(activity.aiInsight ?? null);
    setAiInsightGeneratedAt(activity.aiInsightGeneratedAt ?? null);
    setAiRecommendation(activity.aiRecommendation ?? null);
    setAiRecommendationGeneratedAt(activity.aiRecommendationGeneratedAt ?? null);
  }, [
    activity.aiInsight,
    activity.aiInsightGeneratedAt,
    activity.aiRecommendation,
    activity.aiRecommendationGeneratedAt,
    activity.id,
  ]);

  const handleRecompute = () => {
    startTransition(async () => {
      setError(null);
      try {
        await computeMetrics(
          activity.id,
          ['hcsr', 'interval-efficiency', 'normalized-power', 'late-aerobic-efficiency', 'whr-efficiency'],
          session?.accessToken,
        );
        const [
          latestHcsr,
          latestIntervalEfficiency,
          latestNormalized,
          latestLateAerobic,
          latestWhr,
        ] = await Promise.all([
          fetchMetricResult(activity.id, 'hcsr', session?.accessToken),
          fetchIntervalEfficiency(activity.id, session?.accessToken),
          fetchMetricResult(activity.id, 'normalized-power', session?.accessToken),
          fetchMetricResult(activity.id, 'late-aerobic-efficiency', session?.accessToken),
          fetchMetricResult(activity.id, 'whr-efficiency', session?.accessToken),
        ]);
        setMetric(latestHcsr);
        setIntervalEfficiency(latestIntervalEfficiency);
        setNormalizedMetric(latestNormalized);
        setLateAerobicMetric(latestLateAerobic);
        setWhrMetric(latestWhr);
      } catch (err) {
        setError((err as Error).message);
      }
    });
  };

  const normalizedPowerDisplay = formatNumber(normalizedSummary.normalizedPower, 1);
  const averagePowerDisplay = formatNumber(normalizedSummary.averagePower, 1);
  const variabilityDisplay = formatNumber(normalizedSummary.variabilityIndex, 3);
  const coastingShareDisplay =
    normalizedSummary.coastingShare != null
      ? `${formatNumber(normalizedSummary.coastingShare * 100, 1)}%`
      : '—';
  const validSamplesDisplay = formatNumber(normalizedSummary.validPowerSamples);
  const rollingWindowsDisplay = formatNumber(normalizedSummary.rollingWindowCount);
  const windowSecondsDisplay = formatNumber(normalizedSummary.windowSeconds);
  const normalizedSeriesPreview = normalizedSeries.slice(-10);
  const normalizedTotalSamplesDisplay = formatNumber(normalizedSummary.totalSamples);
  const normalizedWindowSampleDisplay = formatNumber(normalizedSummary.windowSampleCount);
  const normalizedPowerDetail = detailValue(normalizedPowerDisplay, 'W');
  const averagePowerDetail = detailValue(averagePowerDisplay, 'W');
  const normalizedTotalSamplesDetail = detailValue(normalizedTotalSamplesDisplay, 'samples');
  const validPowerSamplesDetail =
    validSamplesDisplay === '—'
      ? 'Not available'
      : normalizedTotalSamplesDisplay === '—'
        ? `${validSamplesDisplay} samples with valid watt data`
        : `${validSamplesDisplay} of ${normalizedTotalSamplesDisplay} samples with valid watt data`;
  const normalizedWindowSecondsDetail = detailValue(windowSecondsDisplay, 's per window');
  const normalizedWindowSampleDetail =
    normalizedWindowSampleDisplay === '—'
      ? 'Not available'
      : `${normalizedWindowSampleDisplay} samples per 30 s window`;
  const normalizedRollingWindowsDetail = detailValue(rollingWindowsDisplay, 'windows');
  const coastingShareRatio = formatNumber(normalizedSummary.coastingShare, 4);
  const coastingShareDetail =
    coastingShareRatio === '—'
      ? 'Not available'
      : `${coastingShareDisplay} of valid samples were ≤5 W (${coastingShareRatio} ratio)`;
  const coastingSharePercentDetail = detailValue(coastingShareDisplay);
  const variabilityDetail =
    normalizedPowerDisplay === '—' || averagePowerDisplay === '—' || variabilityDisplay === '—'
      ? 'Not available'
      : `${normalizedPowerDisplay} W ÷ ${averagePowerDisplay} W = ${variabilityDisplay}`;
  const sampleRateDetail =
    typeof activity.sampleRateHz === 'number' && Number.isFinite(activity.sampleRateHz) && activity.sampleRateHz > 0
      ? `${Number.parseFloat(activity.sampleRateHz.toFixed(2))} Hz recording`
      : 'Not recorded';
  const whrMedianDisplay = formatNumber(whrSummary.median, 3);
  const whrP25Display = formatNumber(whrSummary.p25, 3);
  const whrP75Display = formatNumber(whrSummary.p75, 3);
  const whrEarlyMedianDisplay = formatNumber(whrSummary.earlyMedian, 3);
  const whrLateMedianDisplay = formatNumber(whrSummary.lateMedian, 3);
  const whrDriftPercentDisplay = formatNumber(whrSummary.driftPercent, 2);
  const whrDriftRatioDisplay = formatNumber(whrSummary.driftRatio, 3);
  const whrCoveragePercentValue =
    whrSummary.coverageRatio != null ? whrSummary.coverageRatio * 100 : null;
  const whrCoveragePercentDisplay = formatNumber(whrCoveragePercentValue, 1);
  const whrCoverageRatioDisplay = formatNumber(whrSummary.coverageRatio, 3);
  const whrValidSamplesDisplay = formatNumber(whrSummary.validSampleCount);
  const whrTotalSamplesDisplay = formatNumber(whrSummary.totalSampleCount);
  const whrWindowSecondsDisplay = formatNumber(whrSummary.windowSeconds);
  const whrWindowMinutesDisplay =
    whrSummary.windowSeconds != null ? formatNumber(whrSummary.windowSeconds / 60, 2) : '—';
  const whrWindowCountDisplay = formatNumber(whrSummary.windowCount);
  const whrValidWindowCountDisplay = formatNumber(whrSummary.validWindowCount);
  const whrSampleRateDisplay = formatNumber(whrSummary.sampleRateHz, 2);
  const whrEarlySampleCountDisplay = formatNumber(whrSummary.earlySampleCount);
  const whrLateSampleCountDisplay = formatNumber(whrSummary.lateSampleCount);
  const whrMedianDetail = detailValue(whrMedianDisplay, 'W/bpm');
  const whrP25Detail = detailValue(whrP25Display, 'W/bpm');
  const whrP75Detail = detailValue(whrP75Display, 'W/bpm');
  const whrEarlyMedianDetail = detailValue(whrEarlyMedianDisplay, 'W/bpm');
  const whrLateMedianDetail = detailValue(whrLateMedianDisplay, 'W/bpm');
  const whrDriftPercentDetail = detailValue(whrDriftPercentDisplay, '%');
  const whrDriftRatioDetail = detailValue(whrDriftRatioDisplay);
  const whrCoverageRatioText =
    whrCoverageRatioDisplay === '—' ? 'ratio unavailable' : `${whrCoverageRatioDisplay} ratio`;
  const whrCoverageDetail =
    whrCoveragePercentDisplay === '—'
      ? 'Not available'
      : `${whrCoveragePercentDisplay}% of samples paired (${whrCoverageRatioText})`;
  const whrCoveragePercentDetail = detailValue(whrCoveragePercentDisplay, '%');
  const whrValidSampleDetail =
    whrValidSamplesDisplay === '—'
      ? 'Not available'
      : whrTotalSamplesDisplay === '—'
        ? `${whrValidSamplesDisplay} paired samples`
        : `${whrValidSamplesDisplay} of ${whrTotalSamplesDisplay} samples with paired HR & power`;
  const whrWindowSecondsDetail = detailValue(whrWindowSecondsDisplay, 's per window');
  const whrWindowMinutesDetail =
    whrWindowMinutesDisplay === '—'
      ? 'Not available'
      : `${whrWindowMinutesDisplay} min per window`;
  const whrWindowCountDetail = detailValue(whrWindowCountDisplay, 'windows analyzed');
  const whrValidWindowDetail = detailValue(whrValidWindowCountDisplay, 'windows with coverage');
  const whrSampleRateDetail =
    whrSampleRateDisplay === '—'
      ? 'Not available'
      : `${whrSampleRateDisplay} Hz recording`;
  const whrEarlySampleDetail =
    whrEarlySampleCountDisplay === '—'
      ? 'Not available'
      : `${whrEarlySampleCountDisplay} early samples`;
  const whrLateSampleDetail =
    whrLateSampleCountDisplay === '—'
      ? 'Not available'
      : `${whrLateSampleCountDisplay} late samples`;
  const lateWattsPerBpmDisplay = formatNumber(lateAerobicSummary.wattsPerBpm, 3);
  const lateAveragePowerDisplay = formatNumber(lateAerobicSummary.averagePower, 1);
  const lateAverageHrDisplay = formatNumber(lateAerobicSummary.averageHeartRate, 1);
  const lateCoverageDisplay = (() => {
    const valid = lateAerobicSummary.validSamples ?? null;
    const total = lateAerobicSummary.totalWindowSamples ?? null;
    if (valid == null || total == null || total === 0) {
      return '—';
    }
    const ratio = valid / total;
    return `${formatNumber(ratio * 100, 1)}%`;
  })();
  const lateWindowSecondsDisplay = formatNumber(lateAerobicSummary.analyzedWindowSeconds);
  const lateWindowMinutesDisplay =
    lateAerobicSummary.analyzedWindowSeconds != null
      ? formatNumber(lateAerobicSummary.analyzedWindowSeconds / 60, 1)
      : '—';
  const lateRequestedMinutesDisplay =
    lateAerobicSummary.requestedWindowSeconds != null
      ? formatNumber(lateAerobicSummary.requestedWindowSeconds / 60, 1)
      : '—';
  const lateValidSamplesDisplay = formatNumber(lateAerobicSummary.validSamples);
  const lateTotalSamplesDisplay = formatNumber(lateAerobicSummary.totalWindowSamples);
  const lateWattsPerBpmDetail = detailValue(lateWattsPerBpmDisplay, 'W/bpm');
  const lateAveragePowerDetail = detailValue(lateAveragePowerDisplay, 'W');
  const lateAverageHrDetail = detailValue(lateAverageHrDisplay, 'bpm');
  const lateTotalSamplesDetail = detailValue(lateTotalSamplesDisplay, 'samples');
  const lateValidSamplesDetail =
    lateValidSamplesDisplay === '—'
      ? 'Not available'
      : lateTotalSamplesDisplay === '—'
        ? `${lateValidSamplesDisplay} paired samples`
        : `${lateValidSamplesDisplay} of ${lateTotalSamplesDisplay} samples with both HR & power`;
  const lateCoverageDetail =
    lateCoverageDisplay === '—'
      ? 'Not available'
      : `${lateCoverageDisplay} window coverage (${lateValidSamplesDetail})`;
  const lateWindowSecondsDetail = detailValue(lateWindowSecondsDisplay, 's analyzed');
  const lateRequestedWindowDetail =
    lateAerobicSummary.requestedWindowSeconds != null
      ? `${formatNumber(lateAerobicSummary.requestedWindowSeconds)} s requested (${lateRequestedMinutesDisplay === '—' ? '35 min target' : `${lateRequestedMinutesDisplay} min`})`
      : 'Not available';
  const lateCoveragePercentDetail = detailValue(lateCoverageDisplay);
  const formatTimestamp = (value?: string | null) => {
    if (!value) {
      return null;
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return null;
    }
    return date.toLocaleString();
  };
  const insightGeneratedDisplay = formatTimestamp(aiInsightGeneratedAt);
  const recommendationGeneratedDisplay = formatTimestamp(aiRecommendationGeneratedAt);

  const handleGenerateInsight = () => {
    setAiError(null);
    startInsightTransition(async () => {
      try {
        const response = await generateActivityInsight(activity.id, session?.accessToken);
        setAiInsight(response.insight ?? null);
        setAiInsightGeneratedAt(response.generatedAt ?? null);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to generate insight report';
        setAiError(message);
      }
    });
  };

  const handleGenerateRecommendation = () => {
    setRecommendationError(null);
    startRecommendationTransition(async () => {
      try {
        const response = await generateActivityRecommendation(activity.id, session?.accessToken);
        setAiRecommendation(response.recommendation ?? null);
        setAiRecommendationGeneratedAt(response.generatedAt ?? null);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to generate tomorrow's recommendation";
        setRecommendationError(message);
      }
    });
  };

  useEffect(() => {
    let cancelled = false;
    setIsTrackLoading(true);
    setTrackError(null);
    setTrackBounds(null);

    fetchActivityTrack(activity.id, session?.accessToken)
      .then((response) => {
        if (cancelled) {
          return;
        }
        setTrackPoints(response.points);
        setTrackBounds(response.bounds ?? null);
        setTrackError(null);
      })
      .catch((err) => {
        if (cancelled) {
          return;
        }
        const message = err instanceof Error ? err.message : 'Failed to load ride map';
        if (message === 'Track data not available') {
          setTrackError('No GPS data available for this ride.');
        } else {
          setTrackError(message);
        }
        setTrackPoints([]);
        setTrackBounds(null);
      })
      .finally(() => {
        if (!cancelled) {
          setIsTrackLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activity.id, session?.accessToken]);

  return (
    <div className="space-y-8">
      <ActivitySummaryHero
        activity={activity}
        normalizedPower={normalizedSummary.normalizedPower ?? null}
        averagePower={normalizedSummary.averagePower ?? activity.averagePower ?? null}
        variabilityIndex={normalizedSummary.variabilityIndex ?? null}
        coastingShare={normalizedSummary.coastingShare ?? null}
        lateWattsPerBpm={lateAerobicSummary.wattsPerBpm ?? null}
        overallWhr={whrSummary.median ?? null}
        intervalSummaries={intervalSummaries}
        onOpenComparison={() => setIsComparisonOpen(true)}
        trackPoints={trackPoints}
        trackBounds={trackBounds}
        isTrackLoading={isTrackLoading}
        trackError={trackError}
        previousActivityId={activity.previousActivityId ?? null}
        nextActivityId={activity.nextActivityId ?? null}
      />
      <Card>
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="space-y-1">
            <CardTitle>AI insight report</CardTitle>
            <p className="text-sm text-muted-foreground">
              Summarises how this ride contributes to your training goals using your recent history.
            </p>
            <p className="text-xs text-muted-foreground">
              {insightGeneratedDisplay
                ? `Last generated ${insightGeneratedDisplay}${aiInsight?.model ? ` · ${aiInsight.model}` : ''}`
                : 'No AI insight generated yet.'}
            </p>
          </div>
          <Button onClick={handleGenerateInsight} disabled={isInsightPending} className="gap-2">
            {isInsightPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Generating…</span>
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                <span>Generate insight report</span>
              </>
            )}
          </Button>
        </CardHeader>
        <CardContent className="space-y-6">
          {aiError ? (
            <Alert variant="destructive">
              <AlertTitle>Insight unavailable</AlertTitle>
              <AlertDescription>{aiError}</AlertDescription>
            </Alert>
          ) : null}
          <div className="rounded-lg border border-border/60 bg-background/70 p-4">
            {aiInsight ? (
              <>
                <div className="whitespace-pre-wrap text-sm leading-6 text-foreground">{aiInsight.content}</div>
                <div className="mt-3 text-xs text-muted-foreground">
                  {aiInsight.model ? `Model: ${aiInsight.model}` : null}
                  {aiInsight.model && aiInsight.usage?.totalTokens ? ' · ' : null}
                  {aiInsight.usage?.totalTokens ? `Tokens: ${aiInsight.usage.totalTokens}` : null}
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Click "Generate insight report" to see how this ride advances your objectives.
              </p>
            )}
          </div>
          <div className="space-y-3 rounded-lg border border-dashed border-border/60 bg-muted/40 p-4">
            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-sm font-semibold">Tomorrow&apos;s recommendation</p>
                <p className="text-xs text-muted-foreground">
                  {recommendationGeneratedDisplay
                    ? `Last generated ${recommendationGeneratedDisplay}${aiRecommendation?.model ? ` · ${aiRecommendation.model}` : ''}`
                    : 'Ask for a personalised focus for your next session.'}
                </p>
              </div>
              <Button
                variant="secondary"
                onClick={handleGenerateRecommendation}
                disabled={isRecommendationPending}
                className="gap-2"
              >
                {isRecommendationPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Thinking…</span>
                  </>
                ) : (
                  <>
                    <Compass className="h-4 w-4" />
                    <span>What&apos;s recommended for tomorrow?</span>
                  </>
                )}
              </Button>
            </div>
            {recommendationError ? (
              <Alert variant="destructive">
                <AlertTitle>Recommendation unavailable</AlertTitle>
                <AlertDescription>{recommendationError}</AlertDescription>
              </Alert>
            ) : null}
            <div className="rounded-md border border-border/50 bg-background/80 p-4 text-sm leading-6 text-muted-foreground whitespace-pre-wrap">
              {aiRecommendation ? (
                <>
                  <div className="text-foreground">{aiRecommendation.content}</div>
                  <div className="mt-3 text-xs text-muted-foreground">
                    {aiRecommendation.model ? `Model: ${aiRecommendation.model}` : null}
                    {aiRecommendation.model && aiRecommendation.usage?.totalTokens ? ' · ' : null}
                    {aiRecommendation.usage?.totalTokens ? `Tokens: ${aiRecommendation.usage.totalTokens}` : null}
                  </div>
                </>
              ) : (
                "Request a recommendation to tailor tomorrow's plan."
              )}
            </div>
          </div>
        </CardContent>
      </Card>
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div className="max-w-xl text-sm text-muted-foreground">
          <p>
            Latest metrics computed at{' '}
            {metric?.computedAt ? new Date(metric.computedAt).toLocaleString() : '—'}. Re-run the pipeline to
            refresh derived insights when new algorithms ship.
          </p>
        </div>
        <Button onClick={handleRecompute} disabled={isPending} variant="secondary" className="gap-2">
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Recomputing…</span>
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4" />
              <span>Recompute metrics</span>
            </>
          )}
        </Button>
      </div>
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Computation failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>Ride map (detailed)</CardTitle>
        </CardHeader>
        <CardContent className="h-[420px] rounded-lg border border-dashed p-0">
          {isTrackLoading ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Loading ride map…
            </div>
          ) : trackError ? (
            <div className="flex h-full items-center justify-center px-4 text-sm text-muted-foreground">
              {trackError}
            </div>
          ) : trackPoints.length > 0 ? (
            <RideTrackMap points={trackPoints} bounds={trackBounds} className="h-full w-full" />
          ) : (
            <div className="flex h-full items-center justify-center px-4 text-sm text-muted-foreground">
              No GPS data available for this ride.
            </div>
          )}
        </CardContent>
      </Card>
      <div className="grid gap-4 md:grid-cols-3">
        <MetricSummaryCard
          title="Slope"
          value={slopeDisplay}
          units="bpm/rpm"
          description="Heart rate cost per cadence rpm"
          insight={{
            calculation:
              'Filters cadence ≥20 rpm with valid heart rate, groups the data into 10 rpm buckets that each contain ≥60 s of samples, and fits a Theil–Sen robust regression through the bucket medians to estimate bpm-per-rpm cost.',
            importance:
              'Expresses the marginal heart-rate increase for every additional rpm. Rising slopes highlight higher cardiovascular cost or aerobic decoupling, while lower slopes indicate improved efficiency at a given cadence.',
            usage:
              'Trend this slope across similar endurance rides to watch aerobic durability. Always verify the fit quality (R²) and data coverage before reacting to a sudden change.',
            technicalDetails: [
              { label: 'Current value', value: slopeDetail },
              { label: 'Buckets analyzed', value: hcsrBucketCountDetail },
              { label: 'Valid seconds', value: hcsrValidSecondsDetail },
              { label: 'Regression', value: 'Theil–Sen slope with OLS fallback' },
              { label: 'Cadence filter', value: 'Samples ≥20 rpm with HR & cadence' },
              { label: 'Bucket width', value: '10 rpm bins with ≥60 s data' },
            ],
            notes: ['Requires ≥2 cadence buckets with valid heart rate & cadence observations.'],
          }}
          trendHref={createTrendHref('hcsr.slope_bpm_per_rpm')}
          trendLabel="View slope trend"
        />
        <MetricSummaryCard
          title="R²"
          value={r2Display}
          description="Goodness-of-fit across cadence buckets"
          insight={{
            calculation:
              'Computes the coefficient of determination between the robust regression predictions and the median heart rate observed in each cadence bucket that passed the filtering rules.',
            importance:
              'Shows how much of the heart-rate variance is explained solely by cadence. Values near 1.0 indicate a single slope summarises the ride, while lower values signal noise, decoupling, or missing data.',
            usage:
              'Use R² as a quality gate before comparing slopes between rides. Review the piecewise baseline and bucket coverage if R² drops unexpectedly.',
            technicalDetails: [
              { label: 'Current value', value: r2Detail },
              { label: 'Piecewise R²', value: piecewiseR2Detail },
              { label: 'Buckets analyzed', value: hcsrBucketCountDetail },
              { label: 'Valid seconds', value: hcsrValidSecondsDetail },
              { label: 'Regression inputs', value: 'Median HR per cadence bucket' },
            ],
            notes: ['Piecewise baseline splits the cadence buckets halfway to detect curvature.'],
          }}
          trendHref={createTrendHref('hcsr.r2')}
          trendLabel="View R² trend"
        />
        <MetricSummaryCard
          title="Nonlinearity delta"
          value={nonlinearityDisplay}
          description="Piecewise improvement vs linear fit"
          insight={{
            calculation:
              'Splits the cadence buckets into lower and upper halves, fits ordinary least squares lines to each half, and reports the R² improvement relative to the single global slope.',
            importance:
              'Highlights whether the cadence-to-heart-rate relationship bends across the ride. Larger deltas point to different behaviour at low versus high cadence that a single slope cannot explain.',
            usage:
              'Investigate sizeable deltas alongside the Δ slope and late-ride metrics; plan gearing or pacing strategies if cadence response shifts across the ride.',
            technicalDetails: [
              { label: 'Current value', value: nonlinearityDetail },
              { label: 'Piecewise R²', value: piecewiseR2Detail },
              { label: 'Global R²', value: r2Detail },
              { label: 'Buckets analyzed', value: hcsrBucketCountDetail },
              { label: 'Valid seconds', value: hcsrValidSecondsDetail },
            ],
            notes: ['Requires at least four cadence buckets to evaluate a two-segment fit.'],
          }}
          trendHref={createTrendHref('hcsr.nonlinearity_delta')}
          trendLabel="View nonlinearity trend"
        />
        <MetricSummaryCard
          title="Intercept"
          value={interceptDisplay}
          units="bpm"
          description="Estimated HR at zero cadence"
          insight={{
            calculation:
              'Uses the same robust cadence-to-heart-rate regression to extrapolate the heart rate at 0 rpm, effectively the intercept of the fitted line.',
            importance:
              'Approximates the cardiovascular load independent of cadence. Elevated intercepts can indicate residual fatigue, heat stress, or poor recovery, even if the slope looks normal.',
            usage:
              'Compare against known resting or endurance heart rates when reviewing durability rides. Validate that R² and bucket coverage support trusting this extrapolation.',
            technicalDetails: [
              { label: 'Current value', value: interceptDetail },
              { label: 'Slope input', value: slopeDetail },
              { label: 'Buckets analyzed', value: hcsrBucketCountDetail },
              { label: 'Valid seconds', value: hcsrValidSecondsDetail },
              { label: 'Estimation method', value: 'Theil–Sen intercept (OLS fallback)' },
            ],
          }}
          trendHref={createTrendHref('hcsr.intercept_bpm')}
          trendLabel="View intercept trend"
        />
        <MetricSummaryCard
          title="Half split Δ slope"
          value={deltaSlopeDisplay}
          description="Fatigue signature between ride halves"
          insight={{
            calculation:
              'Fits separate cadence-to-heart-rate slopes for the first and second halves of the ride (time-based) using the same cadence filtering and reports the difference: second-half slope minus first-half slope.',
            importance:
              'Quantifies how cadence efficiency drifts as fatigue accumulates. Positive values indicate the slope steepened later, signalling higher heart-rate cost in the back half.',
            usage:
              'Assess durability by pairing this value with late-ride efficiency and nonlinearity. Large positive shifts warrant recovery focus or fueling review.',
            technicalDetails: [
              { label: 'Current value', value: deltaSlopeDetail },
              { label: 'Ride duration', value: rideDurationDetail },
              {
                label: 'Split point',
                value:
                  halfSplitPointDetail === 'Not available'
                    ? halfSplitPointDetail
                    : `${halfSplitPointDetail} from ride start`,
              },
              { label: 'Cadence filter', value: 'Samples ≥20 rpm with HR & cadence' },
            ],
            notes: ['Each half must contain ≥2 valid cadence-heart-rate pairs for a slope to exist.'],
          }}
          trendHref={createTrendHref('hcsr.half_split_delta_slope')}
          trendLabel="View Δ slope trend"
        />
        <MetricSummaryCard
          title="Valid seconds"
          value={hcsrValidSecondsDisplay === '—' ? '—' : hcsrValidSecondsDisplay}
          description="Data contributing to the analysis"
          insight={{
            calculation:
              'Accumulates the elapsed seconds from samples that met the cadence (≥20 rpm) and heart-rate requirements and were assigned to cadence buckets used in the regression.',
            importance:
              'Higher coverage increases confidence that the slope and R² describe the whole ride rather than a handful of points.',
            usage:
              'Aim for several hundred seconds of valid data before comparing rides. If this value is low, revisit sensor quality or cadence coverage.',
            technicalDetails: [
              { label: 'Current value', value: hcsrValidSecondsDetail },
              { label: 'Buckets analyzed', value: hcsrBucketCountDetail },
              { label: 'Ride duration', value: rideDurationDetail },
              { label: 'Cadence filter', value: 'Samples ≥20 rpm with HR & cadence' },
            ],
            notes: ['Seconds outside valid cadence buckets or lacking heart rate are excluded entirely.'],
          }}
          trendHref={createTrendHref('hcsr.valid_seconds')}
          trendLabel="View valid seconds trend"
        />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <MetricSummaryCard
          title="Adjusted power"
          value={normalizedPowerDisplay}
          units="W"
          description="30 s rolling-power weighted effort"
          insight={{
            calculation:
              'Extracts valid watt samples, builds a 30 second rolling average (window derived from the stream sample rate), raises each window to the 4th power, averages them, and takes the 4th root to produce adjusted power (normalized power).',
            importance:
              'Captures the metabolic cost of surges by weighting higher power more heavily than coasting. It correlates better with physiological load than simple average power.',
            usage:
              'Compare against thresholds (FTP) or prior rides to judge intensity. Pair with the variability index to understand how spiky the effort was.',
            technicalDetails: [
              { label: 'Current value', value: normalizedPowerDetail },
              { label: 'Window length', value: normalizedWindowSecondsDetail },
              { label: 'Samples per window', value: normalizedWindowSampleDetail },
              { label: 'Rolling windows', value: normalizedRollingWindowsDetail },
              { label: 'Valid power samples', value: validPowerSamplesDetail },
              { label: 'Recording rate', value: sampleRateDetail },
            ],
            notes: ['Rolling windows slide sample-by-sample across the activity for maximum resolution.'],
          }}
          trendHref={createTrendHref('normalized-power.normalized_power_w')}
          trendLabel="View adjusted power trend"
        />
        <MetricSummaryCard
          title="Average power"
          value={averagePowerDisplay}
          units="W"
          description="Arithmetic mean of valid power samples"
          insight={{
            calculation:
              'Computes the arithmetic mean of every finite power sample retained for the adjusted power calculation.',
            importance:
              'Provides the baseline load for the ride and acts as the denominator of the variability index.',
            usage:
              'Compare the gap between adjusted and average power to determine whether pacing was smooth or punchy. Use it to double-check expected energy expenditure.',
            technicalDetails: [
              { label: 'Current value', value: averagePowerDetail },
              { label: 'Valid samples', value: validPowerSamplesDetail },
              { label: 'Total recorded', value: normalizedTotalSamplesDetail },
              { label: 'Recording rate', value: sampleRateDetail },
            ],
            notes: ['Invalid, null, or non-numeric watt readings are discarded before computing the mean.'],
          }}
          trendHref={createTrendHref('normalized-power.average_power_w')}
          trendLabel="View average power trend"
        />
        <MetricSummaryCard
          title="Variability index"
          value={variabilityDisplay}
          description="Adjusted to average power ratio"
          insight={{
            calculation:
              'Divides adjusted power by average power to show how much the weighted effort exceeded the arithmetic mean.',
            importance:
              'Measures pacing smoothness. Values close to 1.0 indicate steady efforts, whereas higher numbers highlight surging or technical terrain.',
            usage:
              'Keep endurance rides below ~1.05 to maintain aerobic stability. For races, use the value to assess whether power targets were met given course demands.',
            technicalDetails: [
              { label: 'Current value', value: variabilityDetail },
              { label: 'Adjusted power', value: normalizedPowerDetail },
              { label: 'Average power', value: averagePowerDetail },
              { label: 'Rolling windows', value: normalizedRollingWindowsDetail },
              { label: 'Valid samples', value: validPowerSamplesDetail },
            ],
            notes: ['If average power is zero or missing the variability index cannot be computed.'],
          }}
          trendHref={createTrendHref('normalized-power.variability_index')}
          trendLabel="View variability trend"
        />
        <MetricSummaryCard
          title="Coasting share"
          value={coastingShareDisplay}
          description="Time with ≤5 W of power"
          insight={{
            calculation:
              'Counts valid power samples at or below 5 W and divides by the number of samples that carried watt data in the ride.',
            importance:
              'Quantifies off-pedalling or freewheeling time. Higher percentages suggest either recovery segments, descents, or potential data gaps.',
            usage:
              'Use to review pacing discipline—excess coasting on structured rides may indicate terrain or focus issues. Combine with variability index to explain why adjusted power diverged.',
            technicalDetails: [
              { label: 'Current value', value: coastingSharePercentDetail },
              { label: 'Detail', value: coastingShareDetail },
              { label: 'Valid samples', value: validPowerSamplesDetail },
              { label: 'Threshold', value: 'Samples ≤5 W counted as coasting' },
              { label: 'Recording rate', value: sampleRateDetail },
            ],
            notes: ['Consider terrain context—long descents naturally increase the share even in disciplined rides.'],
          }}
          trendHref={createTrendHref('normalized-power.coasting_share')}
          trendLabel="View coasting trend"
        />
        <MetricSummaryCard
          title="Valid power samples"
          value={validSamplesDisplay}
          description="Samples used in the computation"
          insight={{
            calculation:
              'Counts the number of power readings that were finite numbers after preprocessing the activity stream.',
            importance:
              'Indicates how much of the ride provided usable watt data; downstream metrics rely on these samples.',
            usage:
              'Investigate sudden drops to ensure the power meter recorded properly. Compare to total samples to spot missing data.',
            technicalDetails: [
              { label: 'Current value', value: validPowerSamplesDetail },
              { label: 'Total recorded', value: normalizedTotalSamplesDetail },
              { label: 'Rolling windows', value: normalizedRollingWindowsDetail },
              { label: 'Window length', value: normalizedWindowSecondsDetail },
              { label: 'Recording rate', value: sampleRateDetail },
            ],
            notes: ['Samples without numeric watt data are removed before any rolling-window math executes.'],
          }}
          trendHref={createTrendHref('normalized-power.valid_power_samples')}
          trendLabel="View valid sample trend"
        />
        <MetricSummaryCard
          title="Rolling windows"
          value={rollingWindowsDisplay}
          description={`30 s windows (sample: ${windowSecondsDisplay}s)`}
          insight={{
            calculation:
              'Reports how many 30 second rolling averages were produced from the valid power samples. Each window advances one sample at a time across the stream.',
            importance:
              'More windows mean better temporal coverage for adjusted power. Few windows indicate gaps or extremely short rides.',
            usage:
              'Cross-check with valid sample counts—if window count is low, the adjusted power value may be unstable.',
            technicalDetails: [
              { label: 'Current value', value: normalizedRollingWindowsDetail },
              { label: 'Window length', value: normalizedWindowSecondsDetail },
              { label: 'Samples per window', value: normalizedWindowSampleDetail },
              { label: 'Valid power samples', value: validPowerSamplesDetail },
              { label: 'Recording rate', value: sampleRateDetail },
            ],
            notes: ['Short rides or sparse data reduce rolling-window coverage and can inflate adjusted power.'],
          }}
          trendHref={createTrendHref('normalized-power.rolling_window_count')}
          trendLabel="View rolling windows trend"
        />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <MetricSummaryCard
          title="Median W/HR"
          value={whrMedianDisplay}
          units="W/bpm"
          description="Typical watts per heartbeat across the full ride"
          insight={{
            calculation:
              'Pairs every valid power and heart-rate sample, converts to watts-per-beat, and aggregates the median across adaptive 2–5 minute windows.',
            importance:
              'Summarises baseline aerobic efficiency. Higher medians mean more mechanical work for each cardiac beat.',
            usage:
              'Trend this value on steady endurance rides to monitor aerobic fitness and the impact of heat, fatigue, or fueling.',
            technicalDetails: [
              { label: 'Median', value: whrMedianDetail },
              { label: 'p25', value: whrP25Detail },
              { label: 'p75', value: whrP75Detail },
              { label: 'Window length', value: whrWindowSecondsDetail },
              { label: 'Windows analysed', value: whrWindowCountDetail },
              { label: 'Valid windows', value: whrValidWindowDetail },
            ],
            notes: ['Requires paired power and heart-rate data across the ride.'],
          }}
          trendHref={createTrendHref('whr-efficiency.median_w_per_bpm')}
          trendLabel="View W/HR trend"
        />
        <MetricSummaryCard
          title="Drift vs. first half"
          value={whrDriftPercentDisplay}
          units="%"
          description="Change in watts-per-beat between ride halves"
          insight={{
            calculation:
              'Splits the ratio stream halfway through the ride and compares late median W/HR against the opening half.',
            importance:
              'Highlights aerobic decoupling. Negative drift means efficiency fell later in the ride.',
            usage:
              'Watch for rising drift when heat, fueling, or fatigue issues appear. Pair with late-ride metrics for context.',
            technicalDetails: [
              { label: 'Drift ratio', value: whrDriftRatioDetail },
              { label: 'First-half median', value: whrEarlyMedianDetail },
              { label: 'Second-half median', value: whrLateMedianDetail },
              { label: 'First-half samples', value: whrEarlySampleDetail },
              { label: 'Second-half samples', value: whrLateSampleDetail },
            ],
            notes: ['Zero or positive drift suggests similar or improved efficiency late in the ride.'],
          }}
          trendHref={createTrendHref('whr-efficiency.drift_percent')}
          trendLabel="View drift trend"
        />
        <MetricSummaryCard
          title="Paired coverage"
          value={whrCoveragePercentDisplay}
          units="%"
          description="Share of samples with both power and HR"
          insight={{
            calculation:
              'Counts samples containing numeric watt and heart-rate readings and divides by the total samples processed.',
            importance:
              'Coverage shows how trustworthy the curve is. Sparse coverage weakens window-level insights.',
            usage:
              'Aim for ≥80% coverage before comparing rides. Investigate sensors if coverage drops unexpectedly.',
            technicalDetails: [
              { label: 'Current value', value: whrCoveragePercentDetail },
              { label: 'Detail', value: whrCoverageDetail },
              { label: 'Paired samples', value: whrValidSampleDetail },
              { label: 'Window length', value: whrWindowMinutesDetail },
              { label: 'Windows analysed', value: whrWindowCountDetail },
              { label: 'Sample rate', value: whrSampleRateDetail },
            ],
            notes: ['Low coverage often indicates missing sensors or extensive coasting.'],
          }}
          trendHref={createTrendHref('whr-efficiency.coverage_ratio')}
          trendLabel="View coverage trend"
        />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Watts/HR efficiency curve</CardTitle>
        </CardHeader>
        <CardContent>
          {whrSeries.length > 0 ? (
            <WhrEfficiencyChart series={whrSeries} />
          ) : (
            <p className="text-sm text-muted-foreground">
              Compute the watts-per-heart-rate metric on a ride with paired power and heart rate to visualise efficiency drift.
            </p>
          )}
          <p className="mt-4 text-xs text-muted-foreground">
            Window length: {whrWindowSecondsDisplay !== '—' ? `${whrWindowSecondsDisplay} s` : '—'} (
            {whrWindowMinutesDisplay !== '—' ? `${whrWindowMinutesDisplay} min` : '—'}) · Windows analysed:{' '}
            {whrWindowCountDisplay === '—' ? '—' : whrWindowCountDisplay}
          </p>
        </CardContent>
      </Card>
      <div className="grid gap-4 md:grid-cols-4">
        <MetricSummaryCard
          title="Late-ride W/HR"
          value={lateWattsPerBpmDisplay}
          units="W/bpm"
          description="Power per beat in the durability window"
          insight={{
            calculation:
              'Focuses on the last 35 minutes of the ride (excluding the final 5 minute buffer), averages paired power and heart-rate samples, and divides power by heart rate to report watts per beat.',
            importance:
              'Acts as a durability check—higher ratios show you maintained strong aerobic efficiency late in the ride, while drops can indicate fatigue or cardiac drift.',
            usage:
              'Compare late-ride W/HR across long endurance sessions to confirm durability progress. Review coverage and window stats before trusting trends.',
            technicalDetails: [
              { label: 'Current value', value: lateWattsPerBpmDetail },
              { label: 'Average power', value: lateAveragePowerDetail },
              { label: 'Average heart rate', value: lateAverageHrDetail },
              { label: 'Valid pairs', value: lateValidSamplesDetail },
              { label: 'Window coverage', value: lateCoverageDetail },
              { label: 'Analyzed window', value: lateWindowSecondsDetail },
              { label: 'Requested window', value: lateRequestedWindowDetail },
            ],
            notes: ['Final 5 minutes are excluded to avoid cooldown bias when computing durability.'],
          }}
          trendHref={createTrendHref('late-aerobic-efficiency.watts_per_bpm')}
          trendLabel="View late-ride W/HR trend"
        />
        <MetricSummaryCard
          title="Late-ride avg power"
          value={lateAveragePowerDisplay}
          units="W"
          description="Mean power between -35 and -5 minutes"
          insight={{
            calculation:
              'Calculates the arithmetic mean of power samples that survived the late-ride durability filters (paired with heart rate, within the -35 to -5 minute window).',
            importance:
              'Provides context for the W/HR ratio and shows how much mechanical work you delivered late in the session.',
            usage:
              'Ensure late-ride power is comparable across sessions when evaluating durability. Pair with average heart rate to diagnose decoupling.',
            technicalDetails: [
              { label: 'Current value', value: lateAveragePowerDetail },
              { label: 'Valid pairs', value: lateValidSamplesDetail },
              { label: 'Window coverage', value: lateCoverageDetail },
              { label: 'Analyzed window', value: lateWindowSecondsDetail },
              { label: 'Requested window', value: lateRequestedWindowDetail },
            ],
            notes: ['Power samples lacking matching heart rate are removed before averaging.'],
          }}
          trendHref={createTrendHref('late-aerobic-efficiency.average_power_w')}
          trendLabel="View late-ride power trend"
        />
        <MetricSummaryCard
          title="Late-ride avg HR"
          value={lateAverageHrDisplay}
          units="bpm"
          description="Mean heart rate between -35 and -5 minutes"
          insight={{
            calculation:
              'Averages heart-rate samples that overlap valid power readings within the durability window defined by the metric.',
            importance:
              'Represents cardiovascular strain near the end of the ride. Rising late-ride heart rate for the same power indicates aerobic decoupling.',
            usage:
              'Compare to early-ride heart rates and late-ride power to understand fatigue progression. Use it to calibrate fueling and pacing strategies.',
            technicalDetails: [
              { label: 'Current value', value: lateAverageHrDetail },
              { label: 'Valid pairs', value: lateValidSamplesDetail },
              { label: 'Window coverage', value: lateCoverageDetail },
              { label: 'Analyzed window', value: lateWindowSecondsDetail },
              { label: 'Requested window', value: lateRequestedWindowDetail },
            ],
            notes: ['Heart-rate drift should be interpreted alongside temperature, hydration, and power output.'],
          }}
          trendHref={createTrendHref('late-aerobic-efficiency.average_heart_rate_bpm')}
          trendLabel="View late-ride HR trend"
        />
        <MetricSummaryCard
          title="Valid data coverage"
          value={lateCoverageDisplay}
          description="Portion of window with both power & HR"
          insight={{
            calculation:
              'Divides the number of paired power and heart-rate samples by the total samples available in the late-ride window.',
            importance:
              'Indicates the reliability of all late-ride metrics—low coverage means durability values may be misleading.',
            usage:
              'Aim for ≥80% coverage before drawing conclusions. If coverage is low, inspect sensors or extend the ride for better data.',
            technicalDetails: [
              { label: 'Current value', value: lateCoveragePercentDetail },
              { label: 'Detail', value: lateCoverageDetail },
              { label: 'Valid pairs', value: lateValidSamplesDetail },
              { label: 'Total window samples', value: lateTotalSamplesDetail },
              { label: 'Analyzed window', value: lateWindowSecondsDetail },
              { label: 'Requested window', value: lateRequestedWindowDetail },
            ],
            notes: ['Coverage below 50% suggests the durability window lacks enough overlapping power and heart-rate data.'],
          }}
          trendHref={createTrendHref('late-aerobic-efficiency.valid_sample_coverage_ratio')}
          trendLabel="View durability coverage trend"
        />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Late-ride aerobic efficiency window</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            Requested window: {lateRequestedMinutesDisplay !== '—'
              ? `${lateRequestedMinutesDisplay} min`
              : '—'}{' '}
            (excludes final 5 min)
          </p>
          <p>
            Analyzed window: {lateWindowMinutesDisplay !== '—'
              ? `${lateWindowMinutesDisplay} min`
              : '—'} ({lateWindowSecondsDisplay} s)
          </p>
          <p>
            Valid samples: {formatNumber(lateAerobicSummary.validSamples)} /{' '}
            {formatNumber(lateAerobicSummary.totalWindowSamples)}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>HR-to-Cadence Scaling Ratio buckets</CardTitle>
        </CardHeader>
        <CardContent>
          {hcsrSeries.length > 0 ? (
            <HcsrChart
              buckets={hcsrSeries}
              slope={hcsrSummary.slope ?? null}
              intercept={hcsrSummary.intercept ?? null}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              Upload a ride with valid cadence and heart rate data to visualize the scaling ratio.
            </p>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Adjusted power trend</CardTitle>
        </CardHeader>
        <CardContent>
          {normalizedSeries.length > 0 ? (
            <div className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time (s)</TableHead>
                    <TableHead>Rolling avg (W)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {normalizedSeriesPreview.map((entry) => (
                    <TableRow key={`${entry.t}-${entry.rolling_avg_power_w}`}>
                      <TableCell>{formatNumber(entry.t)}</TableCell>
                      <TableCell>{formatNumber(entry.rolling_avg_power_w, 1)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <p className="text-xs text-muted-foreground">
                Showing {normalizedSeriesPreview.length} of {normalizedSeries.length} windows (last 10).
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Compute the metric on a ride with sufficient power data to view rolling 30 second trends.
            </p>
          )}
        </CardContent>
      </Card>
      {intervalEfficiency ? (
        <Card>
          <CardHeader>
            <CardTitle>Interval Efficiency</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {hasIntervalData ? (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Interval</TableHead>
                      <TableHead>Avg Power</TableHead>
                      <TableHead>Avg HR</TableHead>
                      <TableHead>Avg Cadence</TableHead>
                      <TableHead>Avg Temp</TableHead>
                      <TableHead>W/HR</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {intervalSummaries.map((interval, index) => (
                      <TableRow key={interval.interval ?? index}>
                        <TableCell>{interval.interval ?? index + 1}</TableCell>
                        <TableCell>{formatNumber(interval.avg_power)}</TableCell>
                        <TableCell>{formatNumber(interval.avg_hr)}</TableCell>
                        <TableCell>{formatNumber(interval.avg_cadence)}</TableCell>
                        <TableCell>{formatNumber(interval.avg_temp, 1)}</TableCell>
                        <TableCell>{formatNumber(interval.w_per_hr, 2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <IntervalEfficiencyChart intervals={intervalSummaries} />
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Compute the metric on a ride with heart rate and power data to see hour-by-hour
                efficiency trends.
              </p>
            )}
          </CardContent>
        </Card>
      ) : null}
      <RideComparisonOverlay
        open={isComparisonOpen}
        onOpenChange={setIsComparisonOpen}
        accessToken={session?.accessToken}
        baseActivity={activity}
        baseIntervals={intervalSummaries}
      />
    </div>
  );
}
