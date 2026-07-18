import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, Calendar, Clock, Users, Car, MapPin, Loader2, Trash2, Repeat, AlertCircle, CheckCircle2, XCircle, User as UserIcon, Search, RefreshCw, UserCheck, Timer, Navigation, EyeOff, Wallet, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';
import { useIsDriver, useCanCreateTrips } from '@/hooks/use-user-role';
import { useNavigate } from 'react-router-dom';
import MapboxLocationPicker from '@/components/MapboxLocationPicker';
import RouteMapDisplay, { RouteOption } from '@/components/RouteMapDisplay';
import { useQueryClient } from '@tanstack/react-query';

import {
  getTripById,
  getMyTrips,
  TripResponse,
  TripCreate,
} from '@/services/trips';
import { getMyVehicles, VehicleResponse } from '@/services/vehicles';
import { getMyReservations, getPendingReservations, getDriverReservationStats, cancelReservation, ReservationResponse, TripReservationStats } from '@/services/reservations';
import { getMyWallet } from '@/services/walletService';
import { createTripReview, getPendingTripReviews, PendingTripReview } from '@/services/reviews';
import { useDriverLiveMode, type DriverLiveEvent } from '@/hooks/use-driver-live-mode';
import { useActiveTrip } from '@/hooks/useActiveTrip';
import {
  useMyDriverTrips,
  useMyPendingReservations,
  useMyDriverStats,
  useMyVehiclesCache,
  useMyPassengerReservations,
  useCreateTripMutation,
  useCreateBatchTripsMutation,
  useCancelTripMutation,
  useCancelReservationMutation,
} from '@/hooks/use-my-trips-cache';

interface IntermediateCity {
  name: string;
  coordinates: [number, number];
  distance: number;
}

const DAYS_OF_WEEK = [
  { value: 1, label: "L", fullName: "Lunes" },
  { value: 2, label: "M", fullName: "Martes" },
  { value: 3, label: "X", fullName: "Miércoles" },
  { value: 4, label: "J", fullName: "Jueves" },
  { value: 5, label: "V", fullName: "Viernes" },
  { value: 6, label: "S", fullName: "Sábado" },
  { value: 0, label: "D", fullName: "Domingo" },
];

// Límite máximo de viajes que se pueden crear en batch
const MAX_TRIPS_PER_BATCH = 30;

const MAPBOX_TOKEN =
  "pk.eyJ1IjoibGVzZWwiLCJhIjoiY21rcTMzZHZpMGx2dzNrb3FuanUxNjZ3cyJ9.QckkRB2ojiFgnJL9dLeVew";

