import { useEffect, useState } from 'react';
import { DEMO_TOKEN, demoConversations, demoMessages, demoNotifications, demoReservations, demoTrips, demoUsers, demoVehicle, getDemoUser, id, wait } from '@/mocks/store';

export type LoginRequest = any; export type RegisterRequest = any; export type AuthResponse = any;
export type UserResponse = any; export type UserProfileResponse = any; export type UserListItem = any; export type UserReviewSummary = any; export type UserCreate = any; export type UserUpdate = any;
export type VehicleResponse = any; export type VehicleCreate = any; export type VehicleUpdate = any;
export type Coordinates = any; export type TripPreferences = any; export type TripStopCreate = any; export type TripResponse = any; export type TripDetailResponse = any; export type TripStopResponse = any; export type TripCreate = any; export type TripUpdate = any; export type TripSearchParams = any; export type TripListResponse = any; export type CommissionDetails = any; export type TripCompleteResponse = any;
export type ReservationResponse = any; export type ReservationDetailResponse = any; export type ReservationCreate = any; export type TripReservationStats = any;
export type MessageResponse = any; export type MessageCreate = any; export type ConversationType = 'pre' | 'post' | 'cancelled' | 'rejected'; export type ConversationListItem = any; export type ConversationDetailResponse = any; export type ConversationWithMessagesResponse = any; export type PendingReservationInfo = any; export type PaginatedMessagesResponse = any; export type PaginatedConversationsResponse = any; export type ConversationCreate = any;
export type WalletResponse = any; export type WalletTransaction = any; export type WalletTransactionListResponse = any; export type TopUpBrickRequest = any; export type RechargeOrderResponse = any; export type YapeRechargePayload = any; export type CardRechargePayload = any;
export type PendingTripReview = any; export type ReviewCreatePayload = any; export type DocumentResponse = any; export type PublicAd = any; export type CreateChargeRequest = any; export type PaymentResponse = any;

let currentUser = getDemoUser();
let walletBalance = 120;
const transactions: any[] = [{ id: 'transaction-demo-1', wallet_id: 'wallet-demo-1', amount: 120, transaction_type: 'credit', description: 'Saldo de bienvenida', reference_id: null, created_at: new Date().toISOString() }];
const profile = () => ({ ...currentUser, avatar_url: currentUser.avatar_url, total_trips_as_driver: currentUser.is_driver ? 12 : 0, total_trips_as_passenger: currentUser.is_driver ? 2 : 8, avg_rating: currentUser.rating, total_reviews: 9, recent_reviews: [] });

// ── Notificaciones para conductores (demo, sin backend) ──────────────────────
// Simula lo que en producción vendría por WebSocket: cuando se confirma una
// reserva en uno de mis viajes, se dispara un evento en vivo (para "Mis Viajes")
// y una notificación persistente (para la campanita del header).
const pushNotification = (userId: string, title: string, message: string) => {
  demoNotifications.unshift({
    id: id('notification'), user_id: userId, title, message,
    is_read: false, created_at: new Date().toISOString(),
  });
};

const notifyDriverOfReservation = (trip: any, reservation: any, passengerName: string) => {
  if (typeof window === 'undefined' || !trip) return;
  const seats = reservation.seat_count > 1 ? `${reservation.seat_count} asientos` : `${reservation.seat_count} asiento`;
  const children = reservation.children_count > 0
    ? ` También indicó que viaja con ${reservation.children_count} niño${reservation.children_count > 1 ? 's' : ''}.`
    : '';
  pushNotification(
    trip.driver_id,
    'Nueva reserva confirmada',
    `${passengerName} reservó ${seats} en ${trip.origin_name} → ${trip.destination_name}.${children}`
  );
  const detail = {
    type: 'reservation_confirmed',
    trip_id: trip.id,
    available_seats: trip.available_seats,
    seat_count: reservation.seat_count,
    passenger_name: passengerName,
    origin_name: trip.origin_name,
    destination_name: trip.destination_name,
  };
  window.dispatchEvent(new CustomEvent('sumaq:driver-live', { detail }));
  window.dispatchEvent(new CustomEvent('app:notification', { detail }));
};
const passengerNameFor = (reservation: any) =>
  (reservation.passenger_id === demoUsers.driver.id ? demoUsers.driver : demoUsers.passenger).full_name;

