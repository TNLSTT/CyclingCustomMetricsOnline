import { redirect } from 'next/navigation';

import { ActivityComparisonClient } from '../../../components/activity-comparison-client';
import { Alert, AlertDescription, AlertTitle } from '../../../components/ui/alert';
import { getServerAuthSession } from '../../../lib/auth';
import { env } from '../../../lib/env';
import type { PaginatedActivities } from '../../../types/activity';

async function getActivities(token?: string): Promise<PaginatedActivities> {
  const headers: HeadersInit | undefined = token ? { Authorization: `Bearer ${token}` } : undefined;
  const response = await fetch(`${env.internalApiUrl}/activities?page=1&pageSize=100`, {
    cache: 'no-store',
    headers,
  });
  if (!response.ok) {
    throw new Error('Failed to load activities');
  }
  return (await response.json()) as PaginatedActivities;
}

export default async function ActivityComparisonPage() {
  const session = await getServerAuthSession();
  if (env.authEnabled && !session) {
    redirect('/signin');
  }

  const token = session?.accessToken;
  try {
    const { data: activities } = await getActivities(token);
    return <ActivityComparisonClient activities={activities} />;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error while fetching activities.';
    return (
      <Alert variant="destructive">
        <AlertTitle>Unable to load activities</AlertTitle>
        <AlertDescription>{message}</AlertDescription>
      </Alert>
    );
  }
}
