import { NextResponse } from 'next/server';

import { getServerAuthSession } from '../../../lib/auth';
import { env } from '../../../lib/env';

const METRICS = new Set([
  'avg-power',
  'avg-hr',
  'kilojoules',
  'tss',
  'durable-tss',
  'duration-hours',
]);

const BUCKETS = new Set(['day', 'week', 'month']);

function sanitizeParam(value: string | null, allowed: Set<string>, fallback: string) {
  if (!value || value.trim() === '') {
    return fallback;
  }
  return allowed.has(value) ? value : fallback;
}

function sanitizeTimezone(value: string | null) {
  if (!value || value.trim() === '') {
    return 'UTC';
  }
  const trimmed = value.trim();
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: trimmed });
    return trimmed;
  } catch (error) {
    return 'UTC';
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const metric = sanitizeParam(url.searchParams.get('metric'), METRICS, 'avg-power');
  const bucket = sanitizeParam(url.searchParams.get('bucket'), BUCKETS, 'day');
  const timezone = sanitizeTimezone(url.searchParams.get('tz'));

  const backendUrl = new URL(`${env.internalApiUrl}/trends`);
  backendUrl.searchParams.set('metric', metric);
  backendUrl.searchParams.set('bucket', bucket);
  backendUrl.searchParams.set('tz', timezone);

  const headers: HeadersInit = {};

  if (env.authEnabled) {
    const session = await getServerAuthSession();
    const token = (session as { accessToken?: string } | null)?.accessToken;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    headers.Authorization = `Bearer ${token}`;
  }

  try {
    const response = await fetch(backendUrl.toString(), {
      headers,
      cache: 'no-store',
    });

    if (!response.ok) {
      const message = await response.text();
      return NextResponse.json(
        { error: message || 'Failed to load activity trends.' },
        { status: response.status },
      );
    }

    const payload = await response.json();
    return NextResponse.json(payload);
  } catch (error) {
    console.error('Failed to load trend data', error);
    return NextResponse.json({ error: 'Unable to load trend data.' }, { status: 502 });
  }
}
