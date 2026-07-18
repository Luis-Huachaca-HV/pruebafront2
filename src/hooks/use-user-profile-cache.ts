/**
 * Hooks para caché de perfiles de usuario usando React Query.
 * Evita recargar datos cuando se consulta el mismo perfil múltiples veces.
 */
import { useQuery } from '@tanstack/react-query';
import { getUserProfile, UserProfileResponse } from '@/services/users';
import { useAuth } from '@/contexts/AuthContext';
import { User } from '@/types';

// Query keys para React Query
export const userProfileKeys = {
  all: ['userProfiles'] as const,
  profile: (userId: string) => [...userProfileKeys.all, userId] as const,
};

/**
 * Hook para obtener el perfil completo de un usuario con caché.
 * Los datos se mantienen en caché por 5 minutos.
 * 
 * @param userId - ID del usuario cuyo perfil se quiere obtener
 * @param enabled - Si la query debe ejecutarse (por defecto true si hay userId y token)
 */
export const useUserProfile = (userId: string | null, enabled?: boolean) => {
  const { accessToken } = useAuth();

  return useQuery({
    queryKey: userProfileKeys.profile(userId || ''),
    queryFn: () => getUserProfile(userId!),
    enabled: enabled !== undefined ? enabled : (!!accessToken && !!userId),
    staleTime: 5 * 60 * 1000, // 5 minutos - los datos se consideran "frescos"
    gcTime: 10 * 60 * 1000, // 10 minutos - tiempo en caché antes de ser eliminados
    refetchOnWindowFocus: false, // No recargar al cambiar de tab
    refetchOnMount: false, // No recargar al montar si hay datos en caché
  });
};

/**
 * Convierte UserProfileResponse a User para usar en componentes.
 */
export const convertProfileToUser = (
  profile: UserProfileResponse,
  fallbackName?: string,
  fallbackAvatar?: string
): User => {
  // Priorizar avatar_url del perfil completo, luego fallback de la conversación
  const avatar = profile.avatar_url || fallbackAvatar || undefined;

  return {
    id: profile.id,
    full_name: fallbackName || profile.full_name || '',
    email: profile.email || '',
    avatar: avatar,
    description: profile.description,
    rating: profile.avg_rating ?? profile.rating ?? null,
    tripsCompleted: (profile.total_trips_as_driver || 0) + (profile.total_trips_as_passenger || 0),
    is_driver: profile.is_driver || false,
    total_trips_as_driver: profile.total_trips_as_driver,
    total_trips_as_passenger: profile.total_trips_as_passenger,
  };
};
