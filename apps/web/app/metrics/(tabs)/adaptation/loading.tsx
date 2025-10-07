import { CardSkeleton, PageHeaderSkeleton } from '../../../../components/loading-skeletons';

export default function AdaptationLoading() {
  return (
    <div className="space-y-10">
      <PageHeaderSkeleton />
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <CardSkeleton key={index} headerLines={2} bodyLines={6} />
        ))}
      </div>
    </div>
  );
}
