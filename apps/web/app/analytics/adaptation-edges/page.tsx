import { redirect } from 'next/navigation';

import { fetchAdaptationEdges } from '../../../lib/api';
import { getServerAuthSession } from '../../../lib/auth';
import { env } from '../../../lib/env';
import { Alert, AlertDescription, AlertTitle } from '../../../components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/ui/table';

function formatNumber(value: number | null | undefined, fractionDigits = 0) {
  if (value == null || Number.isNaN(value)) {
    return '—';
  }
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: fractionDigits,
  });
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return '—';
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return '—';
  }
  return parsed.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default async function AdaptationEdgesPage() {
  const session = await getServerAuthSession();

  if (env.authEnabled && !session) {
    redirect('/signin');
  }

  try {
    const summary = await fetchAdaptationEdges(session?.accessToken);

    const hasAnyBlocks = summary.windows.some((window) => window.bestTss || window.bestKilojoules);
    const tssAvailable = summary.windows.some((window) => window.bestTss);

    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">Adaptation edges</h1>
          <p className="text-muted-foreground">
            Discover the deepest training blocks across 3–25 day windows using total training stress
            score (TSS) and kilojoule volume.
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Training load summary</CardTitle>
            <CardDescription>
              Aggregated from normalized power metrics across {summary.totalActivities} activities.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-1">
                <dt className="text-sm font-medium text-muted-foreground">FTP estimate</dt>
                <dd className="text-lg font-semibold">
                  {summary.ftpEstimate ? `${formatNumber(summary.ftpEstimate, 0)} W` : 'Not enough data'}
                </dd>
              </div>
              <div className="space-y-1">
                <dt className="text-sm font-medium text-muted-foreground">Total TSS analyzed</dt>
                <dd className="text-lg font-semibold">{formatNumber(summary.totalTss, 2)}</dd>
              </div>
              <div className="space-y-1">
                <dt className="text-sm font-medium text-muted-foreground">Total kilojoules</dt>
                <dd className="text-lg font-semibold">{formatNumber(summary.totalKilojoules, 0)} kJ</dd>
              </div>
              <div className="space-y-1">
                <dt className="text-sm font-medium text-muted-foreground">Days covered</dt>
                <dd className="text-lg font-semibold">{formatNumber(summary.analyzedDays, 0)}</dd>
              </div>
              <div className="space-y-1">
                <dt className="text-sm font-medium text-muted-foreground">TSS blocks available</dt>
                <dd className="text-lg font-semibold">{tssAvailable ? 'Yes' : 'No'}</dd>
              </div>
            </dl>
            {!tssAvailable ? (
              <p className="mt-4 text-sm text-muted-foreground">
                Compute normalized power metrics to unlock estimated TSS blocks. Kilojoule blocks remain
                available even without an FTP estimate.
              </p>
            ) : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Deepest blocks by window length</CardTitle>
            <CardDescription>
              The strongest contiguous windows are highlighted by TSS and kilojoule volume for each
              duration between 3 and 25 days.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Days</TableHead>
                  <TableHead className="text-right">Peak TSS</TableHead>
                  <TableHead className="text-right">Avg TSS/day</TableHead>
                  <TableHead>Window (TSS)</TableHead>
                  <TableHead className="text-right">Peak kJ</TableHead>
                  <TableHead className="text-right">Avg kJ/day</TableHead>
                  <TableHead>Window (kJ)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!hasAnyBlocks ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-6 text-center text-sm text-muted-foreground">
                      No adaptation blocks yet. Compute normalized power metrics to populate this
                      analysis.
                    </TableCell>
                  </TableRow>
                ) : (
                  summary.windows.map((window) => {
                    const tssBlock = window.bestTss;
                    const kjBlock = window.bestKilojoules;
                    const tssWindowLabel = tssBlock
                      ? `${formatDate(tssBlock.startDate)} → ${formatDate(tssBlock.endDate)}`
                      : '—';
                    const kjWindowLabel = kjBlock
                      ? `${formatDate(kjBlock.startDate)} → ${formatDate(kjBlock.endDate)}`
                      : '—';

                    return (
                      <TableRow key={window.days}>
                        <TableCell className="font-medium">{window.days}</TableCell>
                        <TableCell className="text-right">{formatNumber(tssBlock?.total, 2)}</TableCell>
                        <TableCell className="text-right">{formatNumber(tssBlock?.averagePerDay, 2)}</TableCell>
                        <TableCell>{tssWindowLabel}</TableCell>
                        <TableCell className="text-right">{formatNumber(kjBlock?.total, 0)}</TableCell>
                        <TableCell className="text-right">{formatNumber(kjBlock?.averagePerDay, 0)}</TableCell>
                        <TableCell>{kjWindowLabel}</TableCell>
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
      error instanceof Error
        ? error.message
        : 'Unknown error while fetching adaptation edge analysis.';

    return (
      <Alert variant="destructive">
        <AlertTitle>Unable to load adaptation edges</AlertTitle>
        <AlertDescription>{message}</AlertDescription>
      </Alert>
    );
  }
}
