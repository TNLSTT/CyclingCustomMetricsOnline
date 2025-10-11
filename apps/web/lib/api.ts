import { env } from './env';
import type {
  ActivitySummary,
  ComputeMetricsResponse,
  BulkComputeResponse,
  MetricDefinition,
  MetricResultDetail,
  PaginatedActivities,
  UploadResponse,
  IntervalEfficiencyResponse,
  IntervalEfficiencyHistoryResponse,
  ActivityTrackResponse,
  PowerStreamResponse,
} from '../types/activity';
import type { Profile } from '../types/profile';
import type { AdaptationEdgesResponse } from '../types/adaptation';
import type { DurabilityAnalysisResponse } from '../types/durability-analysis';
import type { DepthAnalysisResponse } from '../types/depth-analysis';
import type { TrainingFrontiersResponse } from '../types/training-frontiers';
import type { DurableTssFilters as DurableTssFiltersResponse, DurableTssResponse } from '../types/durable-tss';
import type { AdminUserListResponse, AdminUserSummary, UserRole } from '../types/admin';

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

export async function computeMetricsForAllActivities(authToken?: string) {
  return apiFetch<BulkComputeResponse>(
    '/activities/compute-all',
    {
      method: 'POST',
    },
    authToken,
  );
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

export async function fetchPowerStream(activityId: string, authToken?: string) {
  return apiFetch<PowerStreamResponse>(
    `/activities/${activityId}/streams/power`,
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

export async function fetchAdaptationEdges(authToken?: string) {
  return apiFetch<AdaptationEdgesResponse>(
    '/metrics/adaptation-edges/deepest-blocks',
    undefined,
    authToken,
  );
}

export interface DurabilityAnalysisFilters {
  minDurationMinutes?: number;
  startDate?: string;
  endDate?: string;
  discipline?: string;
  keyword?: string;
}

export async function fetchDurabilityAnalysis(
  filters: DurabilityAnalysisFilters,
  authToken?: string,
) {
  const params = new URLSearchParams();
  if (filters.minDurationMinutes != null) {
    params.set('minDurationMinutes', String(filters.minDurationMinutes));
  }
  if (filters.startDate) {
    params.set('startDate', filters.startDate);
  }
  if (filters.endDate) {
    params.set('endDate', filters.endDate);
  }
  if (filters.discipline) {
    params.set('discipline', filters.discipline);
  }
  if (filters.keyword) {
    params.set('keyword', filters.keyword);
  }

  const search = params.toString();
  const path = search.length > 0 ? `/durability-analysis?${search}` : '/durability-analysis';
  return apiFetch<DurabilityAnalysisResponse>(path, undefined, authToken);
}

export type DurableTssFilters = DurableTssFiltersResponse;

export async function fetchDurableTss(filters: DurableTssFilters, authToken?: string) {
  const params = new URLSearchParams({ thresholdKj: String(filters.thresholdKj) });
  if (filters.startDate) {
    params.set('startDate', filters.startDate);
  }
  if (filters.endDate) {
    params.set('endDate', filters.endDate);
  }

  const path = `/durable-tss?${params.toString()}`;
  return apiFetch<DurableTssResponse>(path, undefined, authToken);
}

export async function fetchTrainingFrontiers(windowDays?: number, authToken?: string) {
  const params = new URLSearchParams();
  if (windowDays != null) {
    params.set('windowDays', String(windowDays));
  }
  const query = params.toString();
  const path = query.length > 0 ? `/training-frontiers?${query}` : '/training-frontiers';
  return apiFetch<TrainingFrontiersResponse>(path, undefined, authToken);
}

export async function fetchDepthAnalysis(
  thresholdKj: number,
  minPowerWatts: number,
  authToken?: string,
) {
  const params = new URLSearchParams({
    thresholdKj: String(thresholdKj),
    minPower: String(minPowerWatts),
  });
  return apiFetch<DepthAnalysisResponse>(`/metrics/depth-analysis?${params.toString()}`, undefined, authToken);
}

export async function deleteActivity(activityId: string, authToken?: string) {
  await apiFetch<void>(`/activities/${activityId}`, { method: 'DELETE' }, authToken);
}

export async function fetchMetricDefinitions(authToken?: string) {
  const response = await apiFetch<{ definitions: MetricDefinition[] }>(`/metrics`, undefined, authToken);
  return response.definitions;
}

export async function registerUserAccount(email: string, password: string) {
  return apiFetch<{ user: AdminUserSummary; token: string }>(
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
  updates: {
    displayName: string | null;
    avatarUrl: string | null;
    bio: string | null;
    location: string | null;
    primaryDiscipline: string | null;
    trainingFocus: string | null;
    weeklyGoalHours: number | null;
    ftpWatts: number | null;
    websiteUrl: string | null;
    instagramHandle: string | null;
    achievements: string | null;
    weightKg?: number | null;
    hrMaxBpm?: number | null;
    hrRestBpm?: number | null;
    events?: Profile['events'];
    goals?: Profile['goals'];
    strengths?: string | null;
    weaknesses?: string | null;
  },
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

export async function fetchAdminUsers(
  params: {
    page?: number;
    pageSize?: number;
    search?: string;
  },
  authToken?: string,
  signal?: AbortSignal,
) {
  const searchParams = new URLSearchParams();
  if (params.page != null) {
    searchParams.set('page', String(params.page));
  }
  if (params.pageSize != null) {
    searchParams.set('pageSize', String(params.pageSize));
  }
  if (params.search) {
    searchParams.set('search', params.search);
  }

  const query = searchParams.toString();
  const path = query.length > 0 ? `/admin/users?${query}` : '/admin/users';
  return apiFetch<AdminUserListResponse>(
    path,
    { signal },
    authToken,
  );
}

export async function updateUserRole(userId: string, role: UserRole, authToken?: string) {
  return apiFetch<AdminUserSummary>(
    `/admin/users/${userId}`,
    {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    },
    authToken,
  );
}

type ClientMetricEventType = 'feature_click' | 'export';

export interface LogMetricEventInput {
  type: ClientMetricEventType;
  activityId?: string;
  durationMs?: number;
  success?: boolean;
  meta?: Record<string, unknown> | Array<unknown> | string | number | boolean | null;
}

export async function logMetricEvent(input: LogMetricEventInput, authToken?: string) {
  if (!authToken) {
    return;
  }

  try {
    await apiFetch<void>(
      '/telemetry/metric-events',
      {
        method: 'POST',
        body: JSON.stringify(input),
      },
      authToken,
    );
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('Failed to log metric event', error);
    }
  }
}
