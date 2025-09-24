import Link from 'next/link';

import { env } from '../../lib/env';
import { formatDuration } from '../../lib/utils';
import type { PaginatedActivities } from '../../types/activity';
import { Badge } from '../../components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';

async function getActivities(): Promise<PaginatedActivities> {
  const response = await fetch(`${env.internalApiUrl}/activities?page=1&pageSize=50`, {
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error('Failed to load activities');
  }
  return (await response.json()) as PaginatedActivities;
}

export default async function ActivitiesPage() {
  const { data: activities } = await getActivities();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Activities</h1>
        <p className="text-muted-foreground">
          Recently uploaded FIT rides with computed metric summaries.
        </p>
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
              {activities.map((activity) => (
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
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
