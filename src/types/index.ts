export interface Vehicle {
  brand: string;
  color: string;
}

export type UserRole = 'user' | 'driver_verified' | 'admin';
export type UserStatus = 'active' | 'suspended' | 'blocked';

export interface User {
  id: string;
  full_name: string;
  email: string;
  phone_number?: string;
  avatar?: string;
  description?: string;
  rating?: number | null;
  tripsCompleted: number;
  vehicle?: Vehicle;
  is_driver: boolean;
  user_role: UserRole;
  status?: UserStatus;
  total_trips_as_driver?: number;
  total_trips_as_passenger?: number;
  has_verified_vehicle?: boolean; // Computed: si tiene al menos un vehículo verificado
  recent_reviews?: {
    id: string;
    score: number;
    comment?: string | null;
    created_at: string;
    reviewer_name?: string | null;
    reviewer_avatar_url?: string | null;
    origin_name?: string | null;
    destination_name?: string | null;
  }[];
}

export interface Trip {
  id: string;
  origin: string;
  destination: string;
  date: string;
  time: string;
  price: number;
  seats: number;
  availableSeats: number;
  driver: User;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_name?: string;
  content: string;
  created_at: string;
  updated_at?: string;
}

export interface Conversation {
  id: string;
  trip_id?: string;
  other_user_id: string;
  other_user_name: string;
  other_user_avatar?: string;
  subject?: string;
  last_message_content?: string;
  last_message_at?: string;
  unread_count: number;
  messages?: Message[];
}
