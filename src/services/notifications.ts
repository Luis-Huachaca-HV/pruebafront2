/**
 * Servicio para notificaciones desde la base de datos.
 */
const BASE_URL = (import.meta.env.VITE_BACKEND_URL as string || '').replace(/\/$/, '');
const API_BASE = `${BASE_URL}/api/v1`;

const authHeaders = (token?: string) => ({
  'Content-Type': 'application/json',
  'ngrok-skip-browser-warning': '1',
  ...(token && { Authorization: `Bearer ${token}` }),
});

const handleResponse = async <T>(response: Response): Promise<T> => {
  const result = await response.json();
  if (response.ok) return result as T;
  throw new Error(result?.message || 'Error en la petición');
};

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  payload: any;
  sent_at: string;
}

export interface NotificationsResponse {
  notifications: Notification[];
  total: number;
}

export interface UnreadCountResponse {
  count: number;
}

/**
 * Obtiene notificaciones del usuario desde BD.
 */
export const getNotifications = async (
  token: string,
  limit = 50,
  offset = 0
): Promise<NotificationsResponse> => {
  const response = await fetch(
    `${API_BASE}/notifications?limit=${limit}&offset=${offset}`,
    {
      headers: authHeaders(token),
    }
  );
  return handleResponse<NotificationsResponse>(response);
};

/**
 * Obtiene el contador de notificaciones no leídas.
 */
export const getUnreadNotificationsCount = async (
  token: string
): Promise<number> => {
  const response = await fetch(
    `${API_BASE}/notifications/unread-count`,
    {
      headers: authHeaders(token),
    }
  );
  const result = await handleResponse<UnreadCountResponse>(response);
  return result.count;
};

/**
 * Marca una notificación como leída.
 */
export const markNotificationAsRead = async (
  notificationId: string,
  token: string
): Promise<void> => {
  const response = await fetch(
    `${API_BASE}/notifications/${notificationId}/read`,
    {
      method: 'POST',
      headers: authHeaders(token),
    }
  );
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error?.message || 'Error al marcar notificación como leída');
  }
};

/**
 * Marca todas las notificaciones como leídas.
 */
export const markAllNotificationsAsRead = async (
  token: string
): Promise<number> => {
  const response = await fetch(
    `${API_BASE}/notifications/read-all`,
    {
      method: 'POST',
      headers: authHeaders(token),
    }
  );
  const result = await handleResponse<{ marked_count: number }>(response);
  return result.marked_count;
};
