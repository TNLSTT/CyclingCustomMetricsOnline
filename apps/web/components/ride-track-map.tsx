'use client';

import { type MutableRefObject, useEffect, useMemo, useRef, useState } from 'react';

import type { ActivityTrackBounds, ActivityTrackPoint, NumericLike } from '../types/activity';
import { cn } from '../lib/utils';
import { loadLeaflet } from '../lib/load-leaflet';
import { motion } from 'framer-motion';

interface RideTrackMapProps {
  points: ActivityTrackPoint[];
  bounds?: ActivityTrackBounds | null;
  className?: string;
}

type NormalizedPoint = { latitude: number; longitude: number };

type NormalizedBounds = {
  minLatitude: number;
  maxLatitude: number;
  minLongitude: number;
  maxLongitude: number;
};

type LeafletMapInstance = {
  remove: () => void;
  fitBounds: (bounds: LeafletBoundsInstance, options?: Record<string, unknown>) => void;
  setView: (latLng: unknown, zoom: number, options?: Record<string, unknown>) => void;
  invalidateSize: () => void;
};

type LeafletBoundsInstance = {
  pad: (value: number) => LeafletBoundsInstance;
  isValid: () => boolean;
};

type LeafletTileLayerInstance = {
  addTo: (map: LeafletMapInstance) => LeafletTileLayerInstance;
  remove: () => void;
};

type LeafletPolylineInstance = {
  addTo: (map: LeafletMapInstance) => LeafletPolylineInstance;
  setLatLngs: (latLngs: unknown[]) => void;
  getBounds: () => LeafletBoundsInstance;
  remove: () => void;
};

