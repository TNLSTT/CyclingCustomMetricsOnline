import { CardSkeleton, ChartSkeleton, TableSkeleton } from '../../../components/loading-skeletons';
import { Skeleton } from '../../../components/ui/skeleton';

export default function ActivityDetailLoading() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div className="space-y-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-44" />
        </div>
        <Skeleton className="h-10 w-40" />
      </div>
      <CardSkeleton headerLines={1} bodyHeight="h-[380px]" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <CardSkeleton key={index} headerLines={2} bodyLines={5} />
        ))}
      </div>
      <CardSkeleton headerLines={2} bodyLines={6} />
      <TableSkeleton columns={6} rows={6} />
      <ChartSkeleton height="h-72" />
      <CardSkeleton headerLines={2} bodyLines={4} />
    </div>
  );
}
