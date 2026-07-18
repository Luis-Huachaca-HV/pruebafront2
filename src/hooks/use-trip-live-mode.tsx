import { useEffect, useRef, useState, useCallback } from 'react';
import { TripResponse } from '@/services/trips';

export type LiveSearchFilters = {
  originLat?: number;
  originLng?: number;
  destinationLat?: number;
  destinationLng?: number;
  minSeats?: number;
  maxDistanceKm?: number;
  departureTime?: string;
  timeTolerance?: number;
};

export type TripLiveEvent =
  | { type: 'trip_new'; trip: TripResponse }
  | { type: 'trip_seats_updated'; trip: { id: string; available_seats: number } }
  | { type: 'trip_cancelled'; trip: { id: string } };

const MAX_RECONNECT_ATTEMPTS = 15;
const PING_INTERVAL_MS = 30_000;
const FILTER_DEBOUNCE_MS = 500;

export function useTripLiveMode(
  token: string | null, isLiveMode: boolean, filters: LiveSearchFilters, onEvent: (event: TripLiveEvent) => void, onError?: (error: string) => void,
): { isConnected: boolean } {
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const keepAliveRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const subscriptionIdRef = useRef<string | null>(null);
  const onEventRef = useRef(onEvent);
  const onErrorRef = useRef(onError);
  const filterDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isVisibleRef = useRef(true);
  const pendingFiltersRef = useRef<LiveSearchFilters | null>(null);

  // Keep refs up to date
  onEventRef.current = onEvent;
  onErrorRef.current = onError;

  const clearTimers = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (keepAliveRef.current) {
      clearInterval(keepAliveRef.current);
      keepAliveRef.current = null;
    }
    if (filterDebounceRef.current) {
      clearTimeout(filterDebounceRef.current);
      filterDebounceRef.current = null;
    }
  }, []);

  // Connection effect — depends only on token
  useEffect(() => {
    if (!token) {
      if (wsRef.current) {
        wsRef.current.close(1000, 'Client disconnect');
        wsRef.current = null;
      }
      clearTimers();
      setIsConnected(false);
      subscriptionIdRef.current = null;
      return;
    }

    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const hostFromEnv = (import.meta.env.VITE_BACKEND_URL as string || '')
      .replace(/\/$/, '')
      .replace(/^https?:\/\//, '');

    const buildUrl = () => {
      const params = new URLSearchParams();
      params.set('token', token);
      const base = hostFromEnv
        ? `${proto}://${hostFromEnv}/api/v1/trips/ws/live-search`
        : `${proto}://${window.location.hostname}:${window.location.port}/api/v1/trips/ws/live-search`;
      return `${base}?${params.toString()}`;
    };

    const startKeepAlive = (ws: WebSocket) => {
      if (keepAliveRef.current) clearInterval(keepAliveRef.current);
      keepAliveRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN && isVisibleRef.current) {
          ws.send(JSON.stringify({ type: 'ping' }));
        }
      }, PING_INTERVAL_MS);
    };

    const connect = () => {
      if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
        onErrorRef.current?.('Se alcanzó el máximo de intentos de reconexión');
        return;
      }

      const url = buildUrl();
      // console.log('[LiveSearch] Connecting to', url.replace(token, token.slice(0, 6) + '...'));

      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        reconnectAttemptsRef.current = 0;
        // console.log('[LiveSearch] Connected');
        startKeepAlive(ws);
      };

      ws.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data);
          if (data.type === 'subscribed') {
            subscriptionIdRef.current = data.subscription_id;
            // Send pending filters immediately after subscription
            if (pendingFiltersRef.current) {
              sendFilters(ws, pendingFiltersRef.current);
              pendingFiltersRef.current = null;
            }
          } else if (data.type === 'trip_new' || data.type === 'trip_seats_updated' || data.type === 'trip_cancelled') {
            onEventRef.current(data as TripLiveEvent);
          }
        } catch (err) {
          // console.error('[LiveSearch] Error parsing message', err);
        }
      };

      ws.onerror = () => {
        setIsConnected(false);
      };

      ws.onclose = (ev) => {
        setIsConnected(false);
        subscriptionIdRef.current = null;
        if (keepAliveRef.current) {
          clearInterval(keepAliveRef.current);
          keepAliveRef.current = null;
        }
        // console.warn('[LiveSearch] WS closed', { code: ev.code, reason: ev.reason });

        if (ev.code !== 1000) {
          const attempt = reconnectAttemptsRef.current + 1;
          reconnectAttemptsRef.current = attempt;
          if (attempt >= MAX_RECONNECT_ATTEMPTS) {
            onErrorRef.current?.('Se alcanzó el máximo de intentos de reconexión');
            return;
          }
          const backoff = Math.min(10000, 1000 * attempt);
          // console.log('[LiveSearch] Reconnecting in', backoff, 'ms (attempt', attempt, ')');
          if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
          reconnectTimerRef.current = setTimeout(() => connect(), backoff);
        }
      };
    };

    const sendFilters = (ws: WebSocket, f: LiveSearchFilters) => {
      if (ws.readyState !== WebSocket.OPEN) return;
      ws.send(JSON.stringify({
        type: 'update_filters',
        filters: {
          origin_lat: f.originLat ?? null,
          origin_lng: f.originLng ?? null,
          destination_lat: f.destinationLat ?? null,
          destination_lng: f.destinationLng ?? null,
          min_seats: f.minSeats ?? 1,
          max_distance_km: f.maxDistanceKm ?? 50.0,
          departure_time: f.departureTime ?? null,
          time_tolerance_minutes: f.timeTolerance ?? 60,
        },
      }));
    };

    // Visibility API — pause pings in background, reconnect on foreground
    const handleVisibilityChange = () => {
      const visible = document.visibilityState === 'visible';
      isVisibleRef.current = visible;
      if (visible) {
        // Reconnect if connection was lost while in background
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
          reconnectAttemptsRef.current = 0;
          connect();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    try {
      connect();
    } catch (err) {
      // console.error('[LiveSearch] Error creating WebSocket', err);
    }

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearTimers();
      if (wsRef.current) {
        wsRef.current.close(1000, 'Client disconnect');
        wsRef.current = null;
      }
      subscriptionIdRef.current = null;
      setIsConnected(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Filter update effect — sends update_filters message instead of reconnecting
  const filtersKey = JSON.stringify(filters);
  useEffect(() => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN || !subscriptionIdRef.current) {
      // Store filters for when connection is established
      pendingFiltersRef.current = filters;
      return;
    }

    if (filterDebounceRef.current) clearTimeout(filterDebounceRef.current);
    filterDebounceRef.current = setTimeout(() => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'update_filters',
          filters: {
            origin_lat: filters.originLat ?? null,
            origin_lng: filters.originLng ?? null,
            destination_lat: filters.destinationLat ?? null,
            destination_lng: filters.destinationLng ?? null,
            min_seats: filters.minSeats ?? 1,
            max_distance_km: filters.maxDistanceKm ?? 50.0,
            departure_time: filters.departureTime ?? null,
            time_tolerance_minutes: filters.timeTolerance ?? 60,
          },
        }));
      }
    }, FILTER_DEBOUNCE_MS);

    return () => {
      if (filterDebounceRef.current) {
        clearTimeout(filterDebounceRef.current);
        filterDebounceRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersKey]);

  return { isConnected };
}
