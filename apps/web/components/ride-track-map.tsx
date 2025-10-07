'use client';

import { useMemo } from 'react';

import type { ActivityTrackPoint, ActivityTrackResponse } from '../types/activity';
import { cn } from '../lib/utils';

interface RideTrackMapProps {
  points: ActivityTrackPoint[];
  bounds?: ActivityTrackResponse['bounds'];
  className?: string;
}

const VIEWBOX_WIDTH = 800;
const VIEWBOX_HEIGHT = 600;

interface SanitizedPoint {
  latitude: number;
  longitude: number;
}

interface PreparedTrack {
  normalized: Array<[number, number]>;
  path: string;
  start: [number, number] | null;
  finish: [number, number] | null;
  stats: TrackStats;
}

interface TrackStats {
  latSpanDeg: number;
  lonSpanDeg: number;
  approxDistanceKm: number | null;
}

function coerceCoordinate(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return null;
    }
    const parsed = Number.parseFloat(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }

  if (typeof value === 'bigint') {
    const coerced = Number(value);
    return Number.isFinite(coerced) ? coerced : null;
  }

  if (typeof value === 'object' && value !== null) {
    if (typeof (value as { toNumber?: () => unknown }).toNumber === 'function') {
      try {
        return coerceCoordinate((value as { toNumber: () => unknown }).toNumber());
      } catch {
        return null;
      }
    }

    if (typeof (value as { valueOf?: () => unknown }).valueOf === 'function') {
      try {
        const primitive = (value as { valueOf: () => unknown }).valueOf();
        if (primitive !== value) {
          return coerceCoordinate(primitive);
        }
      } catch {
        return null;
      }
    }

    if (typeof (value as { toString?: () => string }).toString === 'function') {
      try {
        return coerceCoordinate((value as { toString: () => string }).toString());
      } catch {
        return null;
      }
    }
  }

  return null;
}

function sanitizePoints(points: ActivityTrackPoint[]): SanitizedPoint[] {
  return points
    .map((point) => {
      if (!point || typeof point !== 'object') {
        return null;
      }
      const latitude = coerceCoordinate((point as ActivityTrackPoint).latitude);
      const longitude = coerceCoordinate((point as ActivityTrackPoint).longitude);
      if (latitude == null || longitude == null) {
        return null;
      }
      return { latitude, longitude };
    })
    .filter((point): point is SanitizedPoint => point !== null);
}

function unwrapLongitudes(points: SanitizedPoint[]): SanitizedPoint[] {
  if (points.length === 0) {
    return points;
  }

  const unwrapped: SanitizedPoint[] = [];
  let offset = 0;
  let previous = points[0]!.longitude;
  for (const point of points) {
    let longitude = point.longitude + offset;
    const adjustedPrevious = previous + offset;
    const delta = longitude - adjustedPrevious;
    if (delta > 180) {
      offset -= 360;
      longitude = point.longitude + offset;
    } else if (delta < -180) {
      offset += 360;
      longitude = point.longitude + offset;
    }
    unwrapped.push({ latitude: point.latitude, longitude });
    previous = point.longitude;
  }
  return unwrapped;
}

function degreesToRadians(degrees: number) {
  return (degrees * Math.PI) / 180;
}

function haversineDistanceKm(a: SanitizedPoint, b: SanitizedPoint): number {
  const R = 6371; // km
  const lat1 = degreesToRadians(a.latitude);
  const lat2 = degreesToRadians(b.latitude);
  const dLat = lat2 - lat1;
  let dLon = degreesToRadians(b.longitude - a.longitude);
  if (dLon > Math.PI) {
    dLon -= 2 * Math.PI;
  } else if (dLon < -Math.PI) {
    dLon += 2 * Math.PI;
  }
  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);
  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLon * sinLon;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return R * c;
}

