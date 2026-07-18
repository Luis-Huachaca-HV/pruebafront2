import { getAuthHeaders } from '@/lib/authUtils';
import { UserRole, UserStatus } from '@/types';

const BASE_URL = (import.meta.env.VITE_BACKEND_URL as string || '').replace(/\/$/, '');
const USERS_URL = `${BASE_URL}/api/v1/users`;

// =====================
// TIPOS
// =====================

export interface UserResponse {
  id: string;
  email: string;
  full_name?: string;
  phone_number?: string;
  user_role?: UserRole;
  status?: UserStatus;
  is_active?: boolean;
  created_at?: string;
}

export interface UserListItem {
  id: string;
  email: string;
  full_name: string;
  avatar_url?: string;
  is_driver: boolean;
  created_at: string;
}

export interface UserListResponse {
  users: UserListItem[];
  total: number;
}


export interface UserProfileResponse extends UserResponse {
  avatar_url?: string;
  description?: string;
  rating?: number;
  is_driver?: boolean;
  total_trips_as_driver?: number;
  total_trips_as_passenger?: number;
  avg_rating?: number;
  total_reviews?: number;
  recent_reviews?: UserReviewSummary[];
}

export interface UserReviewSummary {
  id: string;
  score: number;
  comment?: string | null;
  created_at: string;
  reviewer_id: string;
  reviewer_name?: string | null;
  reviewer_avatar_url?: string | null;
  trip_id?: string | null;
  origin_name?: string | null;
  destination_name?: string | null;
}

export interface UserCreate {
  email: string;
  password: string;
  full_name?: string;
  phone_number?: string;
}

export interface UserUpdate {
  full_name?: string;
  phone_number?: string;
  email?: string;
  avatar_url?: string;
  description?: string;
}


// =====================
// HELPERS
// =====================

const handleResponse = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    let errorMessage = 'Error en la petición';

    try {
      const result = await response.json();
      errorMessage = result?.detail || result?.message || errorMessage;
    } catch {
      errorMessage = `Error ${response.status}: ${response.statusText}`;
    }

    throw new Error(errorMessage);
  }

  return await response.json() as T;
};


// =====================
// REQUESTS
// =====================

// 🙋 GET /users/me (auth)
export const getCurrentUserProfile = async (): Promise<UserProfileResponse> => {
  const response = await fetch(`${USERS_URL}/me`, {
    headers: getAuthHeaders(),
  });

  const result = await handleResponse<UserProfileResponse>(response);
  console.log('[Users API] getCurrentUserProfile:', result);
  return result;
};


// 👤 GET /users/{user_id}
export const getUserById = async (
  userId: string
): Promise<UserResponse> => {
  const response = await fetch(`${USERS_URL}/${userId}`);
  const result = await handleResponse<UserResponse>(response);
  console.log('[Users API] getUserById:', result);
  return result;
};

// 👤 GET /users/{user_id}/profile
export const getUserProfile = async (
  userId: string
): Promise<UserProfileResponse> => {
  const response = await fetch(`${USERS_URL}/${userId}/profile`, {
    headers: getAuthHeaders(),
  });
  const result = await handleResponse<UserProfileResponse>(response);
  console.log('[Users API] getUserProfile:', result);
  return result;
};


// ➕ POST /users
export const createUser = async (
  data: UserCreate
): Promise<UserResponse> => {
  const response = await fetch(USERS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  return handleResponse<UserResponse>(response);
};


// ✏️ PATCH /users/me (auth)
export const updateCurrentUser = async (
  data: UserUpdate
): Promise<UserResponse> => {
  const response = await fetch(`${USERS_URL}/me`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });

  return handleResponse<UserResponse>(response);
};


// 🔑 PATCH /users/me/password (auth)
export const changePassword = async (
  currentPassword: string,
  newPassword: string
): Promise<{ message: string }> => {
  const response = await fetch(`${USERS_URL}/me/password`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify({
      current_password: currentPassword,
      new_password: newPassword,
    }),
  });

  return handleResponse<{ message: string }>(response);
};


// 🚗 GET /users/drivers
export const getActiveDrivers = async (): Promise<UserListItem[]> => {
  const response = await fetch(
    `${USERS_URL}/drivers/`
  );

  const result = await handleResponse<UserListItem[]>(response);
  console.log('[Users API] getActiveDrivers:', result);
  return result;
};
