'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Area,
  Bar,
  Brush,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Download, LineChart as LineChartIcon, RefreshCcw } from 'lucide-react';

import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Skeleton } from './ui/skeleton';
import { Badge } from './ui/badge';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { cn } from '../lib/utils';
import { logMetricEvent } from '../lib/api';

interface TrendPoint {
  bucket: string;
  value: number | null;
  n: number;
}

interface TrendResponse {
  metric: string;
  bucket: string;
  timezone: string;
  points: TrendPoint[];
}

interface ActivityTrendsChartProps {
  initialMetricId?: string;
  initialBucket?: string;
}

type MetricKey = 'avg-power' | 'avg-hr' | 'kilojoules' | 'tss' | 'durable-tss' | 'duration-hours';
type BucketKey = 'day' | 'week' | 'month';

interface MetricOption {
  id: MetricKey;
  label: string;
  description: string;
  unit: string;
}

interface BucketOption {
  id: BucketKey;
  label: string;
  description: string;
}

interface TrendSeriesPoint {
  date: Date;
  value: number | null;
  n: number;
  label: string;
}

interface TrendSeries {
  metric: MetricKey;
  bucket: BucketKey;
  timezone: string;
  points: TrendSeriesPoint[];
}

interface MovingAverageSeries {
  key: string;
  label: string;
  color: string;
  data: Array<{ date: Date; value: number | null }>;
}

interface QuantileBandPoint {
  date: Date;
  lower: number | null;
  upper: number | null;
}

const METRIC_OPTIONS: MetricOption[] = [
  {
    id: 'avg-power',
    label: 'Average power',
    description: 'Mean ride power weighted by sample counts.',
    unit: 'W',
  },
  {
    id: 'avg-hr',
    label: 'Average heart rate',
    description: 'Mean ride heart rate using valid HR samples.',
    unit: 'bpm',
  },
  {
    id: 'kilojoules',
    label: 'Total kilojoules',
    description: 'Daily energy expenditure across all rides.',
    unit: 'kJ',
  },
  {
    id: 'duration-hours',
    label: 'Ride hours',
    description: 'Cumulative moving time converted to hours.',
    unit: 'h',
  },
  {
    id: 'tss',
    label: 'Training Stress Score',
    description: 'Approximate TSS using normalized load versus FTP.',
    unit: 'TSS',
  },
  {
    id: 'durable-tss',
    label: 'Durable TSS',
    description: 'Late-ride TSS calculated after the 1000 kJ mark.',
    unit: 'TSS',
  },
];

const BUCKET_OPTIONS: BucketOption[] = [
  { id: 'day', label: 'Daily', description: 'Individual activity days with fine detail.' },
  { id: 'week', label: 'Weekly', description: 'Week-over-week progression across blocks.' },
  { id: 'month', label: 'Monthly', description: 'Long-term training phase trends.' },
];

const SPARKLINE_METRICS: MetricKey[] = [
  'avg-power',
  'avg-hr',
  'kilojoules',
  'duration-hours',
  'tss',
  'durable-tss',
];

const globalTrendCache = new Map<string, { data: TrendSeries; timestamp: number }>();
const CACHE_TTL_MS = 1000 * 60 * 5;
const FETCH_DEBOUNCE_MS = 250;

function toCacheKey(metric: MetricKey, bucket: BucketKey, tz: string) {
  return `${metric}:${bucket}:${tz}`;
}

function resolveTimeZone(): string {
  if (typeof window === 'undefined') {
    return 'UTC';
  }
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch (error) {
    return 'UTC';
  }
}

function normalizeSeries(response: TrendResponse): TrendSeries {
  return {
    metric: response.metric as MetricKey,
    bucket: response.bucket as BucketKey,
    timezone: response.timezone,
    points: [...response.points]
      .map((point) => ({
        date: new Date(point.bucket),
        value: typeof point.value === 'number' && Number.isFinite(point.value) ? point.value : null,
        n: point.n,
        label: new Date(point.bucket).toLocaleString(undefined, {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        }),
      }))
      .sort((a, b) => a.date.getTime() - b.date.getTime()),
  } satisfies TrendSeries;
}

