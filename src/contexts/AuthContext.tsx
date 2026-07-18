import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { login as backendLogin, register as backendRegister } from '@/services/auth';
import { getCurrentUserProfile } from '@/services/users';
import { User, Vehicle } from '@/types';
import { useNotificationsSocket } from '@/hooks/use-notifications';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isGoogleUser: boolean;
  accessToken: string | null;
  unreadConversationsCount: number;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  loginWithGoogleToken: (token: string) => Promise<{ success: boolean; error?: string }>;
  register: (name: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  updateVehicle: (vehicle: Vehicle) => void;
  updateUser: (data: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Keys para localStorage
const TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';
const USER_KEY = 'user_data';

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [unreadConversationsCount, setUnreadConversationsCount] = useState(0);
  const logoutTimerRef = useRef<number | null>(null);

  const getTokenExpiry = (token: string): number | null => {
    try {
      const payload = token.split('.')[1];
      if (!payload) return null;
      const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
      return typeof decoded.exp === 'number' ? decoded.exp * 1000 : null;
    } catch (error) {
      console.error('Error decoding token:', error);
      return null;
    }
  };

  const clearLogoutTimer = () => {
    if (logoutTimerRef.current) {
      window.clearTimeout(logoutTimerRef.current);
      logoutTimerRef.current = null;
    }
  };

  const performLogout = useCallback(() => {
    clearLogoutTimer();
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setUser(null);
    setAccessToken(null);
  }, []);

  const logoutAndRedirect = useCallback(() => {
    performLogout();
    window.location.assign('/login');
  }, [performLogout]);

  const scheduleAutoLogout = useCallback((token: string) => {
    clearLogoutTimer();
    const expiry = getTokenExpiry(token);
    if (!expiry) return;
    const delay = expiry - Date.now();
    if (delay <= 0) {
      logoutAndRedirect();
      return;
    }
    logoutTimerRef.current = window.setTimeout(() => {
      logoutAndRedirect();
    }, delay);
  }, [logoutAndRedirect]);

  useEffect(() => {
    // Cargar sesión desde localStorage al iniciar
    const loadSession = async () => {
      try {
        const token = localStorage.getItem(TOKEN_KEY);
        const userData = localStorage.getItem(USER_KEY);

        if (token && userData) {
          const expiry = getTokenExpiry(token);
          if (expiry && expiry <= Date.now()) {
            performLogout();
            return;
          }
          const parsedUser = JSON.parse(userData);
          setAccessToken(token);
          setUser(parsedUser);
          scheduleAutoLogout(token);

          // ✅ Verificar vehículos si es conductor (actualizar has_verified_vehicle)
          if (parsedUser.is_driver && token) {
            try {
              const { getMyVehicles } = await import('@/services/vehicles');
              const vehicles = await getMyVehicles(token);
              const hasVerified = vehicles.some(v => v.verification_status === 'verified');
              if (hasVerified !== parsedUser.has_verified_vehicle) {
                setUser({ ...parsedUser, has_verified_vehicle: hasVerified });
                localStorage.setItem(USER_KEY, JSON.stringify({ ...parsedUser, has_verified_vehicle: hasVerified }));
              }
            } catch (error) {
              console.warn('Error verificando vehículos al cargar sesión:', error);
            }
          }

          // ✅ Cargar notificaciones desde BD al iniciar sesión
          try {
            const { getUnreadNotificationsCount } = await import('@/services/notifications');
            const unreadCount = await getUnreadNotificationsCount(token);
            setUnreadConversationsCount(unreadCount);
            console.log('[AuthContext] Notificaciones cargadas desde BD:', unreadCount);
          } catch (notifError) {
            console.warn('Error cargando notificaciones desde BD:', notifError);
            // Continuar aunque falle la carga de notificaciones
          }

          // ✅ Actualizar cache del perfil en segundo plano
          try {
            const { getCurrentUserProfile } = await import('@/services/users');
            const profile = await getCurrentUserProfile();
            
            const updatedUser = {
              ...parsedUser,
              full_name: profile.full_name || parsedUser.full_name,
              email: profile.email || parsedUser.email,
              phone_number: profile.phone_number || parsedUser.phone_number,
              description: profile.description || parsedUser.description,
              avatar: profile.avatar_url || parsedUser.avatar,
              rating: profile.avg_rating ?? profile.rating ?? null,
              tripsCompleted: (profile.total_trips_as_driver || 0) + (profile.total_trips_as_passenger || 0)
            };
            
            setUser(updatedUser);
            localStorage.setItem(USER_KEY, JSON.stringify(updatedUser));
          } catch (profileError) {
            console.warn('Error refrescando el perfil al iniciar:', profileError);
          }
        }
      } catch (error) {
        console.error('Error loading session:', error);
        // Limpiar storage si hay datos corruptos
        performLogout();
      } finally {
        setIsLoading(false);
      }
    };

    loadSession();
  }, [performLogout, scheduleAutoLogout]);

  // Escuchar actualizaciones del contador de conversaciones sin leer
  useEffect(() => {
    const handler = (ev: Event) => {
      // @ts-ignore
      const count = ev?.detail?.count;
      if (typeof count === 'number') {
        setUnreadConversationsCount(count);
      }
    };
    window.addEventListener('app:unread-conversations-count', handler as EventListener);
    return () => {
      window.removeEventListener('app:unread-conversations-count', handler as EventListener);
    };
  }, []);

  // Handler estable para recibir notificaciones
  const handleNotification = useCallback(async (payload: any) => {
    console.log('Notification received:', payload);

    // ✅ Si es un mensaje nuevo, actualizar el contador desde el backend
    if (payload.type === 'new_message' && accessToken) {
      try {
        // Consultar el contador real desde el backend (más confiable)
        const { getUnreadNotificationsCount } = await import('@/services/notifications');
        const newCount = await getUnreadNotificationsCount(accessToken);
        setUnreadConversationsCount(newCount);
        console.log('[AuthContext] Contador actualizado desde backend:', newCount);
      } catch (error) {
        console.warn('[AuthContext] Error actualizando contador desde backend:', error);
        // Fallback: incrementar contador localmente si falla la consulta
        setUnreadConversationsCount(prev => prev + 1);
      }
    }

    // Emitir evento global para que otras partes de la app (p.ej. Messages) reaccionen
    try {
      window.dispatchEvent(new CustomEvent('app:notification', { detail: payload }));
    } catch (e) {
      console.warn('Could not dispatch notification event', e);
    }
  }, [accessToken]);

  // Conectar el socket de notificaciones (hook llamado de forma no condicional)
  const { isConnected: notificationsConnected } = useNotificationsSocket(user?.id || null, accessToken, handleNotification);

  // Opcional: logear estado
  useEffect(() => {
    if (user) {
      console.log('[AuthContext] Notifications socket connected:', notificationsConnected);
      if (!notificationsConnected) {
        console.warn('[AuthContext] ⚠️ WebSocket de notificaciones NO está conectado');
      }
    }
  }, [user, notificationsConnected]);

  // ✅ Actualizar contador periódicamente (cada 30 segundos) para mantenerlo sincronizado
  useEffect(() => {
    if (!accessToken || !user) return;

    const updateCount = async () => {
      try {
        const { getUnreadNotificationsCount } = await import('@/services/notifications');
        const count = await getUnreadNotificationsCount(accessToken);
        setUnreadConversationsCount(count);
        console.log('[AuthContext] Contador actualizado periódicamente:', count);
      } catch (error) {
        console.warn('[AuthContext] Error actualizando contador periódicamente:', error);
      }
    };

    // Actualizar inmediatamente
    updateCount();

    // Actualizar cada 30 segundos
    const interval = setInterval(updateCount, 30000);

    return () => clearInterval(interval);
  }, [accessToken, user]);

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await backendLogin({ email, password });

      // Guardar tokens y datos del usuario
      localStorage.setItem(TOKEN_KEY, response.access_token);
      if (response.refresh_token) {
        localStorage.setItem(REFRESH_TOKEN_KEY, response.refresh_token);
      }

      // Convertir UserResponse del backend a User del frontend
      const userData: User = {
        id: response.user.id,
        full_name: response.user.full_name || '',
        email: response.user.email,
        phone_number: response.user.phone_number,
        avatar: response.user.avatar_url,
        description: response.user.description,
        rating: response.user.reputation_score || null,
        tripsCompleted: 0,
        is_driver: response.user.is_driver || false,
        user_role: response.user.user_role || 'user',
        status: response.user.status || 'active',
        has_verified_vehicle: false, // Se actualizará después si es necesario
      };

      // Verificar si tiene vehículos verificados (solo si es conductor)
      if (userData.is_driver && response.access_token) {
        try {
          const { getMyVehicles } = await import('@/services/vehicles');
          const vehicles = await getMyVehicles(response.access_token);
          userData.has_verified_vehicle = vehicles.some(v => v.verification_status === 'verified');
        } catch (error) {
          console.warn('Error verificando vehículos:', error);
          // Continuar sin bloquear el login
        }
      }

      localStorage.setItem(USER_KEY, JSON.stringify(userData));
      setAccessToken(response.access_token);
      setUser(userData);
      scheduleAutoLogout(response.access_token);

      return { success: true };
    } catch (error: any) {
      console.error('Login error:', error);
      return { success: false, error: error.message || 'Error al iniciar sesión' };
    }
  };

  const register = async (name: string, email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      await backendRegister({
        email,
        password,
        full_name: name,
      });

      // Después del registro exitoso, intentar hacer login automáticamente
      // Agregar un pequeño delay para asegurar que el perfil esté disponible tras el registro
      await new Promise(resolve => setTimeout(resolve, 500));

      const loginResult = await login(email, password);

      if (loginResult.success) {
        return { success: true };
      } else {
        // Mostrar el mensaje de error específico del login
        return { success: false, error: loginResult.error || 'Error al iniciar sesión después del registro' };
      }
    } catch (error: any) {
      console.error('Register error:', error);

      if (error.message?.includes('already registered') || error.message?.includes('already exists')) {
        return { success: false, error: 'Este correo ya está registrado' };
      }

      return { success: false, error: error.message || 'Error en el registro' };
    }
  };

  const logout = async () => {
    performLogout();
  };

  /**
   * Inicia sesión a partir de un JWT emitido por el backend tras Google OAuth.
   * Guarda el token, carga el perfil del usuario y actualiza el estado.
   */
  const loginWithGoogleToken = useCallback(async (token: string): Promise<{ success: boolean; error?: string }> => {
    try {
      localStorage.setItem(TOKEN_KEY, token);
      setAccessToken(token);
      scheduleAutoLogout(token);

      // Cargar perfil del usuario desde el backend
      const profile = await getCurrentUserProfile();

      const userData: User = {
        id: profile.id,
        full_name: profile.full_name || '',
        email: profile.email,
        phone_number: profile.phone_number,
        avatar: profile.avatar_url,
        description: profile.description,
        rating: profile.avg_rating ?? profile.rating ?? null,
        tripsCompleted: (profile.total_trips_as_driver || 0) + (profile.total_trips_as_passenger || 0),
        is_driver: profile.is_driver || false,
        user_role: profile.user_role || 'user',
        status: profile.status || 'active',
        has_verified_vehicle: false,
      };

      localStorage.setItem(USER_KEY, JSON.stringify(userData));
      setUser(userData);

      return { success: true };
    } catch (error: any) {
      console.error('loginWithGoogleToken error:', error);
      // Limpiar token si falla la carga del perfil
      localStorage.removeItem(TOKEN_KEY);
      setAccessToken(null);
      return { success: false, error: error.message || 'Error al completar el inicio de sesión con Google' };
    }
  }, [scheduleAutoLogout]);

  useEffect(() => {
    if (!accessToken) {
      clearLogoutTimer();
      return;
    }
    scheduleAutoLogout(accessToken);
  }, [accessToken, scheduleAutoLogout]);

  const updateVehicle = (vehicle: Vehicle) => {
    if (user) {
      setUser({ ...user, vehicle });
    }
  };

  const updateUser = (data: Partial<User>) => {
    if (user) {
      const updatedUser = { ...user, ...data };
      setUser(updatedUser);
      localStorage.setItem(USER_KEY, JSON.stringify(updatedUser));
    }
  };

  // Detectar si el usuario autenticó vía Google leyendo el payload del JWT
  const isGoogleUser = (() => {
    if (!accessToken) return false;
    try {
      const payload = accessToken.split('.')[1];
      if (!payload) return false;
      const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
      return decoded.auth_provider === 'google';
    } catch {
      return false;
    }
  })();

  return (
    <AuthContext.Provider value={{
      user,
      accessToken,
      isAuthenticated: !!accessToken && !!user,
      isLoading,
      isGoogleUser,
      unreadConversationsCount,
      login,
      loginWithGoogleToken,
      register,
      logout,
      updateVehicle,
      updateUser
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
