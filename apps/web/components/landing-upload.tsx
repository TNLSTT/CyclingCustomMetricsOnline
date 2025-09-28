'use client';

import { useRouter } from 'next/navigation';

import { FileUpload } from './file-upload';

export function LandingUpload() {
  const router = useRouter();

  return (
    <FileUpload
      onAuthRequired={() => {
        router.push('/signin?callbackUrl=/activities');
      }}
      onUploaded={(activityIds) => {
        if (activityIds.length === 1) {
          router.push(`/activities/${activityIds[0]}`);
          return;
        }
        router.push('/activities');
      }}
    />
  );
}