export const login = async (data: LoginRequest) => { currentUser = getDemoUser(data?.email); return wait({ access_token: DEMO_TOKEN, refresh_token: DEMO_TOKEN, token_type: 'bearer', user: { ...profile(), reputation_score: currentUser.rating } }); };
export const register = async (data: RegisterRequest) => { currentUser = { ...demoUsers.passenger, id: id('demo-user'), email: data.email, full_name: data.full_name || 'Usuario demo' }; return wait({ id: currentUser.id, email: currentUser.email, full_name: currentUser.full_name }); };
export const checkEmail = async () => wait({ exists: false });
export const checkName = async () => wait({ exists: false });
export const loginWithGoogle = () => { window.location.assign('/login'); };

export const getCurrentUserProfile = async () => wait(profile());
export const getUserById = async (userId: string) => wait(userId === demoUsers.driver.id ? demoUsers.driver : currentUser);
export const getUserProfile = async (userId: string) => getUserById(userId).then(user => ({ ...user, avg_rating: user.rating, total_trips_as_driver: user.is_driver ? 12 : 0, total_trips_as_passenger: user.is_driver ? 2 : 8, recent_reviews: [] }));
export const createUser = async (data: any) => register(data);
export const updateCurrentUser = async (data: any) => { currentUser = { ...currentUser, ...data }; return wait(profile()); };
export const changePassword = async () => wait({ message: 'Contraseña actualizada en modo demo.' });
export const getActiveDrivers = async () => wait([demoUsers.driver]);

export const getMyVehicles = async () => wait(currentUser.is_driver ? [demoVehicle] : []);
export const getVehicleById = async () => wait(demoVehicle);
export const createVehicle = async (data: any) => wait({ ...demoVehicle, ...data, id: id('vehicle') });
export const updateVehicle = async (_vehicleId: string, data: any) => wait({ ...demoVehicle, ...data });
export const getDriverVehicles = async () => wait([demoVehicle]);

const tripDetail = (trip: any) => ({ ...trip, vehicle_brand: demoVehicle.brand, vehicle_model: demoVehicle.model, vehicle_color: demoVehicle.color, vehicle_year: demoVehicle.year, vehicle_plate: demoVehicle.plate, vehicle_seat_capacity: demoVehicle.seat_capacity, stops: [], user_reservations: demoReservations.filter(item => item.trip_id === trip.id) });
export const searchTrips = async () => wait(demoTrips.filter(trip => trip.status === 'published'));
// Consumers of this service iterate the result directly (`trips.map(...)`).
// Keep the mock contract aligned with the application service by returning the
// list itself instead of a pagination wrapper.
export const getPublishedTrips = async () => wait(demoTrips.filter(trip => trip.status === 'published'));
export const getMyTrips = async () => wait(currentUser.is_driver ? demoTrips : []);
export const getTripById = async (tripId: string) => wait(demoTrips.find(trip => trip.id === tripId) || demoTrips[0]);
export const getTripDetails = async (tripId: string) => getTripById(tripId).then(tripDetail);
export const createTrip = async (data: any) => { const trip = { ...demoTrips[0], ...data, id: id('trip'), driver_id: currentUser.id, available_seats: data.total_seats, status: 'published', created_at: new Date().toISOString() }; demoTrips.push(trip); return wait(trip); };
export const createBatchTrips = async (trips: any[]) => Promise.all(trips.map(createTrip));
export const updateTrip = async (tripId: string, data: any) => { const trip = demoTrips.find(item => item.id === tripId) || demoTrips[0]; Object.assign(trip, data); return wait(trip); };
export const cancelTrip = async (tripId: string) => updateTrip(tripId, { status: 'cancelled' });
export const startTrip = async (tripId: string) => updateTrip(tripId, { status: 'in_progress' });
export const getActiveTrip = async () => wait(demoTrips.find(trip => trip.status === 'in_progress') || null);
export const completeTrip = async (tripId: string) => { const trip = await updateTrip(tripId, { status: 'completed' }); return { trip, commission: { amount: 0 } }; };