async function fetchTrendSeries(
  metric: MetricKey,
  bucket: BucketKey,
  tz: string,
  signal?: AbortSignal,
): Promise<TrendSeries> {
  const params = new URLSearchParams({ metric, bucket, tz });
  const response = await fetch(`/api/trends?${params.toString()}`, { signal });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || 'Failed to load trend data.');
  }
  const payload = (await response.json()) as TrendResponse;
  return normalizeSeries(payload);
}

interface UseTrendSeriesState {
  data: TrendSeries | null;
  isLoading: boolean;
  error: Error | null;
}

function useTrendSeries(metric: MetricKey, bucket: BucketKey, tz: string): UseTrendSeriesState {
  const [state, setState] = useState<UseTrendSeriesState>({ data: null, isLoading: true, error: null });
  const debounceRef = useRef<number | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const key = toCacheKey(metric, bucket, tz);
    const cached = globalTrendCache.get(key);
    const now = Date.now();
    if (cached && now - cached.timestamp < CACHE_TTL_MS) {
      setState({ data: cached.data, isLoading: false, error: null });
      return;
    }

    setState((previous) => ({ ...previous, isLoading: true, error: null }));

    const controller = new AbortController();
    abortControllerRef.current?.abort();
    abortControllerRef.current = controller;

    if (debounceRef.current != null) {
      window.clearTimeout(debounceRef.current);
    }

    debounceRef.current = window.setTimeout(async () => {
      try {
        const data = await fetchTrendSeries(metric, bucket, tz, controller.signal);
        globalTrendCache.set(key, { data, timestamp: Date.now() });
        setState({ data, isLoading: false, error: null });
      } catch (error) {
        if ((error as Error).name === 'AbortError') {
          return;
        }
        setState({ data: null, isLoading: false, error: error as Error });
      }
    }, FETCH_DEBOUNCE_MS);

    return () => {
      if (debounceRef.current != null) {
        window.clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      controller.abort();
    };
  }, [metric, bucket, tz]);

  return state;
}

function computeWindowSize(bucket: BucketKey, days: number) {
  const bucketDays: Record<BucketKey, number> = { day: 1, week: 7, month: 30 };
  const ratio = Math.max(1, Math.round(days / bucketDays[bucket]));
  return ratio;
}

function computeMovingAverage(
  points: TrendSeriesPoint[],
  windowSize: number,
): Array<{ date: Date; value: number | null }> {
  if (windowSize <= 1) {
    return points.map((point) => ({ date: point.date, value: point.value }));
  }

  const averages: Array<{ date: Date; value: number | null }> = [];
  const window: number[] = [];

  for (let index = 0; index < points.length; index += 1) {
    const value = points[index]?.value ?? null;
    if (value != null) {
      window.push(value);
    }
    if (window.length > windowSize) {
      window.shift();
    }

    if (window.length === windowSize) {
      const sum = window.reduce((total, current) => total + current, 0);
      averages.push({ date: points[index]!.date, value: Number((sum / window.length).toFixed(2)) });
    } else {
      averages.push({ date: points[index]!.date, value: null });
    }
  }

  return averages;
}

function computeRollingQuantiles(
  points: TrendSeriesPoint[],
  windowSize: number,
): QuantileBandPoint[] {
  if (points.length === 0) {
    return [];
  }

  const band: QuantileBandPoint[] = [];
  const window: number[] = [];

  for (let index = 0; index < points.length; index += 1) {
    const value = points[index]?.value ?? null;
    if (value != null) {
      window.push(value);
    }
    if (window.length > windowSize) {
      window.shift();
    }

    if (window.length < 3) {
      band.push({ date: points[index]!.date, lower: null, upper: null });
      continue;
    }

    const sorted = [...window].sort((a, b) => a - b);
    const lowerIndex = Math.floor((sorted.length - 1) * 0.25);
    const upperIndex = Math.floor((sorted.length - 1) * 0.75);
    band.push({
      date: points[index]!.date,
      lower: Number(sorted[lowerIndex]!.toFixed(2)),
      upper: Number(sorted[upperIndex]!.toFixed(2)),
    });
  }

  return band;
}

