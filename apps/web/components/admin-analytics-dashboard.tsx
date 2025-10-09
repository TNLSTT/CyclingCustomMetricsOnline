'use client';

import { memo, useMemo } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import type { AdminAnalyticsOverview, SignupFunnelStep } from '../types/admin-analytics';
import { cn } from '../lib/utils';

type AdminAnalyticsDashboardProps = {
  overview: AdminAnalyticsOverview;
};

function formatPercentSafe(value: number): string {
  if (!Number.isFinite(value) || Number.isNaN(value)) {
    return '0%';
  }
  return `${(value * 100).toFixed(1)}%`;
}

function formatRelativeDateLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function SummaryStat({ label, value, sublabel }: { label: string; value: string; sublabel?: string }) {
  return (
    <div className="flex flex-col space-y-1">
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      <span className="text-2xl font-semibold text-foreground">{value}</span>
      {sublabel ? <span className="text-xs text-muted-foreground">{sublabel}</span> : null}
    </div>
  );
}

const SparklineCard = memo(function SparklineCard({ overview }: { overview: AdminAnalyticsOverview }) {
  const data = overview.acquisition.newSignups.daily;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>New signups per day</CardDescription>
        <CardTitle className="text-3xl font-semibold">{data[data.length - 1]?.count ?? 0}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2">
          <SummaryStat label="Avg (7d)" value={overview.acquisition.newSignups.average7d.toFixed(1)} />
          <SummaryStat label="Avg (30d)" value={overview.acquisition.newSignups.average30d.toFixed(1)} />
        </div>
        <div className="mt-6 h-32">
          <ResponsiveContainer>
            <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="signupSparkline" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" hide />
              <YAxis hide domain={[0, (max: number) => max * 1.2]} />
              <Tooltip
                contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderRadius: 'var(--radius)' }}
                formatter={(value: number) => [`${value} signups`, '']}
                labelFormatter={(label: string) => formatRelativeDateLabel(label)}
              />
              <Area type="monotone" dataKey="count" stroke="var(--primary)" fill="url(#signupSparkline)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
});

