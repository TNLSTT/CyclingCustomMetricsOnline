import { CardSkeleton, ChartSkeleton, PageHeaderSkeleton, TableSkeleton } from '../../../../components/loading-skeletons';

export default function KjInIntervalLoading() {
  return (
    <div className="space-y-10">
      <PageHeaderSkeleton />
      <div className="grid gap-4 xl:grid-cols-[340px_1fr]">
        <CardSkeleton headerLines={2} bodyLines={5} />
        <div className="space-y-4">
          <ChartSkeleton height="h-[360px]" />
          <TableSkeleton columns={5} rows={6} />
        </div>
      </div>
    </div>
  );
}
