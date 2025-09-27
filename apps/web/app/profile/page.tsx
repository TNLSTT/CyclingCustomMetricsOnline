import { redirect } from 'next/navigation';

import { ProfileForm } from '../../components/profile-form';
import { Alert, AlertDescription, AlertTitle } from '../../components/ui/alert';
import { getServerAuthSession } from '../../lib/auth';
import { env } from '../../lib/env';
import type { Profile } from '../../types/profile';

async function loadProfile(token?: string): Promise<Profile | null> {
  if (!token) {
    return null;
  }

  const response = await fetch(`${env.internalApiUrl}/profile`, {
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to load profile');
  }

  return (await response.json()) as Profile | null;
}

export default async function ProfilePage() {
  const session = await getServerAuthSession();

  if (env.authEnabled && !session) {
    redirect('/signin');
  }

  if (!env.authEnabled) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Profile</h1>
          <p className="text-muted-foreground">
            Profiles are disabled while authentication is turned off.
          </p>
        </div>
        <Alert>
          <AlertTitle>Authentication disabled</AlertTitle>
          <AlertDescription>
            Set <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">AUTH_ENABLED=true</code> in the backend and
            <code className="ml-1 rounded bg-muted px-1 py-0.5 font-mono text-xs">NEXT_PUBLIC_AUTH_ENABLED=true</code> in the
            frontend to enable sign-in and user profiles.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  try {
    const profile = await loadProfile(session?.accessToken);

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Profile</h1>
          <p className="text-muted-foreground">
            Update how your name, photo, and bio appear across Cycling Custom Metrics.
          </p>
        </div>
        <ProfileForm profile={profile} authToken={session?.accessToken} />
      </div>
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error while fetching profile.';
    return (
      <Alert variant="destructive">
        <AlertTitle>Unable to load profile</AlertTitle>
        <AlertDescription>{message}</AlertDescription>
      </Alert>
    );
  }
}
