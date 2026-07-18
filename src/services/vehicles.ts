const BASE_URL = (import.meta.env.VITE_BACKEND_URL as string || '').replace(/\/$/, '');
const API_BASE = `${BASE_URL}/api/v1`;
const VEHICLES_URL = `${API_BASE}/vehicles`;

// =====================
// TIPOS
// =====================

export interface VehicleResponse {
  id: string;
  driver_id: string;
  brand: string;
  model: string;
  year: number;
  plate: string;
  color?: string;
  seat_capacity: number;
  vehicle_type?: string;
  verification_status: 'pending' | 'verified' | 'rejected';
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

export interface VehicleCreate {
  brand: string;
  model: string;
  year: number;
  plate: string;
  seat_capacity: number;
  color?: string;
  vehicle_type?: string;
}

export interface VehicleUpdate {
  brand?: string;
  model?: string;
  year?: number;
  plate?: string;
  seat_capacity?: number;
  color?: string;
  vehicle_type?: string;
  is_active?: boolean;
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

  throw new Error(result?.message || 'Error en la petición');
};


// =====================
// REQUESTS
// =====================

// 🚗 GET /vehicles/my (auth)
export const getMyVehicles = async (
  token: string
): Promise<VehicleResponse[]> => {
  const response = await fetch(`${VEHICLES_URL}/my`, {
    headers: authHeaders(token),
  });

  return handleResponse<VehicleResponse[]>(response);
};


// 🚙 GET /vehicles/{vehicle_id}
export const getVehicleById = async (
  vehicleId: string
): Promise<VehicleResponse> => {
  const response = await fetch(`${VEHICLES_URL}/${vehicleId}`);
  return handleResponse<VehicleResponse>(response);
};


// ➕ POST /vehicles (auth)
export const createVehicle = async (
  data: VehicleCreate,
  token: string
): Promise<VehicleResponse> => {
  const response = await fetch(`${VEHICLES_URL}/`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(data),
  });

  return handleResponse<VehicleResponse>(response);
};


// ✏️ PATCH /vehicles/{vehicle_id} (auth)
export const updateVehicle = async (
  vehicleId: string,
  data: VehicleUpdate,
  token: string
): Promise<VehicleResponse> => {
  const response = await fetch(`${VEHICLES_URL}/${vehicleId}`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify(data),
  });

  return handleResponse<VehicleResponse>(response);
};


// 👨‍✈️ GET /vehicles/driver/{driver_id}
export const getDriverVehicles = async (
  driverId: string,
  page = 1,
  pageSize = 20
): Promise<VehicleResponse[]> => {
  const response = await fetch(
    `${VEHICLES_URL}/driver/${driverId}?page=${page}&page_size=${pageSize}`
  );

  return handleResponse<VehicleResponse[]>(response);
};