const MyTrips: React.FC = () => {
  const navigate = useNavigate();
  const { user, accessToken } = useAuth();
  const { toast } = useToast();
  const isDriver = useIsDriver();
  const { canCreate: canCreateTrips, isLoading: isLoadingVehicles, reason } = useCanCreateTrips();
  const { activeTrip, isLoading: isLoadingActiveTrip } = useActiveTrip();


  // ── React Query: caché de datos ────────────────────────────────────────────
  const { data: myTripsData = [], isLoading: isLoadingTrips } = useMyDriverTrips(1);
  const { data: pendingData = [] } = useMyPendingReservations();
  const { data: statsData = {} } = useMyDriverStats();
  const { data: vehiclesData = [] } = useMyVehiclesCache();
  const { data: reservationsData = [], isLoading: isLoadingReservations } = useMyPassengerReservations(1);

  const createTripMutation = useCreateTripMutation();
  const createBatchMutation = useCreateBatchTripsMutation();
  const cancelTripMutation = useCancelTripMutation();
  const cancelReservationMutation = useCancelReservationMutation();

  // Invalidar toda la caché de MyTrips (usado por botones de refresco)
  const queryClient = useQueryClient();
  const refreshAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['myTrips'] });
  }, [queryClient]);

  // Estado local sincronizado con caché
  const [myTrips, setMyTrips] = useState<TripResponse[]>([]);
  const [statsByTripId, setStatsByTripId] = useState<Record<string, import('@/services/reservations').TripReservationStats>>({});
  const [pendingCountByTripId, setPendingCountByTripId] = useState<Record<string, number>>({});
  const [vehicles, setVehicles] = useState<import('@/services/vehicles').VehicleResponse[]>([]);
  const [reservations, setReservations] = useState<import('@/services/reservations').ReservationResponse[]>([]);
  const [reservationTrips, setReservationTrips] = useState<Record<string, TripResponse>>({});

  // Sincronizar estado local con React Query
  useEffect(() => {
    if (myTripsData && JSON.stringify(myTripsData) !== JSON.stringify(myTrips)) {
      setMyTrips(myTripsData);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(myTripsData)]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setStatsByTripId(statsData); }, [JSON.stringify(statsData)]);
  useEffect(() => {
    const countByTrip: Record<string, number> = {};
    pendingData.forEach((r) => {
      countByTrip[r.trip_id] = (countByTrip[r.trip_id] || 0) + 1;
    });
    if (JSON.stringify(countByTrip) !== JSON.stringify(pendingCountByTripId)) {
      setPendingCountByTripId(countByTrip);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(pendingData)]);
  useEffect(() => {
    if (vehiclesData && JSON.stringify(vehiclesData) !== JSON.stringify(vehicles)) {
      setVehicles(vehiclesData);
    }
    const verifiedVehicle = vehiclesData.find((v) => v.verification_status === 'verified');
    if (verifiedVehicle && !selectedVehicleId) {
      setSelectedVehicleId(verifiedVehicle.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(vehiclesData)]);

  useEffect(() => {
    if (reservationsData && JSON.stringify(reservationsData) !== JSON.stringify(reservations)) {
      setReservations(reservationsData);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(reservationsData)]);

  useEffect(() => {
    if (!accessToken || isDriver) return;

    let mounted = true;
    getPendingTripReviews(accessToken)
      .then((items) => {
        if (!mounted) return;
        setPendingTripReviews(items);
        setIsReviewDialogOpen(items.length > 0);
      })
      .catch((error) => {
        console.error('Error loading pending trip reviews:', error);
      });

    return () => {
      mounted = false;
    };
  }, [accessToken, isDriver]);

  // Cargar detalles de viajes para reservas del pasajero
  useEffect(() => {
    if (!reservationsData.length) return;
    const missing = reservationsData.filter((r) => !reservationTrips[r.trip_id]);
    if (!missing.length) return;
    Promise.all(missing.map((r) => getTripById(r.trip_id).catch(() => null)))
      .then((trips) => {
        const map: Record<string, TripResponse> = {};
        trips.forEach((trip, i) => { if (trip) map[missing[i].trip_id] = trip; });
        setReservationTrips((prev) => ({ ...prev, ...map }));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reservationsData]);

  const isLoading = isDriver ? isLoadingTrips : isLoadingReservations;

  // Estado para conductores (viajes publicados)
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [origin, setOrigin] = useState("");
  const [originCoords, setOriginCoords] = useState<[number, number] | undefined>();
  const [destination, setDestination] = useState("");
  const [destinationCoords, setDestinationCoords] = useState<[number, number] | undefined>();
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [seats, setSeats] = useState(3);
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [bookingMode, setBookingMode] = useState<"auto" | "manual">("auto");
  const [selectedStops, setSelectedStops] = useState<IntermediateCity[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<RouteOption | null>(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>("");
  const [isCreating, setIsCreating] = useState(false);
  const [isCancelling, setIsCancelling] = useState<string | null>(null);

  // Recurrence states
  const [isRecurring, setIsRecurring] = useState(false);
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [endDate, setEndDate] = useState("");

  // Estado para usuarios normales (reservas)
  const [isCancellingReservation, setIsCancellingReservation] = useState<string | null>(null);
  const [liveRouteData, setLiveRouteData] = useState<Record<string, { duration: number; distance: number }>>({});

  const [localIsLoading, setLocalIsLoading] = useState(true);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [pendingTripReviews, setPendingTripReviews] = useState<PendingTripReview[]>([]);
  const [isReviewDialogOpen, setIsReviewDialogOpen] = useState(false);
  const [selectedReviewScore, setSelectedReviewScore] = useState(0);
  const [reviewComment, setReviewComment] = useState("");
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  // Pagination States (para carga manual de más páginas)
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Driver Live Mode
  const [isDriverLive, setIsDriverLive] = useState(false);
  const [reservationFlashMap, setReservationFlashMap] = useState<Record<string, string>>({});

  const { isConnected: driverLiveConnected } = useDriverLiveMode(
    isDriver && isDriverLive ? accessToken : null,
    useCallback((event: DriverLiveEvent) => {
      if (event.type === "reservation_confirmed") {
        const { trip_id, available_seats, seat_count, passenger_name } = event;

        setMyTrips((prev) =>
          prev.map((t) => (t.id === trip_id ? { ...t, available_seats } : t)),
        );

        setStatsByTripId((prev) => ({
          ...prev,
          [trip_id]: {
            ...prev[trip_id],
            confirmed: (prev[trip_id]?.confirmed ?? 0) + seat_count,
          },
        }));

        const msg = passenger_name
          ? `${passenger_name} reservó ${seat_count} asiento${seat_count > 1 ? "s" : ""}`
          : `${seat_count} asiento${seat_count > 1 ? "s" : ""} reservado${seat_count > 1 ? "s" : ""}`;
        setReservationFlashMap((prev) => ({ ...prev, [trip_id]: msg }));

        setTimeout(() => {
          setReservationFlashMap((prev) => {
            const n = { ...prev };
            delete n[trip_id];
            return n;
          });
        }, 3500);
      }
    }, []),
    (error) => {
      toast({
        title: "Conexión perdida",
        description: error,
        variant: "destructive",
      });
    },
  );

  // Helper function to parse date strings correctly (avoiding timezone issues)
  const parseLocalDate = (dateString: string): Date => {
    const [year, month, day] = dateString.split("-").map(Number);
    return new Date(year, month - 1, day);
  };

  // Función reutilizable para calcular fechas de viajes recurrentes
  const calculateTripDates = useCallback(
    (startDateStr: string, endDateStr: string, days: number[]): string[] => {
      const start = parseLocalDate(startDateStr);
      const end = parseLocalDate(endDateStr);

      if (end < start) return [];

      const dates: string[] = [];
      const current = new Date(start);

      while (current <= end) {
        const dayOfWeek = current.getDay();
        if (days.includes(dayOfWeek)) {
          const y = current.getFullYear();
          const m = String(current.getMonth() + 1).padStart(2, "0");
          const d = String(current.getDate()).padStart(2, "0");
          dates.push(`${y}-${m}-${d}`);

          if (dates.length > MAX_TRIPS_PER_BATCH) {
            break;
          }
        }
        current.setDate(current.getDate() + 1);
      }

      return dates;
    },
    [],
  );

  // Calcular número de viajes que se crearán
  const tripCount = useMemo(() => {
    if (!isRecurring) return 1;
    if (!date || !endDate || selectedDays.length === 0) return 0;
    const dates = calculateTripDates(date, endDate, selectedDays);
    return dates.length;
  }, [isRecurring, date, endDate, selectedDays, calculateTripDates]);

  const exceedsLimit = tripCount > MAX_TRIPS_PER_BATCH;

  // Función helper para construir objeto TripCreate (evita duplicación)
  const buildTripData = useCallback(
    (tripDate: string): TripCreate => {
      const departureDateTime = new Date(`${tripDate}T${time}`);

      let arrivalTime: string | undefined;
      if (selectedRoute?.duration) {
        const arrivalDateTime = new Date(
          departureDateTime.getTime() + selectedRoute.duration * 1000,
        );
        arrivalTime = arrivalDateTime.toISOString();
      }

      return {
        vehicle_id: selectedVehicleId,
        origin_name: origin,
        destination_name: destination,
        origin_coordinates: {
          latitude: originCoords![1],
          longitude: originCoords![0],
        },
        destination_coordinates: {
          latitude: destinationCoords![1],
          longitude: destinationCoords![0],
        },
        departure_time: departureDateTime.toISOString(),
        arrival_time: arrivalTime,
        total_seats: seats,
        price_per_seat: Number(price),
        currency: "SOL",
        booking_mode: bookingMode,
        description: description || undefined,
        stops:
          selectedStops.length > 0
            ? selectedStops.map((stop, index) => ({
              name: stop.name,
              coordinates: {
                latitude: stop.coordinates[1],
                longitude: stop.coordinates[0],
              },
              stop_order: index + 1,
            }))
            : undefined,
        route_distance_km: selectedRoute
          ? Math.round(selectedRoute.distance / 100) / 10
          : undefined,
        route_duration_min: selectedRoute
          ? Math.round(selectedRoute.duration / 60)
          : undefined,
      };
    },
    [
      selectedVehicleId,
      origin,
      destination,
      originCoords,
      destinationCoords,
      time,
      seats,
      price,
      description,
      bookingMode,
      selectedStops,
      selectedRoute,
    ],
  );

  const toggleDay = (day: number) => {
    setSelectedDays((prev) =>
      prev.includes(day)
        ? prev.filter((d) => d !== day)
        : [...prev, day].sort(),
    );
  };

  // loadMoreData manual (para páginas adicionales, fuera de React Query)
  const loadMoreData = useCallback(async () => {
    if (!accessToken || loadingMore || !hasMore) return;
    try {
      setLoadingMore(true);
      const nextPage = page + 1;
      if (isDriver) {
        // Cargar viajes publicados del conductor + saldo billetera
        const [trips, pendingList, stats, wallet] = await Promise.all([
          getMyTrips(accessToken),
          getPendingReservations(accessToken),
          getDriverReservationStats(accessToken),
          getMyWallet(accessToken).catch(() => null),
        ]);
        setMyTrips(trips);
        setStatsByTripId(stats);
        setWalletBalance(wallet?.balance ?? null);
        // Contar solicitudes pendientes por viaje
        const countByTrip: Record<string, number> = {};
        pendingList.forEach((r) => {
          countByTrip[r.trip_id] = (countByTrip[r.trip_id] || 0) + 1;
        });
        setPendingCountByTripId(countByTrip);

        // Cargar vehículos
        const vehiclesData = await getMyVehicles(accessToken);
        setVehicles(vehiclesData);
        const verifiedVehicle = vehiclesData.find(v => v.verification_status === 'verified');
        if (verifiedVehicle) {
          setSelectedVehicleId(verifiedVehicle.id);
          setSeats(Math.min(seats, verifiedVehicle.seat_capacity));
        }

        const { getMyTrips: fetchTrips } = await import('@/services/trips');
        const moreTrips: TripResponse[] = await fetchTrips(accessToken, undefined, nextPage, 20);
        if (moreTrips.length > 0) {
          setMyTrips((prev) => [...prev, ...moreTrips]);
          setPage(nextPage);
          setHasMore(moreTrips.length === 20);
        } else {
          setHasMore(false);
        }
      } else {
        const { getMyReservations: fetchRes } = await import('@/services/reservations');
        const moreRes = await fetchRes(accessToken, undefined, nextPage, 20);
        if (moreRes.length > 0) {
          setReservations((prev) => [...prev, ...moreRes]);
          setPage(nextPage);
          setHasMore(moreRes.length === 20);
          const trips = await Promise.all(moreRes.map((r) => getTripById(r.trip_id).catch(() => null)));
          const map: Record<string, TripResponse> = {};
          trips.forEach((t, i) => { if (t) map[moreRes[i].trip_id] = t; });
          setReservationTrips((prev) => ({ ...prev, ...map }));
        } else {
          setHasMore(false);
        }
      }
    } catch (e) {
      console.error('Error loading more:', e);
    } finally {
      setLoadingMore(false);
    }
  }, [accessToken, isDriver, loadingMore, hasMore, page]);

  // Observer ref target para lazy load
  const observerTarget = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !isLoading) {
          loadMoreData();
        }
      },
      { threshold: 0.1 },
    );
    if (observerTarget.current) observer.observe(observerTarget.current);
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      if (observerTarget.current) observer.unobserve(observerTarget.current);
    };
  }, [loadMoreData, hasMore, loadingMore, isLoading]);

  // Fallback en vivo: cargar duración/distancia desde Mapbox para viajes sin esos datos
  useEffect(() => {
    const trips = [...myTrips, ...Object.values(reservationTrips)].filter(
      (t) =>
        !t.route_duration_min &&
        !t.route_distance_km &&
        t.origin_coordinates &&
        t.destination_coordinates,
    );

    if (trips.length === 0) return;

    trips.forEach((t) => {
      if (liveRouteData[t.id]) return; // ya obtenido
      const { origin_coordinates: o, destination_coordinates: d } = t;
      const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${o.longitude},${o.latitude};${d.longitude},${d.latitude}?geometries=geojson&overview=full&access_token=${MAPBOX_TOKEN}`;
      fetch(url)
        .then((r) => r.json())
        .then((data) => {
          const route = data.routes?.[0];
          if (!route) return;
          setLiveRouteData((prev) => ({
            ...prev,
            [t.id]: {
              duration: Math.round(route.duration / 60),
              distance: Math.round(route.distance / 100) / 10,
            },
          }));
        })
        .catch(() => {
          /* silencioso */
        });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myTrips, reservationTrips]);

  const handleRouteConfirmed = (
    route: RouteOption,
    stops: IntermediateCity[],
  ) => {
    setSelectedRoute(route);
    setSelectedStops(stops);
  };

  const resetForm = () => {
    setOrigin("");
    setOriginCoords(undefined);
    setDestination("");
    setDestinationCoords(undefined);
    setDate("");
    setTime("");
    setPrice("");
    setDescription("");
    setBookingMode("auto");
    setSeats(3);
    setSelectedStops([]);
    setSelectedRoute(null);
    setIsRecurring(false);
    setSelectedDays([]);
    setEndDate("");
    setShowCreateForm(false);
  };

  const handleCreateTrip = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user || !accessToken) {
      toast({
        title: "Error",
        description: "Debes iniciar sesión para publicar un viaje",
        variant: "destructive",
      });
      return;
    }

    if (!selectedVehicleId) {
      toast({
        title: "Vehículo requerido",
        description:
          "Debes seleccionar un vehículo verificado para publicar un viaje",
        variant: "destructive",
      });
      return;
    }

    if (!originCoords || !destinationCoords) {
      toast({
        title: "Ubicaciones requeridas",
        description: "Debes seleccionar origen y destino",
        variant: "destructive",
      });
      return;
    }

    if (!date || !time) {
      toast({
        title: "Fecha y hora requeridas",
        description: "Debes especificar fecha y hora de salida",
        variant: "destructive",
      });
      return;
    }

    // Validar que la fecha no esté en el pasado
    const startDate = parseLocalDate(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (startDate < today) {
      toast({
        title: "Fecha inválida",
        description: "No puedes crear viajes en el pasado",
        variant: "destructive",
      });
      return;
    }

    // Validaciones específicas para viajes recurrentes
    if (isRecurring) {
      if (selectedDays.length === 0) {
        toast({
          title: "Días requeridos",
          description: "Debes seleccionar al menos un día de la semana",
          variant: "destructive",
        });
        return;
      }

      if (!endDate) {
        toast({
          title: "Fecha de fin requerida",
          description:
            "Debes especificar una fecha de fin para viajes recurrentes",
          variant: "destructive",
        });
        return;
      }

      const end = parseLocalDate(endDate);
      if (end < startDate) {
        toast({
          title: "Fecha de fin inválida",
          description:
            "La fecha de fin debe ser posterior a la fecha de inicio",
          variant: "destructive",
        });
        return;
      }
    }

    // Validar límite de viajes en batch
    if (isRecurring && tripCount > MAX_TRIPS_PER_BATCH) {
      toast({
        title: "Límite excedido",
        description: `Puedes crear máximo ${MAX_TRIPS_PER_BATCH} viajes a la vez. Tu selección generaría ${tripCount} viajes. Por favor ajusta el rango de fechas o días seleccionados.`,
        variant: "destructive",
      });
      return;
    }

    try {
      setIsCreating(true);

      if (isRecurring && endDate && selectedDays.length > 0) {
        const tripDates = calculateTripDates(date, endDate, selectedDays);
        const tripsToCreate: TripCreate[] = tripDates.map((tripDate) => buildTripData(tripDate));
        await createBatchMutation.mutateAsync(tripsToCreate);
        toast({ title: `¡${tripsToCreate.length} viajes publicados!`, description: 'Tus viajes recurrentes están ahora visibles' });
      } else {
        await createTripMutation.mutateAsync(buildTripData(date));
        toast({
          title: '¡Viaje publicado!',
          description: selectedStops.length > 0
            ? `Tu viaje con ${selectedStops.length} escala(s) está ahora visible`
            : 'Tu viaje está ahora visible para otros usuarios',
        });
      }

      resetForm();
    } catch (error) {
      console.error('Error creating trip:', error);
      const message = error instanceof Error ? error.message : 'No se pudo publicar el viaje';
      const isInsufficientBalance =
        message.toLowerCase().includes('saldo insuficiente') ||
        message.toLowerCase().includes('insufficient');

      if (isInsufficientBalance) {
        toast({
          title: 'Saldo insuficiente',
          description: (
            <div className="flex flex-col gap-2">
              <span>{message}</span>
              <button
                onClick={() => navigate('/wallet')}
                className="text-primary underline text-left text-sm font-medium"
              >
                Ir a mi billetera
              </button>
            </div>
          ) as unknown as string,
          variant: 'destructive',
        });
      } else {
        toast({
          title: "Error al publicar",
          description: message,
          variant: "destructive",
        });
      }
    } finally {
      setIsCreating(false);
    }
  };

  const handleCancelTrip = async (tripId: string) => {
    if (!accessToken) return;
    try {
      setIsCancelling(tripId);
      await cancelTripMutation.mutateAsync(tripId);
      toast({ title: 'Viaje cancelado', description: 'El viaje ha sido cancelado correctamente' });
    } catch (error) {
      console.error('Error cancelling trip:', error);
      toast({ title: 'Error', description: 'No se pudo cancelar el viaje', variant: 'destructive' });
    } finally {
      setIsCancelling(null);
    }
  };

  const handleCancelReservation = async (reservationId: string) => {
    if (!accessToken) return;
    try {
      setIsCancellingReservation(reservationId);
      await cancelReservationMutation.mutateAsync(reservationId);
      setReservations((prev) => prev.filter((r) => r.id !== reservationId));
      toast({ title: 'Reserva cancelada', description: 'Tu reserva ha sido cancelada correctamente' });
    } catch (error) {
      console.error('Error cancelling reservation:', error);
      toast({ title: 'Error', description: 'No se pudo cancelar la reserva', variant: 'destructive' });
    } finally {
      setIsCancellingReservation(null);
    }
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString)
      .toLocaleTimeString("es-ES", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      })
      .replace(/([ap])\. m\./i, "$1.m.");
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("es-ES", {
      day: "numeric",
      month: "short",
    });
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${Math.round(minutes)} min`;
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    return m > 0 ? `${h}h ${m}min` : `${h}h`;
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "published":
        return "Publicado";
      case "in_progress":
        return "En curso";
      case "completed":
        return "Completado";
      case "cancelled":
        return "Cancelado";
      case "pending":
        return "Pendiente";
      case "blocked":
        return "Bloqueado";
      case "confirmed":
        return "Confirmada";
      default:
        return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "published":
        return "bg-primary-light text-primary";
      case "in_progress":
        return "bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400";
      case "completed":
        return "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400";
      case "cancelled":
        return "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400";
      case "confirmed":
        return "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400";
      case "pending":
      case "blocked":
        return "bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  // Un viaje está oculto si: publicado + saldo <= 0 + sin reservas confirmadas
  const isTripHidden = (trip: TripResponse): boolean => {
    if (walletBalance === null || walletBalance > 0) return false;
    if (trip.status !== 'published') return false;
    const confirmed = statsByTripId[trip.id]?.confirmed ?? 0;
    return confirmed === 0;
  };

  const verifiedVehicles = vehicles.filter(v => v.verification_status === 'verified');
  const selectedVehicle = vehicles.find(v => v.id === selectedVehicleId);
  const activeReservations = reservations.filter(r => r.status !== 'cancelled');
  const cancelledReservations = reservations.filter(r => r.status === 'cancelled');

  // =====================
  // Logic to Group Dates
  // =====================
  const formatGroupHeader = (dateStr: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const tripDate = parseLocalDate(dateStr.slice(0, 10)); // "YYYY-MM-DD"
    tripDate.setHours(0, 0, 0, 0);

    if (tripDate.getTime() === today.getTime()) {
      return "Hoy";
    } else if (tripDate.getTime() === yesterday.getTime()) {
      return "Ayer";
    } else {
      return tripDate
        .toLocaleDateString("es-ES", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric"
        })
        .replace(/^\w/, (c) => c.toUpperCase()); // Capitalize
    }
  };

  const groupTripsByDate = <T,>(
    items: T[],
    dateExtractor: (item: T) => string,
  ) => {
    const groups: Record<string, T[]> = {};

    // Sort descending by date
    const sortedItems = [...items].sort(
      (a, b) =>
        new Date(dateExtractor(b)).getTime() -
        new Date(dateExtractor(a)).getTime(),
    );

    sortedItems.forEach((item) => {
      const dateStr = dateExtractor(item);
      const header = formatGroupHeader(dateStr);
      if (!groups[header]) {
        groups[header] = [];
      }
      groups[header].push(item);
    });

    return groups;
  };

  const myTripsGroups = groupTripsByDate(myTrips, (t) => t.created_at);
  const activeReservationsGroups = groupTripsByDate(activeReservations, (r) => {
    return r.created_at;
  });
  const cancelledReservationsGroups = groupTripsByDate(
    cancelledReservations,
    (r) => {
      return r.created_at;
    },
  );

  const currentPendingReview = pendingTripReviews[0] || null;

  const handleSubmitTripReview = async () => {
    if (!accessToken || !currentPendingReview || selectedReviewScore < 1) return;

    try {
      setIsSubmittingReview(true);
      await createTripReview(
        currentPendingReview.reservation_id,
        { score: selectedReviewScore, comment: reviewComment.trim() || undefined },
        accessToken
      );

      toast({
        title: 'Gracias por calificar',
        description: `Tu calificacion para ${currentPendingReview.driver_name || 'el conductor'} fue registrada.`,
      });

      setPendingTripReviews((prev) => {
        const next = prev.slice(1);
        setIsReviewDialogOpen(next.length > 0);
        return next;
      });
      setSelectedReviewScore(0);
      setReviewComment("");
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo registrar la calificacion';
      toast({ title: 'Error al calificar', description: message, variant: 'destructive' });
    } finally {
      setIsSubmittingReview(false);
    }
  };

  // VISTA PARA CONDUCTORES
  if (isDriver) {
    return (
      <div className="min-h-screen bg-background px-4 py-6 pb-24">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 animate-fade-in">
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">
              Mis Viajes
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Gestiona tus rutas como conductor
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Toggle En vivo — conductor */}
            <button
              onClick={() => setIsDriverLive((v) => !v)}
              className={`flex items-center gap-1.5 h-9 px-3 rounded-xl border-2 text-sm font-semibold transition-all active:scale-[0.98] ${isDriverLive
                ? "border-emerald-500 bg-emerald-500 text-white"
                : "border-border bg-background text-muted-foreground"
                }`}
            >
              <span
                className={`w-2 h-2 rounded-full transition-all ${isDriverLive && driverLiveConnected
                  ? "bg-white animate-pulse"
                  : isDriverLive
                    ? "bg-amber-300"
                    : "bg-muted-foreground/40"
                  }`}
              />
              En vivo
            </button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => refreshAll()}
              disabled={isLoading}
              className="rounded-full w-10 h-10"
            >
              <RefreshCw
                className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`}
              />
            </Button>
            {canCreateTrips && (
              <Button
                onClick={() => setShowCreateForm(!showCreateForm)}
                size="icon"
                className="rounded-full w-12 h-12"
                disabled={isLoadingVehicles}
              >
                <Plus className="w-6 h-6" />
              </Button>
            )}
          </div>
        </div>

        {/* Mensaje si no puede crear viajes */}
        {!isLoadingVehicles && !canCreateTrips && (
          <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl animate-fade-in">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                  {reason || "No puedes crear viajes en este momento"}
                </p>
                {!user?.has_verified_vehicle && (
                  <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                    Ve a tu perfil para registrar y verificar tu vehículo.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Active trip warning */}
        {showCreateForm && canCreateTrips && activeTrip && (
          <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl animate-fade-in">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                  No puedes crear viajes mientras tengas un viaje en curso
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                  Finaliza o cancela tu viaje activo antes de publicar uno nuevo.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => navigate(`/trip-details/${activeTrip.id}`)}
                >
                  <Navigation className="w-4 h-4 mr-2" />
                  Ir a mi viaje activo
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Create Trip Form */}
        {showCreateForm && canCreateTrips && !activeTrip && (
          <form onSubmit={handleCreateTrip} className="mb-6 animate-slide-up">
            <div className="bg-card rounded-2xl p-4 shadow-lg space-y-4">
              <h3 className="font-display font-semibold text-foreground">
                Publicar nuevo viaje
              </h3>

              {verifiedVehicles.length === 0 ? (
                <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl">
                  <p className="text-sm text-yellow-800 dark:text-yellow-200">
                    Necesitas un vehículo verificado para publicar viajes.
                  </p>
                  <Button
                    type="button"
                    variant="link"
                    className="p-0 h-auto text-yellow-800 dark:text-yellow-200 underline mt-2"
                    onClick={() => navigate("/profile")}
                  >
                    Registrar vehículo
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    Vehículo
                  </label>
                  <select
                    value={selectedVehicleId}
                    onChange={(e) => {
                      setSelectedVehicleId(e.target.value);
                      const vehicle = vehicles.find(
                        (v) => v.id === e.target.value,
                      );
                      if (vehicle) {
                        // Ajustar asientos al máximo de la capacidad del vehículo
                        setSeats(Math.min(seats, vehicle.seat_capacity));
                      }
                    }}
                    className="w-full h-12 px-4 rounded-xl border-2 border-input bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-primary"
                    required
                  >
                    <option value="">Selecciona un vehículo</option>
                    {verifiedVehicles.map((vehicle) => (
                      <option key={vehicle.id} value={vehicle.id}>
                        {vehicle.brand} {vehicle.model} - {vehicle.plate} (
                        {vehicle.seat_capacity} asientos)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <MapboxLocationPicker
                value={origin}
                onChange={(location, coords) => {
                  setOrigin(location);
                  setOriginCoords(coords);
                }}
                placeholder="Origen"
                icon="origin"
              />

              <MapboxLocationPicker
                value={destination}
                onChange={(location, coords) => {
                  setDestination(location);
                  setDestinationCoords(coords);
                }}
                placeholder="Destino"
                icon="destination"
              />

              <RouteMapDisplay
                originCoords={originCoords}
                destinationCoords={destinationCoords}
                originName={origin}
                destinationName={destination}
                selectedStops={selectedStops}
                onStopsChange={setSelectedStops}
                onRouteConfirmed={handleRouteConfirmed}
              />

              <div className="flex gap-3">
                <div className="relative flex-1">
                  <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="pl-12"
                    required
                  />
                </div>
                <div className="relative w-28">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <div className="flex gap-3">
                {/* Precio comentado temporalmente */}
                <div className="relative flex-1">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">
                    S/
                  </span>
                  <Input
                    type="number"
                    placeholder="Precio por persona"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="pl-12"
                    required
                    min="1"
                    step="0.01"
                  />
                </div>
                <div className="relative flex-1">
                  <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <select
                    value={seats}
                    onChange={(e) => setSeats(Number(e.target.value))}
                    className="w-full h-12 pl-10 pr-3 rounded-xl border-2 border-input bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-primary appearance-none cursor-pointer"
                    disabled={!selectedVehicle}
                  >
                    {selectedVehicle
                      ? Array.from(
                        { length: selectedVehicle.seat_capacity },
                        (_, i) => i + 1,
                      ).map((num) => (
                        <option key={num} value={num}>
                          {num}
                        </option>
                      ))
                      : [1, 2, 3, 4, 5, 6].map((num) => (
                        <option key={num} value={num}>
                          {num}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Modo de Aprobación
                </label>
                <div className="flex gap-4">
                  <label
                    className={`flex-1 flex flex-col items-center justify-center p-3 rounded-xl border-2 cursor-pointer transition-all ${bookingMode === "auto"
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border bg-background text-muted-foreground hover:bg-muted"
                      }`}
                  >
                    <input
                      type="radio"
                      name="bookingMode"
                      value="auto"
                      checked={bookingMode === "auto"}
                      onChange={() => setBookingMode("auto")}
                      className="sr-only"
                    />
                    <CheckCircle2 className="w-5 h-5 mb-1" />
                    <span className="text-sm font-semibold">Automático</span>
                    <span className="text-xs text-center mt-1 opacity-80">
                      Aprobación instantánea
                    </span>
                  </label>
                  <label
                    className={`flex-1 flex flex-col items-center justify-center p-3 rounded-xl border-2 cursor-pointer transition-all ${bookingMode === "manual"
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border bg-background text-muted-foreground hover:bg-muted"
                      }`}
                  >
                    <input
                      type="radio"
                      name="bookingMode"
                      value="manual"
                      checked={bookingMode === "manual"}
                      onChange={() => setBookingMode("manual")}
                      className="sr-only"
                    />
                    <UserCheck className="w-5 h-5 mb-1" />
                    <span className="text-sm font-semibold">Manual</span>
                    <span className="text-xs text-center mt-1 opacity-80">
                      Revisas cada solicitud
                    </span>
                  </label>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Descripción (opcional)
                </label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe tu viaje, preferencias, puntos de encuentro, etc."
                  className="min-h-[80px]"
                  maxLength={500}
                />
                <p className="text-xs text-muted-foreground text-right">
                  {description.length}/500
                </p>
              </div>

              {/* Recurrence Section */}
              <div className="border-t border-border pt-4 mt-2">
                <label className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={isRecurring}
                    onChange={(e) => setIsRecurring(e.target.checked)}
                    className="w-4 h-4 rounded border-2 border-input text-primary focus:ring-2 focus:ring-primary cursor-pointer"
                  />
                  <Repeat className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                  <span className="text-sm font-medium text-foreground">
                    Repetir este viaje
                  </span>
                </label>

                {isRecurring && (
                  <div className="mt-4 space-y-4 animate-slide-up">
                    {/* Days of week selector */}
                    <div>
                      <label className="text-xs text-muted-foreground mb-2 block">
                        Días de la semana
                      </label>
                      <div className="flex gap-2">
                        {DAYS_OF_WEEK.map((day) => (
                          <button
                            key={day.value}
                            type="button"
                            onClick={() => toggleDay(day.value)}
                            className={`
                              flex-1 h-10 rounded-lg text-sm font-medium transition-all
                              ${selectedDays.includes(day.value)
                                ? "bg-primary text-primary-foreground shadow-md"
                                : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                              }
                            `}
                            title={day.fullName}
                          >
                            {day.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* End date */}
                    <div>
                      <label className="text-xs text-muted-foreground mb-2 block">
                        Repetir hasta
                      </label>
                      <div className="relative">
                        <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                        <Input
                          type="date"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          className="pl-12"
                          min={date}
                          required={isRecurring}
                        />
                      </div>
                    </div>

                    {/* Preview - Warning si excede límite */}
                    {selectedDays.length > 0 &&
                      endDate &&
                      parseLocalDate(endDate) >= parseLocalDate(date) && (
                        <div
                          className={`rounded-lg p-3 ${tripCount === 0 || exceedsLimit
                            ? "bg-destructive/10 border border-destructive/30"
                            : "bg-primary/5 border border-primary/20"
                            }`}
                        >
                          {tripCount === 0 ? (
                            <div>
                              <p className="text-sm text-destructive font-semibold mb-1">
                                Ningún viaje generado
                              </p>
                              <p className="text-sm text-destructive">
                                El rango de fechas no incluye los días de la
                                semana seleccionados.
                              </p>
                            </div>
                          ) : exceedsLimit ? (
                            <div>
                              <p className="text-sm text-destructive font-semibold mb-1">
                                Límite excedido
                              </p>
                              <p className="text-sm text-destructive">
                                Se crearían{" "}
                                <span className="font-semibold">
                                  {tripCount} viajes
                                </span>
                                , pero el máximo permitido es{" "}
                                <span className="font-semibold">
                                  {MAX_TRIPS_PER_BATCH}
                                </span>
                                . Ajusta el rango de fechas o reduce los días
                                seleccionados.
                              </p>
                            </div>
                          ) : (
                            <p className="text-sm text-foreground">
                              Se crearán{" "}
                              <span className="font-semibold text-primary">
                                {tripCount} viaje{tripCount !== 1 ? "s" : ""}
                              </span>{" "}
                              entre el{" "}
                              <span className="font-medium">
                                {parseLocalDate(date).toLocaleDateString(
                                  "es-ES",
                                  { day: "numeric", month: "short" },
                                )}
                              </span>{" "}
                              y el{" "}
                              <span className="font-medium">
                                {parseLocalDate(endDate).toLocaleDateString(
                                  "es-ES",
                                  { day: "numeric", month: "short" },
                                )}
                              </span>
                            </p>
                          )}
                        </div>
                      )}

                    {/* Error validation */}
                    {isRecurring &&
                      endDate &&
                      parseLocalDate(endDate) < parseLocalDate(date) && (
                        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3">
                          <p className="text-sm text-destructive font-medium">
                            La fecha de fin debe ser posterior a la fecha de
                            inicio
                          </p>
                        </div>
                      )}

                    {isRecurring && selectedDays.length === 0 && (
                      <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3">
                        <p className="text-sm text-destructive font-medium">
                          Selecciona al menos un día de la semana
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={resetForm}
                  disabled={isCreating}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  className="flex-1"
                  disabled={
                    isCreating ||
                    verifiedVehicles.length === 0 ||
                    (isRecurring &&
                      (selectedDays.length === 0 ||
                        !endDate ||
                        parseLocalDate(endDate) < parseLocalDate(date) ||
                        exceedsLimit ||
                        tripCount === 0))
                  }
                >
                  {isCreating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Publicando...
                    </>
                  ) : tripCount > 1 ? (
                    `Publicar ${tripCount} viajes`
                  ) : (
                    "Publicar viaje"
                  )}
                </Button>
              </div>
            </div>
          </form>
        )}

        {/* My Trips List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : myTrips.length === 0 && !showCreateForm ? (
          <div className="flex flex-col items-center justify-center py-16 animate-fade-in">
            <div className="w-20 h-20 bg-primary-light rounded-full flex items-center justify-center mb-4">
              <Car className="w-10 h-10 text-primary" />
            </div>
            <h3 className="text-lg font-display font-semibold text-foreground mb-2">
              No tienes viajes publicados
            </h3>
            {canCreateTrips && !activeTrip ? (
              <>
                <p className="text-muted-foreground text-center max-w-xs mb-6 text-sm">
                  Publica tu primer viaje y comienza a compartir gastos con
                  otros viajeros
                </p>
                <Button onClick={() => setShowCreateForm(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Crear viaje
                </Button>
              </>
            ) : canCreateTrips && activeTrip ? (
              <>
                <p className="text-muted-foreground text-center max-w-xs mb-6 text-sm">
                  No puedes crear viajes mientras tengas un viaje en curso
                </p>
                <Button variant="outline" onClick={() => navigate(`/trip-details/${activeTrip.id}`)}>
                  <Navigation className="w-4 h-4 mr-2" />
                  Ir a mi viaje activo
                </Button>
              </>
            ) : (
              <>
                <p className="text-muted-foreground text-center max-w-xs mb-6 text-sm">
                  {reason ||
                    "Para publicar viajes necesitas tener un vehículo verificado."}
                </p>
                <Button variant="outline" onClick={() => navigate("/profile")}>
                  Ir a mi perfil
                </Button>
              </>
            )}
          </div>
        ) : null}

        {/* Lista de viajes (solo si hay viajes) */}
        {!isLoading && myTrips.length > 0 && (
          <div className="space-y-6 animate-slide-up">
            {Object.entries(myTripsGroups).map(([dateGroup, groupTrips]) => (
              <div key={dateGroup}>
                <div className="flex items-center gap-4 mb-4 mt-2">
                  <div className="h-[1px] flex-1 bg-border/60"></div>
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                    {dateGroup}
                  </h3>
                  <div className="h-[1px] flex-1 bg-border/60"></div>
                </div>

                <div className="space-y-4">
                  {groupTrips.map((trip) => (
                    <div
                      key={trip.id}
                      className="relative rounded-2xl overflow-hidden"
                    >
                      {/* Flash overlay — nueva reserva */}
                      {reservationFlashMap[trip.id] && (
                        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-emerald-50/90 backdrop-blur-[3px] transition-all duration-300">
                          <div className="w-12 h-12 rounded-full bg-emerald-500 flex items-center justify-center mb-3 shadow-lg">
                            <UserCheck className="w-6 h-6 text-white" />
                          </div>
                          <p className="text-emerald-800 font-semibold text-sm text-center px-4">
                            {reservationFlashMap[trip.id]}
                          </p>
                        </div>
                      )}
                      <div
                        onClick={() => navigate(`/my-trips/manage/${trip.id}`)}
                        className="bg-card rounded-2xl p-5 shadow-lg hover:shadow-xl border border-border/50 cursor-pointer active:scale-[0.98] transition-all duration-200 hover:scale-[1.02]"
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3">
                              <span>Publicado a las {formatTime(trip.created_at)}</span>
                            </div>
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <div className="flex items-center gap-2 min-w-0">
                                <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
                                  <MapPin className="w-3 h-3 text-white" />
                                </div>
                                <span className="font-medium text-foreground text-sm truncate">
                                  {trip.origin_name}
                                </span>
                              </div>
                              <span className="text-xs text-muted-foreground flex-shrink-0 tabular-nums">
                                {formatTime(trip.departure_time)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-2 mt-1">
                              <div className="flex items-center gap-2 min-w-0">
                                <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0">
                                  <MapPin className="w-3 h-3 text-white" />
                                </div>
                                <span className="font-medium text-foreground text-sm truncate">
                                  {trip.destination_name}
                                </span>
                              </div>
                              {(() => {
                                const dur =
                                  trip.route_duration_min ??
                                  liveRouteData[trip.id]?.duration;
                                const arrTime =
                                  trip.arrival_time ||
                                  (dur
                                    ? new Date(
                                      new Date(
                                        trip.departure_time,
                                      ).getTime() +
                                      dur * 60000,
                                    ).toISOString()
                                    : null);
                                return arrTime ? (
                                  <span className="text-xs text-muted-foreground flex-shrink-0 tabular-nums">
                                    ~{formatTime(arrTime)}
                                  </span>
                                ) : null;
                              })()}
                            </div>
                            {trip.description && (
                              <p className="text-sm text-muted-foreground mt-3 line-clamp-2">
                                {trip.description}
                              </p>
                            )}
                            {(() => {
                              const dur =
                                trip.route_duration_min ??
                                liveRouteData[trip.id]?.duration;
                              const dist =
                                trip.route_distance_km ??
                                liveRouteData[trip.id]?.distance;
                              if (!dur && !dist) return null;
                              return (
                                <div className="flex items-center gap-2 mt-2 flex-wrap">
                                  {dur && (
                                    <span className="inline-flex items-center gap-1 text-xs bg-secondary text-secondary-foreground px-2.5 py-1 rounded-full">
                                      <Timer className="w-3 h-3" />~
                                      {formatDuration(dur)}
                                    </span>
                                  )}
                                  {dist && (
                                    <span className="inline-flex items-center gap-1 text-xs bg-secondary text-secondary-foreground px-2.5 py-1 rounded-full">
                                      <Navigation className="w-3 h-3" />
                                      {dist.toFixed(0)} km
                                    </span>
                                  )}
                                  <span className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary px-2.5 py-1 rounded-full font-medium ml-auto">
                                    Día del viaje: {formatDate(trip.departure_time)}
                                  </span>
                                </div>
                              );
                            })()}
                          </div>
                          {/* Precio comentado temporalmente */}
                          <div className="text-right ml-4">
                            <p className="text-2xl font-bold text-primary">
                              {trip.currency === "SOL" ? "S/" : "$"}
                              {trip.price_per_seat}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              por persona
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-4 border-t border-border">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm bg-primary/10 text-primary px-3 py-1.5 rounded-full font-medium">
                              <Users className="w-4 h-4 inline mr-1" />
                              {trip.available_seats} disponibles
                            </span>
                            {(pendingCountByTripId[trip.id] ?? 0) > 0 && (
                              <span className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-3 py-1.5 rounded-full font-medium">
                                {pendingCountByTripId[trip.id]} pendiente
                                {(pendingCountByTripId[trip.id] ?? 0) !== 1
                                  ? "s"
                                  : ""}
                              </span>
                            )}
                            {(statsByTripId[trip.id]?.confirmed ?? 0) > 0 && (
                              <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-3 py-1.5 rounded-full font-medium">
                                {statsByTripId[trip.id].confirmed} confirmada
                                {statsByTripId[trip.id].confirmed !== 1
                                  ? "s"
                                  : ""}
                              </span>
                            )}
                            {(statsByTripId[trip.id]?.cancelled ?? 0) > 0 && (
                              <span className="text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 px-3 py-1.5 rounded-full font-medium">
                                {statsByTripId[trip.id].cancelled} cancelada
                                {statsByTripId[trip.id].cancelled !== 1
                                  ? "s"
                                  : ""}
                              </span>
                            )}
                            <span
                              className={`text-xs px-3 py-1.5 rounded-full font-medium ${getStatusColor(trip.status)}`}
                            >
                              {getStatusLabel(trip.status)}
                            </span>
                            {trip.booking_mode === "manual" ? (
                              <span className="text-xs bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 px-3 py-1.5 rounded-full font-medium flex items-center gap-1">
                                <UserCheck className="w-3.5 h-3.5" />
                                Aprobación manual
                              </span>
                            ) : (
                              <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-3 py-1.5 rounded-full font-medium flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Aprobación automática
                              </span>
                            )}
                          </div>
                          {trip.status === "published" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCancelTrip(trip.id);
                              }}
                              disabled={isCancelling === trip.id}
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            >
                              {isCancelling === trip.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Trash2 className="w-4 h-4" />
                              )}
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {loadingMore && (
              <div className="flex justify-center p-4">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            )}
            {/* Intersection Observer Target */}
            <div ref={observerTarget} className="h-4" />
          </div>
        )}
      </div>
    );
  }

  // VISTA PARA USUARIOS NORMALES (RESERVAS)
  const reviewAvatarSrc = currentPendingReview?.driver_avatar_url
    ? (currentPendingReview.driver_avatar_url.startsWith('/')
      ? `${(import.meta.env.VITE_BACKEND_URL as string || '').replace(/\/$/, '')}${currentPendingReview.driver_avatar_url}`
      : currentPendingReview.driver_avatar_url)
    : undefined;

  return (
    <div className="min-h-screen bg-background px-4 py-6 pb-24">
      <Dialog
        open={isReviewDialogOpen && !!currentPendingReview}
        onOpenChange={(open) => {
          if (isSubmittingReview) return;
          setIsReviewDialogOpen(open);
        }}
      >
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle>Esperamos que tu viaje haya ido bien</DialogTitle>
            <DialogDescription>
              Califica al conductor para ayudar a la comunidad.
            </DialogDescription>
          </DialogHeader>

          {currentPendingReview && (
            <div className="space-y-4 pt-2">
              <div className="rounded-xl bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground">Ruta</p>
                <p className="text-sm font-medium text-foreground">
                  {currentPendingReview.origin_name} → {currentPendingReview.destination_name}
                </p>
              </div>

              <div className="flex items-center gap-3">
                {reviewAvatarSrc ? (
                  <img
                    src={reviewAvatarSrc}
                    alt={currentPendingReview.driver_name || 'Conductor'}
                    className="h-12 w-12 rounded-full object-cover"
                  />
                ) : (
                  <div className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">
                    {(currentPendingReview.driver_name || 'C').charAt(0)}
                  </div>
                )}
                <div>
                  <p className="text-xs text-muted-foreground">Conductor</p>
                  <p className="text-sm font-semibold text-foreground">
                    {currentPendingReview.driver_name || 'Conductor'}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-center gap-2 py-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setSelectedReviewScore(star)}
                    className="transition-transform active:scale-90"
                    aria-label={`Calificar con ${star} estrella${star > 1 ? 's' : ''}`}
                  >
                    <Star
                      className={`h-8 w-8 ${star <= selectedReviewScore ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/40'}`}
                    />
                  </button>
                ))}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Comentario opcional
                </label>
                <Textarea
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value.slice(0, 280))}
                  placeholder="Cuéntale a la comunidad cómo fue el viaje con este conductor"
                  rows={4}
                  maxLength={280}
                  disabled={isSubmittingReview}
                />
                <p className="text-xs text-muted-foreground text-right">
                  {reviewComment.length}/280
                </p>
              </div>

              <Button
                onClick={handleSubmitTripReview}
                disabled={selectedReviewScore < 1 || isSubmittingReview}
                className="w-full"
              >
                {isSubmittingReview ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  'Enviar calificacion'
                )}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Header */}
      <div className="flex items-center justify-between mb-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">
            Mis Viajes
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Viajes que has reservado como pasajero
          </p>
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={() => refreshAll()}
          disabled={isLoading}
          className="rounded-full w-10 h-10 flex-shrink-0"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* TODO: Eliminar este formulario huérfano. Es el formulario original de creación de viajes
         que quedó atrapado en la vista de pasajero cuando se separaron las vistas conductor/pasajero.
         showCreateForm nunca se pone en true desde esta vista (el botón "+" está en la vista conductor),
         así que este bloque es código muerto. La feature de recurrencia (automatizacion de creacion de 
         varios viajes - "Repetir este viaje") ya fue movida al formulario
         del conductor (arriba, dentro del bloque isDriver). */}

      {/* Create Trip Form */}
      {/* {showCreateForm && (
        <form onSubmit={handleCreateTrip} className="mb-6 animate-slide-up">
          <div className="bg-card rounded-2xl p-4 shadow-lg space-y-4">
            <h3 className="font-display font-semibold text-foreground">Publicar nuevo viaje</h3>

            {verifiedVehicles.length === 0 ? (
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
                <p className="text-sm text-yellow-800">
                  Necesitas un vehículo verificado para publicar viajes.
                </p>
                <Button
                  type="button"
                  variant="link"
                  className="p-0 h-auto text-yellow-800 underline"
                  onClick={() => {}}
                >
                  Registrar vehículo
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Vehículo</label>
                <select
                  value={selectedVehicleId}
                  onChange={(e) => {
                    setSelectedVehicleId(e.target.value);
                    const vehicle = vehicles.find(v => v.id === e.target.value);
                    if (vehicle) {
                      setSeats(Math.min(seats, vehicle.seat_capacity));
                    }
                  }}
                  className="w-full h-12 px-4 rounded-xl border-2 border-input bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-primary"
                  required
                >
                  <option value="">Selecciona un vehículo</option>
                  {verifiedVehicles.map((vehicle) => (
                    <option key={vehicle.id} value={vehicle.id}>
                      {vehicle.brand} {vehicle.model} - {vehicle.plate} ({vehicle.seat_capacity} asientos)
                    </option>
                  ))}
                </select>
              </div>
            )}

            <MapboxLocationPicker
              value={origin}
              onChange={(location, coords) => {
                setOrigin(location);
                setOriginCoords(coords);
              }}
              placeholder="Origen"
              icon="origin"
            />

            <MapboxLocationPicker
              value={destination}
              onChange={(location, coords) => {
                setDestination(location);
                setDestinationCoords(coords);
              }}
              placeholder="Destino"
              icon="destination"
            />

            <RouteMapDisplay
              originCoords={originCoords}
              destinationCoords={destinationCoords}
              originName={origin}
              destinationName={destination}
              selectedStops={selectedStops}
              onStopsChange={setSelectedStops}
              onRouteConfirmed={handleRouteConfirmed}
            />

            <div className="flex gap-3">
              <div className="relative flex-1">
                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="pl-12"
                  required
                />
              </div>
              <div className="relative w-28">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>

            <div className="flex gap-3">
              <div className="relative flex-1">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">S/</span>
                <Input
                  type="number"
                  placeholder="Precio por persona"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="pl-12"
                  required
                  min="1"
                  step="0.01"
                />
              </div>
              <div className="relative w-28">
                <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <select
                  value={seats}
                  onChange={(e) => setSeats(Number(e.target.value))}
                  className="w-full h-12 pl-10 pr-3 rounded-xl border-2 border-input bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-primary appearance-none cursor-pointer"
                  disabled={!selectedVehicle}
                >
                  {selectedVehicle
                    ? Array.from({ length: selectedVehicle.seat_capacity }, (_, i) => i + 1).map((num) => (
                      <option key={num} value={num}>{num}</option>
                    ))
                    : [1, 2, 3, 4, 5, 6].map((num) => (
                      <option key={num} value={num}>{num}</option>
                    ))
                  }
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Descripción (opcional)</label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe tu viaje, preferencias, puntos de encuentro, etc."
                className="min-h-[80px]"
                maxLength={500}
              />
              <p className="text-xs text-muted-foreground text-right">
                {description.length}/500
              </p>
            </div>

            <div className="border-t border-border pt-4 mt-2">
              <label className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={isRecurring}
                  onChange={(e) => setIsRecurring(e.target.checked)}
                  className="w-4 h-4 rounded border-2 border-input text-primary focus:ring-2 focus:ring-primary cursor-pointer"
                />
                <Repeat className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                <span className="text-sm font-medium text-foreground">Repetir este viaje</span>
              </label>

              {isRecurring && (
                <div className="mt-4 space-y-4 animate-slide-up">
                  <div>
                    <label className="text-xs text-muted-foreground mb-2 block">
                      Días de la semana
                    </label>
                    <div className="flex gap-2">
                      {DAYS_OF_WEEK.map((day) => (
                        <button
                          key={day.value}
                          type="button"
                          onClick={() => toggleDay(day.value)}
                          className={`
                            flex-1 h-10 rounded-lg text-sm font-medium transition-all
                            ${selectedDays.includes(day.value)
                              ? 'bg-primary text-primary-foreground shadow-md'
                              : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                            }
                          `}
                          title={day.fullName}
                        >
                          {day.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-muted-foreground mb-2 block">
                      Repetir hasta
                    </label>
                    <div className="relative">
                      <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                      <Input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="pl-12"
                        min={date}
                        required={isRecurring}
                      />
                    </div>
                  </div>

                  {tripCount > 1 && selectedDays.length > 0 && endDate && (
                    <div className={`rounded-lg p-3 ${exceedsLimit
                        ? 'bg-destructive/10 border border-destructive/30'
                        : 'bg-primary/5 border border-primary/20'
                      }`}>
                      {exceedsLimit ? (
                        <div>
                          <p className="text-sm text-destructive font-semibold mb-1">
                            ⚠️ Límite excedido
                          </p>
                          <p className="text-sm text-destructive">
                            Se crearían <span className="font-semibold">{tripCount} viajes</span>, pero el máximo permitido es{' '}
                            <span className="font-semibold">{MAX_TRIPS_PER_BATCH}</span>.
                            Ajusta el rango de fechas o reduce los días seleccionados.
                          </p>
                        </div>
                      ) : (
                        <p className="text-sm text-foreground">
                          ✓ Se crearán <span className="font-semibold text-primary">{tripCount} viajes</span> entre el{' '}
                          <span className="font-medium">
                            {parseLocalDate(date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                          </span>
                          {' '}y el{' '}
                          <span className="font-medium">
                            {parseLocalDate(endDate).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                          </span>
                        </p>
                      )}
                    </div>
                  )}

                  {isRecurring && endDate && parseLocalDate(endDate) <= parseLocalDate(date) && (
                    <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3">
                      <p className="text-sm text-destructive font-medium">
                        La fecha de fin debe ser posterior a la fecha de inicio
                      </p>
                    </div>
                  )}

                  {isRecurring && selectedDays.length === 0 && (
                    <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3">
                      <p className="text-sm text-destructive font-medium">
                        Selecciona al menos un día de la semana
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={resetForm}
                disabled={isCreating}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="flex-1"
                disabled={
                  isCreating ||
                  verifiedVehicles.length === 0 ||
                  (isRecurring && (
                    selectedDays.length === 0 ||
                    !endDate ||
                    parseLocalDate(endDate) <= parseLocalDate(date) ||
                    exceedsLimit
                  ))
                }
              >
                {isCreating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Publicando...
                  </>
                ) : (
                  tripCount > 1 ? `Publicar ${tripCount} viajes` : 'Publicar viaje'
                )}
              </Button>
            </div>
          </div>
        </form>
      )} */}

      {/* My Trips List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : reservations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 animate-fade-in">
          <div className="w-20 h-20 bg-primary-light rounded-full flex items-center justify-center mb-4">
            <UserIcon className="w-10 h-10 text-primary" />
          </div>
          <h3 className="text-lg font-display font-semibold text-foreground mb-2">
            No tienes reservas
          </h3>
          <p className="text-muted-foreground text-center max-w-xs mb-6 text-sm">
            Busca viajes disponibles y reserva tu próximo viaje compartido
          </p>
          <Button onClick={() => navigate("/search")}>
            <Search className="w-4 h-4 mr-2" />
            Buscar viajes
          </Button>
        </div>
      ) : (
        <div className="space-y-6 animate-slide-up">
          {/* Reservas activas (pendientes o confirmadas) */}
          {activeReservations.length > 0 && (
            <div className="space-y-6 animate-slide-up">
              {Object.entries(activeReservationsGroups).map(
                ([dateGroup, groupReservations]) => (
                  <div key={dateGroup}>
                    <div className="flex items-center gap-4 mb-4 mt-2">
                      <div className="h-[1px] flex-1 bg-border/60"></div>
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                        {dateGroup}
                      </h3>
                      <div className="h-[1px] flex-1 bg-border/60"></div>
                    </div>

                    <div className="space-y-4">
                      {groupReservations.map((reservation) => {
                        const trip = reservationTrips[reservation.trip_id];
                        if (!trip) return null;

                        return (
                          <div
                            key={reservation.id}
                            onClick={() => navigate(`/trip-details/${trip.id}`)}
                            className="bg-card rounded-2xl p-5 shadow-lg hover:shadow-xl border border-border/50 cursor-pointer active:scale-[0.98] transition-all duration-200"
                          >
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex-1 min-w-0 overflow-hidden">
                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
                                  <span>Reservado a las {formatTime(reservation.created_at)}</span>
                                </div>
                                <div className="flex items-center justify-between gap-2 mt-1">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <div className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
                                      <MapPin className="w-2.5 h-2.5 text-white" />
                                    </div>
                                    <span className="font-medium text-foreground text-sm truncate">
                                      {trip.origin_name}
                                    </span>
                                  </div>
                                  <span className="text-xs text-muted-foreground flex-shrink-0 tabular-nums">
                                    {formatTime(trip.departure_time)}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between gap-2 mt-1">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <div className="w-4 h-4 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0">
                                      <MapPin className="w-2.5 h-2.5 text-white" />
                                    </div>
                                    <span className="font-medium text-foreground text-sm truncate">
                                      {trip.destination_name}
                                    </span>
                                  </div>
                                  {(() => {
                                    const dur =
                                      trip.route_duration_min ??
                                      liveRouteData[trip.id]?.duration;
                                    const arrTime =
                                      trip.arrival_time ||
                                      (dur
                                        ? new Date(
                                          new Date(
                                            trip.departure_time,
                                          ).getTime() +
                                          dur * 60000,
                                        ).toISOString()
                                        : null);
                                    return arrTime ? (
                                      <span className="text-xs text-muted-foreground flex-shrink-0 tabular-nums">
                                        ~{formatTime(arrTime)}
                                      </span>
                                    ) : null;
                                  })()}
                                </div>
                                {(() => {
                                  const dur =
                                    trip.route_duration_min ??
                                    liveRouteData[trip.id]?.duration;
                                  const dist =
                                    trip.route_distance_km ??
                                    liveRouteData[trip.id]?.distance;
                                  if (!dur && !dist) return null;
                                  return (
                                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                                      {dur && (
                                        <span className="inline-flex items-center gap-1 text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full">
                                          <Timer className="w-3 h-3" />~
                                          {formatDuration(dur)}
                                        </span>
                                      )}
                                      {dist && (
                                        <span className="inline-flex items-center gap-1 text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full">
                                          <Navigation className="w-3 h-3" />
                                          {dist.toFixed(0)} km
                                        </span>
                                      )}
                                      <span className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium ml-auto">
                                        Día de reserva: {formatDate(trip.departure_time)}
                                      </span>
                                    </div>
                                  );
                                })()}
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-medium text-foreground">
                                  {reservation.seat_count} asiento
                                  {reservation.seat_count !== 1 ? "s" : ""}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center justify-between pt-3 border-t border-border">
                              <div className="flex items-center gap-2 flex-wrap">
                                {reservation.status === "confirmed" && (
                                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                                )}
                                <span
                                  className={`text-xs px-3 py-1 rounded-full font-medium ${getStatusColor(reservation.status)}`}
                                >
                                  {getStatusLabel(reservation.status)}
                                </span>
                                {trip.status === "completed" && (
                                  <span
                                    className={`text-xs px-3 py-1 rounded-full font-medium ${getStatusColor("completed")}`}
                                  >
                                    Viaje completado
                                  </span>
                                )}
                                {trip.booking_mode === "manual" ? (
                                  <span className="text-xs bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 px-3 py-1.5 rounded-full font-medium flex items-center gap-1">
                                    <UserCheck className="w-3.5 h-3.5" />
                                    Aprobación manual
                                  </span>
                                ) : (
                                  <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-3 py-1.5 rounded-full font-medium flex items-center gap-1">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    Aprobación automática
                                  </span>
                                )}
                                {reservation.confirmation_code && (
                                  <span className="text-xs text-muted-foreground">
                                    Código: {reservation.confirmation_code}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                {(reservation.status === "confirmed" ||
                                  trip.status === "completed") && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        navigate(`/trip-details/${trip.id}`);
                                      }}
                                    >
                                      Ver detalles
                                    </Button>
                                  )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ),
              )}
            </div>
          )}

          {/* Reservas canceladas */}
          {cancelledReservations.length > 0 && (
            <div
              className="mt-8 space-y-6 animate-slide-up"
              style={{ animationDelay: "0.1s" }}
            >
              <h2 className="text-lg font-display font-bold text-foreground mb-4 opacity-70">
                Canceladas
              </h2>
              {Object.entries(cancelledReservationsGroups).map(
                ([dateGroup, groupReservations]) => (
                  <div key={dateGroup}>
                    <div className="space-y-4">
                      {groupReservations.map((reservation) => {
                        const trip = reservationTrips[reservation.trip_id];
                        if (!trip) return null;

                        return (
                          <div
                            key={reservation.id}
                            onClick={() => navigate(`/trip-details/${trip.id}`)}
                            className="bg-card rounded-2xl p-5 shadow border border-border/50 opacity-80 cursor-pointer active:scale-[0.98] transition-all duration-200"
                          >
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex-1 min-w-0 overflow-hidden">
                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
                                  <span>Reservado a las {formatTime(reservation.created_at)}</span>
                                </div>
                                <div className="flex items-center justify-between gap-2 mt-1">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <div className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
                                      <MapPin className="w-2.5 h-2.5 text-white" />
                                    </div>
                                    <span className="font-medium text-foreground text-sm truncate">
                                      {trip.origin_name}
                                    </span>
                                  </div>
                                  <span className="text-xs text-muted-foreground flex-shrink-0 tabular-nums">
                                    {formatTime(trip.departure_time)}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between gap-2 mt-1">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <div className="w-4 h-4 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0">
                                      <MapPin className="w-2.5 h-2.5 text-white" />
                                    </div>
                                    <span className="font-medium text-foreground text-sm truncate">
                                      {trip.destination_name}
                                    </span>
                                  </div>
                                  {(() => {
                                    const dur =
                                      trip.route_duration_min ??
                                      liveRouteData[trip.id]?.duration;
                                    const arrTime =
                                      trip.arrival_time ||
                                      (dur
                                        ? new Date(
                                          new Date(
                                            trip.departure_time,
                                          ).getTime() +
                                          dur * 60000,
                                        ).toISOString()
                                        : null);
                                    return arrTime ? (
                                      <span className="text-xs text-muted-foreground flex-shrink-0 tabular-nums">
                                        ~{formatTime(arrTime)}
                                      </span>
                                    ) : null;
                                  })()}
                                </div>
                                {(() => {
                                  const dur =
                                    trip.route_duration_min ??
                                    liveRouteData[trip.id]?.duration;
                                  const dist =
                                    trip.route_distance_km ??
                                    liveRouteData[trip.id]?.distance;
                                  if (!dur && !dist) return null;
                                  return (
                                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                                      {dur && (
                                        <span className="inline-flex items-center gap-1 text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full">
                                          <Timer className="w-3 h-3" />~
                                          {formatDuration(dur)}
                                        </span>
                                      )}
                                      {dist && (
                                        <span className="inline-flex items-center gap-1 text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full">
                                          <Navigation className="w-3 h-3" />
                                          {dist.toFixed(0)} km
                                        </span>
                                      )}
                                      <span className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium ml-auto">
                                        Día de reserva: {formatDate(trip.departure_time)}
                                      </span>
                                    </div>
                                  );
                                })()}
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-medium text-foreground">
                                  {reservation.seat_count} asiento
                                  {reservation.seat_count !== 1 ? "s" : ""}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center justify-between pt-3 border-t border-border">
                              <div className="flex items-center gap-2">
                                <XCircle className="w-5 h-5 text-red-500" />
                                <span
                                  className={`text-xs px-3 py-1 rounded-full font-medium ${getStatusColor("cancelled")}`}
                                >
                                  Cancelada
                                </span>
                              </div>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/trip-details/${trip.id}`);
                                }}
                              >
                                Ver detalles
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ),
              )}
            </div>
          )}

          {!isLoading && hasMore && (
            <div ref={observerTarget} className="h-4 mt-4" />
          )}

          {loadingMore && (
            <div className="flex justify-center p-4">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MyTrips;
