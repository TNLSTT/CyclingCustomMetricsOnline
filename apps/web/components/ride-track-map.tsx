'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { ActivityTrackBounds, ActivityTrackPoint, NumericLike } from '../types/activity';
import { cn } from '../lib/utils';

interface RideTrackMapProps {
  points: ActivityTrackPoint[];
  bounds?: ActivityTrackBounds | null;
  className?: string;
}

type NormalizedPoint = { latitude: number; longitude: number };

type ProjectedPoint = { x: number; y: number };

type NormalizedBounds = {
  minLatitude: number;
  maxLatitude: number;
  minLongitude: number;
  maxLongitude: number;
};

function coerceCoordinate(value: NumericLike | null | undefined): number | null {
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

  return null;
}

function sanitizePoints(points: ActivityTrackPoint[]): NormalizedPoint[] {
  return points
    .map((point) => {
      if (!point || typeof point !== 'object') {
        return null;
      }

      const rawLatitude = (point as { lat?: NumericLike; latitude?: NumericLike }).lat ??
        (point as { lat?: NumericLike; latitude?: NumericLike }).latitude;
      const rawLongitude = (point as { lon?: NumericLike; longitude?: NumericLike }).lon ??
        (point as { lon?: NumericLike; longitude?: NumericLike }).longitude;
      const latitude = coerceCoordinate(rawLatitude);
      const longitude = coerceCoordinate(rawLongitude);

      if (latitude == null || longitude == null) {
        return null;
      }

      return { latitude, longitude } satisfies NormalizedPoint;
    })
    .filter((point): point is NormalizedPoint => point !== null);
}

function sanitizeBounds(bounds?: ActivityTrackBounds | null): NormalizedBounds | null {
  if (!bounds) {
    return null;
  }

  const minLatitude = coerceCoordinate(bounds.minLatitude);
  const maxLatitude = coerceCoordinate(bounds.maxLatitude);
  const minLongitude = coerceCoordinate(bounds.minLongitude);
  const maxLongitude = coerceCoordinate(bounds.maxLongitude);

  if (
    minLatitude == null ||
    maxLatitude == null ||
    minLongitude == null ||
    maxLongitude == null
  ) {
    return null;
  }

  return { minLatitude, maxLatitude, minLongitude, maxLongitude } satisfies NormalizedBounds;
}

function computeProjectedPoints(
  points: NormalizedPoint[],
  bounds: NormalizedBounds | null,
  width: number,
  height: number,
): ProjectedPoint[] {
  if (points.length === 0 || width <= 0 || height <= 0) {
    return [];
  }

  let minLatitude = Number.POSITIVE_INFINITY;
  let maxLatitude = Number.NEGATIVE_INFINITY;
  let minLongitude = Number.POSITIVE_INFINITY;
  let maxLongitude = Number.NEGATIVE_INFINITY;

  if (bounds) {
    minLatitude = bounds.minLatitude;
    maxLatitude = bounds.maxLatitude;
    minLongitude = bounds.minLongitude;
    maxLongitude = bounds.maxLongitude;
  } else {
    for (const point of points) {
      minLatitude = Math.min(minLatitude, point.latitude);
      maxLatitude = Math.max(maxLatitude, point.latitude);
      minLongitude = Math.min(minLongitude, point.longitude);
      maxLongitude = Math.max(maxLongitude, point.longitude);
    }
  }

  if (!Number.isFinite(minLatitude) || !Number.isFinite(maxLatitude)) {
    return [];
  }

  const latRange = Math.max(maxLatitude - minLatitude, 1e-6);
  const midLatitudeRadians = ((maxLatitude + minLatitude) / 2) * (Math.PI / 180);
  const lonScale = Math.max(Math.abs(Math.cos(midLatitudeRadians)), 1e-6);
  const lonRange = Math.max((maxLongitude - minLongitude) * lonScale, 1e-6);
  const scale = Math.min(width / lonRange, height / latRange);
  const offsetX = (width - lonRange * scale) / 2;
  const offsetY = (height - latRange * scale) / 2;

  return points.map((point) => {
    const projectedLon = (point.longitude - minLongitude) * lonScale;
    const x = projectedLon * scale + offsetX;
    const y = height - ((point.latitude - minLatitude) * scale + offsetY);
    return { x, y } satisfies ProjectedPoint;
  });
}

