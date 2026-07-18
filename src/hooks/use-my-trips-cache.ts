/**
 * Caché de React Query para la página /my-trips.
 *
 * Estrategia:
 *  - staleTime: 3 min  →  no refetchea si los datos son "frescos"
 *  - gcTime:    10 min →  mantiene datos en memoria aunque no haya suscriptores
 *  - refetchOnWindowFocus: false  →  no recarga al volver al tab
 *  - Invalidación explícita cuando el conductor crea/cancela un viaje
 *    o cuando el pasajero crea/cancela una reserva.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import {
    getMyTrips,
    createTrip,
    createBatchTrips,
    cancelTrip,
    TripResponse,
    TripCreate,
} from '@/services/trips';
import {
    getMyReservations,
    getPendingReservations,
    getDriverReservationStats,
    cancelReservation,
    ReservationResponse,
    TripReservationStats,
} from '@/services/reservations';
import { getMyVehicles, VehicleResponse } from '@/services/vehicles';

// ── Query Keys ────────────────────────────────────────────────────────────────

export const myTripsKeys = {
    all: ['myTrips'] as const,
    trips: () => [...myTripsKeys.all, 'driver'] as const,
    reservations: () => [...myTripsKeys.all, 'reservations'] as const,
    pending: () => [...myTripsKeys.all, 'pending'] as const,
    stats: () => [...myTripsKeys.all, 'stats'] as const,
    vehicles: () => [...myTripsKeys.all, 'vehicles'] as const,
};

const STALE = 3 * 60 * 1000;   // 3 minutos
const GC = 10 * 60 * 1000;  // 10 minutos

const BASE_OPTIONS = {
    staleTime: STALE,
    gcTime: GC,
    refetchOnWindowFocus: false,
    refetchOnMount: false,   // No recargar si hay datos frescos en caché
} as const;

// ── Driver: viajes propios ─────────────────────────────────────────────────────

export const useMyDriverTrips = (page = 1, pageSize = 20) => {
    const { accessToken } = useAuth();
    return useQuery<TripResponse[]>({
        queryKey: [...myTripsKeys.trips(), page],
        queryFn: () => getMyTrips(accessToken!, undefined, page, pageSize),
        enabled: !!accessToken,
        ...BASE_OPTIONS,
    });
};

// ── Driver: solicitudes pendientes ────────────────────────────────────────────

export const useMyPendingReservations = () => {
    const { accessToken } = useAuth();
    return useQuery({
        queryKey: myTripsKeys.pending(),
        queryFn: () => getPendingReservations(accessToken!, 1, 50),
        enabled: !!accessToken,
        ...BASE_OPTIONS,
    });
};

// ── Driver: estadísticas de reservas ─────────────────────────────────────────

export const useMyDriverStats = () => {
    const { accessToken } = useAuth();
    return useQuery<Record<string, TripReservationStats>>({
        queryKey: myTripsKeys.stats(),
        queryFn: () => getDriverReservationStats(accessToken!),
        enabled: !!accessToken,
        ...BASE_OPTIONS,
    });
};

// ── Driver: vehículos propios ─────────────────────────────────────────────────

export const useMyVehiclesCache = () => {
    const { accessToken } = useAuth();
    return useQuery<VehicleResponse[]>({
        queryKey: myTripsKeys.vehicles(),
        queryFn: () => getMyVehicles(accessToken!),
        enabled: !!accessToken,
        staleTime: 10 * 60 * 1000, // los vehículos cambian poco
        gcTime: GC,
        refetchOnWindowFocus: false,
        refetchOnMount: false,
    });
};

// ── Passenger: reservas propias ───────────────────────────────────────────────

export const useMyPassengerReservations = (page = 1, pageSize = 20) => {
    const { accessToken } = useAuth();
    return useQuery<ReservationResponse[]>({
        queryKey: [...myTripsKeys.reservations(), page],
        queryFn: () => getMyReservations(accessToken!, undefined, page, pageSize),
        enabled: !!accessToken,
        ...BASE_OPTIONS,
    });
};

// ── Mutación: crear viaje (driver) ───────────────────────────────────────────

export const useCreateTripMutation = () => {
    const { accessToken } = useAuth();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: TripCreate) => createTrip(data, accessToken!),
        onSuccess: (newTrip) => {
            // Insertar el viaje creado al inicio del caché existente (optimista)
            queryClient.setQueryData<TripResponse[]>(
                [...myTripsKeys.trips(), 1],
                (old) => (old ? [newTrip, ...old] : [newTrip])
            );
            // Invalidar el resto de páginas e invalidar stats
            queryClient.invalidateQueries({ queryKey: myTripsKeys.stats() });
        },
    });
};

// ── Mutación: crear viajes en batch (driver) ──────────────────────────────────

export const useCreateBatchTripsMutation = () => {
    const { accessToken } = useAuth();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (trips: TripCreate[]) => createBatchTrips(trips, accessToken!),
        onSuccess: (newTrips) => {
            queryClient.setQueryData<TripResponse[]>(
                [...myTripsKeys.trips(), 1],
                (old) => (old ? [...newTrips, ...old] : newTrips)
            );
            queryClient.invalidateQueries({ queryKey: myTripsKeys.stats() });
        },
    });
};

// ── Mutación: cancelar viaje (driver) ─────────────────────────────────────────

export const useCancelTripMutation = () => {
    const { accessToken } = useAuth();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (tripId: string) => cancelTrip(tripId, accessToken!),
        onSuccess: (_, tripId) => {
            // Actualizar estado del viaje en caché sin refetch completo
            queryClient.setQueriesData<TripResponse[]>(
                { queryKey: myTripsKeys.trips() },
                (old) =>
                    old?.map((t) =>
                        t.id === tripId ? { ...t, status: 'cancelled' as const } : t
                    )
            );
            queryClient.invalidateQueries({ queryKey: myTripsKeys.stats() });
        },
    });
};

// ── Mutación: cancelar reserva (passenger) ────────────────────────────────────

export const useCancelReservationMutation = () => {
    const { accessToken } = useAuth();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (reservationId: string) =>
            cancelReservation(reservationId, accessToken!),
        onSuccess: (_, reservationId) => {
            // Actualizar estado de la reserva en caché
            queryClient.setQueriesData<ReservationResponse[]>(
                { queryKey: myTripsKeys.reservations() },
                (old) =>
                    old?.map((r) =>
                        r.id === reservationId
                            ? { ...r, status: 'cancelled' as const }
                            : r
                    )
            );
        },
    });
};

// ── Utilidad: invalidar toda la caché de MyTrips ─────────────────────────────
// Útil para llamar desde TripDetails cuando se reserva un viaje.

export const useInvalidateMyTripsCache = () => {
    const queryClient = useQueryClient();
    return () => queryClient.invalidateQueries({ queryKey: myTripsKeys.all });
};
