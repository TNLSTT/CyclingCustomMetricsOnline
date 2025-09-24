import Link from 'next/link';

import { fetchActivities } from '../../lib/api';
import { formatDuration } from '../../lib/utils';
import type { ActivitySummary } from '../../types/activity';
import { Alert, AlertDescription, AlertTitle } from '../../components/ui/alert';
import { Badge } from '../../components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';

export default async function ActivitiesPage() {
  let activities: ActivitySummary[] = [];
  let error: string | null = null;

  try {
    const response = await fetchActivities(1, 50);
    activities = response.data;
  } catch (err) {
    error =
      err instanceof Error
        ? err.message
        : 'Unknown error while fetching activities. Check the API logs for details.';
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Activities</h1>
        <p className="text-muted-foreground">
          Recently uploaded FIT rides with computed metric summaries.
        </p>
      </div>
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Unable to load activities</AlertTitle>
          <AlertDescription>
            {error}. Ensure the backend API is running and the database has been migrated{' '}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">pnpm db:push</code>.
          </AlertDescription>
        </Alert>
      ) : (
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
                          activity.metrics.map((metric) => <Badge key={metric.key}>{metric.key}</Badge>)
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
      )}
    </div>
  );
}
