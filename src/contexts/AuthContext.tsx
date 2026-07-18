import React, { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { login as mockLogin, register as mockRegister } from '@/services/auth';
import type { User, Vehicle } from '@/types';

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
const SESSION_KEY = 'covo-demo-user';
const TOKEN = 'covo-demo-session';

const toUser = (raw: any): User => ({
  id: raw.id, full_name: raw.full_name || 'Usuario demo', email: raw.email,
  phone_number: raw.phone_number, avatar: raw.avatar_url, description: raw.description,
  rating: raw.reputation_score ?? raw.rating ?? 4.8, tripsCompleted: raw.total_trips_as_driver || raw.total_trips_as_passenger || 0,
  is_driver: Boolean(raw.is_driver), user_role: raw.user_role || 'user', status: raw.status || 'active',
  has_verified_vehicle: Boolean(raw.is_driver),
});

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(SESSION_KEY);
      if (stored) setUser(JSON.parse(stored));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const save = useCallback((next: User) => {
    setUser(next);
    localStorage.setItem(SESSION_KEY, JSON.stringify(next));
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const response = await mockLogin({ email, password });
      save(toUser(response.user));
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error?.message || 'No se pudo iniciar la sesión demo.' };
    }
  };

  const register = async (name: string, email: string, password: string) => {
    try {
      await mockRegister({ full_name: name, email, password });
      return login(email, password);
    } catch (error: any) {
      return { success: false, error: error?.message || 'No se pudo crear la cuenta demo.' };
    }
  };

  const logout = async () => { localStorage.removeItem(SESSION_KEY); setUser(null); };
  const loginWithGoogleToken = async () => login('pasajero@demo.local', 'demo');
  const updateVehicle = (vehicle: Vehicle) => user && save({ ...user, vehicle });
  const updateUser = (data: Partial<User>) => user && save({ ...user, ...data });

  return <AuthContext.Provider value={{
    user, isAuthenticated: Boolean(user), isLoading, isGoogleUser: false,
    accessToken: user ? TOKEN : null, unreadConversationsCount: 1,
    login, loginWithGoogleToken, register, logout, updateVehicle, updateUser,
  }}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
