import React from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Star, User as UserIcon, Car, Users } from 'lucide-react';
import { User } from '@/types';
import { cn } from '@/lib/utils';

interface UserProfilePopupProps {
  /** Datos del usuario a mostrar */
  user: User | null;
  /** Si el popup está visible o no */
  open?: boolean;
  /** Callback cuando cambia el estado de visibilidad */
  onOpenChange?: (open: boolean) => void;
  /** Elemento que activa el popup (trigger) */
  trigger: React.ReactNode;
  /** Posición del popup */
  side?: 'top' | 'right' | 'bottom' | 'left';
  /** Alineación del popup */
  align?: 'start' | 'center' | 'end';
  /** Clase CSS adicional para el contenido */
  className?: string;
  /** Callback opcional cuando se hace click en "Ver perfil completo" */
  onViewProfile?: () => void;
  /** Mostrar botón para ver perfil completo */
  showViewProfileButton?: boolean;
  /** Etiqueta de estado opcional (ej: "Consulta previa") */
  statusLabel?: string;
}

/**
 * Componente reutilizable que muestra un popup con información del usuario:
 * - Nombre del usuario
 * - Imagen de perfil ampliada
 * - Score/rating del usuario
 * - Viajes como conductor (si aplica)
 * - Viajes como pasajero
 * 
 * Puede ser configurado para mostrar/ocultar y reutilizado en diferentes partes de la aplicación.
 */
export const UserProfilePopup: React.FC<UserProfilePopupProps> = ({
  user,
  open,
  onOpenChange,
  trigger,
  side = 'top',
  align = 'center',
  className,
  onViewProfile,
  showViewProfileButton = false,
  statusLabel,
}) => {
  if (!user) {
    return <>{trigger}</>;
  }

  const getInitials = (name: string): string => {
    return name
      .split(' ')
      .map((n) => n[0] || '')
      .join('')
      .toUpperCase()
      .slice(0, 2) || 'U';
  };

  const initials = getInitials(user.full_name);

  const handleViewProfile = () => {
    if (onViewProfile) {
      onViewProfile();
    }
    if (onOpenChange) {
      onOpenChange(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        {trigger}
      </PopoverTrigger>
      <PopoverContent
        side={side}
        align={align}
        className={cn('w-64 p-4', className)}
        sideOffset={8}
      >
        <div className="flex flex-col items-center gap-4">
          {/* Avatar ampliado */}
          <Avatar className="w-24 h-24 shadow-lg border-2 border-primary/20">
            {user.avatar ? (
              <AvatarImage
                src={user.avatar}
                alt={`Foto de ${user.full_name}`}
                onError={(e) => {
                  // Si la imagen falla al cargar, el AvatarFallback se mostrará automáticamente
                  console.warn('Error cargando avatar:', user.avatar);
                }}
              />
            ) : null}
            <AvatarFallback className="bg-primary text-primary-foreground text-2xl font-bold">
              {initials}
            </AvatarFallback>
          </Avatar>

          {/* Nombre del usuario */}
          <div className="text-center">
            <h3 className="text-lg font-bold text-foreground">{user.full_name}</h3>
            {user.description && (
              <p className="text-sm text-muted-foreground mt-2 line-clamp-3">
                {user.description}
              </p>
            )}
            {statusLabel && (
              <p className="text-xs font-medium text-muted-foreground mt-2 bg-muted px-2 py-1 rounded-full inline-block">
                {statusLabel}
              </p>
            )}
          </div>

          {/* Score/Rating */}
          {user.rating != null ? (
            <div className="flex items-center gap-2 px-4 py-2 bg-muted rounded-full">
              <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
              <span className="font-semibold text-foreground">{user.rating.toFixed(1)}</span>
              <span className="text-sm text-muted-foreground">/ 5.0</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-4 py-2 bg-muted rounded-full">
              <Star className="w-5 h-5 text-muted-foreground" />
              <span className="text-sm text-muted-foreground italic">Sin puntuación aún</span>
            </div>
          )}

          {/* Viajes realizados o tomados según el tipo de usuario */}
          <div className="w-full pt-2 border-t">
            {user.is_driver ? (
              // Si es conductor: mostrar solo viajes realizados
              <div className="flex items-center justify-between px-3 py-2 bg-primary/5 rounded-lg">
                <div className="flex items-center gap-2">
                  <Car className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium text-foreground">Viajes realizados</span>
                </div>
                <span className="text-sm font-semibold text-foreground">
                  {user.total_trips_as_driver ?? 0}
                </span>
              </div>
            ) : (
              // Si es usuario: mostrar solo viajes tomados
              <div className="flex items-center justify-between px-3 py-2 bg-muted rounded-lg">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">Viajes tomados</span>
                </div>
                <span className="text-sm font-semibold text-foreground">
                  {user.total_trips_as_passenger ?? 0}
                </span>
              </div>
            )}
          </div>

          {/* Botón para ver perfil completo (opcional) */}
          {showViewProfileButton && onViewProfile && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleViewProfile}
              className="w-full mt-2"
            >
              <UserIcon className="w-4 h-4 mr-2" />
              Ver perfil completo
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};
