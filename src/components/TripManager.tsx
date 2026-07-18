import React, { useState, useEffect } from 'react';
import { X, Users, MapPin, Clock, Calendar, CheckCircle2, XCircle, AlertCircle, Loader2, User, Pencil, Save, Baby } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { TripResponse, updateTrip, TripUpdate } from '@/services/trips';
import MapboxLocationPicker from '@/components/MapboxLocationPicker';
import RouteMapDisplay from '@/components/RouteMapDisplay';

interface IntermediateCity {
  name: string;
  coordinates: [number, number];
  distance: number;
}
import { ReservationResponse, getReservationsByTrip, approveReservation, rejectReservation } from '@/services/reservations';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useUserProfile, convertProfileToUser } from '@/hooks/use-user-profile-cache';
import { UserProfilePopup } from './UserProfilePopup';
import { User as UserType } from '@/types';

interface TripManagerProps {
  trip: TripResponse;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void;
  onTripUpdated?: (updatedTrip: TripResponse) => void;
}

export const TripManager: React.FC<TripManagerProps> = ({ trip, isOpen, onClose, onUpdate, onTripUpdated }) => {
  const { accessToken } = useAuth();
  const { toast } = useToast();
  const [reservations, setReservations] = useState<ReservationResponse[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [currentTrip, setCurrentTrip] = useState<TripResponse>(trip);
  
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

  // Actualizar trip local cuando cambia el prop
  useEffect(() => {
    setCurrentTrip(trip);
  }, [trip]);

  useEffect(() => {
    if (isOpen && accessToken) {
      loadReservations();
      // Inicializar valores de edición
      const departureDate = new Date(currentTrip.departure_time);
      setEditDate(departureDate.toISOString().split('T')[0]);
      setEditTime(departureDate.toTimeString().slice(0, 5));
      setEditDescription(currentTrip.description || '');
      setEditOrigin(currentTrip.origin_name);
      setEditDestination(currentTrip.destination_name);
      setEditSeats(currentTrip.total_seats);
      setEditOriginCoords([
        currentTrip.origin_coordinates.longitude,
        currentTrip.origin_coordinates.latitude
      ]);
      setEditDestinationCoords([
        currentTrip.destination_coordinates.longitude,
        currentTrip.destination_coordinates.latitude
      ]);
      setEditSelectedStops([]); // TODO: Cargar stops si están disponibles
    }
  }, [isOpen, currentTrip, accessToken]);

  const loadReservations = async () => {
    if (!accessToken) return;
    
    try {
      setIsLoading(true);
      const data = await getReservationsByTrip(trip.id);
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
      await approveReservation(reservationId);
      await loadReservations();
      onUpdate();
      toast({
        title: "Reserva aprobada",
        description: "La reserva ha sido aprobada correctamente",
      });
    } catch (error) {
      console.error('Error approving reservation:', error);
      toast({
        title: "Error",
        description: "No se pudo aprobar la reserva",
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
      await rejectReservation(reservationId);
      await loadReservations();
      onUpdate();
      toast({
        title: "Reserva rechazada",
        description: "La reserva ha sido rechazada",
      });
    } catch (error) {
      console.error('Error rejecting reservation:', error);
      toast({
        title: "Error",
        description: "No se pudo rechazar la reserva",
        variant: "destructive",
      });
    } finally {
      setProcessingId(null);
    }
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('es-ES', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', { 
      day: 'numeric', 
      month: 'short',
      year: 'numeric'
    });
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
  const canEdit = confirmedReservations.length === 0 && currentTrip.status === 'published';

  const handleSaveEdit = async () => {
    if (!accessToken) return;

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

      const updatedTrip = await updateTrip(currentTrip.id, updateData);
      setCurrentTrip(updatedTrip);
      setIsEditing(false);
      if (onTripUpdated) {
        onTripUpdated(updatedTrip);
      }
      onUpdate();
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
    // Restaurar valores originales
    const departureDate = new Date(currentTrip.departure_time);
    setEditDate(departureDate.toISOString().split('T')[0]);
    setEditTime(departureDate.toTimeString().slice(0, 5));
    setEditDescription(currentTrip.description || '');
    setEditOrigin(currentTrip.origin_name);
    setEditDestination(currentTrip.destination_name);
    setEditSeats(currentTrip.total_seats);
    setEditOriginCoords([
      currentTrip.origin_coordinates.longitude,
      currentTrip.origin_coordinates.latitude
    ]);
    setEditDestinationCoords([
      currentTrip.destination_coordinates.longitude,
      currentTrip.destination_coordinates.latitude
    ]);
    setEditSelectedStops([]);
    setIsEditing(false);
  };

  const handleRouteConfirmed = (route: any, selectedStops: IntermediateCity[]) => {
    setEditSelectedStops(selectedStops);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-2xl h-[90vh] sm:h-[85vh] bg-background rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col animate-in slide-in-from-bottom sm:slide-in-from-bottom-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border flex-shrink-0">
          <h2 className="text-xl font-display font-bold text-foreground">Gestionar Viaje</h2>
          <div className="flex items-center gap-2">
            {canEdit && !isEditing && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(true)}
                className="gap-2"
              >
                <Pencil className="w-4 h-4" />
                Editar
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="rounded-full"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Trip Info / Edit Form */}
        <div className={`bg-card border-b border-border ${isEditing ? 'flex-1 overflow-y-auto min-h-0' : 'flex-shrink-0'}`}>
          {isEditing ? (
            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-foreground">Editar viaje</h3>
                {!canEdit && (
                  <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
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
                <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <select
                  value={editSeats}
                  onChange={(e) => setEditSeats(Number(e.target.value))}
                  className="w-full h-12 pl-10 pr-3 rounded-xl border-2 border-input bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-primary appearance-none cursor-pointer"
                >
                  {Array.from({ length: 8 }, (_, i) => i + 1).map((num) => (
                    <option key={num} value={num}>{num}</option>
                  ))}
                </select>
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
                  className="flex-1"
                  onClick={handleCancelEdit}
                  disabled={isSaving}
                >
                  Cancelar
                </Button>
                <Button
                  className="flex-1"
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
            <div className="p-4 space-y-3">
              {/* Origen y Destino - Solo una vez, compacto */}
              <div className="flex items-center gap-2 text-sm">
                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-3.5 h-3.5 text-primary" />
                </div>
                <span className="font-medium text-foreground truncate">{currentTrip.origin_name}</span>
                <span className="text-muted-foreground">→</span>
                <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
                <span className="font-medium text-foreground truncate">{currentTrip.destination_name}</span>
              </div>

              <div className="grid grid-cols-3 gap-3 pt-2 border-t border-border">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Fecha</p>
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-primary" />
                    <span className="font-medium text-xs">{formatDate(currentTrip.departure_time)}</span>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Hora</p>
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-primary" />
                    <span className="font-medium text-xs">{formatTime(currentTrip.departure_time)}</span>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Asientos</p>
                  <div className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-primary" />
                    <span className="font-medium text-xs">
                      {totalSeatsReserved}/{currentTrip.total_seats}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Reservations List */}
        {!isEditing && (
        <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : reservations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Users className="w-16 h-16 text-muted-foreground mb-4" />
              <p className="text-muted-foreground text-center">
                Aún no hay reservas para este viaje
              </p>
            </div>
          ) : (
            <>
              {pendingReservations.length > 0 && (
                <div>
                  <h3 className="text-base font-semibold text-foreground mb-2">Reservas pendientes</h3>
                  <div className="space-y-2">
                    {pendingReservations.map((reservation) => (
                      <ReservationCard
                        key={reservation.id}
                        reservation={reservation}
                        onApprove={() => handleApprove(reservation.id)}
                        onReject={() => handleReject(reservation.id)}
                        isProcessing={processingId === reservation.id}
                        getStatusIcon={getStatusIcon}
                        getStatusColor={getStatusColor}
                        getStatusLabel={getStatusLabel}
                      />
                    ))}
                  </div>
                </div>
              )}

              {confirmedReservations.length > 0 && (
                <div>
                  <h3 className="text-base font-semibold text-foreground mb-2">Reservas confirmadas</h3>
                  <div className="space-y-2">
                    {confirmedReservations.map((reservation) => (
                      <ReservationCard
                        key={reservation.id}
                        reservation={reservation}
                        getStatusIcon={getStatusIcon}
                        getStatusColor={getStatusColor}
                        getStatusLabel={getStatusLabel}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
        )}
      </div>
    </div>
  );
};

interface ReservationCardProps {
  reservation: ReservationResponse;
  onApprove?: () => void;
  onReject?: () => void;
  isProcessing?: boolean;
  getStatusIcon: (status: string) => React.ReactNode;
  getStatusColor: (status: string) => string;
  getStatusLabel: (status: string) => string;
}

const ReservationCard: React.FC<ReservationCardProps> = ({
  reservation,
  onApprove,
  onReject,
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
    <div className="bg-card rounded-2xl p-4 shadow-md border border-border hover:shadow-lg transition-shadow">
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
              {passengerUser?.full_name || 'Pasajero'}
            </p>
            <p className="text-sm text-muted-foreground">
              {reservation.seat_count} asiento{reservation.seat_count !== 1 ? 's' : ''}
            </p>
            {Number(reservation.children_count) > 0 && (
              <p className="text-sm text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <Baby className="w-3.5 h-3.5" />
                Viaja con {reservation.children_count} niño{reservation.children_count !== 1 ? 's' : ''}
              </p>
            )}
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
            className="flex-1 text-destructive hover:text-destructive hover:bg-destructive/10"
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
            className="flex-1"
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
    </div>
  );
};
