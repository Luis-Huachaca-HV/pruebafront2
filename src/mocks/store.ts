export const DEMO_TOKEN = 'covo-demo-session';

export type DemoUser = {
  id: string;
  email: string;
  full_name: string;
  phone_number: string;
  avatar_url?: string;
  description?: string;
  is_driver: boolean;
  user_role: 'user' | 'driver_verified' | 'admin';
  status: 'active';
  rating: number;
};

export const demoUsers: Record<string, DemoUser> = {
  passenger: {
    id: 'demo-passenger', email: 'pasajero@demo.local', full_name: 'Ana Torres',
    phone_number: '999 111 222', description: 'Viajera frecuente.', is_driver: false,
    user_role: 'user', status: 'active', rating: 4.8,
  },
  driver: {
    id: 'demo-driver', email: 'conductor@demo.local', full_name: 'Carlos Mendoza',
    phone_number: '999 333 444', description: 'Conductor verificado.', is_driver: true,
    user_role: 'driver_verified', status: 'active', rating: 4.9,
  },
};

const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
export const demoTrips: any[] = [{
  id: 'trip-demo-1', driver_id: demoUsers.driver.id, vehicle_id: 'vehicle-demo-1',
  origin_name: 'Arequipa, Perú', destination_name: 'Camaná, Arequipa',
  origin_coordinates: { latitude: -16.409, longitude: -71.537 },
  destination_coordinates: { latitude: -16.624, longitude: -72.711 },
  departure_time: tomorrow, total_seats: 4, available_seats: 3, price_per_seat: 28,
  currency: 'PEN', booking_mode: 'auto', status: 'published',
  description: 'Viaje demo con espacio para equipaje.', route_distance_km: 173,
  route_duration_min: 180, created_at: new Date().toISOString(), driver_name: demoUsers.driver.full_name,
  driver_rating: demoUsers.driver.rating, driver_trips_completed: 42,
}];

export const demoVehicle: any = {
  id: 'vehicle-demo-1', driver_id: demoUsers.driver.id, brand: 'Toyota', model: 'Yaris',
  year: 2022, plate: 'DEM-123', color: 'Azul', seat_capacity: 4,
  vehicle_type: 'Sedán', verification_status: 'verified', is_active: true,
  created_at: new Date().toISOString(),
};

export const demoReservations: any[] = [];
export const demoMessages: any[] = [{
  id: 'message-demo-1', conversation_id: 'conversation-demo-1', sender_id: demoUsers.driver.id,
  sender_name: demoUsers.driver.full_name, content: '¡Hola! El punto de encuentro es la Plaza de Armas.', created_at: new Date().toISOString(),
}];
export const demoConversations: any[] = [{
  id: 'conversation-demo-1', user_id: demoUsers.passenger.id, driver_id: demoUsers.driver.id,
  trip_id: 'trip-demo-1', other_user_id: demoUsers.driver.id, other_user_name: demoUsers.driver.full_name,
  trip_origin_name: 'Arequipa, Perú', trip_destination_name: 'Camaná, Arequipa', conversation_type: 'pre', unread_count: 1,
  last_message_content: demoMessages[0].content, last_message_at: demoMessages[0].created_at, created_at: demoMessages[0].created_at,
}];

export const wait = <T>(value: T, ms = 120): Promise<T> =>
  new Promise(resolve => window.setTimeout(() => resolve(structuredClone(value)), ms));
export const id = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;
export const getDemoUser = (email?: string): DemoUser =>
  email?.toLowerCase().includes('conductor') ? demoUsers.driver : demoUsers.passenger;
