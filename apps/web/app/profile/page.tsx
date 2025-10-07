import { redirect } from 'next/navigation';

import { ProfileForm } from '../../components/profile-form';
import { PageHeader } from '../../components/page-header';
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
      <div className="space-y-10">
        <PageHeader
          title="Profile"
          description="Profiles are disabled while authentication is turned off."
        />
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
      <div className="space-y-10">
        <PageHeader
          title="Profile"
          description="Craft a rich training identity with goals, highlights, and social links that appear alongside your activities and analytics."
        />
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
