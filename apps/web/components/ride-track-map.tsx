'use client';

import { useMemo } from 'react';

import type { ActivityTrackPoint } from '../types/activity';
import { cn } from '../lib/utils';

interface RideTrackMapProps {
  points: ActivityTrackPoint[];
  className?: string;
}

const VIEWBOX_WIDTH = 800;
const VIEWBOX_HEIGHT = 600;

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

function normalizePoints(points: ActivityTrackPoint[]) {
  const sanitized: Array<{ latitude: number; longitude: number }> = points
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
    .filter((point): point is { latitude: number; longitude: number } => point !== null);

  if (sanitized.length === 0) {
    return [] as Array<[number, number]>;
  }

  let minLat = Number.POSITIVE_INFINITY;
  let maxLat = Number.NEGATIVE_INFINITY;
  let minLon = Number.POSITIVE_INFINITY;
  let maxLon = Number.NEGATIVE_INFINITY;

  for (const point of sanitized) {
    minLat = Math.min(minLat, point.latitude);
    maxLat = Math.max(maxLat, point.latitude);
    minLon = Math.min(minLon, point.longitude);
    maxLon = Math.max(maxLon, point.longitude);
  }

  const latRange = Math.max(maxLat - minLat, 1e-6);
  const midLatitudeRadians = ((maxLat + minLat) / 2) * (Math.PI / 180);
  // Longitude degrees shrink by cos(latitude); adjust so tracks keep their aspect ratio.
  const lonToLatRatio = Math.max(Math.abs(Math.cos(midLatitudeRadians)), 1e-6);
  const lonRange = Math.max((maxLon - minLon) * lonToLatRatio, 1e-6);
  const scale = Math.min(VIEWBOX_WIDTH / lonRange, VIEWBOX_HEIGHT / latRange);
  const offsetX = (VIEWBOX_WIDTH - lonRange * scale) / 2;
  const offsetY = (VIEWBOX_HEIGHT - latRange * scale) / 2;

  return sanitized.map((point) => {
    const projectedLon = (point.longitude - minLon) * lonToLatRatio;
    const x = projectedLon * scale + offsetX;
    const y = VIEWBOX_HEIGHT - ((point.latitude - minLat) * scale + offsetY);
    return [Number.parseFloat(x.toFixed(2)), Number.parseFloat(y.toFixed(2))] as [number, number];
  });
}

export function RideTrackMap({ points, className }: RideTrackMapProps) {
  const normalized = useMemo(() => normalizePoints(points), [points]);
  const hasRoute = normalized.length > 0;

  const pathData = useMemo(() => {
    if (!hasRoute) {
      return '';
    }
    const commands = normalized.map(([x, y], index) => {
      return `${index === 0 ? 'M' : 'L'}${x} ${y}`;
    });
    return commands.join(' ');
  }, [hasRoute, normalized]);

  const start = hasRoute ? normalized[0] : null;
  const finish = hasRoute ? normalized[normalized.length - 1] : null;

  return (
    <div className={cn('relative', className)}>
      <svg viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`} className="h-full w-full">
        <defs>
          <linearGradient id="ride-map-bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0f172a" />
            <stop offset="50%" stopColor="#1d4ed8" />
            <stop offset="100%" stopColor="#9333ea" />
          </linearGradient>
          <linearGradient id="ride-map-path" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#bef264" />
            <stop offset="50%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#f97316" />
          </linearGradient>
          <filter id="ride-map-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="8" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <rect width="100%" height="100%" fill="url(#ride-map-bg)" rx="24" />
        <g opacity="0.15" stroke="#e2e8f0" strokeWidth="1">
          {Array.from({ length: 10 }).map((_, index) => {
            const x = ((index + 1) / 11) * VIEWBOX_WIDTH;
            return <line key={`v-${index}`} x1={x} y1={0} x2={x} y2={VIEWBOX_HEIGHT} />;
          })}
          {Array.from({ length: 6 }).map((_, index) => {
            const y = ((index + 1) / 7) * VIEWBOX_HEIGHT;
            return <line key={`h-${index}`} x1={0} y1={y} x2={VIEWBOX_WIDTH} y2={y} />;
          })}
        </g>
        {hasRoute && pathData ? (
          <g filter="url(#ride-map-glow)">
            <path d={pathData} fill="none" stroke="url(#ride-map-path)" strokeWidth="10" strokeLinecap="round" />
          </g>
        ) : null}
        {start ? <circle cx={start[0]} cy={start[1]} r={14} fill="#f97316" opacity="0.9" /> : null}
        {finish ? <circle cx={finish[0]} cy={finish[1]} r={14} fill="#38bdf8" opacity="0.9" /> : null}
      </svg>
      {!hasRoute ? (
        <div className="absolute inset-0 flex items-center justify-center px-4 text-sm text-slate-200">
          No valid GPS samples were found for this ride.
        </div>
      ) : null}
    </div>
  );
}
