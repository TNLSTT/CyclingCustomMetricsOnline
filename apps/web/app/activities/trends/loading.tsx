import { ChartSkeleton, PageHeaderSkeleton } from '../../../components/loading-skeletons';

export default function ActivityTrendsLoading() {
  return (
    <div className="space-y-10">
      <PageHeaderSkeleton />
      <ChartSkeleton height="h-[420px]" />
    </div>
  );
}
