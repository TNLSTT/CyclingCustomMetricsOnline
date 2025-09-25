'use client';

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import type { IntervalEfficiencyInterval } from '../types/activity';

interface IntervalEfficiencyChartProps {
  intervals: IntervalEfficiencyInterval[];
}

export function IntervalEfficiencyChart({ intervals }: IntervalEfficiencyChartProps) {
  const data = intervals
    .filter((interval) => interval.interval != null && interval.w_per_hr != null)
    .map((interval) => ({
      interval: interval.interval as number,
      efficiency: Number.parseFloat((interval.w_per_hr as number).toFixed(2)),
    }));

  if (data.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Interval efficiency requires both power and heart rate data for each hour of the ride.
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 16, right: 24, bottom: 16, left: 16 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey="interval"
          label={{ value: 'Interval (hours)', position: 'insideBottom', offset: -8 }}
          type="number"
          allowDecimals={false}
          domain={['auto', 'auto']}
        />
        <YAxis
          dataKey="efficiency"
          domain={['auto', 'auto']}
          label={{ value: 'Watts per bpm', angle: -90, position: 'insideLeft' }}
        />
        <Tooltip
          formatter={(value: unknown) =>
            typeof value === 'number' ? value.toFixed(2) : String(value ?? '')
          }
          labelFormatter={(label) => `Interval ${label}`}
        />
        <Line
          type="monotone"
          dataKey="efficiency"
          name="W/HR"
          stroke="hsl(var(--primary))"
          strokeWidth={2}
          dot={{ r: 3 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
