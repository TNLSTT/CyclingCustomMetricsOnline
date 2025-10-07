import { CardSkeleton, ChartSkeleton, PageHeaderSkeleton, TableSkeleton } from '../../../../components/loading-skeletons';

export default function IntervalEfficiencyLoading() {
  return (
    <div className="space-y-10">
      <PageHeaderSkeleton />
      <CardSkeleton headerLines={2} bodyLines={3} />
      <ChartSkeleton height="h-[360px]" />
      <TableSkeleton columns={6} rows={6} />
    </div>
  );
}
