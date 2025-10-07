import { MiniStatSkeleton, PageHeaderSkeleton, TableSkeleton } from '../../components/loading-skeletons';

export default function ActivitiesLoading() {
  return (
    <div className="space-y-10">
      <PageHeaderSkeleton />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <MiniStatSkeleton key={index} />
        ))}
      </div>
      <TableSkeleton columns={6} rows={7} />
    </div>
  );
}
