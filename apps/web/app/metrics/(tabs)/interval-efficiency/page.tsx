import Link from 'next/link';
import { redirect } from 'next/navigation';

import { IntervalEfficiencyHistoryChart } from '../../../../components/interval-efficiency-history-chart';
import { Alert, AlertDescription, AlertTitle } from '../../../../components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../../components/ui/table';
import { getServerAuthSession } from '../../../../lib/auth';
import { env } from '../../../../lib/env';
import { fetchIntervalEfficiencyHistory } from '../shared';

export default async function IntervalEfficiencyPage() {
  const session = await getServerAuthSession();
  if (env.authEnabled && !session) {
    redirect('/signin');
  }

  try {
    const history = await fetchIntervalEfficiencyHistory(session?.accessToken);

    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">Interval efficiency</h1>
          <p className="text-muted-foreground">
            Compare watts-per-heart-rate efficiency across your rides to spot adaptation or fatigue trends.
            Use the ride table to jump directly into detailed activity summaries when something stands out.
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">
              {history.metric.name}{' '}
              <span className="text-xs text-muted-foreground">({history.metric.units ?? 'unitless'})</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <IntervalEfficiencyHistoryChart points={history.points} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Activity comparison</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Start time</TableHead>
                  <TableHead>Intervals</TableHead>
                  <TableHead>Avg W/HR</TableHead>
                  <TableHead>First interval</TableHead>
                  <TableHead>Last interval</TableHead>
                  <TableHead className="text-right">View</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.points.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-6 text-center text-sm text-muted-foreground">
                      No interval efficiency metrics computed yet. Upload and compute metrics to populate this
                      view.
                    </TableCell>
                  </TableRow>
                ) : (
                  history.points.map((point) => {
                    const formattedStart = new Date(point.activityStartTime).toLocaleString();

                    return (
                      <TableRow key={point.activityId}>
                        <TableCell className="font-medium">{formattedStart}</TableCell>
                        <TableCell>{point.intervalCount}</TableCell>
                        <TableCell>
                          {point.averageWPerHr != null ? point.averageWPerHr.toFixed(2) : '—'}
                        </TableCell>
                        <TableCell>
                          {point.firstIntervalWPerHr != null ? point.firstIntervalWPerHr.toFixed(2) : '—'}
                        </TableCell>
                        <TableCell>
                          {point.lastIntervalWPerHr != null ? point.lastIntervalWPerHr.toFixed(2) : '—'}
                        </TableCell>
                        <TableCell className="text-right">
                          <Link className="text-primary underline" href={`/activities/${point.activityId}`}>
                            Activity
                          </Link>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown error while fetching interval efficiency history.';

    return (
      <Alert variant="destructive">
        <AlertTitle>Unable to load interval efficiency</AlertTitle>
        <AlertDescription>
          {message}. Ensure the backend API is running and the metrics have been computed{' '}
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">pnpm seed</code>.
        </AlertDescription>
      </Alert>
    );
  }
}
