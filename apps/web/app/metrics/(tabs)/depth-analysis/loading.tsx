import { CardSkeleton, ChartSkeleton, PageHeaderSkeleton, TableSkeleton } from '../../../../components/loading-skeletons';

export default function DepthAnalysisLoading() {
  return (
    <div className="space-y-10">
      <PageHeaderSkeleton />
      <CardSkeleton headerLines={2} bodyLines={4} />
      <ChartSkeleton height="h-[360px]" />
      <TableSkeleton columns={5} rows={5} />
    </div>
  );
}
