import Link from 'next/link';
import { redirect } from 'next/navigation';

import { getServerAuthSession } from '../../../lib/auth';
import { env } from '../../../lib/env';
import type { PaginatedActivities } from '../../../types/activity';
import { PageHeader } from '../../../components/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '../../../components/ui/alert';
import { Badge } from '../../../components/ui/badge';

async function loadRecentActivities(token?: string): Promise<PaginatedActivities | null> {
  try {
    const headers: HeadersInit | undefined = token ? { Authorization: `Bearer ${token}` } : undefined;
    const response = await fetch(`${env.internalApiUrl}/activities?page=1&pageSize=6`, {
      cache: 'no-store',
      headers,
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as PaginatedActivities;
  } catch (error) {
    console.error('Failed to load recent activities for insight report launcher', error);
    return null;
  }
}

function formatActivityTitle(name?: string | null, startTime?: string) {
  if (name && name.trim().length > 0) {
    return name;
  }
  if (!startTime) {
    return 'Ride overview';
  }
  const date = new Date(startTime);
  if (Number.isNaN(date.getTime())) {
    return 'Ride overview';
  }
  return `Ride on ${date.toLocaleDateString()}`;
}

function formatDate(value?: string) {
  if (!value) {
    return '—';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }
  return date.toLocaleString();
}

export default async function InsightReportPage() {
  const session = await getServerAuthSession();
  if (env.authEnabled && !session) {
    redirect('/signin');
  }

  const recentActivities = await loadRecentActivities(session?.accessToken);

  return (
    <div className="space-y-10">
      <PageHeader
        title="Insight reports"
        description="Summarise each ride with an AI-generated report and capture the next day\'s recommendation based on your recent training load and goals."
      />
      <Card>
        <CardHeader>
          <CardTitle>How to generate insight reports</CardTitle>
          <CardDescription>
            Send rich ride context, recent training blocks, and your goals to OpenAI in a single click. The report stays attached to the activity so you can revisit it later.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <ol className="list-decimal space-y-2 pl-6">
            <li>Open any ride below (or from the activities table) to access the detail dashboard.</li>
            <li>Click <strong>Generate insight report</strong> to produce a coach-style summary tailored to your goals.</li>
            <li>Use <strong>What\'s recommended for tomorrow?</strong> to request a follow-up session and practical reminders.</li>
          </ol>
          <p className="text-xs">
            Tip: Store your API secret in <code className="rounded bg-muted px-1 py-0.5 text-[11px]">OPENAI_API_KEY</code> inside the backend <code className="rounded bg-muted px-1 py-0.5 text-[11px]">.env</code>. Set <code className="rounded bg-muted px-1 py-0.5 text-[11px]">OPENAI_API_MODEL</code> if you want to override the default <code className="rounded bg-muted px-1 py-0.5 text-[11px]">gpt-4o-mini</code> model.
          </p>
        </CardContent>
      </Card>
      {!recentActivities ? (
        <Alert variant="destructive">
          <AlertTitle>Unable to load recent activities</AlertTitle>
          <AlertDescription>
            Ensure the API is reachable and that you have permission to view your activities. Retry after confirming your session is still active.
          </AlertDescription>
        </Alert>
      ) : recentActivities.data.length === 0 ? (
        <Alert>
          <AlertTitle>No rides available</AlertTitle>
          <AlertDescription>
            Upload a FIT file on the activities page to enable AI-powered insight reports and recommendations.
          </AlertDescription>
        </Alert>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {recentActivities.data.map((activity) => {
            const hasReport = Boolean(activity.insightReport);
            const hasRecommendation = Boolean(activity.insightRecommendation);
            return (
              <Card key={activity.id} className="flex h-full flex-col justify-between">
                <CardHeader className="space-y-2">
                  <CardTitle className="flex items-center justify-between gap-2 text-base">
                    <span className="truncate" title={formatActivityTitle(activity.name, activity.startTime)}>
                      {formatActivityTitle(activity.name, activity.startTime)}
                    </span>
                    <div className="flex items-center gap-2">
                      <Badge variant={hasReport ? 'default' : 'outline'} className="text-xs">
                        {hasReport ? 'Report saved' : 'Report pending'}
                      </Badge>
                      <Badge variant={hasRecommendation ? 'secondary' : 'outline'} className="text-xs">
                        {hasRecommendation ? 'Recommendation ready' : 'Ask tomorrow'}
                      </Badge>
                    </div>
                  </CardTitle>
                  <CardDescription>{formatDate(activity.startTime)}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-sm text-muted-foreground">
                  <p>
                    {hasReport
                      ? 'This ride already has an AI report—open it to refresh the summary or request a new recommendation.'
                      : 'Open the activity to generate an AI insight report and receive personalised next-day guidance.'}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <Badge variant="outline">
                      {activity.metrics.length > 0 ? `${activity.metrics.length} metrics computed` : 'Metrics pending'}
                    </Badge>
                    <Badge variant="outline">{Math.round(activity.durationSec / 60)} min</Badge>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-2">
                    <Button asChild size="sm" className="flex-1">
                      <Link href={`/activities/${activity.id}`}>View activity</Link>
                    </Button>
                    <Button asChild variant="secondary" size="sm">
                      <Link href="/activities">Browse all activities</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
