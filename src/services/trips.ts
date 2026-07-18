const BASE_URL = (import.meta.env.VITE_BACKEND_URL as string || '').replace(/\/$/, '');
const API_BASE = `${BASE_URL}/api/v1`;
const TRIPS_URL = `${API_BASE}/trips`;

// =====================
// TIPOS
// =====================

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface TripPreferences {
  allow_pets?: boolean;
  allow_smoking?: boolean;
  allow_luggage?: boolean;
  car_features?: string[];
  music_preference?: string;
}

export interface TripStopCreate {
  name: string;
  coordinates: Coordinates;
  stop_order: number;
  price_from_origin?: number;
}

export interface TripResponse {
  id: string;
  driver_id: string;
  vehicle_id: string;
  origin_name: string;
  destination_name: string;
  origin_coordinates: Coordinates;
  destination_coordinates: Coordinates;
  departure_time: string;
  arrival_time?: string;
  total_seats: number;
  available_seats: number;
  price_per_seat: number;
  currency: string;
  booking_mode: 'auto' | 'manual';
  preferences?: TripPreferences;
  description?: string;
  status: 'published' | 'in_progress' | 'completed' | 'cancelled';
  selected_route_id?: string;
  route_distance_km?: number;
  route_duration_min?: number;
  return_trip_id?: string;
  created_at: string;
  updated_at?: string;
  /** Diferencia absoluta en minutos entre la hora del viaje y la hora preferida buscada */
  time_diff_minutes?: number;
  driver_name?: string;
  driver_rating?: number;
  driver_trips_completed?: number;
  driver_avatar_url?: string;
  has_active_reservation?: boolean;
  has_active_conversation?: boolean;
}

export interface UserReservation {
  id: string;
  status: 'pending' | 'confirmed' | 'cancelled';
  seat_count: number;
  created_at: string;
}

export interface TripDetailResponse extends TripResponse {
  stops?: TripStopResponse[];
  driver_name?: string;
  driver_reputation?: number;
  vehicle_brand?: string;
  vehicle_model?: string;
  vehicle_color?: string;
  vehicle_year?: number;
  vehicle_plate?: string;
  vehicle_seat_capacity?: number;
  user_reservations?: UserReservation[];
}

export interface TripStopResponse {
  id: string;
  trip_id: string;
  name: string;
  coordinates: Coordinates;
  stop_order: number;
  estimated_time?: string;
}

export interface TripCreate {
  vehicle_id: string;
  origin_name: string;
  destination_name: string;
  origin_coordinates: Coordinates;
  destination_coordinates: Coordinates;
  departure_time: string;
  arrival_time?: string;
  total_seats: number;
  price_per_seat: number;
  currency?: string;
  booking_mode?: 'auto' | 'manual';
  preferences?: TripPreferences;
  description?: string;
  stops?: TripStopCreate[];
  route_distance_km?: number;
  route_duration_min?: number;
}

export interface TripUpdate {
  origin_name?: string;
  destination_name?: string;
  origin_coordinates?: Coordinates;
  destination_coordinates?: Coordinates;
  departure_time?: string;
  arrival_time?: string;
  total_seats?: number;
  price_per_seat?: number;
  preferences?: TripPreferences;
  description?: string;
}

export interface TripSearchParams {
  origin_lat?: number;
  origin_lng?: number;
  destination_lat?: number;
  destination_lng?: number;
  departure_date?: string;
  min_seats?: number;
  max_price?: number;
  limit?: number;
}

export interface TripListResponse {
  trips: TripResponse[];
  total: number;
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
  const result = await response.json();

  if (response.ok) return result as T;

  if (Array.isArray(result?.detail)) {
    const messages = result.detail.map((err: any) => `${err.loc?.join('.') || 'Campo'}: ${err.msg}`);
    throw new Error(messages.join('\\n'));
  }

  throw new Error(result?.detail || result?.error?.message || result?.message || 'Error en la petición');
};


// =====================
// REQUESTS
// =====================

// 🔍 GET /trips/search
export const searchTrips = async (
  params: TripSearchParams,
  token?: string
): Promise<TripResponse[]> => {
  const queryParams: Record<string, string> = {};

  if (params.origin_lat !== undefined) queryParams.origin_lat = String(params.origin_lat);
  if (params.origin_lng !== undefined) queryParams.origin_lng = String(params.origin_lng);
  if (params.destination_lat !== undefined) queryParams.destination_lat = String(params.destination_lat);
  if (params.destination_lng !== undefined) queryParams.destination_lng = String(params.destination_lng);
  if (params.min_seats !== undefined) queryParams.min_seats = String(params.min_seats);
  if (params.max_price !== undefined) queryParams.max_price = String(params.max_price);
  if (params.limit !== undefined) queryParams.limit = String(params.limit);

  const query = new URLSearchParams(queryParams).toString();
  const response = await fetch(`${TRIPS_URL}/search?${query}`, {
    headers: {
      'ngrok-skip-browser-warning': '1',
      ...(token && { Authorization: `Bearer ${token}` })
    },
  });
  return handleResponse<TripResponse[]>(response);
};


// 📢 GET /trips/published
export interface PublishedTripsParams {
  page?: number;
  pageSize?: number;
  originLat?: number;
  originLng?: number;
  destinationLat?: number;
  destinationLng?: number;
  /** Filtro de texto libre contra origin_name (ILIKE) */
  originName?: string;
  /** Filtro de texto libre contra destination_name (ILIKE) */
  destinationName?: string;
  minSeats?: number;
  maxDistanceKm?: number;
  /** Hora preferida de salida (ISO 8601) */
  departureTime?: string;
  /** Ventana ±minutos alrededor de la hora preferida (5-480) */
  timeTolerance?: number;
}

