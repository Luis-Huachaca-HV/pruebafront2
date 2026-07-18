import { useEffect, useRef, useState, useCallback } from 'react';

export type DriverLiveEvent = {
  type: 'reservation_confirmed';
  trip_id: string;
  available_seats: number;
  seat_count: number;
  passenger_name?: string;
};

const MAX_RECONNECT_ATTEMPTS = 15;
const PING_INTERVAL_MS = 30_000;

export function useDriverLiveMode(
  token: string | null,
  onEvent: (event: DriverLiveEvent) => void,
  onError?: (error: string) => void,
): { isConnected: boolean } {
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const keepAliveRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onEventRef = useRef(onEvent);
  const onErrorRef = useRef(onError);
  const isVisibleRef = useRef(true);

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
  }, []);

  useEffect(() => {
    if (!token) {
      if (wsRef.current) {
        wsRef.current.close(1000, 'Client disconnect');
        wsRef.current = null;
      }
      clearTimers();
      setIsConnected(false);
      return;
    }

    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const hostFromEnv = ''
      .replace(/\/$/, '')
      .replace(/^https?:\/\//, '');

    const buildUrl = () => {
      const params = new URLSearchParams();
      params.set('token', token);
      const base = hostFromEnv
        ? `${proto}://${hostFromEnv}/api/v1/trips/ws/driver-live`
        : `${proto}://${window.location.hostname}:${window.location.port}/api/v1/trips/ws/driver-live`;
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
      // console.log('[DriverLive] Connecting to', url.replace(token, token.slice(0, 6) + '...'));

      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        reconnectAttemptsRef.current = 0;
        // console.log('[DriverLive] Connected');
        startKeepAlive(ws);
      };

      ws.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data);
          if (data.type === 'reservation_confirmed') {
            onEventRef.current(data as DriverLiveEvent);
          }
        } catch (err) {
          // console.error('[DriverLive] Error parsing message', err);
        }
      };

      ws.onerror = () => {
        setIsConnected(false);
      };

      ws.onclose = (ev) => {
        setIsConnected(false);
        if (keepAliveRef.current) {
          clearInterval(keepAliveRef.current);
          keepAliveRef.current = null;
        }
        // console.warn('[DriverLive] WS closed', { code: ev.code, reason: ev.reason });

        // Code 4002 = session replaced by another tab — do NOT reconnect
        if (ev.code === 4002) {
          onErrorRef.current?.('Sesión reemplazada por otra pestaña');
          return;
        }

        if (ev.code !== 1000) {
          const attempt = reconnectAttemptsRef.current + 1;
          reconnectAttemptsRef.current = attempt;
          if (attempt >= MAX_RECONNECT_ATTEMPTS) {
            onErrorRef.current?.('Se alcanzó el máximo de intentos de reconexión');
            return;
          }
          const backoff = Math.min(10000, 1000 * attempt);
          // console.log('[DriverLive] Reconnecting in', backoff, 'ms (attempt', attempt, ')');
          if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
          reconnectTimerRef.current = setTimeout(() => connect(), backoff);
        }
      };
    };

    // Visibility API
    const handleVisibilityChange = () => {
      const visible = document.visibilityState === 'visible';
      isVisibleRef.current = visible;
      if (visible) {
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
      // console.error('[DriverLive] Error creating WebSocket', err);
    }

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearTimers();
      if (wsRef.current) {
        wsRef.current.close(1000, 'Client disconnect');
        wsRef.current = null;
      }
      setIsConnected(false);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return { isConnected };
}
