import { notFound } from 'next/navigation';

import { ActivityDetailClient } from '../../../components/activity-detail-client';
import { env } from '../../../lib/env';
import type { ActivitySummary, MetricResultDetail } from '../../../types/activity';

async function getActivity(id: string): Promise<ActivitySummary> {
  const response = await fetch(`${env.internalApiUrl}/activities/${id}`, {
    cache: 'no-store',
  });
  if (response.status === 404) {
    notFound();
  }
  if (!response.ok) {
    throw new Error('Failed to load activity');
  }
  return (await response.json()) as ActivitySummary;
}

async function getHcsrMetric(id: string): Promise<MetricResultDetail | null> {
  const response = await fetch(`${env.internalApiUrl}/activities/${id}/metrics/hcsr`, {
    cache: 'no-store',
  });
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error('Failed to load metric result');
  }
  return (await response.json()) as MetricResultDetail;
}

export default async function ActivityDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const activity = await getActivity(params.id);
  const hcsr = await getHcsrMetric(params.id);

  return <ActivityDetailClient activity={activity} initialHcsr={hcsr} />;
}