export const getPublishedTrips = async (
  page = 1,
  pageSize = 50,
  params?: Omit<PublishedTripsParams, 'page' | 'pageSize'>,
  token?: string
): Promise<TripResponse[]> => {
  const queryParams: Record<string, string> = {
    page: String(page),
    page_size: String(pageSize),
  };

  // Parámetros de proximidad de lugar
  if (params?.originLat !== undefined) queryParams.origin_lat = String(params.originLat);
  if (params?.originLng !== undefined) queryParams.origin_lng = String(params.originLng);
  if (params?.destinationLat !== undefined) queryParams.destination_lat = String(params.destinationLat);
  if (params?.destinationLng !== undefined) queryParams.destination_lng = String(params.destinationLng);
  if (params?.originName) queryParams.origin_name = params.originName;
  if (params?.destinationName) queryParams.destination_name = params.destinationName;
  if (params?.minSeats !== undefined) queryParams.min_seats = String(params.minSeats);
  if (params?.maxDistanceKm !== undefined) queryParams.max_distance_km = String(params.maxDistanceKm);

  // Parámetros de proximidad de hora
  if (params?.departureTime) queryParams.departure_time = params.departureTime;
  if (params?.timeTolerance !== undefined) queryParams.time_tolerance_minutes = String(params.timeTolerance);

  const query = new URLSearchParams(queryParams).toString();
  const response = await fetch(`${TRIPS_URL}/published?${query}`, {
    headers: {
      'ngrok-skip-browser-warning': '1',
      ...(token && { Authorization: `Bearer ${token}` })
    },
  });

  return handleResponse<TripResponse[]>(response);
};


// 🚗 GET /trips/my-trips (auth)
export const getMyTrips = async (
  token: string,
  status?: string,
  page = 1,
  pageSize = 20
): Promise<TripResponse[]> => {
  const query = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
    ...(status && { status }),
  });

  const response = await fetch(`${TRIPS_URL}/my-trips?${query}`, {
    headers: authHeaders(token),
  });

  return handleResponse<TripResponse[]>(response);
};


// 📄 GET /trips/{trip_id}
export const getTripById = async (
  tripId: string
): Promise<TripResponse> => {
  const response = await fetch(`${TRIPS_URL}/${tripId}`, {
    headers: { 'ngrok-skip-browser-warning': '1' },
  });
  return handleResponse<TripResponse>(response);
};


// 📄 GET /trips/{trip_id}/details
export const getTripDetails = async (
  tripId: string,
  token?: string
): Promise<TripDetailResponse> => {
  const response = await fetch(`${TRIPS_URL}/${tripId}/details`, {
    headers: authHeaders(token),
  });
  return handleResponse<TripDetailResponse>(response);
};


// ➕ POST /trips (auth)
export const createTrip = async (
  data: TripCreate,
  token: string
): Promise<TripResponse> => {
  // [DEBUG] Log payload enviado al backend
  // console.log('[createTrip] Payload enviado:', JSON.stringify(data, null, 2));

  const response = await fetch(`${TRIPS_URL}`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(data),
  });

  return handleResponse<TripResponse>(response);
};


// ➕ POST /trips/batch (auth)
export const createBatchTrips = async (
  trips: TripCreate[],
  token: string
): Promise<TripResponse[]> => {
  const response = await fetch(`${TRIPS_URL}/batch`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ trips }),
  });

  const result = await handleResponse<{ trips: TripResponse[]; total: number }>(response);
  return result.trips;
};


// ✏️ PATCH /trips/{trip_id} (auth)
export const updateTrip = async (
  tripId: string,
  data: TripUpdate,
  token: string
): Promise<TripResponse> => {
  const response = await fetch(`${TRIPS_URL}/${tripId}`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify(data),
  });

  return handleResponse<TripResponse>(response);
};


// ❌ DELETE /trips/{trip_id} (auth)
export const cancelTrip = async (
  tripId: string,
  token: string
): Promise<TripResponse> => {
  const response = await fetch(`${TRIPS_URL}/${tripId}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });

  return handleResponse<TripResponse>(response);
};


// =====================
// TRIP LIFECYCLE
// =====================

export interface CommissionDetails {
  commission_amount: number;
  new_balance: number;
  confirmed_seats: number;
  trip_revenue: number;
}

export interface TripCompleteResponse {
  trip: TripResponse;
  commission: CommissionDetails;
}

// ▶️ POST /trips/{trip_id}/start (auth)
export const startTrip = async (
  tripId: string,
  token: string
): Promise<TripResponse> => {
  const response = await fetch(`${TRIPS_URL}/${tripId}/start`, {
    method: 'POST',
    headers: authHeaders(token),
  });

  return handleResponse<TripResponse>(response);
};


// 🔍 GET /trips/active (auth)
export const getActiveTrip = async (
  token: string
): Promise<TripResponse | null> => {
  const response = await fetch(`${TRIPS_URL}/active`, {
    headers: authHeaders(token),
  });

  if (response.status === 404) return null;
  return handleResponse<TripResponse>(response);
};


// ✅ POST /trips/{trip_id}/complete (auth)
export const completeTrip = async (
  tripId: string,
  token: string
): Promise<TripCompleteResponse> => {
  const response = await fetch(`${TRIPS_URL}/${tripId}/complete`, {
    method: 'POST',
    headers: authHeaders(token),
  });

  return handleResponse<TripCompleteResponse>(response);
};
