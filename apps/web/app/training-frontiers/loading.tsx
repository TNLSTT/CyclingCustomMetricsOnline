import { CardSkeleton, ChartSkeleton, PageHeaderSkeleton, TableSkeleton } from '../../components/loading-skeletons';

export default function TrainingFrontiersLoading() {
  return (
    <div className="space-y-10">
      <PageHeaderSkeleton />
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <CardSkeleton headerLines={2} bodyLines={5} />
        <div className="space-y-4">
          <ChartSkeleton height="h-[360px]" />
          <div className="grid gap-4 xl:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <CardSkeleton key={index} headerLines={2} bodyLines={5} />
            ))}
          </div>
          <TableSkeleton columns={5} rows={5} />
        </div>
      </div>
    </div>
  );
}
