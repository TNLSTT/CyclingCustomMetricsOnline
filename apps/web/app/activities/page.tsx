import Link from 'next/link';

import { redirect } from 'next/navigation';

import { getServerAuthSession } from '../../lib/auth';
import { env } from '../../lib/env';
import { formatDuration } from '../../lib/utils';
import type { PaginatedActivities } from '../../types/activity';
import { Alert, AlertDescription, AlertTitle } from '../../components/ui/alert';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';

async function getActivities(token?: string): Promise<PaginatedActivities> {
  const headers: HeadersInit | undefined = token
    ? { Authorization: `Bearer ${token}` }
    : undefined;
  const response = await fetch(`${env.internalApiUrl}/activities?page=1&pageSize=50`, {
    cache: 'no-store',
    headers,
  });
  if (!response.ok) {
    throw new Error('Failed to load activities');
  }
  return (await response.json()) as PaginatedActivities;
}

export default async function ActivitiesPage() {
  const session = await getServerAuthSession();
  if (env.authEnabled && !session) {
    redirect('/signin');
  }

  try {
    const { data: activities } = await getActivities(session?.accessToken);

    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Activities</h1>
            <p className="text-muted-foreground">
              Recently uploaded FIT rides with computed metric summaries.
            </p>
          </div>
          <Button asChild variant="secondary">
            <Link href="/activities/insights">View activity insights</Link>
          </Button>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Activity history</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Start time</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Metrics</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activities.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                      No activities yet. Upload a FIT file to see your rides here.
                    </TableCell>
                  </TableRow>
                ) : (
                  activities.map((activity) => (
                    <TableRow key={activity.id}>
                      <TableCell className="font-medium">
                        {new Date(activity.startTime).toLocaleString()}
                      </TableCell>
                      <TableCell>{formatDuration(activity.durationSec)}</TableCell>
                      <TableCell className="space-x-2">
                        {activity.metrics.length === 0 ? (
                          <Badge variant="outline">Pending</Badge>
                        ) : (
                          activity.metrics.map((metric) => (
                            <Badge key={metric.key}>{metric.key}</Badge>
                          ))
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Link className="text-primary underline" href={`/activities/${activity.id}`}>
                          View
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error while fetching activities.';
    return (
      <Alert variant="destructive">
        <AlertTitle>Unable to load activities</AlertTitle>
        <AlertDescription>
          {message}. Ensure the backend API is running and the database has been migrated{' '}
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">pnpm db:push</code>.
        </AlertDescription>
      </Alert>
    );
  }
}