export const createReservation = async (data: any) => {
  const trip = demoTrips.find(item => item.id === data.trip_id);
  const autoConfirm = trip?.booking_mode === 'auto';
  const reservation = { id: id('reservation'), trip_id: data.trip_id, passenger_id: currentUser.id, seat_count: data.seat_count, children_count: data.children_count ?? 0, status: autoConfirm ? 'confirmed' : 'pending', created_at: new Date().toISOString() };
  demoReservations.push(reservation);
  if (autoConfirm && trip) {
    trip.available_seats = Math.max(0, (trip.available_seats ?? 0) - reservation.seat_count);
    notifyDriverOfReservation(trip, reservation, currentUser.full_name);
  }
  return wait(reservation);
};
export const getReservation = async (reservationId: string) => wait(demoReservations.find(item => item.id === reservationId) || demoReservations[0]);
export const getReservationsByTrip = async (tripId: string) => wait(demoReservations.filter(item => item.trip_id === tripId).map(item => ({ ...item, passenger_name: demoUsers.passenger.full_name, driver_id: demoUsers.driver.id })));
export const getMyReservations = async () => wait(demoReservations.filter(item => item.passenger_id === currentUser.id));
export const getPendingReservations = async () => wait(demoReservations.filter(item => item.status === 'pending'));
export const getDriverReservationStats = async () => wait(Object.fromEntries(demoTrips.map(trip => [trip.id, { pending: demoReservations.filter(item => item.trip_id === trip.id && item.status === 'pending').length, confirmed: 0, cancelled: 0 }])));
export const approveReservation = async (reservationId: string) => {
  const reservation = demoReservations.find(item => item.id === reservationId);
  if (reservation) {
    reservation.status = 'confirmed';
    const trip = demoTrips.find(item => item.id === reservation.trip_id);
    if (trip) {
      trip.available_seats = Math.max(0, (trip.available_seats ?? 0) - reservation.seat_count);
      notifyDriverOfReservation(trip, reservation, passengerNameFor(reservation));
    }
  }
  return wait(reservation);
};
export const rejectReservation = async (reservationId: string) => { const reservation = demoReservations.find(item => item.id === reservationId); if (reservation) reservation.status = 'cancelled'; return wait(reservation); };
export const cancelReservation = rejectReservation;

export const getConversations = async () => wait({ conversations: demoConversations, total: demoConversations.length, has_more: false });
export const createConversation = async (data: any) => { const existing = demoConversations.find(item => item.trip_id === data.trip_id); if (existing) return wait(existing); const item = { id: id('conversation'), user_id: currentUser.id, driver_id: data.other_user_id, other_user_id: data.other_user_id, other_user_name: demoUsers.driver.full_name, trip_id: data.trip_id, subject: data.subject, conversation_type: data.conversation_type || 'pre', unread_count: 0, created_at: new Date().toISOString() }; demoConversations.push(item); return wait(item); };
export const getConversation = async (conversationId: string) => { const conversation = demoConversations.find(item => item.id === conversationId) || demoConversations[0]; return wait({ ...conversation, messages: demoMessages.filter(item => item.conversation_id === conversation.id), has_active_reservation: false }); };
export const getMessagesPage = async (conversationId: string) => wait({ messages: demoMessages.filter(item => item.conversation_id === conversationId), total: demoMessages.length, has_more: false });
export const sendMessage = async (data: any) => { const message = { id: id('message'), conversation_id: data.conversation_id, sender_id: currentUser.id, sender_name: currentUser.full_name, content: data.content, created_at: new Date().toISOString(), status: 'sent' }; demoMessages.push(message); return wait(message); };
export const acceptReservationFromChat = async () => wait({ message: 'Reserva aprobada en modo demo.' });
export const rejectReservationFromChat = async () => wait({ message: 'Reserva rechazada en modo demo.' });
export const deleteConversation = async () => wait({ message: 'Conversación eliminada.' });
export const deleteMessage = async () => wait({ message: 'Mensaje eliminado.' });
export const markConversationAsRead = async () => wait({ message: 'Conversación marcada como leída.' });
export class ChatWebSocket { connect() {} disconnect() {} sendMessage() {} }
export const useChatWebSocket = () => {
  const [isConnected, setIsConnected] = useState(false);
  useEffect(() => { setIsConnected(true); }, []);

  // Mantener el mismo contrato que el WebSocket real. En modo demo no hay
  // servidor al que notificar, pero la UI igualmente puede emitir el evento.
  return {
    isConnected,
    sendMessage: async () => undefined,
    sendTyping: (_isTyping: boolean) => undefined,
    waitForConnection: async () => true,
    lastMessage: null,
  };
};

