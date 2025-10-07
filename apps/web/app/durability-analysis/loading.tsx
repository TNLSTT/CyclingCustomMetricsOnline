import { CardSkeleton, ChartSkeleton, PageHeaderSkeleton, TableSkeleton } from '../../components/loading-skeletons';

export default function DurabilityAnalysisLoading() {
  return (
    <div className="space-y-10">
      <PageHeaderSkeleton />
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <CardSkeleton headerLines={2} bodyLines={6} />
        <div className="space-y-4">
          <ChartSkeleton height="h-[360px]" />
          <TableSkeleton columns={6} rows={6} />
        </div>
      </div>
    </div>
  );
}
