import { notFound, redirect } from 'next/navigation';

import { AdminUsersClient } from '../../../components/admin-users-client';
import { PageHeader } from '../../../components/page-header';
import { Alert, AlertDescription, AlertTitle } from '../../../components/ui/alert';
import { getServerAuthSession } from '../../../lib/auth';
import { env } from '../../../lib/env';
import type { AdminUserListResponse } from '../../../types/admin';

const PAGE_SIZE = 20;

export default async function AdminUsersPage() {
  if (!env.authEnabled) {
    redirect('/');
  }

  const session = await getServerAuthSession();

  if (!session) {
    redirect(`/signin?callbackUrl=${encodeURIComponent('/admin/users')}`);
  }

  const token = session.accessToken;
  if (!token) {
    redirect(`/signin?callbackUrl=${encodeURIComponent('/admin/users')}`);
  }

  if (session.user?.role !== 'ADMIN') {
    notFound();
  }

  try {
    const response = await fetch(
      `${env.internalApiUrl}/admin/users?page=1&pageSize=${PAGE_SIZE}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: 'no-store',
      },
    );

    if (!response.ok) {
      const fallbackMessage = response.statusText || 'Failed to load users.';
      const parsed = await response
        .json()
        .then((data) => (typeof data?.error === 'string' ? data.error : fallbackMessage))
        .catch(() => fallbackMessage);
      throw new Error(parsed);
    }

    const initialData = (await response.json()) as AdminUserListResponse;

    return (
      <div className="space-y-8">
        <PageHeader
          title="Admin dashboard"
          description="Review registered accounts, adjust roles, and audit access history."
        />
        <AdminUsersClient
          initialUsers={initialData.data}
          total={initialData.total}
          pageSize={initialData.pageSize}
          authToken={token}
          currentUserId={session.user?.id}
        />
      </div>
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error while loading users.';
    return (
      <div className="space-y-6">
        <PageHeader title="Admin dashboard" description="Manage registered accounts." />
        <Alert variant="destructive">
          <AlertTitle>Unable to load admin data</AlertTitle>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      </div>
    );
  }
}
