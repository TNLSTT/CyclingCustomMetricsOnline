import Link from 'next/link';
import { redirect } from 'next/navigation';

import { getServerAuthSession } from '../../../../lib/auth';
import { env } from '../../../../lib/env';
import type {
  IntervalEfficiencyHistoryResponse,
  MetricDefinition,
} from '../../../../types/activity';
import type { AdaptationEdgesResponse } from '../../../../types/adaptation';
import { AdaptationDeepestBlocks } from '../../../../components/adaptation-deepest-blocks';
import { IntervalEfficiencyHistoryChart } from '../../../../components/interval-efficiency-history-chart';
import { MetricsDefinitionBrowser } from '../../../../components/metrics-definition-browser';
import { Alert, AlertDescription, AlertTitle } from '../../../../components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../../components/ui/table';

async function getMetricDefinitions(token?: string): Promise<MetricDefinition[]> {
  const headers: HeadersInit | undefined = token
    ? { Authorization: `Bearer ${token}` }
    : undefined;
  const response = await fetch(`${env.internalApiUrl}/metrics`, {
    cache: 'no-store',
    headers,
  });
  if (!response.ok) {
    throw new Error('Failed to load metric definitions');
  }
  const data = (await response.json()) as { definitions: MetricDefinition[] };
  return data.definitions;
}

async function getIntervalEfficiencyHistory(
  token?: string,
): Promise<IntervalEfficiencyHistoryResponse> {
  const headers: HeadersInit | undefined = token
    ? { Authorization: `Bearer ${token}` }
    : undefined;
  const response = await fetch(`${env.internalApiUrl}/metrics/interval-efficiency/history`, {
    cache: 'no-store',
    headers,
  });

  if (!response.ok) {
    throw new Error('Failed to load interval efficiency history');
  }

  return (await response.json()) as IntervalEfficiencyHistoryResponse;
}

async function getAdaptationEdges(token?: string): Promise<AdaptationEdgesResponse> {
  const headers: HeadersInit | undefined = token
    ? { Authorization: `Bearer ${token}` }
    : undefined;
  const response = await fetch(`${env.internalApiUrl}/metrics/adaptation-edges/deepest-blocks`, {
    cache: 'no-store',
    headers,
  });

  if (!response.ok) {
    throw new Error('Failed to load adaptation edges');
  }

  return (await response.json()) as AdaptationEdgesResponse;
}

export default async function MetricsPage() {
  const session = await getServerAuthSession();
  if (env.authEnabled && !session) {
    redirect('/signin');
  }

  try {
    const [definitions, history, adaptationEdges] = await Promise.all([
      getMetricDefinitions(session?.accessToken),
      getIntervalEfficiencyHistory(session?.accessToken),
      getAdaptationEdges(session?.accessToken),
    ]);

    return (
      <div className="space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">Metric registry</h1>
          <p className="text-muted-foreground">
            Each metric is self-contained with a definition, compute function, and Vitest coverage. Filter and
            copy keys to accelerate experimentation in your analytics pipeline.
          </p>
        </div>
        <MetricsDefinitionBrowser definitions={definitions} />
        <div className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-2xl font-semibold">Interval efficiency trends</h2>
            <p className="text-sm text-muted-foreground">
              Compare watts-per-heart-rate efficiency across your rides to identify improvements or
              fatigue over time.
            </p>
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">
                {history.metric.name}{' '}
                <span className="text-xs text-muted-foreground">
                  ({history.metric.units ?? 'unitless'})
                </span>
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
                      <TableCell
                        colSpan={6}
                        className="py-6 text-center text-sm text-muted-foreground"
                      >
                        No interval efficiency metrics computed yet. Upload and compute metrics to
                        populate this view.
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
                            {point.firstIntervalWPerHr != null
                              ? point.firstIntervalWPerHr.toFixed(2)
                              : '—'}
                          </TableCell>
                          <TableCell>
                            {point.lastIntervalWPerHr != null
                              ? point.lastIntervalWPerHr.toFixed(2)
                              : '—'}
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
        <AdaptationDeepestBlocks analysis={adaptationEdges} />
      </div>
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown error while fetching metric definitions.';

    return (
      <Alert variant="destructive">
        <AlertTitle>Unable to load metric registry</AlertTitle>
        <AlertDescription>
          {message}. Ensure the backend API is running and the metric definitions have been seeded{' '}
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">pnpm seed</code>.
        </AlertDescription>
      </Alert>
    );
  }
}