type LeafletCircleMarkerInstance = {
  addTo: (map: LeafletMapInstance) => LeafletCircleMarkerInstance;
  setLatLng: (latLng: unknown) => void;
  setStyle: (options: Record<string, unknown>) => void;
  remove: () => void;
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

export function RideTrackMap({ points, bounds, className }: RideTrackMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMapInstance | null>(null);
  const tileLayerRef = useRef<LeafletTileLayerInstance | null>(null);
  const routeLayerRef = useRef<LeafletPolylineInstance | null>(null);
  const startMarkerRef = useRef<LeafletCircleMarkerInstance | null>(null);
  const finishMarkerRef = useRef<LeafletCircleMarkerInstance | null>(null);
  const [isReady, setIsReady] = useState(false);
  const viewTokenRef = useRef<string | null>(null);

  const sanitizedPoints = useMemo(() => sanitizePoints(points), [points]);
  const sanitizedBounds = useMemo(() => sanitizeBounds(bounds), [bounds]);

  useEffect(() => {
    if (sanitizedPoints.length === 0) {
      if (tileLayerRef.current) {
        tileLayerRef.current.remove();
        tileLayerRef.current = null;
      }
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      routeLayerRef.current = null;
      startMarkerRef.current = null;
      finishMarkerRef.current = null;
      viewTokenRef.current = null;
      return;
    }

    let cancelled = false;
    setIsReady(false);

    const initializeMap = async () => {
      try {
        const L = await loadLeaflet();
        if (cancelled || !containerRef.current) {
          return;
        }

        let map = mapRef.current;
        if (!map) {
          map = L.map(containerRef.current, {
            attributionControl: true,
            zoomControl: true,
            scrollWheelZoom: true,
          });
          mapRef.current = map;

          const tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19,
            detectRetina: true,
          });
          tileLayerRef.current = tileLayer.addTo(map);
        }

        const latLngs = sanitizedPoints.map((point) => L.latLng(point.latitude, point.longitude));
        if (latLngs.length === 0) {
          return;
        }

        if (!routeLayerRef.current) {
          routeLayerRef.current = L.polyline(latLngs, {
            color: '#38bdf8',
            weight: 5,
            opacity: 0.9,
            lineCap: 'round',
            lineJoin: 'round',
          }).addTo(map);
        } else {
          routeLayerRef.current.setLatLngs(latLngs);
        }

        const ensureMarker = (
          markerRef: MutableRefObject<LeafletCircleMarkerInstance | null>,
          latLng: unknown,
          color: string,
        ) => {
          if (!latLng) {
            if (markerRef.current) {
              markerRef.current.remove();
              markerRef.current = null;
            }
            return;
          }

          if (!markerRef.current) {
            markerRef.current = L.circleMarker(latLng, {
              radius: 6,
              color,
              weight: 2,
              opacity: 1,
              fillColor: color,
              fillOpacity: 1,
            }).addTo(map);
          } else {
            markerRef.current.setLatLng(latLng);
            markerRef.current.setStyle({ color, fillColor: color });
          }
        };

        const startLatLng = latLngs[0] ?? null;
        const finishLatLng = latLngs[latLngs.length - 1] ?? null;

        ensureMarker(startMarkerRef, startLatLng, '#f97316');
        ensureMarker(finishMarkerRef, finishLatLng, '#0ea5e9');

        const readCoordinate = (value: unknown, key: 'lat' | 'lng'): number | null => {
          if (!value || typeof value !== 'object') {
            return null;
          }
          const numeric = (value as Record<string, unknown>)[key];
          return typeof numeric === 'number' && Number.isFinite(numeric) ? numeric : null;
        };

        const startKeyLat = readCoordinate(startLatLng, 'lat');
        const startKeyLng = readCoordinate(startLatLng, 'lng');
        const finishKeyLat = readCoordinate(finishLatLng, 'lat');
        const finishKeyLng = readCoordinate(finishLatLng, 'lng');

        const boundsKey = `${startKeyLat ?? ''},${startKeyLng ?? ''}|${finishKeyLat ?? ''},${finishKeyLng ?? ''}|${
          sanitizedBounds
            ? `${sanitizedBounds.minLatitude},${sanitizedBounds.minLongitude},${sanitizedBounds.maxLatitude},${sanitizedBounds.maxLongitude}`
            : 'no-bounds'
        }`;

        if (viewTokenRef.current !== boundsKey) {
          let mapBounds: LeafletBoundsInstance | null = null;
          if (sanitizedBounds) {
            mapBounds = L.latLngBounds(
              [sanitizedBounds.minLatitude, sanitizedBounds.minLongitude],
              [sanitizedBounds.maxLatitude, sanitizedBounds.maxLongitude],
            );
          } else if (routeLayerRef.current) {
            mapBounds = routeLayerRef.current.getBounds();
          }

          if (mapBounds && mapBounds.isValid()) {
            map.fitBounds(mapBounds.pad(0.05), { animate: false });
          } else if (startLatLng) {
            map.setView(startLatLng, 13, { animate: false });
          }

          viewTokenRef.current = boundsKey;
        }

        if (!cancelled) {
          setIsReady(true);
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to initialize Leaflet map', error);
      }
    };

    initializeMap();

    return () => {
      cancelled = true;
    };
  }, [sanitizedPoints, sanitizedBounds]);

  useEffect(() => {
    const map = mapRef.current;
    const element = containerRef.current;
    if (!map || !element) {
      return;
    }

    map.invalidateSize();

    const observer = new ResizeObserver(() => {
      map.invalidateSize();
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, [sanitizedPoints.length]);

  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
      }
      if (tileLayerRef.current) {
        tileLayerRef.current.remove();
      }
      mapRef.current = null;
      tileLayerRef.current = null;
      routeLayerRef.current = null;
      startMarkerRef.current = null;
      finishMarkerRef.current = null;
      viewTokenRef.current = null;
    };
  }, []);

  const containerAnimation = useMemo(
    () => (isReady ? { opacity: 1, transform: 'scale(1)' } : { opacity: 0.65, transform: 'scale(0.97)' }),
    [isReady],
  );

  if (sanitizedPoints.length === 0) {
    return (
      <div
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
    <motion.div
      ref={containerRef}
      className={cn('relative h-full w-full overflow-hidden rounded-xl bg-slate-900', className)}
      initial={{ opacity: 0, transform: 'scale(0.95)' }}
      animate={containerAnimation}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
    />
  );
}
