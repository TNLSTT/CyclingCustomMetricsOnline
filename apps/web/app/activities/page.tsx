import { redirect } from 'next/navigation';

import { getServerAuthSession } from '../../lib/auth';
import { env } from '../../lib/env';
import type { PaginatedActivities } from '../../types/activity';
import { ActivityQuickStats } from '../../components/activity-quick-stats';
import { ActivityTable } from '../../components/activity-table';
import { PageHeader } from '../../components/page-header';
import { Alert, AlertDescription, AlertTitle } from '../../components/ui/alert';
import { ActivityActions } from '../../components/activity-actions';

async function getActivities(token?: string): Promise<PaginatedActivities> {
  const headers: HeadersInit | undefined = token
    ? { Authorization: `Bearer ${token}` }
    : undefined;
  const response = await fetch(`${env.internalApiUrl}/activities?page=1&pageSize=200`, {
    cache: 'no-store',
    headers,
  });
  if (!response.ok) {
    throw new Error('Failed to load activities');
  }
  return (await response.json()) as PaginatedActivities;
}

export default async function ActivitiesPage() {
  const session = await getServerAuthSession();
  if (env.authEnabled && !session) {
    redirect('/signin');
  }

  try {
    const { data: activities } = await getActivities(session?.accessToken);

    const totalDurationSec = activities.reduce((total, activity) => total + activity.durationSec, 0);
    const totalActivities = activities.length;
    const completedCount = activities.filter((activity) => activity.metrics.length > 0).length;
    const pendingCount = totalActivities - completedCount;
    const uniqueMetricKeys = Array.from(
      new Set(activities.flatMap((activity) => activity.metrics.map((metric) => metric.key))),
    );
    const latestUpload = activities
      .map((activity) => activity.createdAt)
      .filter(Boolean)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];

    return (
      <div className="space-y-10">
        <PageHeader
          title="Activities"
          description="Recently uploaded FIT rides with computed metric summaries. Use the filters below to hone in on pending rides, specific metrics, or sources."
        />
        <ActivityActions />
        <ActivityQuickStats
          totalActivities={totalActivities}
          totalDurationHours={totalDurationSec / 3600}
          completedCount={completedCount}
          pendingCount={pendingCount}
          uniqueMetricKeys={uniqueMetricKeys}
          latestUpload={latestUpload}
        />
        <ActivityTable activities={activities} />
      </div>
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error while fetching activities.';
    return (
      <div className="space-y-10">
        <PageHeader
          title="Activities"
          description="Recently uploaded FIT rides with computed metric summaries. Use the filters below to hone in on pending rides, specific metrics, or sources."
        />
        <ActivityActions />
        <Alert variant="destructive">
          <AlertTitle>Unable to load activities</AlertTitle>
          <AlertDescription>
            {message}. Ensure the backend API is running and the database has been migrated{' '}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">pnpm db:push</code>.
          </AlertDescription>
        </Alert>
      </div>
    );
  }
}
