import { redirect } from 'next/navigation';

import { TrainingFrontiersClient } from '../../components/training-frontiers-client';
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
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">Training frontiers</h1>
          <p className="text-muted-foreground">
            Surface your strongest efforts across durability, efficiency, repeatability, and time-in-zone streaks.
          </p>
        </div>
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
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Training frontiers</h1>
        <p className="text-muted-foreground">
          Explore the outer edges of your recent performances and find the next breakthroughs to chase.
        </p>
      </div>
      <TrainingFrontiersClient initialData={initialData} defaultWindowDays={DEFAULT_WINDOW_DAYS} />
    </div>
  );
}
