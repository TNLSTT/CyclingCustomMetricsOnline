import { redirect } from 'next/navigation';

import { getServerAuthSession } from '../../../../lib/auth';
import { env } from '../../../../lib/env';
import type { ActivitySummary, PaginatedActivities } from '../../../../types/activity';
import type { AdaptationEdgesResponse } from '../../../../types/adaptation';
import { KjIntervalTab } from '../../../../components/kj-interval-tab';
import { PageHeader } from '../../../../components/page-header';
import { Alert, AlertDescription, AlertTitle } from '../../../../components/ui/alert';

async function getActivities(token?: string): Promise<ActivitySummary[]> {
  const headers: HeadersInit | undefined = token ? { Authorization: `Bearer ${token}` } : undefined;
  const response = await fetch(`${env.internalApiUrl}/activities?page=1&pageSize=100`, {
    cache: 'no-store',
    headers,
  });

  if (!response.ok) {
    throw new Error('Failed to load activities');
  }

  const data = (await response.json()) as PaginatedActivities;
  return data.data;
}

async function getAdaptationEdges(token?: string): Promise<AdaptationEdgesResponse> {
  const headers: HeadersInit | undefined = token ? { Authorization: `Bearer ${token}` } : undefined;
  const response = await fetch(`${env.internalApiUrl}/metrics/adaptation-edges/deepest-blocks`, {
    cache: 'no-store',
    headers,
  });

  if (!response.ok) {
    throw new Error('Failed to load adaptation summary');
  }

  return (await response.json()) as AdaptationEdgesResponse;
}

export default async function KjInIntervalPage() {
  const session = await getServerAuthSession();

  if (env.authEnabled && !session) {
    redirect('/signin');
  }

  try {
    const [activities, adaptation] = await Promise.all([
      getActivities(session?.accessToken),
      getAdaptationEdges(session?.accessToken),
    ]);

    return (
      <div className="space-y-10">
        <PageHeader
          title="KJ in interval"
          description="Calculate how much work you complete inside contiguous training-zone intervals using configurable power ranges and minimum durations."
        />
        <KjIntervalTab activities={activities} ftpEstimate={adaptation.ftpEstimate} />
      </div>
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error while fetching data.';
    return (
      <div className="space-y-10">
        <PageHeader
          title="KJ in interval"
          description="Calculate how much work you complete inside contiguous training-zone intervals using configurable power ranges and minimum durations."
        />
        <Alert variant="destructive">
          <AlertTitle>Unable to load KJ in interval</AlertTitle>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      </div>
    );
  }
}
