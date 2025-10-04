import type { IntervalEfficiencyHistoryResponse, MetricDefinition } from '../../../types/activity';
import type { AdaptationEdgesResponse } from '../../../types/adaptation';
import { env } from '../../../lib/env';

async function fetchWithAuth(path: string, token?: string, errorMessage?: string) {
  const headers: HeadersInit | undefined = token ? { Authorization: `Bearer ${token}` } : undefined;
  const response = await fetch(`${env.internalApiUrl}${path}`, {
    cache: 'no-store',
    headers,
  });

  if (!response.ok) {
    throw new Error(errorMessage ?? `Failed to load ${path}`);
  }

  return response;
}

export async function fetchMetricDefinitions(token?: string): Promise<MetricDefinition[]> {
  const response = await fetchWithAuth('/metrics', token, 'Failed to load metric definitions');
  const data = (await response.json()) as { definitions: MetricDefinition[] };
  return data.definitions;
}

export async function fetchIntervalEfficiencyHistory(
  token?: string,
): Promise<IntervalEfficiencyHistoryResponse> {
  const response = await fetchWithAuth(
    '/metrics/interval-efficiency/history',
    token,
    'Failed to load interval efficiency history',
  );
  return (await response.json()) as IntervalEfficiencyHistoryResponse;
}

export async function fetchAdaptationEdges(token?: string): Promise<AdaptationEdgesResponse> {
  const response = await fetchWithAuth(
    '/metrics/adaptation-edges/deepest-blocks',
    token,
    'Failed to load adaptation edges',
  );
  return (await response.json()) as AdaptationEdgesResponse;
}
