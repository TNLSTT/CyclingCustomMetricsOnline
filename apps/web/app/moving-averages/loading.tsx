import { ChartSkeleton, PageHeaderSkeleton } from '../../components/loading-skeletons';

export default function MovingAveragesLoading() {
  return (
    <div className="space-y-10">
      <PageHeaderSkeleton />
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, index) => (
          <ChartSkeleton key={index} height="h-[360px]" />
        ))}
      </div>
    </div>
  );
}
