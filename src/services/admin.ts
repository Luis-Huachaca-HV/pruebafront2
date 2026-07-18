const BASE_URL = (import.meta.env.VITE_BACKEND_URL as string || '').replace(/\/$/, '');
const API_BASE = `${BASE_URL}/api/v1`;
const ADMIN_URL = `${API_BASE}/admin`;

// =====================
// TIPOS
// =====================

export interface AdminLoginRequest {
  username: string;
  password: string;
}

export interface AdminLoginResponse {
  access_token: string;
  token_type: string;
  admin: {
    username: string;
    role: string;
  };
}

export interface DashboardStats {
  total_users: number;
  total_drivers: number;
  total_vehicles: number;
  pending_vehicles: number;
  verified_vehicles: number;
  rejected_vehicles: number;
}

export interface PendingVehicle {
  id: string;
  driver_id: string;
  driver_name: string;
  driver_email: string;
  brand: string;
  model: string;
  color?: string;
  year: number;
  plate: string;
  seat_capacity: number;
  verification_status: 'pending' | 'verified' | 'rejected';
  created_at: string;
}

export interface Driver {
  id: string;
  full_name: string;
  email: string;
  phone_number?: string;
  is_driver: boolean;
  user_role: string;
  created_at: string;
  vehicle?: {
    id: string;
    brand: string;
    model: string;
    year: number;
    plate: string;
    color?: string;
  };
}

export interface AdminUser {
  id: string;
  full_name: string;
  email: string;
  phone_number?: string;
  is_driver: boolean;
  user_role: string;
  status: string;
  created_at: string;
  updated_at?: string;
}

// =====================
// HELPERS
// =====================

const authHeaders = (token?: string) => ({
  'Content-Type': 'application/json',
  ...(token && { Authorization: `Bearer ${token}` }),
});

const handleResponse = async <T>(response: Response): Promise<T> => {
  const result = await response.json();

  if (response.ok) return result as T;

  throw new Error(result?.detail || result?.error?.message || result?.message || 'Error en la petición');
};

// =====================
// REQUESTS
// =====================

// 🔐 POST /admin/login
export const adminLogin = async (
  data: AdminLoginRequest
): Promise<AdminLoginResponse> => {
  const response = await fetch(`${ADMIN_URL}/login`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(data),
  });

  return handleResponse<AdminLoginResponse>(response);
};

// 📊 GET /admin/dashboard/stats
export const getDashboardStats = async (
  token: string
): Promise<DashboardStats> => {
  const response = await fetch(`${ADMIN_URL}/dashboard/stats`, {
    headers: authHeaders(token),
  });

  return handleResponse<DashboardStats>(response);
};

// 🚗 GET /admin/vehicles/pending
export const getPendingVehicles = async (
  token: string,
  page = 1,
  pageSize = 20
): Promise<PendingVehicle[]> => {
  const response = await fetch(
    `${ADMIN_URL}/vehicles/pending?page=${page}&page_size=${pageSize}`,
    { headers: authHeaders(token) }
  );

  return handleResponse<PendingVehicle[]>(response);
};

// 🚙 GET /admin/vehicles/all
export const getAllVehicles = async (
  token: string,
  status?: string,
  page = 1,
  pageSize = 20
): Promise<PendingVehicle[]> => {
  let url = `${ADMIN_URL}/vehicles/all?page=${page}&page_size=${pageSize}`;
  if (status) url += `&status=${status}`;
  
  const response = await fetch(url, { headers: authHeaders(token) });

  return handleResponse<PendingVehicle[]>(response);
};

// ✅ PATCH /admin/vehicles/{vehicleId}/status
export const updateVehicleStatus = async (
  vehicleId: string,
  status: 'pending' | 'verified' | 'rejected',
  token: string
): Promise<{ message: string; vehicle: any }> => {
  const response = await fetch(`${ADMIN_URL}/vehicles/${vehicleId}/status`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify({ status }),
  });

  return handleResponse<{ message: string; vehicle: any }>(response);
};

// 👨‍✈️ GET /admin/drivers
export const getDrivers = async (
  token: string,
  search?: string,
  page = 1,
  pageSize = 20
): Promise<Driver[]> => {
  let url = `${ADMIN_URL}/drivers?page=${page}&page_size=${pageSize}`;
  if (search) url += `&search=${encodeURIComponent(search)}`;
  
  const response = await fetch(url, { headers: authHeaders(token) });

  return handleResponse<Driver[]>(response);
};

// 👥 GET /admin/users
export const getUsers = async (
  token: string,
  search?: string,
  isDriver?: boolean,
  page = 1,
  pageSize = 20
): Promise<AdminUser[]> => {
  let url = `${ADMIN_URL}/users?page=${page}&page_size=${pageSize}`;
  if (search) url += `&search=${encodeURIComponent(search)}`;
  if (isDriver !== undefined) url += `&is_driver=${isDriver}`;
  
  const response = await fetch(url, { headers: authHeaders(token) });

  return handleResponse<AdminUser[]>(response);
};

// 👤 GET /admin/users/{userId}
export const getUserDetail = async (
  userId: string,
  token: string
): Promise<AdminUser & { vehicles: any[] }> => {
  const response = await fetch(`${ADMIN_URL}/users/${userId}`, {
    headers: authHeaders(token),
  });

  return handleResponse<AdminUser & { vehicles: any[] }>(response);
};
