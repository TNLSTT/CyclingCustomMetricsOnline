import { redirect } from 'next/navigation';

import { DepthAnalysisTab } from '../../../../components/depth-analysis-tab';
import { Alert, AlertDescription, AlertTitle } from '../../../../components/ui/alert';
import { getServerAuthSession } from '../../../../lib/auth';
import { env } from '../../../../lib/env';
import type { DepthAnalysisResponse } from '../../../../types/depth-analysis';

const DEFAULT_THRESHOLD_KJ = 2000;
const DEFAULT_MIN_POWER = 180;

async function getDepthAnalysisData(
  thresholdKj: number,
  minPower: number,
  token?: string,
): Promise<DepthAnalysisResponse> {
  const params = new URLSearchParams({
    thresholdKj: String(thresholdKj),
    minPower: String(minPower),
  });
  const headers: HeadersInit | undefined = token ? { Authorization: `Bearer ${token}` } : undefined;
  const response = await fetch(`${env.internalApiUrl}/metrics/depth-analysis?${params.toString()}`, {
    cache: 'no-store',
    headers,
  });

  if (!response.ok) {
    throw new Error('Failed to load depth analysis');
  }

  return (await response.json()) as DepthAnalysisResponse;
}

export default async function DepthAnalysisPage() {
  const session = await getServerAuthSession();

  if (env.authEnabled && !session) {
    redirect('/signin');
  }

  let initialData: DepthAnalysisResponse | null = null;
  let initialError: string | null = null;

  try {
    initialData = await getDepthAnalysisData(
      DEFAULT_THRESHOLD_KJ,
      DEFAULT_MIN_POWER,
      session?.accessToken,
    );
  } catch (error) {
    console.error('Failed to load depth analysis', error);
    initialError = error instanceof Error ? error.message : 'Unknown error while loading depth analysis.';
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Depth analysis</h1>
        <p className="text-muted-foreground">
          Quantify how much work you complete late in the ride after surpassing a configurable energy
          threshold and minimum power requirement.
        </p>
      </div>

      {initialError && !initialData ? (
        <Alert variant="destructive">
          <AlertTitle>Unable to load depth analysis</AlertTitle>
          <AlertDescription>{initialError}</AlertDescription>
        </Alert>
      ) : null}

      <DepthAnalysisTab
        initialData={initialData}
        initialThresholdKj={DEFAULT_THRESHOLD_KJ}
        initialMinPower={DEFAULT_MIN_POWER}
        initialError={initialError}
      />
    </div>
  );
}