function computeTrackStats(points: SanitizedPoint[]): TrackStats {
  if (points.length === 0) {
    return { latSpanDeg: 0, lonSpanDeg: 0, approxDistanceKm: null };
  }
  const unwrapped = unwrapLongitudes(points);
  let minLat = Number.POSITIVE_INFINITY;
  let maxLat = Number.NEGATIVE_INFINITY;
  let minLon = Number.POSITIVE_INFINITY;
  let maxLon = Number.NEGATIVE_INFINITY;
  for (const point of unwrapped) {
    minLat = Math.min(minLat, point.latitude);
    maxLat = Math.max(maxLat, point.latitude);
    minLon = Math.min(minLon, point.longitude);
    maxLon = Math.max(maxLon, point.longitude);
  }
  let distance = 0;
  for (let index = 1; index < points.length; index += 1) {
    distance += haversineDistanceKm(points[index - 1]!, points[index]!);
  }
  return {
    latSpanDeg: maxLat - minLat,
    lonSpanDeg: maxLon - minLon,
    approxDistanceKm: Number.isFinite(distance) ? distance : null,
  };
}

function prepareTrack(points: ActivityTrackPoint[]): PreparedTrack {
  const sanitized = sanitizePoints(points);
  if (sanitized.length === 0) {
    return {
      normalized: [],
      path: '',
      start: null,
      finish: null,
      stats: { latSpanDeg: 0, lonSpanDeg: 0, approxDistanceKm: null },
    };
  }

  const unwrapped = unwrapLongitudes(sanitized);
  const stats = computeTrackStats(sanitized);

  let minLat = Number.POSITIVE_INFINITY;
  let maxLat = Number.NEGATIVE_INFINITY;
  let minLon = Number.POSITIVE_INFINITY;
  let maxLon = Number.NEGATIVE_INFINITY;

  for (const point of unwrapped) {
    minLat = Math.min(minLat, point.latitude);
    maxLat = Math.max(maxLat, point.latitude);
    minLon = Math.min(minLon, point.longitude);
    maxLon = Math.max(maxLon, point.longitude);
  }

  const latRange = Math.max(maxLat - minLat, 1e-6);
  const midLatitudeRadians = degreesToRadians((maxLat + minLat) / 2);
  const lonScaleFactor = Math.max(Math.abs(Math.cos(midLatitudeRadians)), 1e-6);
  const lonRange = Math.max((maxLon - minLon) * lonScaleFactor, 1e-6);
  const scale = Math.min(VIEWBOX_WIDTH / lonRange, VIEWBOX_HEIGHT / latRange);
  const offsetX = (VIEWBOX_WIDTH - lonRange * scale) / 2;
  const offsetY = (VIEWBOX_HEIGHT - latRange * scale) / 2;

  const normalized = unwrapped.map((point) => {
    const projectedLon = (point.longitude - minLon) * lonScaleFactor;
    const x = projectedLon * scale + offsetX;
    const y = VIEWBOX_HEIGHT - ((point.latitude - minLat) * scale + offsetY);
    return [Number.parseFloat(x.toFixed(2)), Number.parseFloat(y.toFixed(2))] as [number, number];
  });

  const path = normalized
    .map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${x} ${y}`)
    .join(' ');

  return {
    normalized,
    path,
    start: normalized[0] ?? null,
    finish: normalized[normalized.length - 1] ?? null,
    stats,
  };
}

function formatSpan(value: number, fractionDigits = 2) {
  if (!Number.isFinite(value) || value <= 0) {
    return '—';
  }
  if (value >= 1) {
    return `${value.toFixed(fractionDigits)}°`;
  }
  const minutes = value * 60;
  if (minutes >= 1) {
    return `${minutes.toFixed(fractionDigits)}′`;
  }
  return `${(minutes * 60).toFixed(fractionDigits)}″`;
}

function formatDistance(kilometers: number | null) {
  if (kilometers == null || !Number.isFinite(kilometers) || kilometers <= 0) {
    return 'Distance unavailable';
  }
  if (kilometers >= 1) {
    return `${kilometers.toFixed(1)} km of samples`;
  }
  return `${(kilometers * 1000).toFixed(0)} m of samples`;
}

export function RideTrackMap({ points, bounds, className }: RideTrackMapProps) {
  const prepared = useMemo(() => prepareTrack(points), [points]);
  const hasRoute = prepared.normalized.length > 0;

  const latSpanText = useMemo(() => formatSpan(prepared.stats.latSpanDeg), [prepared.stats.latSpanDeg]);
  const lonSpanText = useMemo(() => formatSpan(prepared.stats.lonSpanDeg), [prepared.stats.lonSpanDeg]);
  const distanceText = useMemo(() => formatDistance(prepared.stats.approxDistanceKm), [
    prepared.stats.approxDistanceKm,
  ]);

  const boundsText = useMemo(() => {
    if (!bounds) {
      return null;
    }
    const north = bounds.maxLatitude;
    const south = bounds.minLatitude;
    const east = bounds.maxLongitude;
    const west = bounds.minLongitude;
    const latSummary = `${Math.abs(north).toFixed(3)}°${north >= 0 ? 'N' : 'S'} / ${Math.abs(south).toFixed(3)}°${south >= 0 ? 'N' : 'S'}`;
    const lonSummary = `${Math.abs(east).toFixed(3)}°${east >= 0 ? 'E' : 'W'} / ${Math.abs(west).toFixed(3)}°${west >= 0 ? 'E' : 'W'}`;
    return { latSummary, lonSummary };
  }, [bounds]);

  return (
    <div className={cn('relative overflow-hidden rounded-3xl border border-slate-800/40', className)}>
      <svg viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`} className="h-full w-full">
        <defs>
          <linearGradient id="ride-map-bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#020617" />
            <stop offset="50%" stopColor="#1e293b" />
            <stop offset="100%" stopColor="#0f172a" />
          </linearGradient>
          <linearGradient id="ride-map-path" x1="0%" y1="0%" x2="100%" y2="0%" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#34d399" />
            <stop offset="50%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#f97316" />
          </linearGradient>
          <filter id="ride-map-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="7" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <pattern id="ride-map-grid" width="80" height="80" patternUnits="userSpaceOnUse">
            <path d={`M 80 0 L 0 0 0 80`} fill="none" stroke="#64748b" strokeOpacity="0.12" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#ride-map-bg)" />
        <rect width="100%" height="100%" fill="url(#ride-map-grid)" />
        {hasRoute && prepared.path ? (
          <g filter="url(#ride-map-glow)">
            <path
              d={prepared.path}
              fill="none"
              stroke="url(#ride-map-path)"
              strokeWidth={12}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        ) : null}
        {hasRoute && prepared.start ? (
          <circle cx={prepared.start[0]} cy={prepared.start[1]} r={14} fill="#f97316" opacity="0.9" />
        ) : null}
        {hasRoute && prepared.finish ? (
          <circle cx={prepared.finish[0]} cy={prepared.finish[1]} r={14} fill="#38bdf8" opacity="0.9" />
        ) : null}
      </svg>
      {!hasRoute ? (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950/60 px-4 text-sm text-slate-200">
          No valid GPS samples were found for this ride.
        </div>
      ) : (
        <>
          <div className="pointer-events-none absolute inset-x-4 bottom-4 flex flex-col gap-2 rounded-2xl bg-slate-950/70 p-4 text-[0.7rem] text-slate-200 shadow-lg shadow-primary/10 backdrop-blur">
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.3em] text-primary">
              <span>Route summary</span>
              <span className="tracking-normal text-slate-100">{distanceText}</span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-[0.75rem]">
              <div className="flex flex-col gap-1">
                <span className="text-xs uppercase tracking-[0.2em] text-slate-400">Latitude span</span>
                <span className="text-base font-semibold text-slate-100">{latSpanText}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs uppercase tracking-[0.2em] text-slate-400">Longitude span</span>
                <span className="text-base font-semibold text-slate-100">{lonSpanText}</span>
              </div>
            </div>
            {boundsText ? (
              <div className="grid grid-cols-2 gap-3 text-[0.75rem] text-slate-300">
                <div className="flex flex-col gap-1">
                  <span className="text-xs uppercase tracking-[0.2em] text-slate-500">Lat bounds</span>
                  <span className="font-medium text-slate-100">{boundsText.latSummary}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs uppercase tracking-[0.2em] text-slate-500">Lon bounds</span>
                  <span className="font-medium text-slate-100">{boundsText.lonSummary}</span>
                </div>
              </div>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
