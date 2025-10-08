'use client';

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

interface WhrEfficiencyChartPoint {
  windowIndex: number;
  midpointMinutes: number | null;
  percentiles: Record<string, number | null>;
  coverageRatio: number | null;
  sampleCount: number | null;
  validSampleCount: number | null;
}

interface WhrEfficiencyChartProps {
  series: WhrEfficiencyChartPoint[];
}

const DEFAULT_COLORS = ['#38bdf8', '#6366f1', '#f97316', '#22c55e', '#f43f5e', '#eab308'];

export function WhrEfficiencyChart({ series }: WhrEfficiencyChartProps) {
  const percentileKeys = Array.from(
    new Set(series.flatMap((point) => Object.keys(point.percentiles))),
  ).sort();

  const activePercentiles = percentileKeys.filter((key) =>
    series.some((point) => {
      const value = point.percentiles[key];
      return typeof value === 'number' && Number.isFinite(value);
    }),
  );

  if (activePercentiles.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Watts/HR efficiency requires rides with overlapping power and heart-rate data.
      </p>
    );
  }

  const data = series.map((point) => {
    const midpoint =
      point.midpointMinutes != null
        ? Number.parseFloat(point.midpointMinutes.toFixed(2))
        : point.windowIndex;
    const datum: Record<string, number | null> = {
      window: point.windowIndex,
      midpoint,
      coverage: point.coverageRatio,
      validSamples: point.validSampleCount,
    };
    for (const key of activePercentiles) {
      const value = point.percentiles[key];
      datum[key] =
        typeof value === 'number' && Number.isFinite(value)
          ? Number.parseFloat(value.toFixed(3))
          : null;
    }
    return datum;
  });

  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 16, right: 24, bottom: 16, left: 16 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey="midpoint"
          label={{ value: 'Midpoint (min)', position: 'insideBottom', offset: -8 }}
          type="number"
          allowDecimals
          domain={['auto', 'auto']}
        />
        <YAxis
          label={{ value: 'Watts per bpm', angle: -90, position: 'insideLeft' }}
          domain={['auto', 'auto']}
        />
        <Tooltip
          formatter={(value: unknown, name: string) => {
            if (typeof value === 'number') {
              return [value.toFixed(3), name.toUpperCase()];
            }
            if (value == null) {
              return ['—', name.toUpperCase()];
            }
            return [String(value), name.toUpperCase()];
          }}
          labelFormatter={(label: any, payload) => {
            const first = Array.isArray(payload) ? payload[0] : undefined;
            const windowIndex = first?.payload?.window as number | undefined;
            const coverage = first?.payload?.coverage as number | null | undefined;
            const validSamples = first?.payload?.validSamples as number | null | undefined;
            const coverageDisplay =
              typeof coverage === 'number' && Number.isFinite(coverage)
                ? `${Number.parseFloat((coverage * 100).toFixed(1))}% coverage`
                : null;
            const samplesDisplay =
              typeof validSamples === 'number' && Number.isFinite(validSamples)
                ? `${validSamples} valid samples`
                : null;
            const extra = [coverageDisplay, samplesDisplay].filter(Boolean).join(' · ');
            return `Window ${windowIndex ?? label}${extra ? ` (${extra})` : ''}`;
          }}
        />
        <Legend formatter={(value) => value.toUpperCase()} />
        {activePercentiles.map((key, index) => (
          <Line
            key={key}
            type="monotone"
            dataKey={key}
            stroke={DEFAULT_COLORS[index % DEFAULT_COLORS.length]}
            strokeWidth={2}
            dot={false}
            name={key}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
