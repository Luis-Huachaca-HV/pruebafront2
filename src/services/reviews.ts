const BASE_URL = (import.meta.env.VITE_BACKEND_URL as string || '').replace(/\/$/, '');
const API_BASE = `${BASE_URL}/api/v1`;
const REVIEWS_URL = `${API_BASE}/reviews`;

export interface PendingTripReview {
  reservation_id: string;
  trip_id: string;
  driver_id: string;
  driver_name?: string;
  driver_avatar_url?: string;
  origin_name: string;
  destination_name: string;
  departure_time: string;
  started_at?: string;
  route_duration_min?: number;
}

export interface ReviewCreatePayload {
  score: number;
  comment?: string;
}

const authHeaders = (token?: string) => ({
  'Content-Type': 'application/json',
  'ngrok-skip-browser-warning': '1',
  ...(token && { Authorization: `Bearer ${token}` }),
});

const handleResponse = async <T>(response: Response): Promise<T> => {
  const result = await response.json();

  if (response.ok) return result as T;

  throw new Error(result?.detail || result?.error?.message || result?.message || 'Error en la petición');
};

export const getPendingTripReviews = async (token: string): Promise<PendingTripReview[]> => {
  const response = await fetch(`${REVIEWS_URL}/pending`, {
    headers: authHeaders(token),
  });
  return handleResponse<PendingTripReview[]>(response);
};

export const createTripReview = async (
  reservationId: string,
  payload: ReviewCreatePayload,
  token: string
): Promise<{ id: string }> => {
  const response = await fetch(`${REVIEWS_URL}/reservations/${reservationId}`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
  return handleResponse<{ id: string }>(response);
};
