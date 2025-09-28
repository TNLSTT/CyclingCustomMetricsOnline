import type { AdaptationBlockSummary, AdaptationEdgesResponse } from '../types/adaptation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';

function formatNumber(value: number | null | undefined, fractionDigits = 0) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '—';
  }

  return value.toLocaleString(undefined, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

function formatDateRange(startIso: string, endIso: string) {
  const start = new Date(startIso);
  const end = new Date(endIso);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return '—';
  }

  const sameDay = start.toDateString() === end.toDateString();
  if (sameDay) {
    return dateFormatter.format(start);
  }

  return `${dateFormatter.format(start)} – ${dateFormatter.format(end)}`;
}

function BlockSummaryCell({
  block,
  primaryLabel,
  primaryValue,
  primaryDigits,
  secondaryLabel,
  secondaryValue,
  secondaryDigits,
}: {
  block: AdaptationBlockSummary | null;
  primaryLabel: string;
  primaryValue: number | null;
  primaryDigits: number;
  secondaryLabel: string;
  secondaryValue: number | null;
  secondaryDigits: number;
}) {
  if (!block) {
    return <span className="text-sm text-muted-foreground">Not enough data</span>;
  }

  const rideCount = block.activityIds.length;
  const rideLabel = rideCount === 1 ? 'ride' : 'rides';

  return (
    <div className="space-y-1">
      <div className="font-semibold">
        {formatNumber(primaryValue, primaryDigits)} {primaryLabel}
      </div>
      <div className="text-xs text-muted-foreground">
        {formatDateRange(block.start, block.end)} • {block.dayCount} days • {rideCount} {rideLabel}
      </div>
      <div className="text-xs text-muted-foreground">
        {formatNumber(secondaryValue, secondaryDigits)} {secondaryLabel}
      </div>
    </div>
  );
}

export function AdaptationDeepestBlocks({
  analysis,
}: {
  analysis: AdaptationEdgesResponse;
}) {
  const ftpDisplay =
    typeof analysis.ftpEstimate === 'number'
      ? `${formatNumber(analysis.ftpEstimate, 1)} W`
      : '—';

  const hasData = analysis.windowSummaries.some((entry) => entry.bestKj || entry.bestTss);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Adaptation edges</CardTitle>
        <CardDescription>
          Deepest training blocks across 3–25 day windows based on total training stress and total work.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">FTP estimate:</span> {ftpDisplay}
        </p>
        {!hasData ? (
          <p className="text-sm text-muted-foreground">
            Upload rides with power data to calculate TSS and kilojoule totals across multi-day training blocks.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Window</TableHead>
                  <TableHead>Highest TSS block</TableHead>
                  <TableHead>Highest kJ block</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {analysis.windowSummaries.map((summary) => (
                  <TableRow key={summary.windowDays}>
                    <TableCell className="font-medium">{summary.windowDays} days</TableCell>
                    <TableCell>
                      <BlockSummaryCell
                        block={summary.bestTss}
                        primaryLabel="TSS"
                        primaryValue={summary.bestTss?.totalTss ?? null}
                        primaryDigits={1}
                        secondaryLabel="kJ"
                        secondaryValue={summary.bestTss?.totalKj ?? null}
                        secondaryDigits={0}
                      />
                    </TableCell>
                    <TableCell>
                      <BlockSummaryCell
                        block={summary.bestKj}
                        primaryLabel="kJ"
                        primaryValue={summary.bestKj?.totalKj ?? null}
                        primaryDigits={0}
                        secondaryLabel="TSS"
                        secondaryValue={summary.bestKj?.totalTss ?? null}
                        secondaryDigits={1}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
