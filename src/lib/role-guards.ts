import { User, UserRole } from '@/types';

/**
 * Verifica si un usuario es conductor
 */
export const isDriver = (user: User | null): boolean => {
  return user?.is_driver === true;
};

/**
 * Verifica si un usuario puede crear viajes
 * Requiere: ser conductor Y tener vehículo verificado
 */
export const canCreateTrips = (user: User | null): boolean => {
  return isDriver(user) && (user?.has_verified_vehicle === true);
};

/**
 * Verifica si un usuario es admin
 */
export const isAdmin = (user: User | null): boolean => {
  return user?.user_role === 'admin';
};

/**
 * Verifica si un usuario tiene un rol específico
 */
export const hasRole = (user: User | null, role: UserRole): boolean => {
  return user?.user_role === role;
};

/**
 * Verifica si un usuario está activo
 */
export const isActive = (user: User | null): boolean => {
  return user?.status === 'active';
};

/**
 * Obtiene un mensaje descriptivo sobre por qué un usuario no puede crear viajes
 */
export const getCannotCreateTripsReason = (user: User | null): string => {
  if (!user) {
    return 'Debes iniciar sesión para publicar viajes.';
  }

  if (!isDriver(user)) {
    return 'Debes ser conductor para publicar viajes. Registra tu vehículo en tu perfil.';
  }

  if (!user.has_verified_vehicle) {
    return 'Tu vehículo debe estar verificado para publicar viajes. Espera la aprobación del administrador.';
  }

  return 'No puedes publicar viajes en este momento.';
};
