import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { AdminAnalyticsDashboard } from '../../../components/admin-analytics-dashboard';
import { PageHeader } from '../../../components/page-header';
import { Alert, AlertDescription, AlertTitle } from '../../../components/ui/alert';
import { Button } from '../../../components/ui/button';
import { getServerAuthSession } from '../../../lib/auth';
import { env } from '../../../lib/env';
import type { AdminAnalyticsOverview } from '../../../types/admin-analytics';

export default async function AdminAnalyticsPage() {
  if (!env.authEnabled) {
    redirect('/');
  }

  const session = await getServerAuthSession();

  if (!session) {
    redirect(`/signin?callbackUrl=${encodeURIComponent('/admin/analytics')}`);
  }

  const token = session.accessToken;
  if (!token) {
    redirect(`/signin?callbackUrl=${encodeURIComponent('/admin/analytics')}`);
  }

  if (session.user?.role !== 'ADMIN') {
    notFound();
  }

  try {
    const response = await fetch(`${env.internalApiUrl}/admin/analytics/overview`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      const fallbackMessage = response.statusText || 'Failed to load analytics overview.';
      const parsed = await response
        .json()
        .then((data) => (typeof data?.error === 'string' ? data.error : fallbackMessage))
        .catch(() => fallbackMessage);
      throw new Error(parsed);
    }

    const overview = (await response.json()) as AdminAnalyticsOverview;

    return (
      <div className="space-y-8">
        <PageHeader
          title="Admin analytics"
          description="Monitor acquisition, activation, and engagement signals across the platform."
        />
        <div className="flex justify-end">
          <Button asChild variant="outline">
            <Link href="/admin/users">Manage users</Link>
          </Button>
        </div>
        <AdminAnalyticsDashboard overview={overview} />
      </div>
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error while loading analytics overview.';
    return (
      <div className="space-y-6">
        <PageHeader
          title="Admin analytics"
          description="Monitor acquisition, activation, and engagement signals across the platform."
        />
        <div className="flex justify-end">
          <Button asChild variant="outline">
            <Link href="/admin/users">Manage users</Link>
          </Button>
        </div>
        <Alert variant="destructive">
          <AlertTitle>Unable to load analytics</AlertTitle>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      </div>
    );
  }
}
