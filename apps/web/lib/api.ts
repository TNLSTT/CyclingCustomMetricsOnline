import { env } from './env';
import type {
  ActivitySummary,
  ComputeMetricsResponse,
  MetricDefinition,
  MetricResultDetail,
  PaginatedActivities,
  UploadResponse,
} from '../types/activity';

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const baseUrl =
    typeof window === 'undefined' ? env.internalApiUrl ?? env.apiUrl : env.apiUrl;
  const url = path.startsWith('http') ? path : `${baseUrl}${path}`;
  const headers =
    init?.body instanceof FormData
      ? init?.headers
      : { 'Content-Type': 'application/json', ...(init?.headers ?? {}) };

  let response: Response;

  try {
    response = await fetch(url, {
      ...init,
      headers,
      cache: 'no-store',
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Unexpected error while contacting the metrics API';
    throw new Error(
      `${message}. Verify the backend is running at ${baseUrl} and accessible from the web app.`,
    );
  }

  if (!response.ok) {
    const message = await response
      .json()
      .catch(() => ({ error: response.statusText || 'Request failed' }));
    throw new Error(
      message.error || `Request failed with status ${response.status} from ${url}`,
    );
  }

  if (response.status === 204) {
    return {} as T;
  }

  return (await response.json()) as T;
}

export async function uploadFitFile(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  return apiFetch<UploadResponse>('/upload', {
    method: 'POST',
    body: formData,
  });
}

export async function fetchActivities(page = 1, pageSize = 10) {
  const searchParams = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  return apiFetch<PaginatedActivities>(`/activities?${searchParams.toString()}`);
}

export async function fetchActivity(activityId: string) {
  return apiFetch<ActivitySummary>(`/activities/${activityId}`);
}

export async function computeMetrics(activityId: string, metricKeys?: string[]) {
  return apiFetch<ComputeMetricsResponse>(`/activities/${activityId}/compute`, {
    method: 'POST',
    body: JSON.stringify(metricKeys ? { metricKeys } : {}),
  });
}

export async function fetchMetricResult(activityId: string, metricKey: string) {
  return apiFetch<MetricResultDetail>(`/activities/${activityId}/metrics/${metricKey}`);
}

export async function deleteActivity(activityId: string) {
  await apiFetch<void>(`/activities/${activityId}`, { method: 'DELETE' });
}

export async function fetchMetricDefinitions() {
  const response = await apiFetch<{ definitions: MetricDefinition[] }>(`/metrics`);
  return response.definitions;
}
