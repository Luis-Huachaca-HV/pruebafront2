import React, { useState, useEffect } from 'react';
import { ArrowLeft, Users, MapPin, Clock, Calendar, CheckCircle2, XCircle, AlertCircle, Loader2, User, Pencil, Save, Trash2, RefreshCw, Timer, Navigation } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { TripResponse, updateTrip, TripUpdate, getTripById, cancelTrip } from '@/services/trips';
import MapboxLocationPicker from '@/components/MapboxLocationPicker';
import RouteMapDisplay from '@/components/RouteMapDisplay';
import { useParams, useNavigate } from 'react-router-dom';
import { ReservationResponse, ReservationDetailResponse, getReservationsByTrip, approveReservation, rejectReservation, cancelReservation } from '@/services/reservations';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useUserProfile, convertProfileToUser } from '@/hooks/use-user-profile-cache';
import { UserProfilePopup } from '@/components/UserProfilePopup';
import { User as UserType } from '@/types';
import { getVehicleById, VehicleResponse } from '@/services/vehicles';

interface IntermediateCity {
  name: string;
  coordinates: [number, number];
  distance: number;
}

const MAPBOX_TOKEN = 'pk.eyJ1IjoibGVzZWwiLCJhIjoiY21rcTMzZHZpMGx2dzNrb3FuanUxNjZ3cyJ9.QckkRB2ojiFgnJL9dLeVew';

