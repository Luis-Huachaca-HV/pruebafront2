import { useAuth } from '@/contexts/AuthContext';
import { useMemo } from 'react';
import { getMyVehicles } from '@/services/vehicles';
import { useState, useEffect } from 'react';

/**
 * Hook para verificar si el usuario actual es conductor
 */
export const useIsDriver = (): boolean => {
  const { user } = useAuth();
  return useMemo(() => user?.is_driver === true, [user?.is_driver]);
};

/**
 * Hook para obtener el rol del usuario
 */
export const useUserRole = () => {
  const { user } = useAuth();
  return useMemo(() => user?.user_role || 'user', [user?.user_role]);
};

/**
 * Hook para verificar si el usuario puede crear viajes
 * Requiere: ser conductor Y tener al menos un vehículo verificado
 */
export const useCanCreateTrips = (): { canCreate: boolean; isLoading: boolean; reason?: string } => {
  const { user, accessToken } = useAuth();
  const [hasVerifiedVehicle, setHasVerifiedVehicle] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState(true);

  const isDriver = user?.is_driver === true;

  useEffect(() => {
    const checkVehicles = async () => {
      if (!isDriver || !accessToken) {
        setHasVerifiedVehicle(false);
        setIsLoading(false);
        return;
      }

      try {
        const vehicles = await getMyVehicles(accessToken);
        const hasVerified = vehicles.some(v => v.verification_status === 'verified');
        setHasVerifiedVehicle(hasVerified);
      } catch (error) {
        console.error('Error verificando vehículos:', error);
        setHasVerifiedVehicle(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkVehicles();
  }, [isDriver, accessToken]);

  const canCreate = isDriver && hasVerifiedVehicle;
  let reason: string | undefined;

  if (!isDriver) {
    reason = 'Debes ser conductor para publicar viajes. Registra tu vehículo en tu perfil.';
  } else if (!hasVerifiedVehicle && !isLoading) {
    reason = 'Tu vehículo debe estar verificado para publicar viajes. Espera la aprobación del administrador.';
  }

  return { canCreate, isLoading, reason };
};

/**
 * Hook para verificar si el usuario es admin
 */
export const useIsAdmin = (): boolean => {
  const { user } = useAuth();
  return useMemo(() => user?.user_role === 'admin', [user?.user_role]);
};
