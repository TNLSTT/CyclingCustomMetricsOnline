import { redirect } from 'next/navigation';

import { Alert, AlertDescription, AlertTitle } from '../../components/ui/alert';
import { MovingAverageCharts } from '../../components/moving-average-charts';
import { getServerAuthSession } from '../../lib/auth';
import { env } from '../../lib/env';
import type { MovingAveragesResponse } from '../../types/moving-averages';

async function getMovingAverageData(token?: string): Promise<MovingAveragesResponse> {
  const headers: HeadersInit | undefined = token ? { Authorization: `Bearer ${token}` } : undefined;
  try {
    const response = await fetch(`${env.internalApiUrl}/metrics/moving-averages`, {
      cache: 'no-store',
      headers,
    });

    if (!response.ok) {
      throw new Error('Failed to load moving averages');
    }

    return (await response.json()) as MovingAveragesResponse;
  } catch (error) {
    console.error('Failed to load moving averages', error);
    return { days: [] };
  }
}

export default async function MovingAveragesPage() {
  const session = await getServerAuthSession();
  if (env.authEnabled && !session) {
    redirect('/signin');
  }

  const data = await getMovingAverageData(session?.accessToken);

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Moving averages</h1>
        <p className="text-muted-foreground">
          Visualize how your training load and power durability evolve across multi-month rolling
          windows.
        </p>
      </div>

      {data.days.length === 0 ? (
        <Alert>
          <AlertTitle>No activities yet</AlertTitle>
          <AlertDescription>
            Upload a FIT file and compute metrics to unlock long-term moving averages for energy and
            peak power.
          </AlertDescription>
        </Alert>
      ) : (
        <MovingAverageCharts days={data.days} />
      )}
    </div>
  );
}
