import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

interface ActivityQuickStatsProps {
  totalActivities: number;
  totalDurationHours: number;
  completedCount: number;
  pendingCount: number;
  uniqueMetricKeys: string[];
  latestUpload?: string | null;
}

function formatHours(hours: number) {
  if (!Number.isFinite(hours) || hours <= 0) {
    return '0h';
  }
  const rounded = Math.round(hours * 10) / 10;
  return `${rounded.toFixed(rounded % 1 === 0 ? 0 : 1)}h`;
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return '—';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }
  return date.toLocaleString();
}

export function ActivityQuickStats({
  totalActivities,
  totalDurationHours,
  completedCount,
  pendingCount,
  uniqueMetricKeys,
  latestUpload,
}: ActivityQuickStatsProps) {
  const completionRate = (() => {
    if (totalActivities === 0) {
      return '—';
    }
    const ratio = completedCount / totalActivities;
    return `${Math.round(ratio * 100)}%`;
  })();

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Total rides processed</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <p className="text-2xl font-bold">{totalActivities}</p>
          <p className="text-xs text-muted-foreground">
            Includes all uploads in the last 50 activity records.
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Time analyzed</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <p className="text-2xl font-bold">{formatHours(totalDurationHours)}</p>
          <p className="text-xs text-muted-foreground">Summed duration across listed rides.</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Metric coverage</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <p className="text-2xl font-bold">{completionRate}</p>
          <p className="text-xs text-muted-foreground">
            {completedCount} computed · {pendingCount} waiting on processing.
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Latest insight</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <p className="text-lg font-semibold">{uniqueMetricKeys.length || '—'} metrics</p>
          <p className="text-xs text-muted-foreground">Last upload {formatDateTime(latestUpload)}.</p>
        </CardContent>
      </Card>
    </div>
  );
}
