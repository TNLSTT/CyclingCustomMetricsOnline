import Link from 'next/link';
import { redirect } from 'next/navigation';

import { MetricsDefinitionBrowser } from '../../../../components/metrics-definition-browser';
import { Button } from '../../../../components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '../../../../components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../../components/ui/card';
import { getServerAuthSession } from '../../../../lib/auth';
import { env } from '../../../../lib/env';
import { fetchMetricDefinitions } from '../shared';

export default async function MetricsPage() {
  const session = await getServerAuthSession();
  if (env.authEnabled && !session) {
    redirect('/signin');
  }

  try {
    const definitions = await fetchMetricDefinitions(session?.accessToken);

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
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">Interval efficiency trends</CardTitle>
              <CardDescription>
                Compare watts-per-heart-rate efficiency across your rides and dig into ride level context.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <Button asChild className="w-full">
                <Link href="/metrics/interval-efficiency">Open interval efficiency</Link>
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">Adaptation edges</CardTitle>
              <CardDescription>
                Review your deepest training blocks and how your efficiency evolved across each progression.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <Button asChild className="w-full">
                <Link href="/metrics/adaptation">View adaptation analysis</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
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
