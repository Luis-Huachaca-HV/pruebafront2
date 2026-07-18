import { useEffect, useState } from 'react';
export interface Coordinates { longitude: number; latitude: number; }
export interface WalkingRouteData { userLocation: [number, number]; routeGeometry: GeoJSON.LineString; distanceKm: number; durationMin: number; }
export interface UseWalkingRouteResult { data: WalkingRouteData | null; isLoading: boolean; error: string | null; }

export function useWalkingRoute(originCoords: Coordinates | null, _unusedToken?: string): UseWalkingRouteResult {
  const [data, setData] = useState<WalkingRouteData | null>(null);
  useEffect(() => {
    if (!originCoords) return setData(null);
    const start: [number, number] = [originCoords.longitude - 0.01, originCoords.latitude - 0.01];
    setData({ userLocation: start, routeGeometry: { type: 'LineString', coordinates: [start, [originCoords.longitude, originCoords.latitude]] }, distanceKm: 1.5, durationMin: 18 });
  }, [originCoords?.latitude, originCoords?.longitude]);
  return { data, isLoading: false, error: null };
}
