import { redirect } from 'next/navigation';

import { ActivityMetricsInsights } from '../../../components/activity-metrics-insights';
import { Alert, AlertDescription, AlertTitle } from '../../../components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { getServerAuthSession } from '../../../lib/auth';
import { env } from '../../../lib/env';
import type { ActivitySummary, PaginatedActivities } from '../../../types/activity';

async function getActivities(token?: string): Promise<ActivitySummary[]> {
  const headers: HeadersInit | undefined = token ? { Authorization: `Bearer ${token}` } : undefined;
  const response = await fetch(`${env.internalApiUrl}/activities?page=1&pageSize=200`, {
    cache: 'no-store',
    headers,
  });
  if (!response.ok) {
    throw new Error('Failed to load activities');
  }
  const payload = (await response.json()) as PaginatedActivities;
  return payload.data;
}

export default async function ActivityInsightsPage() {
  const session = await getServerAuthSession();
  if (env.authEnabled && !session) {
    redirect('/signin');
  }

  try {
    const activities = await getActivities(session?.accessToken);

    if (activities.length === 0) {
      return (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Activity trends</CardTitle>
            <CardDescription>Upload your first ride to unlock personalized analytics.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Once you import a FIT file and compute metrics, this page will visualize how your key numbers
              change over time.
            </p>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="space-y-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold">Insights</h1>
          <p className="text-muted-foreground">
            Compare normalized power, aerobic efficiency, and HR-to-cadence trends across every ride.
          </p>
        </div>
        <ActivityMetricsInsights activities={activities} />
      </div>
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error while fetching insights.';
    return (
      <Alert variant="destructive">
        <AlertTitle>Unable to load insights</AlertTitle>
        <AlertDescription>
          {message}. Ensure the backend API is running and recent activities have been processed.
        </AlertDescription>
      </Alert>
    );
  }
}
