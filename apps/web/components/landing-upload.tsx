'use client';

import { useRouter } from 'next/navigation';

import { FileUpload } from './file-upload';

export function LandingUpload() {
  const router = useRouter();

  return (
    <FileUpload
      onUploaded={(activityId) => {
        router.push(`/activities/${activityId}`);
      }}
    />
  );
}
