'use client';

import { useState } from 'react';
import { Cpu } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';

import { computeMetricsForAllActivities } from '../lib/api';
import { env } from '../lib/env';
import type { BulkComputeResponse } from '../types/activity';
import { FileUpload } from './file-upload';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';

function formatResultSummary(result: BulkComputeResponse) {
  const computedCount = result.computed.length;
  const failureCount = result.failures.length;
  if (computedCount === 0 && failureCount === 0) {
    return 'All activities already have metrics—nothing to run.';
  }
  if (failureCount === 0) {
    return `Computed metrics for ${computedCount} activit${computedCount === 1 ? 'y' : 'ies'}.`;
  }
  return `Computed ${computedCount} activit${computedCount === 1 ? 'y' : 'ies'}, ${failureCount} failed.`;
}

export function ActivityActions() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [isComputing, setIsComputing] = useState(false);
  const [result, setResult] = useState<BulkComputeResponse | null>(null);

  async function handleComputeAll() {
    if (env.authEnabled && status !== 'authenticated') {
      toast.error({ title: 'Authentication required', description: 'Sign in to compute metrics.' });
      router.push('/signin?callbackUrl=/activities');
      return;
    }

    try {
      setIsComputing(true);
      const response = await computeMetricsForAllActivities(session?.accessToken);
      setResult(response);

      const computedCount = response.computed.length;
      const failureCount = response.failures.length;

      if (computedCount === 0 && failureCount === 0) {
        toast.success({
          title: 'All caught up',
          description: 'Every activity already has metrics computed.',
        });
      } else if (failureCount === 0) {
        toast.success({
          title: 'Metrics computed',
          description: `Processed ${computedCount} activit${computedCount === 1 ? 'y' : 'ies'}.`,
        });
      } else {
        toast.error({
          title: 'Some metrics failed',
          description: `Computed ${computedCount}, ${failureCount} failed.`,
        });
      }

      router.refresh();
    } catch (error) {
      toast.error({
        title: 'Bulk compute failed',
        description: error instanceof Error ? error.message : 'Unable to compute metrics.',
      });
    } finally {
      setIsComputing(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <FileUpload
        onAuthRequired={() => {
          router.push('/signin?callbackUrl=/activities');
        }}
        onUploaded={() => {
          router.refresh();
          setResult(null);
        }}
      />

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Cpu className="h-5 w-5" />
            <span>Bulk compute metrics</span>
          </CardTitle>
          <CardDescription>
            Run the metrics engine for every activity that is still waiting on computation.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={handleComputeAll} disabled={isComputing}>
            {isComputing ? 'Computing…' : 'Compute pending metrics'}
          </Button>
          {result ? (
            <Alert variant={result.failures.length > 0 ? 'destructive' : 'default'}>
              <AlertTitle>Last bulk run</AlertTitle>
              <AlertDescription className="space-y-2">
                <p>{formatResultSummary(result)}</p>
                {result.failures.length > 0 ? (
                  <ul className="list-inside list-disc text-xs">
                    {result.failures.slice(0, 5).map((failure) => (
                      <li key={failure.activityId}>
                        {failure.activityId}: {failure.error}
                      </li>
                    ))}
                    {result.failures.length > 5 ? (
                      <li className="font-medium">{result.failures.length - 5} more failures…</li>
                    ) : null}
                  </ul>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {result.pendingCount === 0
                      ? 'No pending activities remain.'
                      : `${result.pendingCount} activit${
                          result.pendingCount === 1 ? 'y was' : 'ies were'
                        } awaiting compute at the start of the run.`}
                  </p>
                )}
              </AlertDescription>
            </Alert>
          ) : (
            <p className="text-sm text-muted-foreground">
              Save time by triggering every outstanding recompute with a single click.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