interface CompareSeriesResult {
  current: TrendSeriesPoint[];
  previous: TrendSeriesPoint[];
}

function computeCompareSeries(points: TrendSeriesPoint[], bucket: BucketKey): CompareSeriesResult {
  if (points.length === 0) {
    return { current: [], previous: [] };
  }

  const daysPerBucket: Record<BucketKey, number> = { day: 1, week: 7, month: 30 };
  const now = points[points.length - 1]!.date;
  const bucketMs = daysPerBucket[bucket] * 24 * 60 * 60 * 1000;
  const windowMs = 8 * 7 * 24 * 60 * 60 * 1000; // 8 weeks
  const currentStart = new Date(now.getTime() - windowMs + bucketMs);
  const previousEnd = new Date(currentStart.getTime() - bucketMs);
  const previousStart = new Date(previousEnd.getTime() - windowMs + bucketMs);

  const current = points.filter((point) => point.date >= currentStart);
  const previousRaw = points.filter((point) => point.date >= previousStart && point.date <= previousEnd);

  const shiftedPrevious = previousRaw.map((point) => ({
    ...point,
    date: new Date(point.date.getTime() + windowMs),
  }));

  return { current, previous: shiftedPrevious };
}

function buildChartData(points: TrendSeriesPoint[]) {
  return points.map((point) => ({
    date: point.date.getTime(),
    value: point.value,
    n: point.n,
    label: point.label,
  }));
}

