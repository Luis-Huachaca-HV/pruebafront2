const BASE_URL = (import.meta.env.VITE_BACKEND_URL as string || '').replace(/\/$/, '');
const API_BASE = `${BASE_URL}/api/v1`;
const RESERVATIONS_URL = `${API_BASE}/reservations`;

// =====================
// TIPOS
// =====================

export interface ReservationResponse {
  id: string;
  trip_id: string;
  passenger_id: string;
  seat_count: number;
  status: 'pending' | 'blocked' | 'confirmed' | 'cancelled';
  expires_at?: string;
  confirmation_code?: string;
  // agreed_price?: number;  // Futuro: precio acordado
  // escrow_amount?: number;  // Futuro: monto en escrow
  created_at: string;
  updated_at?: string;
}

export interface ReservationDetailResponse extends ReservationResponse {
  trip_origin_name?: string;
  trip_destination_name?: string;
  trip_departure_time?: string;
  passenger_name?: string;
  driver_id?: string;
}

export interface ReservationCreate {
  trip_id: string;
  seat_count: number;
}

// =====================
// HELPERS
// =====================

const authHeaders = (token?: string) => ({
  'Content-Type': 'application/json',
  'ngrok-skip-browser-warning': '1',
  ...(token && { Authorization: `Bearer ${token}` }),
});

const handleResponse = async <T>(response: Response): Promise<T> => {
  let result: any;
  try {
    result = await response.json();
  } catch {
    const text = await response.text().catch(() => '(no body)');
    const msg = `Error ${response.status}: respuesta no válida del servidor`;
    console.error('[Reservations] Non-JSON response:', response.status, text.slice(0, 200));
    throw new Error(msg);
  }

  if (response.ok) return result as T;

  const errorMsg = result?.detail || result?.error?.message || result?.message || `Error ${response.status}`;
  console.error('[Reservations] API error:', response.status, JSON.stringify(result));
  throw new Error(typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg));
};

// =====================
// REQUESTS
// =====================

// ➕ POST /reservations (auth)
export const createReservation = async (
  data: ReservationCreate,
  token: string
): Promise<ReservationResponse> => {
  const response = await fetch(`${RESERVATIONS_URL}/`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(data),
  });

  return handleResponse<ReservationResponse>(response);
};

// 📄 GET /reservations/{reservation_id}
export const getReservation = async (
  reservationId: string
): Promise<ReservationResponse> => {
  const response = await fetch(`${RESERVATIONS_URL}/${reservationId}`, {
    headers: { 'ngrok-skip-browser-warning': '1' },
  });
  return handleResponse<ReservationResponse>(response);
};

// 📋 GET /reservations/trip/{trip_id}
export const getReservationsByTrip = async (
  tripId: string,
  status?: string
): Promise<ReservationDetailResponse[]> => {
  const query = status ? `?status=${status}` : '';
  const response = await fetch(`${RESERVATIONS_URL}/trip/${tripId}${query}`, {
    headers: { 'ngrok-skip-browser-warning': '1' },
  });
  return handleResponse<ReservationResponse[]>(response);
};

// 📋 GET /reservations/passenger/me (auth)
export const getMyReservations = async (
  token: string,
  status?: string,
  page = 1,
  pageSize = 20
): Promise<ReservationResponse[]> => {
  const queryParams: Record<string, string> = {
    page: String(page),
    page_size: String(pageSize),
  };
  if (status) queryParams.status = status;

  const query = new URLSearchParams(queryParams).toString();
  const response = await fetch(`${RESERVATIONS_URL}/passenger/me?${query}`, {
    headers: authHeaders(token),
  });
  return handleResponse<ReservationResponse[]>(response);
};

// 📋 GET /reservations/driver/pending (auth)
export const getPendingReservations = async (
  token: string,
  page = 1,
  pageSize = 20
): Promise<ReservationDetailResponse[]> => {
  const query = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
  }).toString();

  const response = await fetch(`${RESERVATIONS_URL}/driver/pending?${query}`, {
    headers: authHeaders(token),
  });
  return handleResponse<ReservationDetailResponse[]>(response);
};

// 📊 GET /reservations/driver/stats (auth)
export interface TripReservationStats {
  pending: number;
  confirmed: number;
  cancelled: number;
}

export const getDriverReservationStats = async (
  token: string
): Promise<Record<string, TripReservationStats>> => {
  const response = await fetch(`${RESERVATIONS_URL}/driver/stats`, {
    headers: authHeaders(token),
  });
  return handleResponse<Record<string, TripReservationStats>>(response);
};

// ✅ POST /reservations/{reservation_id}/approve (auth)
export const approveReservation = async (
  reservationId: string,
  token: string
): Promise<ReservationResponse> => {
  const response = await fetch(`${RESERVATIONS_URL}/${reservationId}/approve`, {
    method: 'POST',
    headers: authHeaders(token),
  });
  return handleResponse<ReservationResponse>(response);
};

// ❌ POST /reservations/{reservation_id}/reject (auth)
export const rejectReservation = async (
  reservationId: string,
  token: string
): Promise<ReservationResponse> => {
  const response = await fetch(`${RESERVATIONS_URL}/${reservationId}/reject`, {
    method: 'POST',
    headers: authHeaders(token),
  });
  return handleResponse<ReservationResponse>(response);
};

// 🗑️ POST /reservations/{reservation_id}/cancel (auth)
export const cancelReservation = async (
  reservationId: string,
  token: string
): Promise<ReservationResponse> => {
  const response = await fetch(`${RESERVATIONS_URL}/${reservationId}/cancel`, {
    method: 'POST',
    headers: authHeaders(token),
  });
  return handleResponse<ReservationResponse>(response);
};
