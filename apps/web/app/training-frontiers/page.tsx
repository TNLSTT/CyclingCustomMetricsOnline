import { redirect } from 'next/navigation';

import { TrainingFrontiersClient } from '../../components/training-frontiers-client';
import { PageHeader } from '../../components/page-header';
import { Alert, AlertDescription, AlertTitle } from '../../components/ui/alert';
import { getServerAuthSession } from '../../lib/auth';
import { env } from '../../lib/env';
import type { TrainingFrontiersResponse } from '../../types/training-frontiers';

const DEFAULT_WINDOW_DAYS = 90;

async function loadInitialFrontiers(token?: string): Promise<TrainingFrontiersResponse | null> {
  const headers: HeadersInit | undefined = token ? { Authorization: `Bearer ${token}` } : undefined;
  try {
    const response = await fetch(
      `${env.internalApiUrl}/training-frontiers?windowDays=${DEFAULT_WINDOW_DAYS}`,
      {
        cache: 'no-store',
        headers,
      },
    );
    if (!response.ok) {
      console.error('Failed to load training frontiers', response.statusText);
      return null;
    }
    return (await response.json()) as TrainingFrontiersResponse;
  } catch (error) {
    console.error('Unable to fetch training frontiers', error);
    return null;
  }
}

export default async function TrainingFrontiersPage() {
  const session = await getServerAuthSession();
  if (env.authEnabled && !session) {
    redirect('/signin');
  }

  const initialData = await loadInitialFrontiers(session?.accessToken);

  if (!initialData) {
    return (
      <div className="space-y-10">
        <PageHeader
          title="Training frontiers"
          description="Surface your strongest efforts across durability, efficiency, repeatability, and time-in-zone streaks."
        />
        <Alert variant="destructive">
          <AlertTitle>Unable to load training frontier data</AlertTitle>
          <AlertDescription>
            Check your connection and confirm the API is reachable, then refresh to try again.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <PageHeader
        title="Training frontiers"
        description="Explore the outer edges of your recent performances and find the next breakthroughs to chase."
      />
      <TrainingFrontiersClient initialData={initialData} defaultWindowDays={DEFAULT_WINDOW_DAYS} />
    </div>
  );
}
