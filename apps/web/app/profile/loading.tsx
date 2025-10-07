import { FormSkeleton, PageHeaderSkeleton } from '../../components/loading-skeletons';

export default function ProfileLoading() {
  return (
    <div className="space-y-10">
      <PageHeaderSkeleton />
      <FormSkeleton includeAvatar fieldCount={5} />
    </div>
  );
}
