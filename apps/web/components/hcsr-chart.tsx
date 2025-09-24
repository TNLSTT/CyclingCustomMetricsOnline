'use client';

import {
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

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

export function HcsrChart({ buckets, slope, intercept }: HcsrChartProps) {
  const data = buckets.map((bucket) => ({
    cadence: bucket.cadenceMid,
    medianHR: bucket.medianHR,
    seconds: bucket.seconds,
    fitted:
      slope != null && intercept != null
        ? Number.parseFloat((intercept + slope * bucket.cadenceMid).toFixed(2))
        : null,
  }));

  return (
    <ResponsiveContainer width="100%" height={320}>
      <ComposedChart data={data} margin={{ top: 16, right: 24, bottom: 16, left: 16 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="cadence" unit="rpm" type="number" domain={['auto', 'auto']} />
        <YAxis unit="bpm" domain={['auto', 'auto']} />
        <Tooltip formatter={(value: unknown) => String(value)} />
        <Legend />
        <Scatter
          dataKey="medianHR"
          name="Median HR"
          fill="hsl(var(--primary))"
          shape="circle"
        />
        {slope != null && intercept != null ? (
          <Line
            type="monotone"
            dataKey="fitted"
            name="Fitted trend"
            stroke="hsl(var(--secondary-foreground))"
            strokeWidth={2}
            dot={false}
          />
        ) : null}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
