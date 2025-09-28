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

import type { ActivitySummary } from '../types/activity';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';

interface ActivityTrendsChartProps {
  activities: ActivitySummary[];
}

interface SeriesPoint {
  activityId: string;
  timestamp: number;
  value: number;
  activityLabel: string;
}

interface MetricSeries {
  id: string;
  label: string;
  unit?: string;
  points: SeriesPoint[];
}

function humanize(text: string) {
  return text
    .replace(/[_-]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function guessUnit(field: string) {
  const lower = field.toLowerCase();
  if (lower.includes('w_per_hr')) {
    return 'W/HR';
  }
  if (lower.includes('watts') || lower.includes('power')) {
    return 'W';
  }
  if (lower.includes('hr') || lower.includes('heart')) {
    return 'bpm';
  }
  if (lower.includes('cadence') || lower.includes('rpm')) {
    return 'rpm';
  }
  if (lower.includes('speed')) {
    return 'm/s';
  }
  if (lower.includes('temp')) {
    return '°C';
  }
  if (lower.includes('seconds') || lower.includes('duration')) {
    return 's';
  }
  return undefined;
}

export function ActivityTrendsChart({ activities }: ActivityTrendsChartProps) {
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

  const metricSeries = useMemo<MetricSeries[]>(() => {
    if (activities.length === 0) {
      return [];
    }

    const sortedActivities = [...activities].sort(
      (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
    );

    const map = new Map<string, MetricSeries>();

    map.set('activity.duration', {
      id: 'activity.duration',
      label: 'Ride duration (minutes)',
      unit: 'min',
      points: [],
    });

    for (const activity of sortedActivities) {
      const timestamp = new Date(activity.startTime).getTime();
      const activityLabel = new Date(activity.startTime).toLocaleString();
      const durationMinutes = activity.durationSec / 60;
      const durationSeries = map.get('activity.duration');
      durationSeries?.points.push({
        activityId: activity.id,
        timestamp,
        value: Number.isFinite(durationMinutes) ? Number(durationMinutes.toFixed(2)) : 0,
        activityLabel,
      });

      for (const metric of activity.metrics) {
        const summary = metric.summary as Record<string, unknown>;
        for (const [fieldKey, fieldValue] of Object.entries(summary)) {
          if (typeof fieldValue !== 'number' || !Number.isFinite(fieldValue)) {
            continue;
          }
          const seriesId = `${metric.key}.${fieldKey}`;
          const existing = map.get(seriesId);
          const entry: MetricSeries = existing ?? {
            id: seriesId,
            label: `${humanize(metric.key)} – ${humanize(fieldKey)}`,
            unit: guessUnit(fieldKey),
            points: [],
          };
          entry.points.push({
            activityId: activity.id,
            timestamp,
            value: Number(fieldValue.toFixed(3)),
            activityLabel,
          });
          map.set(seriesId, entry);
        }
      }
    }

    const series = Array.from(map.values()).map((entry) => ({
      ...entry,
      points: entry.points.sort((a, b) => a.timestamp - b.timestamp),
    }));

    series.sort((a, b) => {
      if (a.id === 'activity.duration') {
        return -1;
      }
      if (b.id === 'activity.duration') {
        return 1;
      }
      return a.label.localeCompare(b.label);
    });

    return series;
  }, [activities]);

  const metricOptions = metricSeries.map((series) => ({
    id: series.id,
    label: series.label,
    unit: series.unit,
    count: series.points.length,
  }));

  const [selectedMetricId, setSelectedMetricId] = useState<string | undefined>(() => {
    return metricOptions.at(0)?.id;
  });

  useEffect(() => {
    if (metricOptions.length === 0) {
      setSelectedMetricId(undefined);
      return;
    }
    if (!selectedMetricId || !metricOptions.some((option) => option.id === selectedMetricId)) {
      setSelectedMetricId(metricOptions[0]?.id);
    }
  }, [metricOptions, selectedMetricId]);

  const selectedSeries = useMemo(() => {
    if (metricOptions.length === 0) {
      return undefined;
    }
    const found = metricSeries.find((series) => series.id === selectedMetricId);
    return found ?? metricSeries[0];
  }, [metricSeries, metricOptions.length, selectedMetricId]);

  if (activities.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">No activities yet</CardTitle>
          <CardDescription>Upload a FIT file to unlock personalized trend charts.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!selectedSeries) {
    return null;
  }

  const chartData = selectedSeries.points.map((point) => ({
    date: point.timestamp,
    value: point.value,
    activityId: point.activityId,
    activityLabel: point.activityLabel,
  }));

  const latestHighlights = [...selectedSeries.points]
    .filter((point) => Number.isFinite(point.value))
    .slice(-3)
    .reverse();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold text-foreground">Activity trends</h2>
          <p className="text-sm text-muted-foreground">
            Visualize how your ride duration and computed metrics evolve with every upload.
          </p>
        </div>
        {metricOptions.length > 0 ? (
          <div className="flex items-center gap-2">
            <label htmlFor="metric-select" className="text-sm font-medium text-foreground">
              Metric
            </label>
            <select
              id="metric-select"
              className="flex h-9 items-center rounded-md border border-input bg-background px-3 text-sm shadow-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              value={selectedSeries.id}
              onChange={(event) => setSelectedMetricId(event.target.value)}
            >
              {metricOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label} ({option.count})
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">{selectedSeries.label}</CardTitle>
          <CardDescription>
            {selectedSeries.points.length} activity{selectedSeries.points.length === 1 ? '' : 'ies'} tracked
            {selectedSeries.unit ? ` · ${selectedSeries.unit}` : ''}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="h-[360px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="4 4" stroke="hsl(var(--muted))" />
                <XAxis
                  dataKey="date"
                  type="number"
                  tickFormatter={(value) => dateFormatter.format(new Date(value))}
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                  axisLine={{ stroke: 'hsl(var(--border))' }}
                  tickLine={{ stroke: 'hsl(var(--border))' }}
                  domain={['auto', 'auto']}
                />
                <YAxis
                  tickFormatter={(value) => value.toString()}
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                  axisLine={{ stroke: 'hsl(var(--border))' }}
                  tickLine={{ stroke: 'hsl(var(--border))' }}
                  width={60}
                />
                <Tooltip
                  contentStyle={{ borderRadius: '0.75rem', borderColor: 'hsl(var(--border))' }}
                  labelFormatter={(value) => fullDateFormatter.format(new Date(value))}
                  formatter={(value: number) => {
                    const formattedValue = Number.isFinite(value)
                      ? value.toLocaleString(undefined, {
                          maximumFractionDigits: 2,
                        })
                      : '—';
                    const unit = selectedSeries.unit ? ` ${selectedSeries.unit}` : '';
                    return [`${formattedValue}${unit}`, selectedSeries.label];
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-foreground">Recent highlights</h3>
            {latestHighlights.length > 0 ? (
              <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
                {latestHighlights.map((point) => (
                  <li key={`${selectedSeries.id}-${point.activityId}`}>
                    <span className="font-medium text-foreground">
                      {fullDateFormatter.format(new Date(point.timestamp))}
                    </span>
                    : {point.value.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    {selectedSeries.unit ? ` ${selectedSeries.unit}` : ''}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">
                Once this metric has at least one value we&apos;ll showcase the most recent performances here.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
