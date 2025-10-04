import { redirect } from 'next/navigation';

import { DurableTssClient } from '../../components/durable-tss-client';
import { Alert, AlertDescription, AlertTitle } from '../../components/ui/alert';
import { getServerAuthSession } from '../../lib/auth';
import { env } from '../../lib/env';
import type { DurableTssResponse } from '../../types/durable-tss';

const DEFAULT_THRESHOLD_KJ = 1000;

async function loadInitialDurableTss(token?: string): Promise<DurableTssResponse | null> {
  const headers: HeadersInit | undefined = token ? { Authorization: `Bearer ${token}` } : undefined;
  try {
    const response = await fetch(
      `${env.internalApiUrl}/durable-tss?thresholdKj=${DEFAULT_THRESHOLD_KJ}`,
      {
        cache: 'no-store',
        headers,
      },
    );

    if (!response.ok) {
      console.error('Failed to load durable TSS response', response.statusText);
      return null;
    }

    return (await response.json()) as DurableTssResponse;
  } catch (error) {
    console.error('Unable to fetch durable TSS response', error);
    return null;
  }
}

export default async function DurableTssPage() {
  const session = await getServerAuthSession();
  if (env.authEnabled && !session) {
    redirect('/signin');
  }

  const initialData = await loadInitialDurableTss(session?.accessToken);

  if (!initialData) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">Durable TSS explorer</h1>
          <p className="text-muted-foreground">
            Visualize the training load you accumulate once fatigue sets in and your kilojoule burn passes a critical threshold.
          </p>
        </div>
        <Alert variant="destructive">
          <AlertTitle>Unable to load durable TSS data</AlertTitle>
          <AlertDescription>
            Ensure the API is reachable and that your rides include power data. Try again after verifying your connection.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Durable TSS explorer</h1>
        <p className="text-muted-foreground">
          Quantify how much structured stress you carry deep into rides by calculating TSS only after a chosen kilojoule mark.
        </p>
      </div>
      <DurableTssClient initialData={initialData} defaultThresholdKj={DEFAULT_THRESHOLD_KJ} />
    </div>
  );
}
