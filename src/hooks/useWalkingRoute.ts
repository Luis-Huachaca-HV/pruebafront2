import { useState, useEffect } from 'react';

// =====================
// TYPES
// =====================

export interface Coordinates {
  longitude: number;
  latitude: number;
}

export interface WalkingRouteData {
  userLocation: [number, number]; // [lng, lat] — Mapbox format
  routeGeometry: GeoJSON.LineString;
  distanceKm: number;
  durationMin: number;
}

export interface UseWalkingRouteResult {
  data: WalkingRouteData | null;
  isLoading: boolean;
  error: string | null;
}

// =====================
// HAVERSINE (inline — single consumer)
// =====================

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

function haversineDistanceKm(
  point1: { longitude: number; latitude: number },
  point2: { longitude: number; latitude: number },
): number {
  const R = 6371; // Earth radius in km
  const dLat = toRad(point2.latitude - point1.latitude);
  const dLon = toRad(point2.longitude - point1.longitude);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(point1.latitude)) *
      Math.cos(toRad(point2.latitude)) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// =====================
// HOOK
// =====================

const DISTANCE_THRESHOLD_KM = 5;

export function useWalkingRoute(
  originCoords: Coordinates | null,
  mapboxToken: string,
): UseWalkingRouteResult {
  const [data, setData] = useState<WalkingRouteData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Guard: no origin coords — skip entirely
    if (!originCoords) return;

    // Guard: geolocation API not available
    if (!navigator.geolocation) return;

    let cancelled = false;
    setIsLoading(true);
    setError(null);
    setData(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        if (cancelled) return;

        const userPos = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };

        // Haversine pre-check
        const distance = haversineDistanceKm(userPos, originCoords);
        if (distance > DISTANCE_THRESHOLD_KM) {
          setIsLoading(false);
          return;
        }

        // Fetch walking directions from Mapbox
        try {
          const url =
            `https://api.mapbox.com/directions/v5/mapbox/walking/` +
            `${userPos.longitude},${userPos.latitude};${originCoords.longitude},${originCoords.latitude}` +
            `?geometries=geojson&overview=full&access_token=${mapboxToken}`;

          const response = await fetch(url);
          if (cancelled) return;

          if (!response.ok) {
            setError('Directions API request failed');
            setIsLoading(false);
            return;
          }

          const json = await response.json();
          if (cancelled) return;

          if (!json.routes || json.routes.length === 0) {
            setError('No walking routes found');
            setIsLoading(false);
            return;
          }

          const route = json.routes[0];

          setData({
            userLocation: [userPos.longitude, userPos.latitude],
            routeGeometry: route.geometry as GeoJSON.LineString,
            distanceKm: route.distance / 1000,
            durationMin: Math.round(route.duration / 60),
          });
        } catch (err) {
          if (cancelled) return;
          setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
          if (!cancelled) {
            setIsLoading(false);
          }
        }
      },
      () => {
        // Geolocation denied / error — silent degradation
        if (!cancelled) {
          setIsLoading(false);
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      },
    );

    return () => {
      cancelled = true;
    };
  }, [originCoords?.latitude, originCoords?.longitude, mapboxToken]);

  return { data, isLoading, error };
}
