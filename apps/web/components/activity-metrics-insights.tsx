'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import type { ActivitySummary, MetricSummary } from '../types/activity';
import { Badge } from './ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

interface ActivityMetricsInsightsProps {
  activities: ActivitySummary[];
}

type MetricOption = {
  id: string;
  metricKey: string;
  label: string;
  units?: string;
  description: string;
  accessor: (summary: Record<string, unknown>) => number | null;
};

const metricOptions: MetricOption[] = [
  {
    id: 'hcsr:slope',
    metricKey: 'hcsr',
    label: 'HCSR slope',
    units: 'bpm/rpm',
    description:
      'Tracks how heart rate scales with cadence — useful for spotting fatigue and neuromuscular changes.',
    accessor: (summary) =>
      typeof summary.slope_bpm_per_rpm === 'number' ? summary.slope_bpm_per_rpm : null,
  },
  {
    id: 'hcsr:r2',
    metricKey: 'hcsr',
    label: 'HCSR model fit (R²)',
    description:
      'Assesses how consistently your heart rate responds to cadence across an entire ride.',
    accessor: (summary) => (typeof summary.r2 === 'number' ? summary.r2 : null),
  },
  {
    id: 'normalized-power:np',
    metricKey: 'normalized-power',
    label: 'Normalized power',
    units: 'W',
    description: 'Captures ride intensity by weighting surges more heavily than steady pacing.',
    accessor: (summary) =>
      typeof summary.normalized_power_w === 'number' ? summary.normalized_power_w : null,
  },
  {
    id: 'late-aerobic-efficiency:watt-bpm',
    metricKey: 'late-aerobic-efficiency',
    label: 'Late aerobic efficiency',
    units: 'W/bpm',
    description:
      'Shows power per heartbeat during the final stretch of a ride to monitor aerobic decoupling.',
    accessor: (summary) =>
      typeof summary.watts_per_bpm === 'number' ? summary.watts_per_bpm : null,
  },
];

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
});

function getMetricSummary(metrics: MetricSummary[], metricKey: string) {
  return metrics.find((metric) => metric.key === metricKey)?.summary ?? null;
}

function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  if (hours === 0) {
    return `${minutes} min`;
  }
  if (minutes === 0) {
    return `${hours} hr`;
  }
  return `${hours} hr ${minutes} min`;
}

export function ActivityMetricsInsights({ activities }: ActivityMetricsInsightsProps) {
  const computedOptions = useMemo(() => {
    return metricOptions.map((option) => {
      const points = activities
        .map((activity) => {
          const summary = getMetricSummary(activity.metrics, option.metricKey);
          if (!summary) {
            return null;
          }
          const value = option.accessor(summary as Record<string, unknown>);
          if (value == null) {
            return null;
          }
          const start = new Date(activity.startTime);
          return {
            activityId: activity.id,
            timestamp: start.getTime(),
            label: dateFormatter.format(start),
            iso: start.toISOString(),
            value,
            durationSec: activity.durationSec,
          };
        })
        .filter((point): point is NonNullable<typeof point> => point !== null)
        .sort((a, b) => a.timestamp - b.timestamp);

      return { option, points };
    });
  }, [activities]);

  const availableOptions = computedOptions.filter((entry) => entry.points.length > 0);
  const [selectedId, setSelectedId] = useState<string>(
    () => availableOptions[0]?.option.id ?? metricOptions[0].id,
  );

  useEffect(() => {
    if (!availableOptions.some((entry) => entry.option.id === selectedId)) {
      const fallback = availableOptions[0]?.option.id ?? metricOptions[0].id;
      setSelectedId(fallback);
    }
  }, [availableOptions, selectedId]);

  const selectedEntry = availableOptions.find((entry) => entry.option.id === selectedId);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base font-semibold">Activity trends</CardTitle>
              <p className="text-sm text-muted-foreground">
                Explore how your favorite metrics evolve across the rides you have uploaded.
              </p>
            </div>
            <div className="space-y-1 text-sm">
              <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Metric
              </label>
              <select
                value={selectedId}
                onChange={(event) => setSelectedId(event.target.value)}
                className="flex h-9 min-w-[220px] rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {computedOptions.map(({ option, points }) => (
                  <option key={option.id} value={option.id} disabled={points.length === 0}>
                    {option.label}
                    {points.length === 0 ? ' — compute this metric to unlock' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {selectedEntry ? (
            <p className="text-xs text-muted-foreground">
              {selectedEntry.option.description}
              {selectedEntry.option.units ? ` • ${selectedEntry.option.units}` : ''}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Compute metrics like normalized power or HCSR on your activities to unlock interactive charts.
            </p>
          )}
        </CardHeader>
        <CardContent className="space-y-6">
          {selectedEntry ? (
            <ResponsiveContainer height={340}>
              <LineChart data={selectedEntry.points} margin={{ top: 16, right: 24, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="4 4" className="stroke-muted" />
                <XAxis
                  dataKey="timestamp"
                  type="number"
                  tickFormatter={(value) => dateFormatter.format(new Date(value))}
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  tickLine={false}
                />
                <YAxis
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  tickLine={false}
                  width={selectedEntry.option.units ? 64 : 48}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    borderRadius: '0.5rem',
                    border: '1px solid hsl(var(--border))',
                  }}
                  labelFormatter={(value) => new Date(value).toLocaleString()}
                  formatter={(value: number) => [`${value.toFixed(2)}${selectedEntry.option.units ? ` ${selectedEntry.option.units}` : ''}`, selectedEntry.option.label]}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="hsl(var(--chart-1))"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="rounded-lg border border-dashed p-12 text-center text-sm text-muted-foreground">
              Upload activities and run metrics to populate this chart.
            </div>
          )}

          {selectedEntry ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{selectedEntry.points.length} rides</Badge>
                {selectedEntry.option.units ? (
                  <Badge variant="secondary">Units: {selectedEntry.option.units}</Badge>
                ) : null}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {selectedEntry.points
                  .slice()
                  .reverse()
                  .slice(0, 6)
                  .map((point) => (
                    <div
                      key={`${selectedEntry.option.id}-${point.activityId}`}
                      className="rounded-lg border bg-background/40 p-4 text-sm"
                    >
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{new Date(point.iso).toLocaleString()}</span>
                        <span>{formatDuration(point.durationSec)}</span>
                      </div>
                      <p className="mt-2 text-lg font-semibold text-foreground">
                        {point.value.toFixed(2)}
                        {selectedEntry.option.units ? ` ${selectedEntry.option.units}` : ''}
                      </p>
                      <p className="text-xs text-muted-foreground">Activity ID: {point.activityId}</p>
                    </div>
                  ))}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