const ManageTrip: React.FC = () => {
  const { tripId } = useParams<{ tripId: string }>();
  const navigate = useNavigate();
  const { accessToken, user } = useAuth();
  const { toast } = useToast();
  const [trip, setTrip] = useState<TripResponse | null>(null);
  const [liveRouteDuration, setLiveRouteDuration] = useState<number | null>(null);
  const [liveRouteDistance, setLiveRouteDistance] = useState<number | null>(null);
  const [vehicle, setVehicle] = useState<VehicleResponse | null>(null);
  const [reservations, setReservations] = useState<ReservationDetailResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingTrip, setIsLoadingTrip] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Estados para edición
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editOrigin, setEditOrigin] = useState('');
  const [editOriginCoords, setEditOriginCoords] = useState<[number, number] | undefined>();
  const [editDestination, setEditDestination] = useState('');
  const [editDestinationCoords, setEditDestinationCoords] = useState<[number, number] | undefined>();
  const [editSeats, setEditSeats] = useState(1);
  const [editSelectedStops, setEditSelectedStops] = useState<IntermediateCity[]>([]);

  // Cargar viaje y vehículo
  useEffect(() => {
    const loadTrip = async () => {
      if (!tripId || !accessToken) return;

      try {
        setIsLoadingTrip(true);
        const tripData = await getTripById(tripId);

        // Guard: solo el conductor del viaje puede gestionar esta página
        if (user && tripData.driver_id !== user.id) {
          navigate(`/trip-details/${tripId}`, { replace: true });
          return;
        }

        setTrip(tripData);

        // Cargar vehículo asociado al viaje
        let vehicleData: VehicleResponse | null = null;
        try {
          vehicleData = await getVehicleById(tripData.vehicle_id);
          setVehicle(vehicleData);
        } catch (error) {
          console.error('Error loading vehicle:', error);
          // No es crítico, continuamos sin el vehículo
        }

        // Inicializar valores de edición
        const departureDate = new Date(tripData.departure_time);
        setEditDate(departureDate.toISOString().split('T')[0]);
        setEditTime(departureDate.toTimeString().slice(0, 5));
        setEditDescription(tripData.description || '');
        setEditOrigin(tripData.origin_name);
        setEditDestination(tripData.destination_name);
        // Ajustar asientos según la capacidad del vehículo si está disponible
        const initialSeats = vehicleData
          ? Math.min(tripData.total_seats, vehicleData.seat_capacity)
          : tripData.total_seats;
        setEditSeats(initialSeats);
        setEditOriginCoords([
          tripData.origin_coordinates.longitude,
          tripData.origin_coordinates.latitude
        ]);
        setEditDestinationCoords([
          tripData.destination_coordinates.longitude,
          tripData.destination_coordinates.latitude
        ]);
        setEditSelectedStops([]); // TODO: Cargar stops si están disponibles
      } catch (error) {
        console.error('Error loading trip:', error);
        toast({
          title: "Error",
          description: "No se pudo cargar el viaje",
          variant: "destructive",
        });
        navigate('/my-trips');
      } finally {
        setIsLoadingTrip(false);
      }
    };

    loadTrip();
  }, [tripId, accessToken, navigate, toast]);

  // Cargar reservas
  useEffect(() => {
    if (tripId && accessToken) {
      loadReservations();
    }
  }, [tripId, accessToken]);

  // Fallback en vivo: obtener duración/distancia desde Mapbox si el viaje no tiene esos datos guardados
  useEffect(() => {
    if (!trip) return;
    if (trip.route_duration_min && trip.route_distance_km) return; // ya tenemos los datos
    const { origin_coordinates: orig, destination_coordinates: dest } = trip;
    if (!orig || !dest) return;
    const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${orig.longitude},${orig.latitude};${dest.longitude},${dest.latitude}?geometries=geojson&overview=full&access_token=${MAPBOX_TOKEN}`;
    fetch(url)
      .then(r => r.json())
      .then(data => {
        const route = data.routes?.[0];
        if (!route) return;
        if (!trip.route_duration_min && route.duration) {
          setLiveRouteDuration(Math.round(route.duration / 60));
        }
        if (!trip.route_distance_km && route.distance) {
          setLiveRouteDistance(Math.round(route.distance / 100) / 10);
        }
      })
      .catch(() => { /* silencioso */ });
  }, [trip]);

  const loadReservations = async () => {
    if (!accessToken || !tripId) return;

    try {
      setIsLoading(true);
      const data = await getReservationsByTrip(tripId);
      setReservations(data);
    } catch (error) {
      console.error('Error loading reservations:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar las reservas",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async (reservationId: string) => {
    if (!accessToken) return;

    try {
      setProcessingId(reservationId);
      await approveReservation(reservationId, accessToken);
      await loadReservations();

      // Recargar el viaje para actualizar asientos disponibles
      if (tripId) {
        const updatedTrip = await getTripById(tripId);
        setTrip(updatedTrip);
      }

      toast({
        title: "Reserva aprobada",
        description: "La reserva ha sido aprobada correctamente",
      });
    } catch (error) {
      console.error('Error approving reservation:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "No se pudo aprobar la reserva",
        variant: "destructive",
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (reservationId: string) => {
    if (!accessToken) return;

    try {
      setProcessingId(reservationId);
      await rejectReservation(reservationId, accessToken);
      await loadReservations();

      // Recargar el viaje para actualizar asientos disponibles
      if (tripId) {
        const updatedTrip = await getTripById(tripId);
        setTrip(updatedTrip);
      }

      toast({
        title: "Reserva rechazada",
        description: "La reserva ha sido rechazada",
      });
    } catch (error) {
      console.error('Error rejecting reservation:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "No se pudo rechazar la reserva",
        variant: "destructive",
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleCancelReservation = async (reservationId: string) => {
    if (!accessToken) return;

    try {
      setProcessingId(reservationId);
      await cancelReservation(reservationId, accessToken);
      await loadReservations();

      // Recargar el viaje para actualizar asientos disponibles
      if (tripId) {
        const updatedTrip = await getTripById(tripId);
        setTrip(updatedTrip);
      }

      toast({
        title: "Reserva cancelada",
        description: "La reserva ha sido cancelada correctamente",
      });
    } catch (error) {
      console.error('Error canceling reservation:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "No se pudo cancelar la reserva",
        variant: "destructive",
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleDeleteTrip = async () => {
    if (!accessToken || !tripId) return;
    try {
      setIsDeleting(true);
      await cancelTrip(tripId, accessToken);
      toast({
        title: "Viaje eliminado",
        description: "El viaje ha sido cancelado correctamente",
      });
      navigate('/my-trips');
    } catch (error) {
      console.error('Error deleting trip:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "No se pudo eliminar el viaje",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('es-ES', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).replace(/([ap])\. m\./i, '$1.m.');
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
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
      case 'pending': return 'Pendiente';
      case 'blocked': return 'Bloqueado';
      case 'confirmed': return 'Confirmada';
      case 'cancelled': return 'Cancelada';
      default: return status;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'confirmed':
        return <CheckCircle2 className="w-5 h-5 text-green-600" />;
      case 'cancelled':
        return <XCircle className="w-5 h-5 text-red-600" />;
      case 'pending':
      case 'blocked':
        return <AlertCircle className="w-5 h-5 text-amber-600" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400';
      case 'cancelled': return 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400';
      case 'pending':
      case 'blocked': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const confirmedReservations = reservations.filter(r => r.status === 'confirmed');
  const pendingReservations = reservations.filter(r => r.status === 'pending' || r.status === 'blocked');
  const totalSeatsReserved = confirmedReservations.reduce((sum, r) => sum + r.seat_count, 0);
  const canEdit = trip ? (confirmedReservations.length === 0 && trip.status === 'published') : false;

  const handleSaveEdit = async () => {
    if (!accessToken || !trip) return;

    if (!editOriginCoords || !editDestinationCoords) {
      toast({
        title: "Error",
        description: "Debes seleccionar origen y destino",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSaving(true);
      const departureDateTime = new Date(`${editDate}T${editTime}`);

      const updateData: TripUpdate = {
        origin_name: editOrigin,
        destination_name: editDestination,
        origin_coordinates: {
          latitude: editOriginCoords[1],
          longitude: editOriginCoords[0],
        },
        destination_coordinates: {
          latitude: editDestinationCoords[1],
          longitude: editDestinationCoords[0],
        },
        departure_time: departureDateTime.toISOString(),
        total_seats: editSeats,
        description: editDescription || undefined,
      };

      const updatedTrip = await updateTrip(trip.id, updateData, accessToken);
      setTrip(updatedTrip);
      setIsEditing(false);
      toast({
        title: "Viaje actualizado",
        description: "Los cambios se han guardado correctamente",
      });
    } catch (error) {
      console.error('Error updating trip:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "No se pudo actualizar el viaje",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    if (!trip) return;

    // Restaurar valores originales
    const departureDate = new Date(trip.departure_time);
    setEditDate(departureDate.toISOString().split('T')[0]);
    setEditTime(departureDate.toTimeString().slice(0, 5));
    setEditDescription(trip.description || '');
    setEditOrigin(trip.origin_name);
    setEditDestination(trip.destination_name);
    setEditSeats(trip.total_seats);
    setEditOriginCoords([
      trip.origin_coordinates.longitude,
      trip.origin_coordinates.latitude
    ]);
    setEditDestinationCoords([
      trip.destination_coordinates.longitude,
      trip.destination_coordinates.latitude
    ]);
    setEditSelectedStops([]);
    setIsEditing(false);
  };

  const handleRouteConfirmed = (route: any, selectedStops: IntermediateCity[]) => {
    setEditSelectedStops(selectedStops);
  };

  if (isLoadingTrip) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!trip) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background animate-fade-in">
      {/* Header con botón de retroceso */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border animate-fade-in">
        <div className="flex items-center gap-4 p-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              if (isEditing) {
                handleCancelEdit();
              } else {
                navigate('/my-trips');
              }
            }}
            className="rounded-full hover:bg-accent transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-display font-bold text-foreground flex-1">
            {isEditing ? 'Editar Viaje' : 'Gestionar Viaje'}
          </h1>
          {!isEditing && (
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={async () => {
                  if (!tripId) return;
                  const [updatedTrip] = await Promise.all([
                    getTripById(tripId),
                    loadReservations(),
                  ]);
                  setTrip(updatedTrip);
                }}
                disabled={isLoading}
                className="rounded-full hover:bg-accent transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
              {canEdit && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditing(true)}
                  className="gap-2 transition-all duration-200 hover:scale-105 active:scale-95"
                >
                  <Pencil className="w-4 h-4" />
                  Editar
                </Button>
              )}
              {trip?.status !== 'cancelled' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="gap-2 text-red-600 border-red-200 hover:bg-red-50 hover:border-red-400 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-950 transition-all duration-200 hover:scale-105 active:scale-95"
                >
                  <Trash2 className="w-4 h-4" />
                  Eliminar
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Diálogo de confirmación de eliminación */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-card rounded-2xl shadow-xl border border-border p-6 max-w-sm w-full animate-slide-up">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <h2 className="text-lg font-semibold text-foreground">Eliminar viaje</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-1">
              ¿Estás seguro de que quieres eliminar este viaje?
            </p>
            {confirmedReservations.length > 0 && (
              <p className="text-sm text-amber-600 dark:text-amber-400 mb-1">
                Hay {confirmedReservations.length} reserva(s) confirmada(s) que serán canceladas.
              </p>
            )}
            <p className="text-sm text-muted-foreground mb-5">Esta acción no se puede deshacer.</p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
              >
                Cancelar
              </Button>
              <Button
                variant="destructive"
                className="flex-1 gap-2"
                onClick={handleDeleteTrip}
                disabled={isDeleting}
              >
                {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                {isDeleting ? 'Eliminando...' : 'Eliminar'}
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto p-4 pb-20">
        {/* Trip Info / Edit Form */}
        <div className={`bg-card rounded-2xl shadow-lg border border-border mb-4 transition-all duration-300 ${isEditing
          ? 'animate-slide-up'
          : 'animate-fade-in'
          }`}>
          {isEditing ? (
            <div className="p-6 space-y-4 animate-slide-up">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-foreground">Editar viaje</h2>
                {!canEdit && (
                  <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400 animate-fade-in">
                    <AlertCircle className="w-4 h-4" />
                    <span>No se puede editar: hay reservas confirmadas</span>
                  </div>
                )}
              </div>

              {/* Origen y Destino */}
              <MapboxLocationPicker
                value={editOrigin}
                onChange={(location, coords) => {
                  setEditOrigin(location);
                  setEditOriginCoords(coords);
                }}
                placeholder="Origen"
                icon="origin"
              />

              <MapboxLocationPicker
                value={editDestination}
                onChange={(location, coords) => {
                  setEditDestination(location);
                  setEditDestinationCoords(coords);
                }}
                placeholder="Destino"
                icon="destination"
              />

              <RouteMapDisplay
                originCoords={editOriginCoords}
                destinationCoords={editDestinationCoords}
                originName={editOrigin}
                destinationName={editDestination}
                selectedStops={editSelectedStops}
                onStopsChange={setEditSelectedStops}
                onRouteConfirmed={handleRouteConfirmed}
              />

              <div className="flex gap-3">
                <div className="relative flex-1">
                  <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    type="date"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="pl-12"
                    required
                  />
                </div>
                <div className="relative w-28">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    type="time"
                    value={editTime}
                    onChange={(e) => setEditTime(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <div className="relative">
                <Users className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground z-10 pointer-events-none" />
                <select
                  value={editSeats}
                  onChange={(e) => setEditSeats(Number(e.target.value))}
                  className="w-full h-12 pl-12 pr-3 rounded-xl border-2 border-input bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-primary appearance-none cursor-pointer"
                >
                  {vehicle
                    ? Array.from({ length: vehicle.seat_capacity }, (_, i) => i + 1).map((num) => (
                      <option key={num} value={num}>{num}</option>
                    ))
                    : Array.from({ length: 8 }, (_, i) => i + 1).map((num) => (
                      <option key={num} value={num}>{num}</option>
                    ))
                  }
                </select>
                {vehicle && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Capacidad máxima del vehículo: {vehicle.seat_capacity} asientos
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Descripción (opcional)</label>
                <Textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Describe tu viaje, preferencias, puntos de encuentro, etc."
                  className="min-h-[80px]"
                  maxLength={500}
                />
                <p className="text-xs text-muted-foreground text-right">
                  {editDescription.length}/500
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  className="flex-1 transition-all duration-200 hover:scale-105 active:scale-95"
                  onClick={handleCancelEdit}
                  disabled={isSaving}
                >
                  Cancelar
                </Button>
                <Button
                  className="flex-1 transition-all duration-200 hover:scale-105 active:scale-95"
                  onClick={handleSaveEdit}
                  disabled={isSaving || !canEdit || !editOriginCoords || !editDestinationCoords}
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Guardar cambios
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <div className="p-6 space-y-4 animate-fade-in">
              {/* Origen y Destino con horas */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
                      <MapPin className="w-3.5 h-3.5 text-white" />
                    </div>
                    <span className="font-medium text-foreground text-sm truncate">{trip.origin_name}</span>
                  </div>
                  <span className="text-sm text-muted-foreground flex-shrink-0 tabular-nums font-medium">{formatTime(trip.departure_time)}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0">
                      <MapPin className="w-3.5 h-3.5 text-white" />
                    </div>
                    <span className="font-medium text-foreground text-sm truncate">{trip.destination_name}</span>
                  </div>
                  {(() => {
                    const dur = trip.route_duration_min ?? liveRouteDuration;
                    const arrTime = trip.arrival_time || (dur ? new Date(new Date(trip.departure_time).getTime() + dur * 60000).toISOString() : null);
                    return arrTime ? <span className="text-sm text-muted-foreground flex-shrink-0 tabular-nums">~{formatTime(arrTime)}</span> : null;
                  })()}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 pt-4 border-t border-border">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Fecha</p>
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-primary" />
                    <span className="font-medium text-sm">{formatDate(trip.departure_time)}</span>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Hora salida</p>
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-primary" />
                    <span className="font-medium text-sm">{formatTime(trip.departure_time)}</span>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Asientos</p>
                  <div className="flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-primary" />
                    <span className="font-medium text-sm">
                      {totalSeatsReserved}/{trip.total_seats}
                    </span>
                  </div>
                </div>
              </div>

              {trip.description && (
                <div className="pt-4 border-t border-border">
                  <p className="text-xs text-muted-foreground mb-1">Descripción</p>
                  <p className="text-sm text-foreground">{trip.description}</p>
                </div>
              )}

              {(() => {
                const dur = trip.route_duration_min ?? liveRouteDuration;
                const dist = trip.route_distance_km ?? liveRouteDistance;
                if (!dur && !dist) return null;
                return (
                  <div className="pt-4 border-t border-border flex items-center gap-3 flex-wrap">
                    {dur && (
                      <div className="flex items-center gap-1.5">
                        <Timer className="w-4 h-4 text-primary" />
                        <span className="text-sm font-medium">~{formatDuration(dur)}</span>
                      </div>
                    )}
                    {dist && (
                      <div className="flex items-center gap-1.5">
                        <Navigation className="w-4 h-4 text-primary" />
                        <span className="text-sm font-medium">{dist.toFixed(1)} km</span>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}
        </div>

        {!isEditing && (
          <div className={`bg-card rounded-2xl shadow-lg border border-border p-6 transition-all duration-300 ${isLoading ? 'animate-fade-in' : 'animate-slide-up'
            }`}>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : reservations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 animate-fade-in">
                <Users className="w-16 h-16 text-muted-foreground mb-4" />
                <p className="text-muted-foreground text-center">
                  Aún no hay reservas para este viaje
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingReservations.length > 0 && (
                  <div className="animate-slide-up">
                    <h3 className="text-lg font-semibold text-foreground mb-3">Reservas pendientes</h3>
                    <div className="space-y-3">
                      {pendingReservations.map((reservation, index) => (
                        <div
                          key={reservation.id}
                          className="animate-slide-up"
                          style={{ animationDelay: `${index * 50}ms` }}
                        >
                          <ReservationCard
                            reservation={reservation}
                            onApprove={() => handleApprove(reservation.id)}
                            onReject={() => handleReject(reservation.id)}
                            isProcessing={processingId === reservation.id}
                            getStatusIcon={getStatusIcon}
                            getStatusColor={getStatusColor}
                            getStatusLabel={getStatusLabel}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {confirmedReservations.length > 0 && (
                  <div className="animate-slide-up">
                    <h3 className="text-lg font-semibold text-foreground mb-3">Reservas confirmadas</h3>
                    <div className="space-y-3">
                      {confirmedReservations.map((reservation, index) => (
                        <div
                          key={reservation.id}
                          className="animate-slide-up"
                          style={{ animationDelay: `${(pendingReservations.length + index) * 50}ms` }}
                        >
                          <ReservationCard
                            reservation={reservation}
                            onCancel={() => handleCancelReservation(reservation.id)}
                            isProcessing={processingId === reservation.id}
                            getStatusIcon={getStatusIcon}
                            getStatusColor={getStatusColor}
                            getStatusLabel={getStatusLabel}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {reservations.filter(r => r.status === 'cancelled').length > 0 && (
                  <div className="animate-slide-up">
                    <h3 className="text-lg font-semibold text-foreground mb-3">Reservas canceladas</h3>
                    <div className="space-y-3">
                      {reservations.filter(r => r.status === 'cancelled').map((reservation, index) => (
                        <div
                          key={reservation.id}
                          className="animate-slide-up"
                          style={{ animationDelay: `${(pendingReservations.length + confirmedReservations.length + index) * 50}ms` }}
                        >
                          <ReservationCard
                            reservation={reservation}
                            onCancel={() => handleCancelReservation(reservation.id)}
                            isProcessing={processingId === reservation.id}
                            getStatusIcon={getStatusIcon}
                            getStatusColor={getStatusColor}
                            getStatusLabel={getStatusLabel}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

interface ReservationCardProps {
  reservation: ReservationDetailResponse;
  onApprove?: () => void;
  onReject?: () => void;
  onCancel?: () => void;
  isProcessing?: boolean;
  getStatusIcon: (status: string) => React.ReactNode;
  getStatusColor: (status: string) => string;
  getStatusLabel: (status: string) => string;
}

const ReservationCard: React.FC<ReservationCardProps> = ({
  reservation,
  onApprove,
  onReject,
  onCancel,
  isProcessing,
  getStatusIcon,
  getStatusColor,
  getStatusLabel,
}) => {
  const { accessToken } = useAuth();
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const { data: passengerProfile } = useUserProfile(
    reservation.passenger_id,
    isPopupOpen && !!accessToken
  );

  const passengerUser: UserType | null = passengerProfile
    ? convertProfileToUser(passengerProfile, '', undefined)
    : null;

  return (
    <div className="bg-background rounded-xl p-4 shadow-md border border-border hover:shadow-lg transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3 flex-1">
          <UserProfilePopup
            user={passengerUser}
            open={isPopupOpen}
            onOpenChange={setIsPopupOpen}
            side="right"
            align="start"
            trigger={
              <button
                onClick={() => setIsPopupOpen(true)}
                className="w-12 h-12 rounded-full bg-primary-light flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity"
              >
                <User className="w-6 h-6 text-primary" />
              </button>
            }
          />
          <div className="flex-1">
            <p className="font-medium text-foreground">
              {reservation.passenger_name || passengerUser?.full_name || 'Pasajero'}
            </p>
            <p className="text-sm text-muted-foreground">
              {reservation.seat_count} asiento{reservation.seat_count !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {getStatusIcon(reservation.status)}
          <span className={`text-xs px-3 py-1 rounded-full font-medium ${getStatusColor(reservation.status)}`}>
            {getStatusLabel(reservation.status)}
          </span>
        </div>
      </div>

      {reservation.confirmation_code && (
        <p className="text-xs text-muted-foreground mb-3">
          Código: {reservation.confirmation_code}
        </p>
      )}

      {(reservation.status === 'pending' || reservation.status === 'blocked') && onApprove && onReject && (
        <div className="flex gap-2 pt-3 border-t border-border">
          <Button
            size="sm"
            variant="outline"
            onClick={onReject}
            disabled={isProcessing}
            className="flex-1 text-destructive hover:text-destructive hover:bg-destructive/10 transition-all duration-200 hover:scale-105 active:scale-95"
          >
            {isProcessing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <XCircle className="w-4 h-4 mr-2" />
                Rechazar
              </>
            )}
          </Button>
          <Button
            size="sm"
            onClick={onApprove}
            disabled={isProcessing}
            className="flex-1 transition-all duration-200 hover:scale-105 active:scale-95"
          >
            {isProcessing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Aprobar
              </>
            )}
          </Button>
        </div>
      )}

      {reservation.status === 'confirmed' && onCancel && (
        <div className="pt-3 border-t border-border">
          <Button
            size="sm"
            variant="outline"
            onClick={onCancel}
            disabled={isProcessing}
            className="w-full text-destructive hover:text-destructive hover:bg-destructive/10 transition-all duration-200 hover:scale-105 active:scale-95"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Cancelando...
              </>
            ) : (
              <>
                <XCircle className="w-4 h-4 mr-2" />
                Cancelar reserva
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
};

export default ManageTrip;
