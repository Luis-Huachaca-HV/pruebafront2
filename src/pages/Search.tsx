//SEARCH IMPORTANTE 
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Calendar, Clock, Users, Star, MessageCircle, MapPin, Loader2,
  Timer, X, Minus, Plus, ArrowRight, Flame, XCircle,
  ChevronLeft,
  Filter,
  ArrowDown,
  Send,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/use-toast';
import { getPublishedTrips, TripResponse } from '@/services/trips';
import { createConversation } from '@/services/chat';
import { UserProfilePopup } from '../components/UserProfilePopup';
import { useUserProfile, convertProfileToUser } from '../hooks/use-user-profile-cache';
import { User } from '../types';
import { getActiveAds, PublicAd } from '@/services/ads';
import MapboxLocationPicker from '../components/MapboxLocationPicker';
import AddressAutocomplete from '../components/AddressAutocomplete';
//import { toast } from "sonner";

// ── Types ──────────────────────────────────────────────────────────────────────

interface TripWithDriver extends TripResponse {
  driver?: {
    id: string;
    name: string;
    email: string;
    rating: number;
    tripsCompleted: number;
    avatarUrl?: string;
  };
}

interface LocationState {
  origin?: string | LocationValue;
  destination?: string | LocationValue;
  date?: string;
  time?: string;
  seats?: number;
  returnTrip?: any;
}

type SortKey = 'date_asc' | 'latest' | 'cheapest' | 'most_expensive' | 'shortest';

interface LocationValue {
  display: string;
  coords?: [number, number]; // [lng, lat]
}

const TIME_TOLERANCE_OPTIONS = [
  { value: 15, label: '±15 min' },
  { value: 30, label: '±30 min' },
  { value: 60, label: '±1 hora' },
  { value: 120, label: '±2 horas' },
];

