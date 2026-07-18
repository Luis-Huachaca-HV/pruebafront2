/**
 * Utilidades para manejo de autenticación y tokens
 */

const TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';

/**
 * Obtiene el token de acceso desde localStorage
 */
export const getAccessToken = (): string | null => {
  return localStorage.getItem(TOKEN_KEY);
};

/**
 * Obtiene el refresh token desde localStorage
 */
export const getRefreshToken = (): string | null => {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
};

/**
 * Crea headers de autenticación con el token
 */
export const getAuthHeaders = (): HeadersInit => {
  const token = getAccessToken();

  return {
    'Content-Type': 'application/json',
    // Bypass Ngrok browser warning page for API calls from mobile apps
    'ngrok-skip-browser-warning': '1',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
  };
};

/**
 * Verifica si el usuario está autenticado
 */
export const isAuthenticated = (): boolean => {
  return !!getAccessToken();
};
