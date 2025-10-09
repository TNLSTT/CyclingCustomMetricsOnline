'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';

import { fetchAdminUsers, updateUserRole } from '../lib/api';
import type { AdminUserSummary, UserRole } from '../types/admin';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Badge } from './ui/badge';

interface AdminUsersClientProps {
  initialUsers: AdminUserSummary[];
  total: number;
  pageSize: number;
  authToken?: string;
  currentUserId?: string;
}

function useDebouncedValue<T>(value: T, delay: number) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const handle = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(handle);
  }, [value, delay]);

  return debounced;
}

const roleOptions: Array<{ value: UserRole; label: string }> = [
  { value: 'ADMIN', label: 'Admin' },
  { value: 'USER', label: 'User' },
];

export function AdminUsersClient({
  initialUsers,
  total: initialTotal,
  pageSize,
  authToken,
  currentUserId,
}: AdminUsersClientProps) {
  const [users, setUsers] = useState<AdminUserSummary[]>(initialUsers);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const feedbackTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const debouncedSearch = useDebouncedValue(search, 400);

  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }),
    [],
  );

  useEffect(() => {
    return () => {
      if (feedbackTimeout.current) {
        clearTimeout(feedbackTimeout.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!authToken) {
      return;
    }

    const controller = new AbortController();
    setIsLoading(true);
    setError(null);

    fetchAdminUsers(
      {
        page,
        pageSize,
        search: debouncedSearch || undefined,
      },
      authToken,
      controller.signal,
    )
      .then((response) => {
        if (controller.signal.aborted) {
          return;
        }
        setUsers(response.data);
        setTotal(response.total);
      })
      .catch((err) => {
        if (controller.signal.aborted) {
          return;
        }
        const message = err instanceof Error ? err.message : 'Failed to load users.';
        setError(message);
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      });

    return () => controller.abort();
  }, [authToken, debouncedSearch, page, pageSize]);

  const totalPages = useMemo(() => {
    if (total === 0) {
      return 1;
    }
    return Math.max(1, Math.ceil(total / pageSize));
  }, [pageSize, total]);

  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = total === 0 ? 0 : Math.min(total, rangeStart + users.length - 1);

  const handleRoleChange = async (userId: string, role: UserRole) => {
    if (!authToken) {
      setError('Missing authentication token. Please sign in again.');
      return;
    }

    const current = users.find((user) => user.id === userId);
    if (!current || current.role === role) {
      return;
    }

    setPendingUserId(userId);
    setError(null);

    try {
      const updated = await updateUserRole(userId, role, authToken);
      setUsers((previous) => previous.map((user) => (user.id === updated.id ? updated : user)));
      if (feedbackTimeout.current) {
        clearTimeout(feedbackTimeout.current);
      }
      setFeedback(`Updated ${updated.email} to ${role.toLowerCase()} role.`);
      feedbackTimeout.current = setTimeout(() => {
        setFeedback(null);
      }, 4000);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPendingUserId(null);
    }
  };

  if (!authToken) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Admin session required</AlertTitle>
        <AlertDescription>
          You must be signed in with an administrator account to manage users.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="relative w-full max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search by email"
            className="pl-9"
            aria-label="Search users by email"
          />
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>
            Showing {rangeStart}-{rangeEnd} of {total} users
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setSearch('');
              setPage(1);
            }}
            disabled={search.length === 0 && page === 1 && !isLoading}
          >
            Reset
          </Button>
        </div>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Unable to load users</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {feedback ? (
        <Alert>
          <AlertTitle>Role updated</AlertTitle>
          <AlertDescription>{feedback}</AlertDescription>
        </Alert>
      ) : null}

      <div className="overflow-hidden rounded-lg border bg-card/80 backdrop-blur">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead className="w-[160px]">Role</TableHead>
              <TableHead>Sign-up date</TableHead>
              <TableHead>Last login</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                  Loading users…
                </TableCell>
              </TableRow>
            ) : null}
            {!isLoading && users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                  No users found. Try adjusting your search.
                </TableCell>
              </TableRow>
            ) : null}
            {!isLoading
              ? users.map((user) => {
                  const isCurrentUser = user.id === currentUserId;
                  return (
                    <TableRow key={user.id}>
                      <TableCell className="space-y-1">
                        <div className="font-medium text-foreground">{user.email}</div>
                        <div className="text-xs text-muted-foreground">
                          ID: <code className="rounded bg-muted px-1 py-0.5">{user.id}</code>
                        </div>
                        {isCurrentUser ? (
                          <Badge variant="secondary" className="mt-1">
                            You
                          </Badge>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <select
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-70"
                          value={user.role}
                          onChange={(event) => handleRoleChange(user.id, event.target.value as UserRole)}
                          disabled={pendingUserId === user.id || isCurrentUser}
                          aria-label={`Change role for ${user.email}`}
                        >
                          {roleOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        {isCurrentUser ? (
                          <p className="mt-1 text-xs text-muted-foreground">
                            You cannot modify your own role.
                          </p>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-foreground">
                          {dateFormatter.format(new Date(user.createdAt))}
                        </span>
                      </TableCell>
                      <TableCell>
                        {user.lastLoginAt ? (
                          <span className="text-sm text-foreground">
                            {dateFormatter.format(new Date(user.lastLoginAt))}
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground">Never</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              : null}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col items-center gap-3 border-t pt-4 sm:flex-row sm:justify-between">
        <div className="text-sm text-muted-foreground">
          Page {page} of {totalPages}
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page <= 1}>
            Previous
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
            disabled={page >= totalPages}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
