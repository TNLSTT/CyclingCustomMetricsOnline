"use client";

import {
  Brush,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from 'recharts';
import { type ChangeEvent, useEffect, useMemo, useState } from 'react';

import { formatDuration } from '../lib/utils';

interface HcsrBucket {
  cadenceMid: number;
  medianHR: number;
  seconds: number;
  hr25?: number;
  hr75?: number;
}

interface HcsrChartProps {
  buckets: HcsrBucket[];
  slope?: number | null;
  intercept?: number | null;
}

type ChartDatum = {
  cadence: number;
  fitted: number | null;
  medianHR: number;
  seconds: number;
};

export function HcsrChart({ buckets, slope, intercept }: HcsrChartProps) {
  const hasTrendLine = slope != null && intercept != null;

  const baseData = useMemo<ChartDatum[]>(
    () =>
      buckets.map((bucket) => ({
        cadence: bucket.cadenceMid,
        medianHR: bucket.medianHR,
        seconds: bucket.seconds,
        fitted:
          slope != null && intercept != null
            ? Number.parseFloat((intercept + slope * bucket.cadenceMid).toFixed(2))
            : null,
      })),
    [buckets, intercept, slope],
  );

  const maxSeconds = useMemo(
    () => baseData.reduce((max, point) => Math.max(max, point.seconds), 0),
    [baseData],
  );

  const [minSeconds, setMinSeconds] = useState(0);
  const [showTrendLine, setShowTrendLine] = useState(hasTrendLine);
  const [autoScaleAxes, setAutoScaleAxes] = useState(true);

  useEffect(() => {
    setShowTrendLine(hasTrendLine);
  }, [hasTrendLine]);

  useEffect(() => {
    if (maxSeconds === 0 && minSeconds !== 0) {
      setMinSeconds(0);
    } else if (maxSeconds > 0 && minSeconds > maxSeconds) {
      setMinSeconds(maxSeconds);
    }
  }, [maxSeconds, minSeconds]);

  const handleMinSecondsChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextValue = Number.parseInt(event.target.value, 10);
    setMinSeconds(Number.isNaN(nextValue) ? 0 : nextValue);
  };

  const sliderMax = useMemo(() => {
    if (maxSeconds <= 0) {
      return 0;
    }
    if (maxSeconds <= 30) {
      return Math.ceil(maxSeconds);
    }
    if (maxSeconds <= 120) {
      return Math.ceil(maxSeconds / 5) * 5;
    }
    return Math.ceil(maxSeconds / 30) * 30;
  }, [maxSeconds]);

  const sliderStep = sliderMax > 120 ? 30 : sliderMax > 30 ? 5 : 1;

  const filteredData = useMemo(
    () => baseData.filter((point) => point.seconds >= minSeconds),
    [baseData, minSeconds],
  );

  const chartData = filteredData.length > 0 ? filteredData : baseData;

  const cadenceExtent = useMemo(() => {
    if (chartData.length === 0) {
      return [0, 0];
    }
    const values = chartData.map((point) => point.cadence);
    return [Math.min(...values), Math.max(...values)];
  }, [chartData]);

  const heartRateExtent = useMemo(() => {
    if (chartData.length === 0) {
      return [0, 0];
    }
    const values = chartData.map((point) => point.medianHR);
    return [Math.min(...values), Math.max(...values)];
  }, [chartData]);

  const xDomain: [number | 'auto', number | 'auto'] = autoScaleAxes
    ? ['auto', 'auto']
    : [
        Math.max(0, cadenceExtent[0] - 5),
        cadenceExtent[1] + 5,
      ];

  const yDomain: [number | 'auto', number | 'auto'] = autoScaleAxes
    ? ['auto', 'auto']
    : [
        Math.max(0, heartRateExtent[0] - 5),
        heartRateExtent[1] + 5,
      ];

  const getPointRadius = (seconds: number) => {
    if (maxSeconds <= 0) {
      return 4;
    }
    const normalized = seconds / maxSeconds;
    return 4 + normalized * 6;
  };

  const renderScatterPoint = ({
    cx,
    cy,
    payload,
  }: {
    cx?: number;
    cy?: number;
    payload?: ChartDatum;
  }) => {
    if (cx == null || cy == null || payload == null) {
      return null;
    }
    const radius = getPointRadius(payload.seconds);
    return (
      <circle
        cx={cx}
        cy={cy}
        r={radius}
        fill="hsl(var(--primary))"
        fillOpacity={0.85}
        stroke="hsl(var(--background))"
        strokeWidth={1}
      />
    );
  };

  const renderTooltip = ({
    active,
    payload,
    label,
  }: TooltipProps<number, string>) => {
    if (!active || !payload || payload.length === 0) {
      return null;
    }

    const point = payload[0].payload as ChartDatum | undefined;

    if (!point) {
      return null;
    }

    return (
      <div className="rounded-md border bg-background p-2 text-xs shadow">
        <p className="font-medium text-foreground">{Math.round(label ?? point.cadence)} rpm</p>
        <p className="text-muted-foreground">
          Median HR: {Math.round(point.medianHR)} bpm
        </p>
        <p className="text-muted-foreground">
          Samples aggregated: {formatDuration(point.seconds)}
        </p>
        {point.fitted != null && showTrendLine ? (
          <p className="text-muted-foreground">
            Fitted trend: {point.fitted.toFixed(1)} bpm
          </p>
        ) : null}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Minimum bucket duration
          </span>
          <div className="flex items-center gap-3">
            <input
              aria-label="Minimum bucket duration"
              className="h-2 w-40 cursor-pointer appearance-none rounded-lg bg-muted"
              disabled={sliderMax === 0}
              max={sliderMax}
              min={0}
              onChange={handleMinSecondsChange}
              step={sliderStep}
              type="range"
              value={Math.min(minSeconds, sliderMax)}
            />
            <span className="tabular-nums text-xs text-muted-foreground">
              ≥ {formatDuration(Math.min(minSeconds, sliderMax))}
            </span>
          </div>
        </label>
        <label className="flex items-center gap-2">
          <input
            checked={showTrendLine && hasTrendLine}
            className="h-4 w-4 rounded border border-input"
            disabled={!hasTrendLine}
            onChange={(event) => setShowTrendLine(event.target.checked)}
            type="checkbox"
          />
          <span className="text-xs font-medium text-foreground">
            Show fitted trend
          </span>
        </label>
        <label className="flex items-center gap-2">
          <input
            checked={autoScaleAxes}
            className="h-4 w-4 rounded border border-input"
            onChange={(event) => setAutoScaleAxes(event.target.checked)}
            type="checkbox"
          />
          <span className="text-xs font-medium text-foreground">Auto-scale axes</span>
        </label>
      </div>
      <ResponsiveContainer width="100%" height={360}>
        <ComposedChart data={chartData} margin={{ top: 24, right: 24, bottom: 24, left: 16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted-foreground) / 0.4)" />
          <XAxis
            dataKey="cadence"
            domain={xDomain}
            label={{ value: 'Cadence (rpm)', position: 'insideBottom', offset: -16 }}
            tick={{ fontSize: 12 }}
            type="number"
          />
          <YAxis
            domain={yDomain}
            label={{ angle: -90, offset: 10, position: 'insideLeft', value: 'Heart rate (bpm)' }}
            tick={{ fontSize: 12 }}
          />
          <Tooltip content={renderTooltip} cursor={{ strokeDasharray: '4 4' }} />
          <Legend verticalAlign="top" height={36} iconType="circle" />
          <Scatter
            dataKey="medianHR"
            name="Median HR"
            shape={renderScatterPoint}
          />
          {showTrendLine && hasTrendLine ? (
            <Line
              dataKey="fitted"
              dot={false}
              name="Fitted trend"
              stroke="hsl(var(--secondary-foreground))"
              strokeWidth={2}
              type="monotone"
            />
          ) : null}
          <Brush
            className="text-xs"
            dataKey="cadence"
            height={26}
            stroke="hsl(var(--muted-foreground))"
            travellerWidth={10}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
