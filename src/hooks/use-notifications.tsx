import { useEffect, useRef, useState } from 'react';

export type NotificationPayload = {
  type: string;
  [key: string]: any;
};

export function useNotificationsSocket(userId: string | null, token: string | null, onNotification: (payload: NotificationPayload) => void) {
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!userId) return;

    const backendUrl = import.meta.env.VITE_BACKEND_URL as string || '';
    const hostFromEnv = backendUrl.replace(/\/$/, '').replace(/^https?:\/\//, '');
    let proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    if (backendUrl.startsWith('https://')) {
      proto = 'wss';
    } else if (backendUrl.startsWith('http://')) {
      proto = 'ws';
    }
    const wsUrl = hostFromEnv ? `${proto}://${hostFromEnv}/api/v1/ws/notifications/${userId}` : `${proto}://${window.location.hostname}:${window.location.port}/api/v1/ws/notifications/${userId}`;

    const maskedToken = token ? `${token.slice(0,6)}...${token.slice(-6)}` : null;
    console.log('[Notifications] Attempting WS connect', { wsUrl: wsUrl + (token ? `?token=${maskedToken}` : ''), userId, tokenProvided: !!token, navigatorOnline: navigator.onLine });

    const connect = () => {
      const finalUrl = wsUrl + (token ? `?token=${encodeURIComponent(token)}` : '');
      console.log('[Notifications] creating WebSocket', finalUrl);
      const ws = new WebSocket(finalUrl);
      // Expose for manual inspection in DevTools
      try {
        // @ts-ignore
        window.__debug_notifications_ws = ws;
      } catch (e) {
        // ignore
      }
      wsRef.current = ws;

      let opened = false;
      ws.onopen = (ev) => {
        opened = true;
        setIsConnected(true);
        reconnectAttemptsRef.current = 0;
        console.log('[Notifications] WS onopen', { readyState: ws.readyState, ev });
      };

      // If onopen not called within 5s, log diagnostics
      const openTimeout = setTimeout(() => {
        if (!opened) {
          console.warn('[Notifications] WS open timeout (5s) - likely handshake failed', { finalUrl, readyState: ws.readyState });
        }
      }, 5000);

      ws.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data);
          console.log('[Notifications] WS onmessage', data);
          onNotification(data);
        } catch (err) {
          console.error('[Notifications] Error parsing message', err, ev.data);
        }
      };

      ws.onerror = (err) => {
        console.error('[Notifications] WS onerror', err);
      };

      ws.onclose = (ev) => {
        clearTimeout(openTimeout);
        setIsConnected(false);
        console.warn('[Notifications] WS onclose', { code: ev.code, reason: ev.reason, wasClean: ev.wasClean, readyState: ws.readyState });

        if (ev.code !== 1000) {
          const attempt = reconnectAttemptsRef.current + 1;
          reconnectAttemptsRef.current = attempt;
          const backoff = Math.min(10000, 1000 * attempt);
          console.log('[Notifications] scheduling reconnect', { attempt, backoff });
          if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
          reconnectTimerRef.current = setTimeout(() => {
            connect();
          }, backoff);
        }
      };

      // Debug: poll readyState during connection attempts for a short period
      let pollCount = 0;
      const pollInterval = setInterval(() => {
        pollCount++;
        console.log('[Notifications] WS readyState poll', { readyState: ws.readyState, pollCount });
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CLOSED || pollCount > 10) {
          clearInterval(pollInterval);
        }
      }, 500);
    };

    try {
      connect();
    } catch (error) {
      console.error('[Notifications] Error creating WebSocket', error);
    }

    return () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close(1000, 'Client disconnect');
        wsRef.current = null;
      }
    };
  }, [userId, token, onNotification]);

  return { isConnected };
}