function exportCsv(series: TrendSeries, averages: MovingAverageSeries[], filename: string) {
  const headers = ['Bucket', 'Value', 'Sample count', ...averages.map((entry) => entry.label)];
  const rows = series.points.map((point, index) => {
    const averageValues = averages.map((entry) => entry.data[index]?.value ?? '');
    const base = [point.date.toISOString(), point.value ?? '', point.n.toString(), ...averageValues];
    return base.join(',');
  });
  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${filename}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function exportPng(container: HTMLDivElement | null, filename: string) {
  if (!container) {
    return;
  }
  const svg = container.querySelector('svg');
  if (!svg) {
    return;
  }

  const serializer = new XMLSerializer();
  const svgString = serializer.serializeToString(svg);
  const canvas = document.createElement('canvas');
  const bounds = svg.getBoundingClientRect();
  const scale = window.devicePixelRatio || 1;
  canvas.width = bounds.width * scale;
  canvas.height = bounds.height * scale;
  const context = canvas.getContext('2d');
  if (!context) {
    return;
  }
  context.scale(scale, scale);

  const image = new Image();
  image.onload = () => {
    context.clearRect(0, 0, bounds.width, bounds.height);
    context.drawImage(image, 0, 0, bounds.width, bounds.height);
    const url = canvas.toDataURL('image/png');
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${filename}.png`;
    anchor.click();
  };
  const encoded = window.btoa(unescape(encodeURIComponent(svgString)));
  image.src = `data:image/svg+xml;base64,${encoded}`;
}

interface SparklineData {
  metric: MetricKey;
  series: TrendSeries | null;
}

function SparklineGrid({
  bucket,
  timezone,
  activeMetric,
  onSelect,
}: {
  bucket: BucketKey;
  timezone: string;
  activeMetric: MetricKey;
  onSelect: (metric: MetricKey) => void;
}) {
  const [data, setData] = useState<Record<MetricKey, TrendSeries | null>>({
    'avg-power': null,
    'avg-hr': null,
    kilojoules: null,
    'duration-hours': null,
    tss: null,
    'durable-tss': null,
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    setIsLoading(true);
    Promise.all(
      SPARKLINE_METRICS.map(async (metric) => {
        const key = toCacheKey(metric, bucket, timezone);
        const cached = globalTrendCache.get(key);
        if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
          return { metric, series: cached.data } satisfies SparklineData;
        }
        try {
          const series = await fetchTrendSeries(metric, bucket, timezone);
          globalTrendCache.set(key, { data: series, timestamp: Date.now() });
          return { metric, series } satisfies SparklineData;
        } catch (error) {
          return { metric, series: null } satisfies SparklineData;
        }
      }),
    ).then((entries) => {
      if (!mounted) {
        return;
      }
      const map: Record<MetricKey, TrendSeries | null> = {
        'avg-power': null,
        'avg-hr': null,
        kilojoules: null,
        'duration-hours': null,
        tss: null,
        'durable-tss': null,
      };
      for (const entry of entries) {
        map[entry.metric] = entry.series;
      }
      setData(map);
      setIsLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, [bucket, timezone]);

  return (
    <div className="grid gap-3 md:grid-cols-3">
      {SPARKLINE_METRICS.map((metric) => {
        const option = METRIC_OPTIONS.find((entry) => entry.id === metric)!;
        const series = data[metric];
        const chartData = series ? buildChartData(series.points).slice(-24) : [];
        return (
          <button
            type="button"
            key={metric}
            onClick={() => onSelect(metric)}
            className={cn(
              'group flex flex-col rounded-xl border border-border bg-card/70 p-4 text-left transition hover:-translate-y-0.5 hover:border-primary hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              activeMetric === metric && 'border-primary shadow-md',
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-foreground">{option.label}</span>
              {activeMetric === metric ? (
                <Badge variant="secondary">Active</Badge>
              ) : null}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{option.description}</p>
            <div className="mt-3 h-16 w-full">
              {isLoading && !series ? (
                <Skeleton className="h-full w-full" />
              ) : series && chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" vertical={false} />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="hsl(var(--primary))"
                      strokeWidth={1.5}
                      dot={false}
                      isAnimationActive={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center rounded bg-muted text-xs text-muted-foreground">
                  No data
                </div>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function EmptyState() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">No rides found</CardTitle>
        <CardDescription>
          Upload a FIT file to populate your training history and unlock trend analytics.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button asChild>
          <a href="/upload">Upload a FIT</a>
        </Button>
      </CardContent>
    </Card>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <Alert variant="destructive">
      <AlertTitle>Unable to load trends</AlertTitle>
      <AlertDescription className="flex flex-col gap-3 text-sm">
        <span>{message}</span>
        <Button variant="outline" size="sm" className="self-start" asChild>
          <a href="/activities">Change filter</a>
        </Button>
      </AlertDescription>
    </Alert>
  );
}

export function ActivityTrendsChart({ initialMetricId, initialBucket }: ActivityTrendsChartProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tz = resolveTimeZone();

  const defaultMetric = initialMetricId && METRIC_OPTIONS.some((option) => option.id === initialMetricId)
    ? (initialMetricId as MetricKey)
    : 'avg-power';
  const defaultBucket = initialBucket && BUCKET_OPTIONS.some((option) => option.id === initialBucket)
    ? (initialBucket as BucketKey)
    : 'day';

  const [metric, setMetric] = useState<MetricKey>(defaultMetric);
  const [bucket, setBucket] = useState<BucketKey>(defaultBucket);
  const [showSevenDayAverage, setShowSevenDayAverage] = useState(true);
  const [showTwentyEightDayAverage, setShowTwentyEightDayAverage] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [showQuantileBand, setShowQuantileBand] = useState(true);
  const [activeTooltipIndex, setActiveTooltipIndex] = useState<number | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('metric', metric);
    params.set('bucket', bucket);
    router.replace(`?${params.toString()}`);
  }, [router, searchParams, metric, bucket]);

  const { data: series, isLoading, error } = useTrendSeries(metric, bucket, tz);
  const contextMetric = metric === 'kilojoules' ? metric : 'kilojoules';
  const { data: contextSeries } = useTrendSeries(contextMetric, bucket, tz);

  const movingAverages = useMemo(() => {
    if (!series) {
      return [];
    }
    const windowSeven = computeWindowSize(series.bucket, 7);
    const windowTwentyEight = computeWindowSize(series.bucket, 28);
    const averages: MovingAverageSeries[] = [];
    if (showSevenDayAverage) {
      averages.push({
        key: 'ma-7',
        label: '7-day average',
        color: 'hsl(var(--primary))',
        data: computeMovingAverage(series.points, windowSeven),
      });
    }
    if (showTwentyEightDayAverage) {
      averages.push({
        key: 'ma-28',
        label: '28-day average',
        color: 'hsl(var(--muted-foreground))',
        data: computeMovingAverage(series.points, windowTwentyEight),
      });
    }
    return averages;
  }, [series, showSevenDayAverage, showTwentyEightDayAverage]);

  const quantileBand = useMemo(() => {
    if (!series || !showQuantileBand) {
      return [];
    }
    const window = computeWindowSize(series.bucket, 21);
    return computeRollingQuantiles(series.points, window);
  }, [series, showQuantileBand]);

  const compareSeries = useMemo(() => {
    if (!series || !compareMode) {
      return { current: [], previous: [] };
    }
    return computeCompareSeries(series.points, series.bucket);
  }, [series, compareMode]);

  const chartData = useMemo(() => (series ? buildChartData(series.points) : []), [series]);
  const quantileData = useMemo(
    () =>
      quantileBand
        .filter((entry) => entry.lower != null && entry.upper != null)
        .map((entry) => ({
          date: entry.date.getTime(),
          lower: entry.lower!,
          band: Number((entry.upper! - entry.lower!).toFixed(2)),
        })),
    [quantileBand],
  );

  const movingAverageData = useMemo(() =>
    movingAverages.map((average) =>
      average.data.map((entry) => ({ date: entry.date.getTime(), value: entry.value })),
    ),
  [movingAverages]);

  const compareData = useMemo(() => ({
    current: compareSeries.current.map((entry) => ({
      date: entry.date.getTime(),
      value: entry.value,
    })),
    previous: compareSeries.previous.map((entry) => ({
      date: entry.date.getTime(),
      value: entry.value,
    })),
  }), [compareSeries]);

  const contextData = useMemo(() => {
    if (!contextSeries) {
      return [];
    }
    return buildChartData(contextSeries.points).map((entry) => ({
      date: entry.date,
      contextValue: entry.value,
    }));
  }, [contextSeries]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (!chartData.length) {
        return;
      }
      if (event.key === 'ArrowRight') {
        setActiveTooltipIndex((index) => {
          if (index == null) {
            return 0;
          }
          return Math.min(index + 1, chartData.length - 1);
        });
      } else if (event.key === 'ArrowLeft') {
        setActiveTooltipIndex((index) => {
          if (index == null) {
            return chartData.length - 1;
          }
          return Math.max(index - 1, 0);
        });
      }
    }

    window.addEventListener('keydown', handleKeyDown as any);
    return () => {
      window.removeEventListener('keydown', handleKeyDown as any);
    };
  }, [chartData.length]);

  useEffect(() => {
    setActiveTooltipIndex(null);
  }, [metric, bucket]);

  const latestPoint = series?.points.at(-1);

  const metricOption = METRIC_OPTIONS.find((entry) => entry.id === metric)!;

  const defaultBrushStartIndex = useMemo(() => {
    if (!chartData.length) {
      return 0;
    }
    const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;
    const latestTime = chartData[chartData.length - 1]!.date;
    const target = latestTime - ninetyDaysMs;
    const index = chartData.findIndex((entry) => entry.date >= target);
    return index >= 0 ? index : 0;
  }, [chartData]);

  const authToken = session?.accessToken;

  const handleExportCsv = useCallback(() => {
    if (!series) {
      return;
    }
    const filename = `${series.metric}-${series.bucket}-trend`;
    if (authToken) {
      void logMetricEvent(
        {
          type: 'feature_click',
          meta: {
            feature: 'Export',
            format: 'csv',
            metric: series.metric,
            bucket: series.bucket,
          },
        },
        authToken,
      );
      void logMetricEvent(
        {
          type: 'export',
          success: true,
          meta: {
            format: 'csv',
            metric: series.metric,
            bucket: series.bucket,
          },
        },
        authToken,
      );
    }
    exportCsv(series, movingAverages, filename);
  }, [authToken, movingAverages, series]);

  const handleExportPng = useCallback(() => {
    if (!series) {
      return;
    }
    const filename = `${series.metric}-${series.bucket}-trend`;
    if (authToken) {
      void logMetricEvent(
        {
          type: 'feature_click',
          meta: {
            feature: 'Export',
            format: 'png',
            metric: series.metric,
            bucket: series.bucket,
          },
        },
        authToken,
      );
      void logMetricEvent(
        {
          type: 'export',
          success: true,
          meta: {
            format: 'png',
            metric: series.metric,
            bucket: series.bucket,
          },
        },
        authToken,
      );
    }
    exportPng(containerRef.current, filename);
  }, [authToken, series]);

  if (error) {
    return <ErrorState message={error.message} />;
  }

  if (!isLoading && (!series || series.points.length === 0)) {
    return <EmptyState />;
  }

  return (
    <div className="space-y-8">
      <div className="grid gap-4 rounded-2xl border border-border bg-card/70 p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <LineChartIcon className="h-4 w-4" />
              <span>Training signal</span>
            </div>
            <h2 className="text-2xl font-semibold text-foreground">Activity trends</h2>
            <p className="text-sm text-muted-foreground">
              Compare rolling volume, intensity, and efficiency to understand how your training load evolves.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 shadow-sm">
              <span className="text-xs font-medium text-muted-foreground">Metric</span>
              <select
                className="bg-transparent text-sm font-medium text-foreground focus:outline-none"
                value={metric}
                onChange={(event) => setMetric(event.target.value as MetricKey)}
              >
                {METRIC_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 shadow-sm">
              <span className="text-xs font-medium text-muted-foreground">Bucket</span>
              <select
                className="bg-transparent text-sm font-medium text-foreground focus:outline-none"
                value={bucket}
                onChange={(event) => setBucket(event.target.value as BucketKey)}
              >
                {BUCKET_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 shadow-sm">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="compare-toggle">
                Compare
              </label>
              <input
                id="compare-toggle"
                type="checkbox"
                className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                checked={compareMode}
                onChange={(event) => setCompareMode(event.target.checked)}
              />
            </div>
            <div className="flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 shadow-sm">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="quantile-toggle">
                Variability band
              </label>
              <input
                id="quantile-toggle"
                type="checkbox"
                className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                checked={showQuantileBand}
                onChange={(event) => setShowQuantileBand(event.target.checked)}
              />
            </div>
          </div>
        </div>
        <SparklineGrid bucket={bucket} timezone={tz} activeMetric={metric} onSelect={setMetric} />
      </div>

      <Card ref={containerRef} className="overflow-hidden">
        <CardHeader className="gap-4 md:flex md:flex-row md:items-start md:justify-between">
          <div>
            <CardTitle className="text-base font-semibold">{metricOption.label}</CardTitle>
            <CardDescription>{metricOption.description}</CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExportCsv} className="gap-2">
              <Download className="h-4 w-4" /> CSV
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportPng} className="gap-2">
              <Download className="h-4 w-4" /> PNG
            </Button>
            <div className="flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 shadow-sm">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="ma-7-toggle">
                7d avg
              </label>
              <input
                id="ma-7-toggle"
                type="checkbox"
                className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                checked={showSevenDayAverage}
                onChange={(event) => setShowSevenDayAverage(event.target.checked)}
              />
            </div>
            <div className="flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 shadow-sm">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="ma-28-toggle">
                28d avg
              </label>
              <input
                id="ma-28-toggle"
                type="checkbox"
                className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                checked={showTwentyEightDayAverage}
                onChange={(event) => setShowTwentyEightDayAverage(event.target.checked)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="h-[420px] w-full">
            {isLoading && !series ? (
              <Skeleton className="h-full w-full" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={chartData}
                  margin={{ top: 20, right: 24, left: 0, bottom: 0 }}
                  onMouseMove={(state) => {
                    if (typeof state.activeTooltipIndex === 'number') {
                      setActiveTooltipIndex(state.activeTooltipIndex);
                    }
                  }}
                  onMouseLeave={() => setActiveTooltipIndex(null)}
                  activeTooltipIndex={activeTooltipIndex ?? undefined}
                >
                  <CartesianGrid strokeDasharray="4 4" stroke="hsl(var(--muted))" />
                  <XAxis
                    dataKey="date"
                    type="number"
                    tickFormatter={(value) => new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                    domain={['auto', 'auto']}
                  />
                  <YAxis
                    yAxisId="primary"
                    tickFormatter={(value) => value.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                    axisLine={{ stroke: 'hsl(var(--border))' }}
                    tickLine={{ stroke: 'hsl(var(--border))' }}
                    width={72}
                  />
                  <YAxis
                    yAxisId="context"
                    orientation="right"
                    hide
                    tickFormatter={(value) => value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  />
                  <RechartsTooltip
                    labelFormatter={(value) => new Date(value).toLocaleString()}
                    contentStyle={{ borderRadius: 12, borderColor: 'hsl(var(--border))' }}
                    formatter={(value: number, name) => {
                      if (name === 'contextValue') {
                        return [`${value.toLocaleString(undefined, { maximumFractionDigits: 0 })} kJ`, 'Energy'];
                      }
                      const formatted = Number.isFinite(value)
                        ? value.toLocaleString(undefined, { maximumFractionDigits: 2 })
                        : '—';
                      return [metricOption.unit ? `${formatted} ${metricOption.unit}` : formatted, metricOption.label];
                    }}
                  />
                  <Legend />
                  {showQuantileBand && quantileData.length > 0 ? (
                    <>
                      <Area
                        yAxisId="primary"
                        type="monotone"
                        data={quantileData}
                        dataKey="lower"
                        stroke="none"
                        fill="transparent"
                        stackId="quantile"
                        isAnimationActive={false}
                      />
                      <Area
                        yAxisId="primary"
                        type="monotone"
                        data={quantileData}
                        dataKey="band"
                        stroke="none"
                        fill="url(#quantileGradient)"
                        stackId="quantile"
                        isAnimationActive={false}
                        name="P25-P75"
                      />
                    </>
                  ) : null}
                  <Bar
                    data={contextData}
                    dataKey="contextValue"
                    yAxisId="context"
                    name="Energy"
                    fill="hsl(var(--muted))"
                    barSize={8}
                    opacity={0.4}
                  />
                  <Line
                    yAxisId="primary"
                    type="monotone"
                    dataKey="value"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2.5}
                    dot={false}
                    isAnimationActive={false}
                    name={metricOption.label}
                  />
                  {movingAverageData.map((data, index) => (
                    <Line
                      key={movingAverages[index]!.key}
                      yAxisId="primary"
                      type="monotone"
                      data={data}
                      dataKey="value"
                      stroke={movingAverages[index]!.color}
                      strokeWidth={1.5}
                      strokeDasharray="6 6"
                      dot={false}
                      name={movingAverages[index]!.label}
                    />
                  ))}
                  {compareMode ? (
                    <Line
                      yAxisId="primary"
                      type="monotone"
                      data={compareData.current}
                      dataKey="value"
                      stroke="hsl(var(--primary))"
                      strokeWidth={3}
                      dot={false}
                      name="Last 8 weeks"
                    />
                  ) : null}
                  {compareMode ? (
                    <Line
                      yAxisId="primary"
                      type="monotone"
                      data={compareData.previous}
                      dataKey="value"
                      stroke="hsl(var(--secondary))"
                      strokeWidth={2}
                      strokeDasharray="4 4"
                      dot={false}
                      name="Previous 8 weeks"
                    />
                  ) : null}
                  <Brush
                    travellerWidth={12}
                    dataKey="date"
                    startIndex={defaultBrushStartIndex}
                    height={24}
                    stroke="hsl(var(--primary))"
                  />
                  <defs>
                    <linearGradient id="quantileGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.12} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="grid gap-4 rounded-xl border border-border bg-muted/20 p-4 md:grid-cols-2">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Latest highlight</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {latestPoint
                  ? `${latestPoint.label}: ${latestPoint.value?.toLocaleString(undefined, {
                      maximumFractionDigits: 1,
                    }) ?? '—'} ${metricOption.unit}`
                  : 'Once new rides are processed, highlights will appear here.'}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <RefreshCcw className="h-4 w-4" />
              Updated automatically after each upload · Bucketed by {bucket} · {series?.timezone ?? tz}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
