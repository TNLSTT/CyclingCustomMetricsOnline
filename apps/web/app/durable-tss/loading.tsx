import { CardSkeleton, ChartSkeleton, PageHeaderSkeleton } from '../../components/loading-skeletons';

export default function DurableTssLoading() {
  return (
    <div className="space-y-10">
      <PageHeaderSkeleton />
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <CardSkeleton headerLines={2} bodyLines={4} />
        <ChartSkeleton height="h-[420px]" />
      </div>
    </div>
  );
}
