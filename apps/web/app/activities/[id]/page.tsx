import { notFound, redirect } from 'next/navigation';

import { ActivityDetailClient } from '../../../components/activity-detail-client';
import { getServerAuthSession } from '../../../lib/auth';
import { env } from '../../../lib/env';
import type {
  ActivitySummary,
  IntervalEfficiencyResponse,
  MetricResultDetail,
} from '../../../types/activity';

async function getActivity(id: string, token?: string): Promise<ActivitySummary> {
  const headers: HeadersInit | undefined = token
    ? { Authorization: `Bearer ${token}` }
    : undefined;
  const response = await fetch(`${env.internalApiUrl}/activities/${id}`, {
    cache: 'no-store',
    headers,
  });
  if (response.status === 404) {
    notFound();
  }
  if (!response.ok) {
    throw new Error('Failed to load activity');
  }
  return (await response.json()) as ActivitySummary;
}

async function getHcsrMetric(id: string, token?: string): Promise<MetricResultDetail | null> {
  const headers: HeadersInit | undefined = token
    ? { Authorization: `Bearer ${token}` }
    : undefined;
  const response = await fetch(`${env.internalApiUrl}/activities/${id}/metrics/hcsr`, {
    cache: 'no-store',
    headers,
  });
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error('Failed to load metric result');
  }
  return (await response.json()) as MetricResultDetail;
}

async function getNormalizedPowerMetric(
  id: string,
  token?: string,
): Promise<MetricResultDetail | null> {
  const headers: HeadersInit | undefined = token
    ? { Authorization: `Bearer ${token}` }
    : undefined;
  const response = await fetch(
    `${env.internalApiUrl}/activities/${id}/metrics/normalized-power`,
    {
      cache: 'no-store',
      headers,
    },
  );
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error('Failed to load normalized power metric');
  }
  return (await response.json()) as MetricResultDetail;
}

async function getIntervalEfficiency(
  id: string,
  token?: string,
): Promise<IntervalEfficiencyResponse | null> {
  const headers: HeadersInit | undefined = token
    ? { Authorization: `Bearer ${token}` }
    : undefined;
  const response = await fetch(
    `${env.internalApiUrl}/activities/${id}/metrics/interval-efficiency`,
    {
      cache: 'no-store',
      headers,
    },
  );
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error('Failed to load interval efficiency metric');
  }
  return (await response.json()) as IntervalEfficiencyResponse;
}

export default async function ActivityDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getServerAuthSession();
  if (env.authEnabled && !session) {
    redirect('/signin');
  }

  const token = session?.accessToken;
  const activity = await getActivity(params.id, token ?? undefined);
  const [hcsr, intervalEfficiency, normalizedPower] = await Promise.all([
    getHcsrMetric(params.id, token ?? undefined),
    getIntervalEfficiency(params.id, token ?? undefined),
    getNormalizedPowerMetric(params.id, token ?? undefined),
  ]);

  return (
    <ActivityDetailClient
      activity={activity}
      initialHcsr={hcsr}
      initialIntervalEfficiency={intervalEfficiency}
      initialNormalizedPower={normalizedPower}
    />
  );
}