//  -* temporalmente aquí, luego lo movemos a un archivo aparte *-
interface Props {
  onSearch: (data: {
    origin: string;
    destination: string;
    date: string;
    time: string;
    seats: number;
  }) => void;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatTime(dateString: string) {
  return new Date(dateString).toLocaleTimeString('es-ES', { hour: 'numeric', minute: '2-digit', hour12: true }).replace(/([ap])\. m\./i, '$1.m.');
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

function formatDuration(minutes: number) {
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

function formatDepartsIn(dateString: string): string | null {
  const diff = new Date(dateString).getTime() - Date.now();
  if (diff <= 0) return null;
  const totalMins = Math.floor(diff / 60_000);
  if (totalMins < 60) return `Sale en ${totalMins} min`;
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  return m > 0 ? `Sale en ${h}h ${m}min` : `Sale en ${h}h`;
}

// ── LocationSearchInput ────────────────────────────────────────────────────────
const LocationSearchInput: React.FC<{
  value: LocationValue;
  onChange: (val: LocationValue) => void;
  placeholder: string;
  variant: 'origin' | 'destination';
}> = ({ value, onChange, placeholder, variant }) => {
  const [mapOpen, setMapOpen] = useState(false);

  return (
    <div className="flex items-center gap-3 py-0.5">
      {/* Autocomplete con Mapbox Geocoding */}
      <AddressAutocomplete
        value={value.display}
        onChange={(val) => onChange({ display: val.display, coords: val.coords })}
        placeholder={placeholder}
        className="flex-1 min-w-0"
        inputClassName="bg-transparent text-sm text-foreground placeholder:text-muted-foreground w-full"
      />

      {/* Botón mapa: abre selector visual de coordenadas (búsqueda precisa opcional) */}
      <button
        onClick={() => setMapOpen(true)}
        className={`flex-shrink-0 transition-opacity hover:opacity-60 ${variant === 'origin' ? 'text-emerald-500' : 'text-red-500'
          }`}
        title="Seleccionar en mapa"
      >
        <MapPin className="w-4 h-4 text-[#EA580C]" />
      </button>

      {/* Modal del mapa — solo se monta cuando el usuario lo abre */}
      {mapOpen && (
        <MapboxLocationPicker
          defaultOpen
          hideTrigger
          value={value.display}
          initialCoordinates={value.coords}
          placeholder={placeholder}
          icon={variant}
          onClose={() => setMapOpen(false)}
          onChange={(loc, coords) => {
            onChange({ display: loc, coords });
            setMapOpen(false);
          }}
        />
      )}
    </div>
  );
};

// ── TripCard ───────────────────────────────────────────────────────────────────

const TripCard: React.FC<{
  trip: TripWithDriver;
  onSelect: () => void;
  onContactDriver: (e: React.MouseEvent) => void;
  isContacting: boolean;
  popupDriverId: string | null;
  setPopupDriverId: (id: string | null) => void;
  accessToken: string | null;
  currentUserId?: string | null;
  seatFlash?: 'down' | 'up';
  dismissReason?: 'cancelled' | 'full';
  isFading?: boolean;
}> = ({ trip, onSelect, onContactDriver, isContacting, popupDriverId, setPopupDriverId, accessToken, currentUserId, seatFlash, dismissReason, isFading }) => {
  const isPopupOpen = popupDriverId === trip.driver_id;
  const driverId = trip.driver_id;

  // Obtener perfil del conductor con caché
  const { data: driverProfileData } = useUserProfile(
    driverId,
    isPopupOpen && !!driverId && !!accessToken
  );
  const departsIn = formatDepartsIn(trip.departure_time);

  const driverProfile: User | null = useMemo(() => {
    if (!driverId) return null;
    if (driverProfileData) return convertProfileToUser(driverProfileData, trip.driver?.name, undefined);
    return {
      id: driverId,
      full_name: trip.driver?.name || 'Conductor',
      email: trip.driver?.email || '',
      avatar: undefined,
      description: undefined,
      rating: trip.driver?.rating || 4.5,
      tripsCompleted: trip.driver?.tripsCompleted || 0,
      is_driver: true,
      user_role: 'driver_verified' as const,
      total_trips_as_driver: undefined,
      total_trips_as_passenger: undefined,
    };
  }, [driverProfileData, trip, driverId]);

  return (
    <div
      onClick={dismissReason ? undefined : onSelect}
      className={`relative bg-card rounded-2xl p-5 shadow-md border border-border/50 cursor-pointer
        transition-all ease-in-out
        ${isFading
          ? 'opacity-0 scale-[0.96] -translate-y-2 duration-700 pointer-events-none'
          : 'opacity-100 scale-100 translate-y-0 duration-200 hover:shadow-lg active:scale-[0.99]'}
        ${dismissReason ? 'pointer-events-none' : ''}`}
    >
      {/* Dismiss overlay — siempre en DOM para transición suave */}
      <div className={`absolute inset-0 rounded-2xl flex flex-col items-center justify-center gap-2.5
        backdrop-blur-[3px] pointer-events-none transition-opacity duration-300 z-10
        ${dismissReason === 'cancelled' ? 'bg-rose-50/90' : dismissReason === 'full' ? 'bg-amber-50/90' : ''}
        ${dismissReason ? 'opacity-100' : 'opacity-0'}`}>
        {dismissReason === 'cancelled' && (
          <>
            <XCircle className="w-9 h-9 text-rose-400" strokeWidth={1.5} />
            <p className="text-sm font-semibold tracking-wide text-rose-500">Viaje cancelado</p>
          </>
        )}
        {dismissReason === 'full' && (
          <>
            <Users className="w-9 h-9 text-amber-400" strokeWidth={1.5} />
            <p className="text-sm font-semibold tracking-wide text-amber-600">Viaje lleno</p>
          </>
        )}
      </div>

      {/* Fecha / Badge diferencia + Sale en */}
      <div className="flex items-center justify-between mb-3 gap-2">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <span className="text-sm font-medium text-muted-foreground">{formatDate(trip.departure_time)}</span>
          {trip.time_diff_minutes != null && (
            <span className="flex items-center gap-1 bg-primary/10 text-primary px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap">
              <Clock className="w-3 h-3" />
              +{formatDuration(trip.time_diff_minutes)} dif.
            </span>
          )}
        </div>
        {departsIn && (
          <span className="text-xs text-emerald-600 font-medium bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-400 px-2.5 py-1 rounded-full whitespace-nowrap flex-shrink-0">
            {departsIn}
          </span>
        )}
      </div>

      {/* Línea de ruta */}
      <div className="flex items-center gap-3 mb-3">
        <div className="flex flex-col items-center gap-0.5 flex-shrink-0">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
          <div className="w-px h-5 bg-border" />
          <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
        </div>
        <div className="flex flex-col gap-1.5 min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium text-foreground text-sm leading-tight truncate">{trip.origin_name}</span>
            <span className="text-xs text-muted-foreground flex-shrink-0 tabular-nums font-medium">{formatTime(trip.departure_time)}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium text-foreground text-sm leading-tight truncate">{trip.destination_name}</span>
            {(() => {
              const dur = trip.route_duration_min;
              const arrTime = trip.arrival_time || (dur ? new Date(new Date(trip.departure_time).getTime() + dur * 60000).toISOString() : null);
              return arrTime ? <span className="text-xs text-muted-foreground flex-shrink-0 tabular-nums">~{formatTime(arrTime)}</span> : null;
            })()}
          </div>
        </div>
      </div>

      {/* Chips de meta-info */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        {trip.available_seats === 1 ? (
          <span className={`inline-flex items-center gap-1 text-xs bg-amber-500/15 text-amber-600 dark:text-amber-400 px-2.5 py-1 rounded-full font-semibold transition-all duration-300 ${seatFlash === 'down' ? 'scale-110 bg-red-100 text-red-700' : ''}`}>
            <Flame className="w-3 h-3" />
            <span>¡Últimos asientos! ({trip.available_seats}/{trip.total_seats})</span>
          </span>
        ) : (
          <span className={`inline-flex items-center gap-1 text-xs bg-secondary text-secondary-foreground px-2.5 py-1 rounded-full transition-all duration-300 ${seatFlash === 'down' ? 'bg-red-100 text-red-700 scale-110' : ''}`}>
            <Users className="w-3 h-3" />
            {trip.available_seats} lugares
          </span>
        )}
        {trip.route_duration_min != null && (
          <span className="inline-flex items-center gap-1 text-xs bg-secondary text-secondary-foreground px-2.5 py-1 rounded-full">
            <Timer className="w-3 h-3" />
            {formatDuration(trip.route_duration_min)}
          </span>
        )}
        {trip.route_distance_km != null && (
          <span className="text-xs bg-secondary text-secondary-foreground px-2.5 py-1 rounded-full">
            {trip.route_distance_km.toFixed(0)} km
          </span>
        )}
      </div>

      {/* Conductor + CTA */}
      <div className="flex items-center justify-between pt-3 border-t border-border">
        <div className="flex items-center gap-2.5">
          <UserProfilePopup
            user={driverProfile}
            open={isPopupOpen}
            onOpenChange={(open) => setPopupDriverId(open ? driverId : null)}
            side="right"
            align="start"
            trigger={
              <div
                className="w-9 h-9 bg-primary/10 rounded-full flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity flex-shrink-0"
                onClick={(e) => { e.stopPropagation(); setPopupDriverId(isPopupOpen ? null : driverId); }}
              >
                <span className="text-sm font-semibold text-primary">
                  {trip.driver?.name?.charAt(0) || 'C'}
                </span>
              </div>
            }
          />
          <div>
            <p className="text-sm font-medium text-foreground leading-tight">{trip.driver?.name || 'Conductor'}</p>
            <div className="flex items-center gap-1 mt-0.5">
              <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
              <span className="text-xs text-muted-foreground">{trip.driver?.rating || 4.5}</span>
              <span className="text-xs text-muted-foreground">· {trip.driver?.tripsCompleted || 0} viajes</span>
            </div>
          </div>
        </div>

        {currentUserId !== trip.driver_id && (
          <Button
            //size="sm"
            onClick={(e) => { e.stopPropagation(); onContactDriver(e); }}
            disabled={isContacting}
            className="rounded-full p-2"
            title="Contactar"
          >
            {isContacting
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <MessageCircle className="w-4 h-4" />
            }
          </Button>
        )}
      </div>
    </div>
  );
};

// Ordenación: criterios por grupos (solo uno por grupo para ser consistente)
const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'date_asc', label: 'Fecha (próximo)' },
  { value: 'latest', label: 'Fecha (lejano)' },
  { value: 'cheapest', label: 'Precio (menor)' },
  { value: 'most_expensive', label: 'Precio (mayor)' },
  { value: 'shortest', label: 'Duración (corta)' },
];

const SORT_GROUP: Record<SortKey, string> = {
  date_asc: 'fecha',
  latest: 'fecha',
  cheapest: 'precio',
  most_expensive: 'precio',
  shortest: 'duracion',
};

// Máximo asientos según backend (total_seats / seat_capacity le=8)
const MIN_SEATS_MAX = 8;

const PAGE_SIZE = 20;

function compareBy(a: TripWithDriver, b: TripWithDriver, key: SortKey): number {
  switch (key) {
    case 'date_asc':
      return new Date(a.departure_time).getTime() - new Date(b.departure_time).getTime();
    case 'latest':
      return new Date(b.departure_time).getTime() - new Date(a.departure_time).getTime();
    case 'cheapest':
      return (a.price_per_seat ?? 0) - (b.price_per_seat ?? 0);
    case 'most_expensive':
      return (b.price_per_seat ?? 0) - (a.price_per_seat ?? 0);
    case 'shortest':
      return (a.route_duration_min ?? 9999) - (b.route_duration_min ?? 9999);
    default:
      return 0;
  }
}

// ── Main Search Page ───────────────────────────────────────────────────────────
const Search: React.FC = () => {
  // Ubicación (texto + coords opcionales)
  const [origin, setOrigin] = useState<LocationValue>({ display: '' });
  const [destination, setDestination] = useState<LocationValue>({ display: '' });

  // Fecha / hora
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [seats, setSeats] = useState(1);

  // Filtros inline (asientos, próximos 24h, tolerancia horaria)
  const [minSeats, setMinSeats] = useState(1);
  const [timeTolerance, setTimeTolerance] = useState(60);
  const [nextDepartureOnly, setNextDepartureOnly] = useState(false);

  // Ordenamiento: varios criterios combinables (orden de la lista = prioridad)
  const [sortBy, setSortBy] = useState<SortKey[]>([]);

  // Datos
  const [allTrips, setAllTrips] = useState<TripWithDriver[]>([]);
  const [filteredTrips, setFilteredTrips] = useState<TripWithDriver[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [hasSearched, setHasSearched] = useState(false);
  const [resultsKey, setResultsKey] = useState(0);

  const lastSearchParamsRef = useRef<{
    originLat?: number; originLng?: number; destinationLat?: number; destinationLng?: number;
    originName?: string; destinationName?: string; minSeats?: number;
    departureTime?: string; timeTolerance?: number;
  } | null>(null);
  const loadMoreSentinelRef = useRef<HTMLDivElement>(null);
  const resultsSectionRef = useRef<HTMLDivElement>(null);

  // UI
  const [isContactingDriver, setIsContactingDriver] = useState<string | null>(null);
  const [popupDriverId, setPopupDriverId] = useState<string | null>(null);

  // Anuncios
  const [activeAds, setActiveAds] = useState<PublicAd[]>([]);
  const [currentAdIndex, setCurrentAdIndex] = useState(0);
  const [isReturnTrip, setIsReturnTrip] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const { accessToken, user } = useAuth();
  const { toast } = useToast();
  const backendBaseUrl = useMemo(() => '', []);

  // ── Carga de datos (backend → RPC search_published_trips) ─────────────────────

  const loadTrips = useCallback(async (opts: {
    page?: number;
    append?: boolean;
    params?: {
      originLat?: number; originLng?: number; destinationLat?: number; destinationLng?: number;
      originName?: string; destinationName?: string; minSeats?: number;
      departureTime?: string; timeTolerance?: number;
    };
  } = {}) => {
    const { page: pageNum = 1, append = false, params } = opts;
    const searchParams = { ...params, minSeats: params?.minSeats ?? 1 };
    if (!append) {
      setResultsKey(k => k + 1);
      lastSearchParamsRef.current = searchParams;
      setPage(1);
      setIsLoading(true);
    } else {
      setIsLoadingMore(true);
    }
    try {
      const trips = await getPublishedTrips(pageNum, PAGE_SIZE, searchParams);
      const tripsWithDriver: TripWithDriver[] = trips.map(trip => ({
        ...trip,
        driver: {
          id: trip.driver_id,
          name: trip.driver_name?.trim() || 'Conductor',
          email: '',
          rating: trip.driver_rating ?? 0,
          tripsCompleted: trip.driver_trips_completed ?? 0,
          avatarUrl: trip.driver_avatar_url || undefined,
        },
      }));
      setHasMore(trips.length >= PAGE_SIZE);
      if (append) {
        setAllTrips(prev => {
          const existingIds = new Set(prev.map(t => t.id));
          const toAdd = tripsWithDriver.filter(t => !existingIds.has(t.id));
          return toAdd.length ? [...prev, ...toAdd] : prev;
        });
        setFilteredTrips(prev => {
          const existingIds = new Set(prev.map(t => t.id));
          const toAdd = tripsWithDriver.filter(t => !existingIds.has(t.id));
          return toAdd.length ? [...prev, ...toAdd] : prev;
        });
        setPage(p => p + 1);
      } else {
        setAllTrips(tripsWithDriver);
        setFilteredTrips(tripsWithDriver);
        setPage(2);
      }
    } catch (error) {
      console.error('[Search] Error:', error);
      if (!append) {
        toast({ title: 'Error', description: 'No se pudieron cargar los viajes disponibles', variant: 'destructive' });
        setAllTrips([]);
        setFilteredTrips([]);
      }
      setHasMore(false);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [toast]);

  const loadMore = useCallback(() => {
    if (isLoadingMore || !hasMore || !lastSearchParamsRef.current) return;
    loadTrips({ page, append: true, params: lastSearchParamsRef.current });
  }, [loadTrips, page, hasMore, isLoadingMore]);

  // Cargar anuncios
  useEffect(() => {
    const fetchAds = async () => {
      try {
        const ads = await getActiveAds();
        setActiveAds(ads);
      } catch (e) {
        console.error("Error fetching ads", e);
      }
    };
    fetchAds();
  }, []);

  // Efecto carrusel simple para anuncios
  useEffect(() => {
    if (activeAds.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentAdIndex(prev => (prev + 1) % activeAds.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [activeAds.length]);

  // Filtrar viajes por fecha exacta (solo cuando no hay hora especificada)
  const applyDateOnlyFilter = useCallback((trips: TripWithDriver[]) => {
    if (!date) return trips;
    return trips.filter(trip => {
      const d = new Date(trip.departure_time);
      const tripLocalDate = [
        d.getFullYear(),
        String(d.getMonth() + 1).padStart(2, '0'),
        String(d.getDate()).padStart(2, '0'),
      ].join('-');
      return tripLocalDate === date;
    });
  }, [date]);

  // Pre-llenar búsqueda (desde viaje de ida o desde la SearchBar del Home)
  useEffect(() => {
    const state = location.state as LocationState | null;

    if (!state) {
      // No navigation state: load all published trips on initial visit
      loadTrips({ page: 1, append: false });
      return;
    }

    // Clear location.state so this effect doesn't re-run
    window.history.replaceState({ ...window.history.state, usr: {} }, '');

    // ESCENARIO A: viaje de regreso
    if (state.returnTrip) {
      const { originName, originCoords, destinationName, destinationCoords, date: returnDate } = state.returnTrip;
      setOrigin({ display: originName, coords: originCoords });
      setDestination({ display: destinationName, coords: destinationCoords });
      setDate(returnDate);
      setIsReturnTrip(true);

      loadTrips({
        page: 1,
        append: false,
        params: {
          originLat: originCoords[1],
          originLng: originCoords[0],
          destinationLat: destinationCoords[1],
          destinationLng: destinationCoords[0],
        }
      });
    }
    // ESCENARIO B: viene de la SearchBar del Home
    else {
      if (typeof state.origin === 'string') {
        setOrigin({ display: state.origin });
      } else if (state.origin?.display) {
        setOrigin(state.origin);
      }

      if (typeof state.destination === 'string') {
        setDestination({ display: state.destination });
      } else if (state.destination?.display) {
        setDestination(state.destination);
      }

      if (state.date) setDate(state.date);
      if (state.time) setTime(state.time);
      if (state.seats) setMinSeats(state.seats);

      // Build params directly from state to avoid stale closure with handleSearch
      const today = new Date().toISOString().split('T')[0];
      const departureTime = state.time ? new Date(`${state.date || today}T${state.time}`).toISOString() : undefined;
      const originValue = typeof state.origin === 'string' ? { display: state.origin } : state.origin;
      const destValue = typeof state.destination === 'string' ? { display: state.destination } : state.destination;

      loadTrips({
        page: 1,
        append: false,
        params: {
          originName: originValue?.display || undefined,
          destinationName: destValue?.display || undefined,
          originLat: originValue?.coords?.[1],
          originLng: originValue?.coords?.[0],
          destinationLat: destValue?.coords?.[1],
          destinationLng: destValue?.coords?.[0],
          minSeats: (state.seats && state.seats > 1) ? state.seats : undefined,
          departureTime,
          timeTolerance: departureTime ? 60 : undefined,
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Ordenamiento y filtros client-side ────────────────────────────────────────

  const displayedTrips = useMemo(() => {
    const seen = new Set<string>();
    let result = filteredTrips.filter(t => {
      if (seen.has(t.id)) return false;
      seen.add(t.id);
      return true;
    });

    if (nextDepartureOnly) {
      const now = Date.now();
      const in24h = now + 86_400_000;
      result = result.filter(t => {
        const ts = new Date(t.departure_time).getTime();
        return ts >= now && ts <= in24h;
      });
      result.sort((a, b) => new Date(a.departure_time).getTime() - new Date(b.departure_time).getTime());
      return result;
    }

    const criteria = sortBy.length > 0 ? sortBy : (['date_asc'] as SortKey[]);
    result.sort((a, b) => {
      for (const key of criteria) {
        const cmp = compareBy(a, b, key);
        if (cmp !== 0) return cmp;
      }
      return 0;
    });
    return result;
  }, [filteredTrips, sortBy, nextDepartureOnly]);

  useEffect(() => {
    const sentinel = loadMoreSentinelRef.current;
    if (!sentinel || !hasMore || isLoadingMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { rootMargin: '200px', threshold: 0 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore, hasMore, isLoadingMore, displayedTrips.length]);

  const applyDateRangeFilter = useCallback((trips: TripWithDriver[]) => {
    if (!date) return trips;
    const now = Date.now();
    const endOfDay = new Date(`${date}T23:59:59`).getTime();
    return trips
      .filter(trip => {
        const ts = new Date(trip.departure_time).getTime();
        return ts >= now && ts <= endOfDay;
      })
      // Ascendente: los más próximos a hoy aparecen primero
      .sort((a, b) => new Date(a.departure_time).getTime() - new Date(b.departure_time).getTime());
  }, [date]);

  // ── Handlers ──────────────────────────────────────────────────────────────────

  const handleSearch = useCallback(async () => {
    setSortBy([]);
    setHasSearched(true);

    const today = new Date().toISOString().split('T')[0];
    const departureTime = time ? new Date(`${date || today}T${time}`).toISOString() : undefined;

    const params = {
      originName: origin.display || undefined,
      destinationName: destination.display || undefined,
      originLat: origin.coords?.[1],
      originLng: origin.coords?.[0],
      destinationLat: destination.coords?.[1],
      destinationLng: destination.coords?.[0],
      minSeats: minSeats > 1 ? minSeats : undefined,
      departureTime,
      timeTolerance: departureTime ? timeTolerance : undefined,
    };

    await loadTrips({ page: 1, append: false, params });

    if (date && !time) {
      setFilteredTrips(prev => applyDateRangeFilter(prev));
    }

    // Scroll to results after search completes so user sees them immediately
    setTimeout(() => {
      resultsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 150);
  }, [date, time, origin, destination, minSeats, timeTolerance, loadTrips, applyDateRangeFilter]);

  const handleClearAll = useCallback(async () => {
    setOrigin({ display: '' });
    setDestination({ display: '' });
    setDate('');
    setTime('');
    setMinSeats(1);
    setTimeTolerance(60);
    setNextDepartureOnly(false);
    setSortBy([]);
    setHasSearched(false);
    await loadTrips({ page: 1, append: false });
  }, [loadTrips]);

  const handleContactDriver = useCallback(async (driverId: string, tripId: string) => {
    if (!accessToken || !user) {
      toast({ title: 'Inicia sesión', description: 'Debes iniciar sesión para contactar al conductor', variant: 'destructive' });
      navigate('/login', {
        state: {
          redirectTo: `${location.pathname}${location.search}`,
        },
      });
      return;
    }
    if (driverId === user.id) {
      toast({ title: 'Acción no permitida', description: 'No puedes enviarte mensajes a ti mismo', variant: 'destructive' });
      return;
    }
    try {
      setIsContactingDriver(driverId);
      const conversation = await createConversation(
        { other_user_id: driverId, trip_id: tripId, conversation_type: 'pre', subject: 'Consulta sobre viaje' },
        accessToken
      );
      navigate('/messages', { state: { selectedConversationId: conversation.id, newConversation: driverId } });
    } catch {
      toast({ title: 'Error', description: 'No se pudo iniciar la conversación', variant: 'destructive' });
    } finally {
      setIsContactingDriver(null);
    }
  }, [accessToken, user, navigate, toast, location.pathname, location.search]);

  const hasActiveFilters = !!origin.display || !!destination.display || !!date || !!time || minSeats > 1 || nextDepartureOnly;

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#F4F8FC] flex flex-col font-sans pb-24">


      {/* Top Header estilo App */}
      <div className="flex items-center justify-between px-4 py-5 bg-transparent">
        <button onClick={() => navigate(-1)} className="p-1" aria-label="Volver">
          <ChevronLeft className="w-6 h-6 text-[#0F2A4D]" />
        </button>
        <h1 className="text-xl font-black text-[#0F2A4D]">Buscador de Viajes</h1>
        <button className="p-1" aria-label="Filtrar">
          <Filter className="w-6 h-6 text-[#0F2A4D]" />
        </button>
      </div>

      <div className="px-4 w-full max-w-md mx-auto">

        {/* Banner Publicitario: 1 imagen completa por slide */}
        {activeAds.length > 0 && (
          <div className="mb-6 animate-fade-in">
            {activeAds.map((ad, index) => {
              let finalImageUrl = ad.image_url;
              if (finalImageUrl?.startsWith('/')) {
                const backend = '';
                finalImageUrl = `${backend}${finalImageUrl}`.replace(/^http:\/\//i, 'https://');
              }
              return (
                <div
                  key={ad.id}
                  className={`${index === currentAdIndex ? 'block' : 'hidden'} w-full h-48 sm:h-56 relative rounded-2xl overflow-hidden shadow-sm border border-border/50`}
                >
                  <button
                    type="button"
                    onClick={() => ad.link_url && navigate(ad.link_url)}
                    className="block w-full h-full text-left"
                  >
                    <img
                      src={finalImageUrl}
                      alt={ad.title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0F2A4D]/85 via-[#0F2A4D]/10 to-transparent" />
                    <p className="absolute bottom-4 left-4 right-4 text-white font-black text-lg leading-tight drop-shadow">
                      {ad.title}
                    </p>
                  </button>
                </div>
              );
            })}

            {activeAds.length > 1 && (
              <div className="mt-3 flex items-center justify-center gap-2">
                {activeAds.map((ad, index) => (
                  <button
                    key={`dot-${ad.id}`}
                    type="button"
                    aria-label={`Ir al anuncio ${index + 1}`}
                    onClick={() => setCurrentAdIndex(index)}
                    className={`h-2 rounded-full transition-all ${index === currentAdIndex ? 'w-6 bg-[#F97316]' : 'w-2 bg-[#DCE8F5]'}`}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Banner: viaje de regreso */}
        {isReturnTrip && (
          <div className="mb-4 flex items-center gap-3 rounded-2xl bg-[#DCE8F5]/30 border border-[#DCE8F5] px-4 py-3 animate-fade-in">
            <ArrowRight className="w-4 h-4 text-[#EA580C] shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[#EA580C] leading-tight">Buscando viaje de regreso</p>
              <p className="text-xs text-gray-600 truncate">
                {origin.display || ''} → {destination.display || ''}
              </p>
            </div>
            <button
              onClick={() => setIsReturnTrip(false)}
              className="text-gray-400 hover:text-gray-700 transition-colors shrink-0"
              aria-label="Descartar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Core Query Card */}
        <div className="bg-[#DCE8F5] p-4 rounded-[28px] shadow-sm mb-4 relative animate-slide-up">
          <form onSubmit={(e) => { e.preventDefault(); handleSearch(); }} className="space-y-3">

            {/* Origen */}
            <div className="bg-white rounded-xl flex items-center px-4 shadow-sm h-12 relative z-20">
              <MapPin className="w-5 h-5 text-gray-500 mr-2 shrink-0" />
              <div className="flex-1 w-full">
                <LocationSearchInput
                  value={origin}
                  onChange={setOrigin}
                  placeholder="Origen"
                  variant="origin"
                />
              </div>
            </div>

            {/* FLECHA */}
            <div className="absolute left-1/2 top-[76px] -translate-x-1/2 -translate-y-1/2 z-10">
              <ArrowDown className="w-5 h-5 text-gray-700" />
            </div>

            {/* Destino */}
            <div className="bg-white rounded-xl flex items-center px-4 shadow-sm h-12 relative z-20">
              <Send className="w-5 h-5 text-gray-500 mr-2 shrink-0" />
              <div className="flex-1 w-full">
                <LocationSearchInput
                  value={destination}
                  onChange={setDestination}
                  placeholder="Destino"
                  variant="destination"
                />
              </div>
            </div>

            {/* Fecha + Botón */}
            <div className="flex gap-3 pt-1">
              <div className="flex-1 bg-white rounded-xl flex items-center px-3 shadow-sm h-12">
                <Calendar className="w-5 h-5 text-gray-500 mr-2 shrink-0" />
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full h-full bg-transparent border-none focus-visible:ring-0 px-0 text-sm text-gray-700"
                />
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="flex-1 bg-[#F97316] hover:bg-[#EA580C] text-white rounded-xl h-12 font-medium text-sm shadow-sm"
              >
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Buscar Viaje'}
              </Button>
            </div>

            {/* Filtros */}
            <div className="mt-2 pt-3 border-t border-white/40 space-y-3">

              <div className="flex flex-wrap gap-3">

                {/* Hora */}
                <div className="flex-1 min-w-[120px]">
                  <label className="text-[11px] font-semibold text-[#163B67] uppercase tracking-wide mb-1 block">
                    Hora (Opc.)
                  </label>
                  <div className="bg-white/80 rounded-xl flex items-center px-3 shadow-sm h-10">
                    <Clock className="w-4 h-4 text-gray-500 mr-2 shrink-0" />
                    <Input
                      type="time"
                      value={time}
                      onChange={(e) => setTime(e.target.value)}
                      className="w-full h-full bg-transparent border-none focus-visible:ring-0 px-0 text-sm text-gray-700"
                    />
                  </div>
                </div>

                {/* Asientos */}
                <div>
                  <label className="text-[11px] font-semibold text-[#163B67] uppercase tracking-wide mb-1 block">
                    Asientos
                  </label>
                  <div className="flex items-center gap-2 h-10 bg-white/80 rounded-xl px-2 shadow-sm">
                    <button
                      type="button"
                      onClick={() => setMinSeats(s => Math.max(1, s - 1))}
                      disabled={minSeats <= 1}
                      className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="min-w-[1.2rem] text-center text-sm font-medium">
                      {minSeats}
                    </span>
                    <button
                      type="button"
                      onClick={() => setMinSeats(s => Math.min(MIN_SEATS_MAX, s + 1))}
                      disabled={minSeats >= MIN_SEATS_MAX}
                      className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Tolerancia */}
              {time ? (
                <div>
                  <label className="text-[11px] font-semibold text-[#163B67] uppercase tracking-wide mb-1 block">
                    Tolerancia horaria
                  </label>
                  <div className="flex gap-2">
                    {TIME_TOLERANCE_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setTimeTolerance(opt.value)}
                        className={`flex-1 py-1.5 rounded-full text-xs font-medium transition-all ${timeTolerance === opt.value
                          ? 'bg-[#F97316] text-white'
                          : 'bg-white/50 text-[#163B67]'
                          }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : !date && (
                <label className="flex items-center justify-between gap-3 cursor-pointer bg-white/40 rounded-xl px-3 py-2">
                  <span className="text-sm font-medium text-[#163B67]">
                    Solo próximas 24 h
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={nextDepartureOnly}
                    onClick={() => setNextDepartureOnly(!nextDepartureOnly)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full p-0.5 overflow-hidden transition-colors ${nextDepartureOnly ? 'bg-[#F97316]' : 'bg-white/80'
                      }`}
                  >
                    <span className={`h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${nextDepartureOnly ? 'translate-x-5' : 'translate-x-0'
                      }`} />
                  </button>
                </label>
              )}
            </div>
          </form>
        </div>

        {/* Acciones */}


        {/* Ordenar */}
        {
          !isLoading && allTrips.length > 0 && (
            <div className="mb-4 animate-fade-in">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Ordenar por</p>
              <div className="flex flex-wrap gap-2">
                {SORT_OPTIONS.map(opt => {
                  const index = sortBy.indexOf(opt.value);
                  const active = index !== -1;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        if (active) {
                          setSortBy(prev => prev.filter(k => k !== opt.value));
                        } else {
                          const group = SORT_GROUP[opt.value];
                          setSortBy(prev => [...prev.filter(k => SORT_GROUP[k] !== group), opt.value]);
                        }
                      }}
                      className={`rounded-full px-3 py-1.5 text-xs font-medium border transition-all ${active
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'border-input text-foreground hover:border-primary/50'
                        }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )
        }

        {/* Resultados */}
        <div ref={resultsSectionRef} className="animate-slide-up">
          {!isLoading && (
            <h2 className="text-lg font-semibold text-[#0F2A4D] mb-1">
              Viajes Disponibles
            </h2>
          )}
          <p className="text-sm text-gray-500 mb-3">
            {displayedTrips.length} viaje{displayedTrips.length !== 1 ? 's' : ''} disponible{displayedTrips.length !== 1 ? 's' : ''}
          </p>

          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : displayedTrips.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 text-center">
              <div className="w-14 h-14 bg-secondary rounded-2xl flex items-center justify-center mb-4">
                <MapPin className="w-7 h-7 text-muted-foreground" />
              </div>
              <h3 className="text-base font-semibold text-foreground mb-1">
                {allTrips.length === 0 ? 'Aún no hay viajes publicados' : 'Sin resultados'}
              </h3>
              <p className="text-sm text-muted-foreground max-w-xs">
                {allTrips.length === 0
                  ? '¡Sé el primero en publicar un viaje!'
                  : hasSearched
                    ? `No encontramos viajes${origin.display ? ` desde ${origin.display}` : ''}${date ? ` hasta el ${formatDate(date + 'T12:00:00')}` : ''}.`
                    : 'Ningún viaje cumple los filtros activos.'}
              </p>
              {allTrips.length === 0 ? (
                <Button className="mt-5 rounded-2xl" onClick={() => navigate('/my-trips')}>
                  Publicar un viaje
                </Button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleClearAll()}
                  className="mt-5 rounded-full border-2 border-[#0F2A4D] bg-transparent text-[#0F2A4D] px-6 py-2 font-semibold hover:bg-[#0F2A4D] hover:text-white transition-all"
                >
                  Limpiar filtros
                </button>
              )}
            </div>
          ) : (
            <>
              <div key={resultsKey} className="space-y-3">
                {displayedTrips.map((trip, index) => (
                  (() => {
                    const avatarSrc = trip.driver?.avatarUrl
                      ? (trip.driver.avatarUrl.startsWith('/')
                        ? `${backendBaseUrl}${trip.driver.avatarUrl}`
                        : trip.driver.avatarUrl)
                      : undefined;

                    return (
                  <div
                    key={trip.id}
                    onClick={() => navigate(`/trip-details/${trip.id}`)}
                    className="bg-white rounded-[22px] px-4 py-3 mb-4 border border-gray-100 shadow-[0_20px_50px_rgba(159,132,247,0.15)] hover:shadow-[0_12px_30px_rgba(0,0,0,0.1)] transition-all cursor-pointer w-full overflow-hidden"
                  >
                    <div className="flex items-center gap-4">

                      {/* IZQUIERDA (Conductor)*/}
                      <div className="flex flex-col items-center w-[70px] border-r border-gray-200 pr-3 ">
                        <div className="w-12 h-12 bg-[#DCE8F5] rounded-full flex items-center justify-center shadow-sm">
                          {avatarSrc ? (
                            <img
                              src={avatarSrc}
                              alt={trip.driver?.name || 'Conductor'}
                              className="w-12 h-12 rounded-full object-cover"
                            />
                          ) : (
                            <span className="text-lg font-bold text-[#F97316]">
                              {trip.driver?.name?.charAt(0) || 'X'}
                            </span>
                          )}
                        </div>

                        <p className="text-[12px] font-semibold text-gray-800 mt-2 text-center leading-tight">
                          {trip.driver?.name || 'Conductor'}
                        </p>

                        <div className="flex items-center gap-1 mt-1">
                          <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                          <span className="text-[11px] text-gray-500 font-medium">
                            {trip.driver?.rating || '0'}
                          </span>
                        </div>
                      </div>

                      {/* CENTRO (ruta y hora) */}
                      <div className="flex-1 p-4 flex flex-col justify-between min-w-0"> {/* Cambio: min-w-0 permite que el truncate funcione */}

                        {/* RUTA  */}
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-2 pr-2">

                          <h3 className="text-[15px] font-bold text-slate-800 leading-tight truncate">
                            {trip.origin_name.split(',')[0]}
                          </h3>

                          <ArrowRight className="w-4 h-4 text-[#F97316] opacity-60 flex-shrink-0" />

                          <h3 className="text-[15px] font-bold text-slate-800 leading-tight truncate">
                            {trip.destination_name.split(',')[0]}
                          </h3>
                        </div>

                        {/* INFO (hora) */}
                        <div className="flex items-center gap-2 text-gray-500">
                          <Clock className="w-4 h-4 text-gray-400" />
                          <span className="text-[12px] font-medium">
                            {new Date(trip.departure_time).toLocaleTimeString('es-ES', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                      </div>

                      {/* DERECHA (Precio , Asientos y Botón) */}
                      <div className="w-[100px] flex flex-col items-center justify-between py-2 px-2">

                        {/* PRECIO */}
                        <div className="bg-[#F97316] px-3 py-1 rounded-lg shadow-sm">
                          <p className="text-[13px] font-black text-white">
                            S/ {trip.price_per_seat ?? '0'}
                          </p>
                        </div>
                        {/* ASIENTOS: */}
                        <div className="flex items-center gap-1 text-slate-600 mt-2">
                          <Users className="w-3 h-3 text-[#F97316]" />
                          <span className="text-[12px] font-bold">
                            {trip.available_seats} asientos
                          </span>
                        </div>
                        {/* BOTÓN */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleContactDriver(trip.driver_id, trip.id);
                          }}
                          className="mt-2 border border-[#F97316] text-[#F97316] px-3 py-1 rounded-full text-[11px] font-bold hover:bg-[#F97316] hover:text-white transition-all shadow-sm"
                        >
                          Contactar
                        </button>
                      </div>
                    </div>
                  </div>
                    );
                  })()
                ))}
              </div>
              {hasMore && <div ref={loadMoreSentinelRef} className="h-4" />}
              {isLoadingMore && (
                <div className="flex justify-center py-6">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              )}
            </>
          )}
        </div>
      </div >
    </div >
  );
};

export default Search;
