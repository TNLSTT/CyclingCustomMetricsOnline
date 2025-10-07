import { redirect } from 'next/navigation';

import { ActivityTrendsChart } from '../../../components/activity-trends-chart';
import { PageHeader } from '../../../components/page-header';
import { Alert, AlertDescription, AlertTitle } from '../../../components/ui/alert';
import { getServerAuthSession } from '../../../lib/auth';
import { env } from '../../../lib/env';
import type { PaginatedActivities } from '../../../types/activity';

async function getActivities(token?: string): Promise<PaginatedActivities> {
  const headers: HeadersInit | undefined = token ? { Authorization: `Bearer ${token}` } : undefined;
  const response = await fetch(`${env.internalApiUrl}/activities?page=1&pageSize=200`, {
    cache: 'no-store',
    headers,
  });

  if (!response.ok) {
    throw new Error('Failed to load activities');
  }

  return (await response.json()) as PaginatedActivities;
}

interface ActivityTrendsPageProps {
  searchParams?: {
    metric?: string | string[];
  };
}

export default async function ActivityTrendsPage({
  searchParams,
}: ActivityTrendsPageProps) {
  const session = await getServerAuthSession();

  if (env.authEnabled && !session) {
    redirect('/signin');
  }

  try {
    const { data: activities } = await getActivities(session?.accessToken);
    const metricParam = searchParams?.metric;
    const initialMetricId = typeof metricParam === 'string' ? metricParam : undefined;

    return (
      <div className="space-y-10">
        <PageHeader
          title="Activity trends"
          description="Explore how your ride durations and computed metrics evolve across every activity you upload."
        />
        <ActivityTrendsChart activities={activities} initialMetricId={initialMetricId} />
      </div>
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error while fetching trends.';
    return (
      <div className="space-y-10">
        <PageHeader
          title="Activity trends"
          description="Explore how your ride durations and computed metrics evolve across every activity you upload."
        />
        <Alert variant="destructive">
          <AlertTitle>Unable to load activity trends</AlertTitle>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      </div>
    );
  }
}
