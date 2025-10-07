import { CardSkeleton, PageHeaderSkeleton, TableSkeleton } from '../../../../components/loading-skeletons';

export default function MetricRegistryLoading() {
  return (
    <div className="space-y-10">
      <PageHeaderSkeleton />
      <CardSkeleton headerLines={1} bodyLines={3} />
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <CardSkeleton key={index} headerLines={2} bodyLines={5} />
        ))}
      </div>
      <TableSkeleton columns={2} rows={4} />
    </div>
  );
}
