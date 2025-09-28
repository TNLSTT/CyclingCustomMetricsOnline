'use client';

import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';

import { FileUpload } from './file-upload';

export function LandingUpload() {
  const router = useRouter();
  const { status } = useSession();

  return (
    <FileUpload
      onAuthRequired={() => {
        if (status !== 'authenticated') {
          router.push('/signin?callbackUrl=%2Factivities');
        }
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