function drawBackground(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, '#0f172a');
  gradient.addColorStop(0.5, '#1d4ed8');
  gradient.addColorStop(1, '#9333ea');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.globalAlpha = 0.25;
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1;

  const verticalLines = 10;
  for (let index = 1; index <= verticalLines; index += 1) {
    const x = (index / (verticalLines + 1)) * width;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }

  const horizontalLines = 6;
  for (let index = 1; index <= horizontalLines; index += 1) {
    const y = (index / (horizontalLines + 1)) * height;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  ctx.restore();
}

function drawRoute(
  ctx: CanvasRenderingContext2D,
  points: ProjectedPoint[],
  width: number,
  height: number,
) {
  if (points.length === 0) {
    return;
  }

  const routeGradient = ctx.createLinearGradient(0, 0, width, 0);
  routeGradient.addColorStop(0, '#bef264');
  routeGradient.addColorStop(0.5, '#38bdf8');
  routeGradient.addColorStop(1, '#f97316');

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = routeGradient;
  ctx.lineWidth = Math.max(4, Math.min(width, height) * 0.012);
  ctx.shadowColor = 'rgba(56, 189, 248, 0.4)';
  ctx.shadowBlur = 18;

  ctx.beginPath();
  points.forEach((point, index) => {
    if (index === 0) {
      ctx.moveTo(point.x, point.y);
    } else {
      ctx.lineTo(point.x, point.y);
    }
  });
  ctx.stroke();
  ctx.restore();
}

function drawMarker(
  ctx: CanvasRenderingContext2D,
  point: ProjectedPoint | null,
  color: string,
  radius: number,
) {
  if (!point) {
    return;
  }

  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function RideTrackMap({ points, bounds, className }: RideTrackMapProps) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const containerRef = useCallback((node: HTMLDivElement | null) => {
    setContainer(node);
  }, []);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });

  const sanitizedPoints = useMemo(() => sanitizePoints(points), [points]);
  const sanitizedBounds = useMemo(() => sanitizeBounds(bounds), [bounds]);

  useEffect(() => {
    if (!container) {
      return;
    }

    const updateDimensions = (width: number, height: number) => {
      setDimensions((current) => {
        if (current.width === width && current.height === height) {
          return current;
        }
        return { width, height };
      });
    };

    const { width: initialWidth, height: initialHeight } = container.getBoundingClientRect();
    if (initialWidth > 0 && initialHeight > 0) {
      updateDimensions(initialWidth, initialHeight);
    }

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        updateDimensions(width, height);
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, [container]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const { width, height } = dimensions;
    if (width <= 0 || height <= 0) {
      return;
    }

    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }

    const ratio = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    canvas.width = Math.max(1, Math.floor(width * ratio));
    canvas.height = Math.max(1, Math.floor(height * ratio));
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);

    drawBackground(context, width, height);

    if (sanitizedPoints.length === 0) {
      return;
    }

    const projected = computeProjectedPoints(sanitizedPoints, sanitizedBounds, width, height);
    if (projected.length === 0) {
      return;
    }

    drawRoute(context, projected, width, height);

    const start = projected[0] ?? null;
    const finish = projected[projected.length - 1] ?? null;
    const markerRadius = Math.max(6, Math.min(width, height) * 0.02);

    drawMarker(context, start, '#f97316', markerRadius);
    drawMarker(context, finish, '#38bdf8', markerRadius);
  }, [sanitizedPoints, sanitizedBounds, dimensions]);

  if (sanitizedPoints.length === 0) {
    return (
      <div
        ref={containerRef}
        className={cn(
          'flex h-full w-full items-center justify-center rounded-xl bg-slate-900 text-sm text-slate-200',
          className,
        )}
      >
        No valid GPS samples were found for this ride.
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn('relative h-full w-full overflow-hidden rounded-xl bg-slate-900', className)}
    >
      <canvas ref={canvasRef} className="h-full w-full" />
    </div>
  );
}
