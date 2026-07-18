import { UserRole, UserStatus } from '@/types';

const BASE_URL = (import.meta.env.VITE_BACKEND_URL as string || '').replace(/\/$/, '');
const AUTH_URL = `${BASE_URL}/api/v1/auth`;

// =====================
// TIPOS
// =====================

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  full_name: string;
  phone_number?: string;
}

export interface UserResponse {
  id: string;
  email: string;
  full_name: string;
  phone_number?: string;
  is_driver?: boolean;
  user_role?: UserRole;
  status?: UserStatus;
  avatar_url?: string;
  description?: string;
  reputation_score?: number;
}

export interface UserRegistrationResponse {
  id: string;
  email: string;
  full_name: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: 'bearer';
  refresh_token?: string;
  user: UserResponse;
}


// =====================
// HELPERS
// =====================

const authHeaders = () => ({
  'Content-Type': 'application/json',
});

const handleResponse = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    let errorMessage = 'Error de autenticación';

    try {
      const result = await response.json();
      // El backend devuelve errores en formato: { success: false, error: { message: "...", code: 409, details: {} } }
      // También puede venir en formato FastAPI estándar: { detail: "..." }
      errorMessage = result?.error?.message || result?.detail || result?.message || errorMessage;

      // Si no hay mensaje específico, crear uno basado en el código de estado
      if (errorMessage === 'Error de autenticación') {
        switch (response.status) {
          case 409:
            errorMessage = 'Este correo electrónico ya está registrado';
            break;
          case 422:
            errorMessage = 'Error de validación. Verifica los datos ingresados';
            break;
          case 401:
            errorMessage = 'No autorizado';
            break;
          case 500:
            errorMessage = 'Error interno del servidor. Por favor intenta más tarde';
            break;
          default:
            errorMessage = `Error ${response.status}: ${response.statusText}`;
        }
      }
    } catch {
      // Si no se puede parsear el JSON, usar mensaje por defecto
      errorMessage = `Error ${response.status}: ${response.statusText}`;
    }

    throw new Error(errorMessage);
  }

  return await response.json() as T;
};


// =====================
// REQUESTS
// =====================

// 🔍 GET /auth/check-email/{email}
export const checkEmail = async (
  email: string
): Promise<{ exists: boolean }> => {
  const response = await fetch(`${AUTH_URL}/check-email/${encodeURIComponent(email)}`, {
    method: 'GET',
    headers: authHeaders(),
  });

  return handleResponse<{ exists: boolean }>(response);
};

// 🔍 GET /auth/check-name/{name}
export const checkName = async (
  name: string
): Promise<{ exists: boolean }> => {
  const response = await fetch(`${AUTH_URL}/check-name/${encodeURIComponent(name)}`, {
    method: 'GET',
    headers: authHeaders(),
  });

  return handleResponse<{ exists: boolean }>(response);
};

// 📝 POST /auth/register
export const register = async (
  data: RegisterRequest
): Promise<UserRegistrationResponse> => {
  const response = await fetch(`${AUTH_URL}/register`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(data),
  });

  return handleResponse<UserRegistrationResponse>(response);
};


// 🔗 Google OAuth — redirige al backend que redirige a Google
export const loginWithGoogle = (): void => {
  window.location.href = `${BASE_URL}/api/v1/auth/google/login`;
};


// 🔐 POST /auth/login
export const login = async (
  data: LoginRequest
): Promise<AuthResponse> => {
  try {
    const response = await fetch(`${AUTH_URL}/login`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(data),
    });

    return await handleResponse<AuthResponse>(response);
  } catch (error: any) {
    console.error('[AuthService] Detailed Login error:', error);
    // Re-throw to be caught by context/hook
    throw error;
  }
};
