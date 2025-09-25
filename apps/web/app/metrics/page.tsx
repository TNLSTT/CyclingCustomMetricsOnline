import { env } from '../../lib/env';
import type { MetricDefinition } from '../../types/activity';
import { Alert, AlertDescription, AlertTitle } from '../../components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';

async function getMetricDefinitions(): Promise<MetricDefinition[]> {
  const response = await fetch(`${env.internalApiUrl}/metrics`, {
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error('Failed to load metric definitions');
  }
  const data = (await response.json()) as { definitions: MetricDefinition[] };
  return data.definitions;
}

export default async function MetricsPage() {
  try {
    const definitions = await getMetricDefinitions();

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Metric registry</h1>
          <p className="text-muted-foreground">
            Each metric is self-contained with a definition, compute function, and Vitest coverage.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {definitions.map((definition) => (
            <Card key={definition.key}>
              <CardHeader>
                <CardTitle className="text-base font-semibold">
                  {definition.name}
                  <span className="ml-2 text-xs text-muted-foreground">v{definition.version}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>{definition.description}</p>
                {definition.units ? (
                  <p>
                    <span className="font-medium text-foreground">Units:</span> {definition.units}
                  </p>
                ) : null}
                {definition.computeConfig ? (
                  <pre className="rounded-md bg-muted p-3 text-xs">
                    {JSON.stringify(definition.computeConfig, null, 2)}
                  </pre>
                ) : null}
              </CardContent>
            </Card>
          ))}
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
