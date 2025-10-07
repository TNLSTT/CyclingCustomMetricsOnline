import { redirect } from 'next/navigation';

import { ActivityTrendsChart } from '../../../components/activity-trends-chart';
import { PageHeader } from '../../../components/page-header';
import { getServerAuthSession } from '../../../lib/auth';
import { env } from '../../../lib/env';

interface ActivityTrendsPageProps {
  searchParams?: {
    metric?: string | string[];
    bucket?: string | string[];
  };
}

export default async function ActivityTrendsPage({
  searchParams,
}: ActivityTrendsPageProps) {
  const session = await getServerAuthSession();

  if (env.authEnabled && !session) {
    redirect('/signin');
  }

  const metricParam = searchParams?.metric;
  const bucketParam = searchParams?.bucket;
  const initialMetricId = typeof metricParam === 'string' ? metricParam : undefined;
  const initialBucket = typeof bucketParam === 'string' ? bucketParam : undefined;

  return (
    <div className="space-y-10">
      <PageHeader
        title="Activity trends"
        description="Explore how your ride durations and computed metrics evolve across every activity you upload."
      />
      <ActivityTrendsChart initialMetricId={initialMetricId} initialBucket={initialBucket} />
    </div>
  );
}
