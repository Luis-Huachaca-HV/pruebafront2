import { useQuery } from '@tanstack/react-query';
import { getActiveTrip, TripResponse } from '@/services/trips';
import { useAuth } from '@/contexts/AuthContext';

export const activeTripKeys = {
  all: ['activeTrip'] as const,
};

/**
 * Hook para obtener el viaje activo del usuario autenticado.
 * Refresca automáticamente al volver a la ventana y cada 30 segundos de staleTime.
 */
export const useActiveTrip = () => {
  const { accessToken } = useAuth();

  const { data, isLoading, refetch } = useQuery<TripResponse | null>({
    queryKey: activeTripKeys.all,
    queryFn: () => getActiveTrip(accessToken!),
    enabled: !!accessToken,
    staleTime: 30 * 1000, // 30 segundos
    refetchOnWindowFocus: true,
  });

  return {
    activeTrip: data ?? null,
    isLoading,
    refetch,
  };
};
