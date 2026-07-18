import { useEffect, useRef, useState } from 'react';

export type DriverLiveEvent = {
  type: 'reservation_confirmed';
  trip_id: string;
  available_seats: number;
  seat_count: number;
  passenger_name?: string;
};

// Este proyecto es solo frontend (sin backend real, ver README.md), así que el
// "modo en vivo" del conductor se simula con un bus de eventos local en vez de
// un WebSocket. mocks/services/index.ts dispara 'sumaq:driver-live' cuando se
// confirma una reserva (auto-confirmada o aprobada por el conductor).
export function useDriverLiveMode(
  token: string | null,
  onEvent: (event: DriverLiveEvent) => void,
  onError?: (error: string) => void,
): { isConnected: boolean } {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!token) {
      setIsConnected(false);
      return;
    }

    setIsConnected(true);

    const handler = (ev: Event) => {
      const detail = (ev as CustomEvent<DriverLiveEvent>).detail;
      if (detail?.type === 'reservation_confirmed') {
        onEventRef.current(detail);
      }
    };

    window.addEventListener('sumaq:driver-live', handler as EventListener);
    return () => {
      window.removeEventListener('sumaq:driver-live', handler as EventListener);
      setIsConnected(false);
    };
  }, [token]);

  return { isConnected };
}