const SignupFunnelCard = memo(function SignupFunnelCard({ overview }: { overview: AdminAnalyticsOverview }) {
  const funnel = overview.acquisition.signupToFirstUpload;
  const stages: SignupFunnelStep[] = funnel.steps;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>Signup → first upload funnel</CardDescription>
        <CardTitle className="text-xl font-semibold">{funnel.usersWithUpload} activated users</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Stage</TableHead>
              <TableHead>Users</TableHead>
              <TableHead className="text-right">Conversion</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stages.map((step) => (
              <TableRow key={step.label}>
                <TableCell className="font-medium">{step.label}</TableCell>
                <TableCell>
                  {step.count}/{funnel.totalSignups}
                </TableCell>
                <TableCell className="text-right">{formatPercentSafe(step.conversion)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <p className="text-xs text-muted-foreground">
          Within 24h: {formatPercentSafe(funnel.conversion24h)} • Within 7d: {formatPercentSafe(funnel.conversion7d)}
        </p>
      </CardContent>
    </Card>
  );
});

const HistogramCard = memo(function HistogramCard({ overview }: { overview: AdminAnalyticsOverview }) {
  const data = overview.acquisition.timeToFirstValue;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>Time to first value</CardDescription>
        <CardTitle className="text-xl font-semibold">Minutes from signup → upload</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-48">
          <ResponsiveContainer>
            <BarChart data={data} margin={{ top: 16, right: 16, left: 0, bottom: 16 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" interval={0} tickLine={false} axisLine={false} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={32} />
              <Tooltip
                contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderRadius: 'var(--radius)' }}
                formatter={(value: number, _name, { payload }) => [`${value} users`, payload.label as string]}
              />
              <Bar dataKey="count" fill="var(--primary)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
});

const SourceCard = memo(function SourceCard({ overview }: { overview: AdminAnalyticsOverview }) {
  const sources = overview.acquisition.signupsBySource;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Signup sources</CardTitle>
        <CardDescription>Share of signups by source (last 30 days)</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {sources.length === 0 ? (
          <p className="text-sm text-muted-foreground">No attribution data available.</p>
        ) : (
          <Table>
            <TableBody>
              {sources.map((source) => (
                <TableRow key={source.source}>
                  <TableCell className="capitalize">{source.source}</TableCell>
                  <TableCell>{source.count}</TableCell>
                  <TableCell className="text-right">{formatPercentSafe(source.percentage)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
});

const ActiveUsersCard = memo(function ActiveUsersCard({ overview }: { overview: AdminAnalyticsOverview }) {
  const active = overview.engagement.activeUsers;
  const data = active.series;

  return (
    <Card className="md:col-span-2">
      <CardHeader className="pb-2">
        <CardTitle className="text-xl font-semibold">Active users</CardTitle>
        <CardDescription>DAU/WAU/MAU over the last 90 days</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-4">
          <SummaryStat label="DAU" value={String(active.current.dau)} />
          <SummaryStat label="WAU" value={String(active.current.wau)} />
          <SummaryStat label="MAU" value={String(active.current.mau)} />
          <SummaryStat label="Stickiness" value={formatPercentSafe(active.current.stickiness)} />
        </div>
        <div className="mt-6 h-64">
          <ResponsiveContainer>
            <AreaChart data={data} margin={{ top: 20, right: 16, left: 0, bottom: 0 }}>
              <XAxis dataKey="date" tickFormatter={formatRelativeDateLabel} minTickGap={24} />
              <YAxis tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderRadius: 'var(--radius)' }}
                labelFormatter={(label) => formatRelativeDateLabel(label)}
              />
              <Area type="monotone" dataKey="mau" stroke="#64748b" fill="rgba(148,163,184,0.25)" name="MAU" />
              <Area type="monotone" dataKey="wau" stroke="#10b981" fill="rgba(16,185,129,0.2)" name="WAU" />
              <Area type="monotone" dataKey="dau" stroke="hsl(var(--primary))" fill="rgba(99,102,241,0.2)" name="DAU" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
});

const RetentionHeatmap = memo(function RetentionHeatmap({ overview }: { overview: AdminAnalyticsOverview }) {
  const cohorts = overview.engagement.retentionCohorts;
  const maxValue = useMemo(() => {
    return cohorts.reduce((max, cohort) => {
      const cohortMax = cohort.retention.reduce((innerMax, entry) => Math.max(innerMax, entry.value), 0);
      return Math.max(max, cohortMax);
    }, 0);
  }, [cohorts]);

  return (
    <Card className="md:col-span-2">
      <CardHeader>
        <CardTitle>Activation retention milestones</CardTitle>
        <CardDescription>Cohorts by signup week — day 0/1/7/30 activity share</CardDescription>
      </CardHeader>
      <CardContent>
        {cohorts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No cohorts available in the last 12 weeks.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cohort week</TableHead>
                  {cohorts[0]?.retention.map((entry) => (
                    <TableHead key={entry.label} className="text-center">
                      {entry.label}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {cohorts.map((cohort) => (
                  <TableRow key={cohort.cohort}>
                    <TableCell>
                      {formatRelativeDateLabel(cohort.cohort)}
                      <span className="ml-1 text-xs text-muted-foreground">({cohort.size})</span>
                    </TableCell>
                    {cohort.retention.map((entry) => {
                      const intensity = maxValue > 0 ? entry.value / maxValue : 0;
                      return (
                        <TableCell key={`${cohort.cohort}-${entry.label}`} className="text-center">
                          <span
                            className={cn(
                              'inline-flex min-w-[48px] justify-center rounded-md px-2 py-1 text-sm font-semibold text-background',
                            )}
                            style={{ backgroundColor: `rgba(99,102,241,${Math.max(0.2, intensity)})` }}
                          >
                            {formatPercentSafe(entry.value)}
                          </span>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
});

const ReturningUsersCard = memo(function ReturningUsersCard({ overview }: { overview: AdminAnalyticsOverview }) {
  const leaderboard = overview.engagement.returningUsers;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Returning users leaderboard</CardTitle>
        <CardDescription>Users with 3+ active days this week</CardDescription>
      </CardHeader>
      <CardContent>
        {leaderboard.length === 0 ? (
          <p className="text-sm text-muted-foreground">No returning users yet this week.</p>
        ) : (
          <ul className="space-y-3">
            {leaderboard.map((entry) => (
              <li key={entry.userId} className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">{entry.email.replace(/(.{2}).+(@.*)/, '$1***$2')}</p>
                  <p className="text-xs text-muted-foreground">{entry.activeDays} active days</p>
                </div>
                <span className="text-sm text-muted-foreground">{entry.activityCount} activities</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
});

const SessionsCard = memo(function SessionsCard({ overview }: { overview: AdminAnalyticsOverview }) {
  const sessions = overview.engagement.sessions;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sessions</CardTitle>
        <CardDescription>Page view derived session stats (last 30 days)</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-3">
        <SummaryStat label="Total sessions" value={sessions.totalSessions.toLocaleString()} />
        <SummaryStat label="Avg sessions/user" value={sessions.averageSessionsPerUser.toFixed(2)} />
        <SummaryStat label="Median length" value={`${sessions.medianSessionMinutes} min`} />
      </CardContent>
    </Card>
  );
});

const UploadsCard = memo(function UploadsCard({ overview }: { overview: AdminAnalyticsOverview }) {
  const daily = overview.usage.uploadsPerDay.slice(-7);
  const topUsers = overview.usage.uploadsPerUser.slice(0, 5);
  return (
    <Card className="md:col-span-2">
      <CardHeader>
        <CardTitle>Uploads</CardTitle>
        <CardDescription>Success vs failure split and top uploaders</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h4 className="text-sm font-semibold text-muted-foreground">Daily (last 7 days)</h4>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Success</TableHead>
                <TableHead>Failed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {daily.map((day) => (
                <TableRow key={day.date}>
                  <TableCell>{formatRelativeDateLabel(day.date)}</TableCell>
                  <TableCell>{day.success}</TableCell>
                  <TableCell>{day.failed}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div>
          <h4 className="text-sm font-semibold text-muted-foreground">Top uploaders</h4>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Success</TableHead>
                <TableHead>Failed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {topUsers.map((user) => (
                <TableRow key={user.userId}>
                  <TableCell>{user.email.replace(/(.{2}).+(@.*)/, '$1***$2')}</TableCell>
                  <TableCell>{user.success}</TableCell>
                  <TableCell>{user.failed}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
});

const RecomputeCard = memo(function RecomputeCard({ overview }: { overview: AdminAnalyticsOverview }) {
  const daily = overview.usage.recompute.daily.slice(-7);
  const topUsers = overview.usage.recompute.topUsers.slice(0, 5);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recompute usage</CardTitle>
        <CardDescription>Trigger volume and power users</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h4 className="text-sm font-semibold text-muted-foreground">Daily</h4>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Runs</TableHead>
                <TableHead>Unique users</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {daily.map((day) => (
                <TableRow key={day.date}>
                  <TableCell>{formatRelativeDateLabel(day.date)}</TableCell>
                  <TableCell>{day.count}</TableCell>
                  <TableCell>{day.uniqueUsers}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div>
          <h4 className="text-sm font-semibold text-muted-foreground">Top users</h4>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Runs</TableHead>
                <TableHead>Last run</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {topUsers.map((user) => (
                <TableRow key={user.userId}>
                  <TableCell>{user.email.replace(/(.{2}).+(@.*)/, '$1***$2')}</TableCell>
                  <TableCell>{user.count}</TableCell>
                  <TableCell>{user.lastRunAt ? formatRelativeDateLabel(user.lastRunAt) : '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
});

const TopActivitiesCard = memo(function TopActivitiesCard({ overview }: { overview: AdminAnalyticsOverview }) {
  const activities = overview.usage.topActivities.slice(0, 10);
  return (
    <Card className="md:col-span-2">
      <CardHeader>
        <CardTitle>Top viewed activities</CardTitle>
        <CardDescription>Most viewed workouts across 7/30 day windows</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Activity</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Views</TableHead>
              <TableHead>Window</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {activities.map((activity) => (
              <TableRow key={`${activity.activityId}-${activity.window}`}>
                <TableCell>{activity.title ?? activity.activityId}</TableCell>
                <TableCell>{activity.owner.replace(/(.{2}).+(@.*)/, '$1***$2')}</TableCell>
                <TableCell>{activity.views}</TableCell>
                <TableCell>{activity.window}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
});

const MetricCoverageCard = memo(function MetricCoverageCard({ overview }: { overview: AdminAnalyticsOverview }) {
  const rows = overview.usage.metricCoverage;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Metric coverage</CardTitle>
        <CardDescription>Share of activities with key metrics computed</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Metric</TableHead>
              <TableHead>Coverage</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.metricKey}>
                <TableCell className="capitalize">{row.metricName}</TableCell>
                <TableCell>{formatPercentSafe(row.coverage)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <p className="mt-2 text-xs text-muted-foreground">
          Total activities evaluated: {overview.usage.metricCoverage[0]?.totalActivities.toLocaleString() ?? '0'}
        </p>
      </CardContent>
    </Card>
  );
});

const ParseFailuresCard = memo(function ParseFailuresCard({ overview }: { overview: AdminAnalyticsOverview }) {
  const failures = overview.quality.parseFailures;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Parse failure breakdown</CardTitle>
        <CardDescription>Failure codes from FIT ingest attempts</CardDescription>
      </CardHeader>
      <CardContent>
        {failures.length === 0 ? (
          <p className="text-sm text-muted-foreground">No parse failures recorded in the last 30 days.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Error code</TableHead>
                <TableHead>Count</TableHead>
                <TableHead>Share</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {failures.map((failure) => (
                <TableRow key={failure.errorCode}>
                  <TableCell className="capitalize">{failure.errorCode}</TableCell>
                  <TableCell>{failure.count}</TableCell>
                  <TableCell>{formatPercentSafe(failure.percentage)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
});

const LatencyCard = memo(function LatencyCard({ overview }: { overview: AdminAnalyticsOverview }) {
  const upload = overview.quality.latency.upload;
  const recompute = overview.quality.latency.recompute;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Latency percentiles</CardTitle>
        <CardDescription>Upload and recompute durations (milliseconds)</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        <div>
          <h4 className="text-sm font-semibold text-muted-foreground">Upload</h4>
          <div className="grid gap-2 md:grid-cols-3">
            <SummaryStat label="P50" value={`${Math.round(upload.p50)} ms`} />
            <SummaryStat label="P95" value={`${Math.round(upload.p95)} ms`} />
            <SummaryStat label="P99" value={`${Math.round(upload.p99)} ms`} />
          </div>
        </div>
        <div>
          <h4 className="text-sm font-semibold text-muted-foreground">Recompute</h4>
          <div className="grid gap-2 md:grid-cols-3">
            <SummaryStat label="P50" value={`${Math.round(recompute.p50)} ms`} />
            <SummaryStat label="P95" value={`${Math.round(recompute.p95)} ms`} />
            <SummaryStat label="P99" value={`${Math.round(recompute.p99)} ms`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

const RetryCard = memo(function RetryCard({ overview }: { overview: AdminAnalyticsOverview }) {
  const retry = overview.quality.retry;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Retry insights</CardTitle>
        <CardDescription>Repeated ingest attempts across upload failures</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-3">
        <SummaryStat label="Retry rate" value={formatPercentSafe(retry.retryRate)} />
        <SummaryStat label="Mean retries" value={retry.meanRetries.toFixed(2)} />
        <SummaryStat label="Samples" value={String(retry.sampleSize)} />
      </CardContent>
    </Card>
  );
});

const BadDataCard = memo(function BadDataCard({ overview }: { overview: AdminAnalyticsOverview }) {
  const flagged = overview.quality.badData.slice(0, 5);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Bad data detector</CardTitle>
        <CardDescription>Users with >20% failed uploads in the last 7 days</CardDescription>
      </CardHeader>
      <CardContent>
        {flagged.length === 0 ? (
          <p className="text-sm text-muted-foreground">No users exceeded the failure threshold.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Failure rate</TableHead>
                <TableHead>Attempts</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {flagged.map((user) => (
                <TableRow key={user.userId}>
                  <TableCell>{user.email.replace(/(.{2}).+(@.*)/, '$1***$2')}</TableCell>
                  <TableCell>{formatPercentSafe(user.failureRate)}</TableCell>
                  <TableCell>{user.totalUploads}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
});

const PerformanceCard = memo(function PerformanceCard({ overview }: { overview: AdminAnalyticsOverview }) {
  const dbEndpoints = overview.performance.db.slice(0, 5);
  const storage = overview.performance.storage;
  const recompute = overview.performance.recomputeCost;
  return (
    <Card className="md:col-span-2">
      <CardHeader>
        <CardTitle>Performance & cost</CardTitle>
        <CardDescription>Endpoint load, storage footprint, recompute spend</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          <SummaryStat label="Uploads dir" value={`${(storage.uploadsDirBytes / 1_000_000).toFixed(1)} MB`} />
          <SummaryStat
            label="Postgres"
            value={storage.postgresBytes != null ? `${(storage.postgresBytes / 1_000_000).toFixed(1)} MB` : 'n/a'}
          />
          <SummaryStat label="Recompute minutes" value={recompute.totalMinutes.toFixed(1)} sublabel={`≈$${recompute.estimatedUsd.toFixed(2)}`} />
        </div>
        <div>
          <h4 className="text-sm font-semibold text-muted-foreground">Slowest endpoints</h4>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Endpoint</TableHead>
                <TableHead>Avg ms</TableHead>
                <TableHead>Queries</TableHead>
                <TableHead>Reqs</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dbEndpoints.map((endpoint) => (
                <TableRow key={`${endpoint.method}-${endpoint.path}`}>
                  <TableCell>
                    <span className="font-medium">{endpoint.method}</span> {endpoint.path}
                  </TableCell>
                  <TableCell>{endpoint.avgDurationMs.toFixed(1)}</TableCell>
                  <TableCell>{endpoint.avgQueryCount.toFixed(1)}</TableCell>
                  <TableCell>{endpoint.requestCount}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
});

const SegmentsCard = memo(function SegmentsCard({ overview }: { overview: AdminAnalyticsOverview }) {
  const devices = overview.cohorts.devices;
  const segments = overview.cohorts.userSegments;
  const geo = overview.cohorts.geo;
  return (
    <Card className="md:col-span-2">
      <CardHeader>
        <CardTitle>Cohorts & segmentation</CardTitle>
        <CardDescription>Device mix, behavioral clusters, and top geos</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <h4 className="text-sm font-semibold text-muted-foreground">Device sources</h4>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Device</TableHead>
                  <TableHead>Count</TableHead>
                  <TableHead>Share</TableHead>
                  <TableHead>Window</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {devices.slice(0, 6).map((device, index) => (
                  <TableRow key={`${device.device}-${index}`}>
                    <TableCell className="capitalize">{device.device}</TableCell>
                    <TableCell>{device.count}</TableCell>
                    <TableCell>{formatPercentSafe(device.percentage)}</TableCell>
                    <TableCell>{device.window}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-muted-foreground">User segments</h4>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Segment</TableHead>
                  <TableHead>Users</TableHead>
                  <TableHead>Uploads</TableHead>
                  <TableHead>Views</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {segments.map((segment) => (
                  <TableRow key={segment.label}>
                    <TableCell>{segment.label}</TableCell>
                    <TableCell>{segment.count}</TableCell>
                    <TableCell>{segment.centroid.uploads.toFixed(1)}</TableCell>
                    <TableCell>{segment.centroid.views.toFixed(1)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
        <div>
          <h4 className="text-sm font-semibold text-muted-foreground">Top geos</h4>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Country</TableHead>
                <TableHead>Users</TableHead>
                <TableHead>Share</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {geo.map((entry) => (
                <TableRow key={entry.country}>
                  <TableCell>{entry.country}</TableCell>
                  <TableCell>{entry.count}</TableCell>
                  <TableCell>{formatPercentSafe(entry.percentage)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
});

const ConversionCard = memo(function ConversionCard({ overview }: { overview: AdminAnalyticsOverview }) {
  const funnel = overview.conversion.funnel;
  const activation = overview.conversion.activation.slice(-6);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Conversion funnel & activation</CardTitle>
        <CardDescription>Week-over-week step counts and cohort activation rates</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h4 className="text-sm font-semibold text-muted-foreground">Signup → export funnel</h4>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Step</TableHead>
                <TableHead>Current week</TableHead>
                <TableHead>Prev week</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {funnel.map((step) => (
                <TableRow key={step.step}>
                  <TableCell>{step.step}</TableCell>
                  <TableCell>{step.currentCount}</TableCell>
                  <TableCell>{step.previousWeekCount}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div>
          <h4 className="text-sm font-semibold text-muted-foreground">Activation rate (3 uploads + 1 recompute within 7d)</h4>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cohort</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Rate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activation.map((cohort) => (
                <TableRow key={cohort.cohort}>
                  <TableCell>{formatRelativeDateLabel(cohort.cohort)}</TableCell>
                  <TableCell>{cohort.cohortSize}</TableCell>
                  <TableCell>{formatPercentSafe(cohort.activationRate)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
});

const ReliabilityCard = memo(function ReliabilityCard({ overview }: { overview: AdminAnalyticsOverview }) {
  const availability = overview.reliability.availability;
  const queue = overview.reliability.queue;
  const exceptions = overview.reliability.exceptions.slice(0, 5);
  return (
    <Card className="md:col-span-2">
      <CardHeader>
        <CardTitle>Reliability & SLOs</CardTitle>
        <CardDescription>Availability, queue health, and top exceptions (24h)</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          <SummaryStat label="Current availability" value={formatPercentSafe(availability.current)} />
          <SummaryStat label="Error ratio" value={formatPercentSafe(availability.errorRatio)} />
          <SummaryStat label="Burn rate" value={availability.burnRate.toFixed(2)} />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <SummaryStat label="Queue depth" value={String(queue.depth)} />
          <SummaryStat label="Oldest job" value={queue.oldestMinutes != null ? `${queue.oldestMinutes} min` : '—'} />
        </div>
        <div>
          <h4 className="text-sm font-semibold text-muted-foreground">Top exceptions</h4>
          {exceptions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No exceptions recorded in the last 24 hours.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Count</TableHead>
                  <TableHead>Sample stack</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {exceptions.map((exception) => (
                  <TableRow key={exception.name}>
                    <TableCell>{exception.name}</TableCell>
                    <TableCell>{exception.count}</TableCell>
                    <TableCell>
                      <pre className="max-h-24 overflow-hidden whitespace-pre-wrap text-xs text-muted-foreground">
                        {exception.sampleStack ?? '—'}
                      </pre>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </CardContent>
    </Card>
  );
});

const SafetyCard = memo(function SafetyCard({ overview }: { overview: AdminAnalyticsOverview }) {
  const suspicious = overview.safety.suspicious.slice(0, 5);
  const storage = overview.safety.storage;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Safety & housekeeping</CardTitle>
        <CardDescription>Upload spikes and storage reconciliation</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h4 className="text-sm font-semibold text-muted-foreground">Suspicious spikes</h4>
          {suspicious.length === 0 ? (
            <p className="text-sm text-muted-foreground">No abnormal upload bursts detected.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Uploads (10m)</TableHead>
                  <TableHead>Window start</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {suspicious.map((entry) => (
                  <TableRow key={entry.userId}>
                    <TableCell>{entry.email.replace(/(.{2}).+(@.*)/, '$1***$2')}</TableCell>
                    <TableCell>{entry.uploads}</TableCell>
                    <TableCell>{formatRelativeDateLabel(entry.windowStart)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <SummaryStat label="Orphaned files" value={String(storage.orphanCount)} />
          <SummaryStat label="Activities" value={storage.dbActivityCount.toLocaleString()} />
          <SummaryStat label="Scanned" value={formatRelativeDateLabel(storage.scannedAt)} />
        </div>
      </CardContent>
    </Card>
  );
});

const UxCard = memo(function UxCard({ overview }: { overview: AdminAnalyticsOverview }) {
  const clicks = overview.ux.featureClicks;
  const empty = overview.ux.emptyStates;
  return (
    <Card>
      <CardHeader>
        <CardTitle>UX signals</CardTitle>
        <CardDescription>Feature clicks and empty state frequency</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h4 className="text-sm font-semibold text-muted-foreground">Feature clicks (14d)</h4>
          {clicks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No click telemetry recorded.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Feature</TableHead>
                  <TableHead>Clicks</TableHead>
                  <TableHead>Share</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clicks.map((click) => (
                  <TableRow key={click.feature}>
                    <TableCell>{click.feature}</TableCell>
                    <TableCell>{click.count}</TableCell>
                    <TableCell>{formatPercentSafe(click.percentage)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
        <SummaryStat
          label="Empty state rate"
          value={formatPercentSafe(empty.rate)}
          sublabel={`${empty.emptySessions}/${empty.totalSessions} sessions`}
        />
      </CardContent>
    </Card>
  );
});

const AlertsCard = memo(function AlertsCard({ overview }: { overview: AdminAnalyticsOverview }) {
  const banners = overview.alerts.banners;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Realtime alerts</CardTitle>
        <CardDescription>Threshold breaches evaluated over the last 10 minutes</CardDescription>
      </CardHeader>
      <CardContent>
        {banners.length === 0 ? (
          <p className="text-sm text-muted-foreground">All clear — no active alerts.</p>
        ) : (
          <ul className="space-y-3">
            {banners.map((banner, index) => (
              <li key={`${banner.type}-${index}`} className="rounded-lg border p-3 text-sm">
                <span className="font-semibold uppercase text-muted-foreground">{banner.type}</span>
                <p>{banner.message}</p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
});

export function AdminAnalyticsDashboard({ overview }: AdminAnalyticsDashboardProps) {
  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Acquisition & activation</h2>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <SparklineCard overview={overview} />
          <SignupFunnelCard overview={overview} />
          <HistogramCard overview={overview} />
          <SourceCard overview={overview} />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Engagement & retention</h2>
        <div className="grid gap-6 md:grid-cols-2">
          <ActiveUsersCard overview={overview} />
          <RetentionHeatmap overview={overview} />
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          <ReturningUsersCard overview={overview} />
          <SessionsCard overview={overview} />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Usage of core features</h2>
        <div className="grid gap-6 md:grid-cols-3">
          <UploadsCard overview={overview} />
          <RecomputeCard overview={overview} />
          <MetricCoverageCard overview={overview} />
        </div>
        <TopActivitiesCard overview={overview} />
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Quality & failures</h2>
        <div className="grid gap-6 md:grid-cols-3">
          <ParseFailuresCard overview={overview} />
          <LatencyCard overview={overview} />
          <RetryCard overview={overview} />
        </div>
        <BadDataCard overview={overview} />
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Performance & cost</h2>
        <PerformanceCard overview={overview} />
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Cohorts & segmentation</h2>
        <SegmentsCard overview={overview} />
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Conversion & activation</h2>
        <ConversionCard overview={overview} />
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Reliability & safety</h2>
        <div className="grid gap-6 md:grid-cols-3">
          <ReliabilityCard overview={overview} />
          <SafetyCard overview={overview} />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">UX & alerts</h2>
        <div className="grid gap-6 md:grid-cols-2">
          <UxCard overview={overview} />
          <AlertsCard overview={overview} />
        </div>
      </section>
    </div>
  );
}

export default memo(AdminAnalyticsDashboard);
