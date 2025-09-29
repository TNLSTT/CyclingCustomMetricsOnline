import { redirect } from 'next/navigation';

import { DurabilityAnalysisClient } from '../../components/durability-analysis-client';
import { Alert, AlertDescription, AlertTitle } from '../../components/ui/alert';
import { getServerAuthSession } from '../../lib/auth';
import { env } from '../../lib/env';
import type { DurabilityAnalysisResponse } from '../../types/durability-analysis';

const DEFAULT_MIN_DURATION_MINUTES = 180;

async function loadInitialAnalysis(token?: string): Promise<DurabilityAnalysisResponse | null> {
  const headers: HeadersInit | undefined = token ? { Authorization: `Bearer ${token}` } : undefined;
  try {
    const response = await fetch(
      `${env.internalApiUrl}/durability-analysis?minDurationMinutes=${DEFAULT_MIN_DURATION_MINUTES}`,
      {
        cache: 'no-store',
        headers,
      },
    );
    if (!response.ok) {
      console.error('Failed to load durability analysis', response.statusText);
      return null;
    }
    return (await response.json()) as DurabilityAnalysisResponse;
  } catch (error) {
    console.error('Unable to fetch durability analysis', error);
    return null;
  }
}

export default async function DurabilityAnalysisPage() {
  const session = await getServerAuthSession();
  if (env.authEnabled && !session) {
    redirect('/signin');
  }

  const initialData = await loadInitialAnalysis(session?.accessToken);

  if (!initialData) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">Durability analysis</h1>
          <p className="text-muted-foreground">
            Investigate how well you hold power and efficiency deep into your longest rides.
          </p>
        </div>
        <Alert variant="destructive">
          <AlertTitle>Unable to load durability data</AlertTitle>
          <AlertDescription>
            Ensure the API is reachable and that at least one long ride has been uploaded. Try again after
            verifying your connection.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Durability analysis</h1>
        <p className="text-muted-foreground">
          Filter long endurance rides, compute late-ride resilience metrics, and visualize how your
          durability evolves over time.
        </p>
      </div>
      <DurabilityAnalysisClient initialData={initialData} defaultMinDurationMinutes={DEFAULT_MIN_DURATION_MINUTES} />
    </div>
  );
}