const wallet = () => ({ id: 'wallet-demo-1', user_id: currentUser.id, balance: walletBalance });
export const getMyWallet = async () => wait(wallet());
export const getMyTransactions = async (_token: string, page = 1, pageSize = 20) => wait({ transactions: transactions.slice((page - 1) * pageSize, page * pageSize), total: transactions.length, page, page_size: pageSize });
const recharge = async (payload: any) => { const amount = Number(payload.transaction_amount || 0); walletBalance += amount; transactions.unshift({ id: id('transaction'), wallet_id: 'wallet-demo-1', amount, transaction_type: 'credit', description: 'Recarga demo', reference_id: null, created_at: new Date().toISOString() }); return wait({ id: id('recharge'), amount, status: 'approved', created_at: new Date().toISOString() }); };
export const rechargeWalletBrick = async (_token: string, payload: any) => recharge(payload);
export const rechargeWalletYape = async (_token: string, payload: any) => recharge(payload);
export const rechargeWalletCard = async (_token: string, payload: any) => recharge(payload);

export const getPendingTripReviews = async () => wait([]);
export const createTripReview = async () => wait({ message: 'Reseña registrada en modo demo.' });
export const uploadDocumentFile = async (_file: File) => wait({ file_url: URL.createObjectURL(_file) });
export const createDocumentRecord = async (data: any) => wait({ id: id('document'), ...data, created_at: new Date().toISOString() });
export const uploadProfilePhoto = async (file: File) => wait({ avatar_url: URL.createObjectURL(file) });
export const base64ToFile = (base64: string, fileName: string) => new File([base64], fileName, { type: 'image/png' });
export const getNotifications = async () => {
  const mine = demoNotifications.filter(item => item.user_id === currentUser.id);
  return wait({ notifications: mine, total: mine.length });
};
export const getUnreadNotificationsCount = async () => wait(demoNotifications.filter(item => item.user_id === currentUser.id && !item.is_read).length);
export const markNotificationAsRead = async (notificationId: string) => {
  const notification = demoNotifications.find(item => item.id === notificationId);
  if (notification) notification.is_read = true;
  return wait({ message: 'Notificación leída.' });
};
export const markAllNotificationsAsRead = async () => {
  demoNotifications.filter(item => item.user_id === currentUser.id).forEach(item => { item.is_read = true; });
  return wait({ message: 'Notificaciones actualizadas.' });
};
export const getActiveAds = async () => wait([
  { id: 'ad-demo-1', title: 'Viaja seguro por el Perú con SumaqTravel', image_url: '/hero/machu-picchu.png', link_url: '/search', position: 'home', is_active: true },
  { id: 'ad-demo-2', title: 'Arma tu itinerario con IA y viaja acompañado', image_url: '/hero/arequipa.png', link_url: '/itinerary', position: 'home', is_active: true },
]);

export const paymentService = { createCharge: async (data: any) => { if (!data?.token) throw new Error('Token requerido'); if (!data?.reservation_id) throw new Error('Se requiere una reservación'); if (!data?.email) throw new Error('Email requerido'); if (!data?.amount || data.amount <= 0) throw new Error('El monto debe ser mayor a 0'); return wait({ id: id('payment'), culqi_charge_id: id('demo-charge'), status: 'approved', payment_method: 'card', amount: data.amount, currency_code: 'PEN', message: 'Pago simulado aprobado.' }); } };
