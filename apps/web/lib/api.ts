import { env } from './env';
import type {
  ActivitySummary,
  ComputeMetricsResponse,
  MetricDefinition,
  MetricResultDetail,
  PaginatedActivities,
  UploadResponse,
  IntervalEfficiencyResponse,
  IntervalEfficiencyHistoryResponse,
  ActivityTrackResponse,
} from '../types/activity';
import type { Profile } from '../types/profile';

async function apiFetch<T>(path: string, init?: RequestInit, authToken?: string): Promise<T> {
  const url = path.startsWith('http') ? path : `${env.apiUrl}${path}`;
  const baseHeadersInit: HeadersInit | undefined = init?.body instanceof FormData
    ? init?.headers
    : { 'Content-Type': 'application/json', ...(init?.headers ?? {}) };
  const headers = new Headers(baseHeadersInit ?? undefined);
  if (authToken) {
    headers.set('Authorization', `Bearer ${authToken}`);
  }
  const response = await fetch(url, {
    ...init,
    headers,
    cache: 'no-store',
  });

  if (!response.ok) {
    const message = await response
      .json()
      .catch(() => ({ error: response.statusText }));
    throw new Error(message.error ?? 'Request failed');
  }

  if (response.status === 204) {
    return {} as T;
  }

  return (await response.json()) as T;
}

export async function uploadFitFiles(files: File[], authToken?: string) {
  const formData = new FormData();
  files.forEach((file) => formData.append('files', file));
  return apiFetch<UploadResponse>('/upload', {
    method: 'POST',
    body: formData,
  }, authToken);
}

export async function fetchActivities(page = 1, pageSize = 10, authToken?: string) {
  const searchParams = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  return apiFetch<PaginatedActivities>(`/activities?${searchParams.toString()}`, undefined, authToken);
}

export async function fetchActivity(activityId: string, authToken?: string) {
  return apiFetch<ActivitySummary>(`/activities/${activityId}`, undefined, authToken);
}

export async function computeMetrics(activityId: string, metricKeys?: string[], authToken?: string) {
  return apiFetch<ComputeMetricsResponse>(
    `/activities/${activityId}/compute`,
    {
      method: 'POST',
      body: JSON.stringify(metricKeys ? { metricKeys } : {}),
    },
    authToken,
  );
}

export async function fetchMetricResult(
  activityId: string,
  metricKey: string,
  authToken?: string,
) {
  return apiFetch<MetricResultDetail>(
    `/activities/${activityId}/metrics/${metricKey}`,
    undefined,
    authToken,
  );
}

export async function fetchActivityTrack(activityId: string, authToken?: string) {
  return apiFetch<ActivityTrackResponse>(`/activities/${activityId}/track`, undefined, authToken);
}

export async function fetchIntervalEfficiency(activityId: string, authToken?: string) {
  return apiFetch<IntervalEfficiencyResponse>(
    `/activities/${activityId}/metrics/interval-efficiency`,
    undefined,
    authToken,
  );
}

export async function fetchIntervalEfficiencyHistory(authToken?: string) {
  return apiFetch<IntervalEfficiencyHistoryResponse>(
    '/metrics/interval-efficiency/history',
    undefined,
    authToken,
  );
}

export async function deleteActivity(activityId: string, authToken?: string) {
  await apiFetch<void>(`/activities/${activityId}`, { method: 'DELETE' }, authToken);
}

export async function fetchMetricDefinitions(authToken?: string) {
  const response = await apiFetch<{ definitions: MetricDefinition[] }>(`/metrics`, undefined, authToken);
  return response.definitions;
}

export async function registerUserAccount(email: string, password: string) {
  return apiFetch<{ user: { id: string; email: string }; token: string }>(
    '/auth/register',
    {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    },
  );
}

export async function fetchProfile(authToken?: string) {
  return apiFetch<Profile | null>('/profile', undefined, authToken);
}

export async function updateProfile(
  updates: { displayName: string | null; avatarUrl: string | null; bio: string | null },
  authToken?: string,
) {
  return apiFetch<Profile>(
    '/profile',
    {
      method: 'PUT',
      body: JSON.stringify(updates),
    },
    authToken,
  );
}
