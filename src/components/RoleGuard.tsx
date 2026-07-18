import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useIsDriver, useCanCreateTrips, useIsAdmin } from '@/hooks/use-user-role';
import { Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

interface RoleGuardProps {
  children: React.ReactNode;
  requireDriver?: boolean;
  requireCanCreateTrips?: boolean;
  requireAdmin?: boolean;
  fallback?: React.ReactNode;
  showMessage?: boolean;
}

/**
 * Componente guard para proteger rutas basado en roles
 */
export const RoleGuard: React.FC<RoleGuardProps> = ({
  children,
  requireDriver = false,
  requireCanCreateTrips = false,
  requireAdmin = false,
  fallback,
  showMessage = true,
}) => {
  const { user, isLoading } = useAuth();
  const isDriver = useIsDriver();
  const { canCreate: canCreateTrips, isLoading: isLoadingVehicles, reason } = useCanCreateTrips();
  const isAdmin = useIsAdmin();
  const navigate = useNavigate();

  // Esperar a que el usuario esté completamente cargado
  if (isLoading || !user || (requireCanCreateTrips && isLoadingVehicles)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Verificar permisos
  if (requireAdmin && !isAdmin) {
    if (fallback) return <>{fallback}</>;
    if (showMessage) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background px-4">
          <div className="max-w-md w-full text-center space-y-4">
            <AlertCircle className="w-16 h-16 text-destructive mx-auto" />
            <h2 className="text-2xl font-bold text-foreground">Acceso denegado</h2>
            <p className="text-muted-foreground">
              Esta sección es solo para administradores.
            </p>
            <Button onClick={() => navigate('/search')}>Volver al inicio</Button>
          </div>
        </div>
      );
    }
    return null;
  }

  if (requireCanCreateTrips && !canCreateTrips) {
    if (fallback) return <>{fallback}</>;
    if (showMessage) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background px-4">
          <div className="max-w-md w-full text-center space-y-4">
            <AlertCircle className="w-16 h-16 text-amber-500 mx-auto" />
            <h2 className="text-2xl font-bold text-foreground">No puedes crear viajes</h2>
            <p className="text-muted-foreground">
              {reason || 'Debes ser conductor con vehículo verificado para publicar viajes.'}
            </p>
            <div className="flex gap-2 justify-center">
              <Button variant="outline" onClick={() => navigate('/profile')}>
                Ir a mi perfil
              </Button>
              <Button onClick={() => navigate('/search')}>Buscar viajes</Button>
            </div>
          </div>
        </div>
      );
    }
    return null;
  }

  if (requireDriver && !isDriver) {
    if (fallback) return <>{fallback}</>;
    if (showMessage) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background px-4">
          <div className="max-w-md w-full text-center space-y-4">
            <AlertCircle className="w-16 h-16 text-amber-500 mx-auto" />
            <h2 className="text-2xl font-bold text-foreground">Solo para conductores</h2>
            <p className="text-muted-foreground">
              Esta sección es solo para conductores. Registra tu vehículo en tu perfil para convertirte en conductor.
            </p>
            <div className="flex gap-2 justify-center">
              <Button variant="outline" onClick={() => navigate('/profile')}>
                Ir a mi perfil
              </Button>
              <Button onClick={() => navigate('/search')}>Buscar viajes</Button>
            </div>
          </div>
        </div>
      );
    }
    return null;
  }

  return <>{children}</>;
};
