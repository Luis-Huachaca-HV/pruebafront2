import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  MapPin,
  Clock,
  Users,
  Calendar,
  Car,
  Star,
  Loader2,
  Navigation,
  CheckCircle2,
  CheckCircle,
  XCircle,
  Package,
  Music,
  Cigarette,
  Dog,
  MessageCircle,
  Check,
  Plus,
  Flame,
  Play,
  CircleCheck,
  Wallet,
  UserCheck,
  Baby
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { getTripDetails, TripDetailResponse, startTrip, completeTrip } from '@/services/trips';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { createConversation } from '@/services/chat';
import { createReservation } from '@/services/reservations';
import { UserProfilePopup } from '@/components/UserProfilePopup';
import { useQueryClient } from '@tanstack/react-query';
import { chatKeys } from '@/hooks/use-chat-cache';
import { useUserProfile, convertProfileToUser } from '@/hooks/use-user-profile-cache';
import { myTripsKeys } from '@/hooks/use-my-trips-cache';
import { User, UserRole } from '@/types';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useWalkingRoute } from '@/hooks/useWalkingRoute';
import { Checkbox } from '@/components/ui/checkbox';

const MAPBOX_TOKEN = 'pk.eyJ1IjoibGVzZWwiLCJhIjoiY21rcTMzZHZpMGx2dzNrb3FuanUxNjZ3cyJ9.QckkRB2ojiFgnJL9dLeVew';

const TripDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { accessToken, user } = useAuth();
  const queryClient = useQueryClient();
  const [trip, setTrip] = useState<TripDetailResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isContactingDriver, setIsContactingDriver] = useState(false);
  const [isReserving, setIsReserving] = useState(false);
  const [reservationStatus, setReservationStatus] = useState<'none' | 'confirmed' | 'pending'>('none');
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);
  const [showReturnTripDialog, setShowReturnTripDialog] = useState(false);
  const [isDriverPopupOpen, setIsDriverPopupOpen] = useState(false);
  const [seatCount, setSeatCount] = useState(1);
  const [childrenCount, setChildrenCount] = useState(0);
  const [liveRouteDuration, setLiveRouteDuration] = useState<number | null>(null);
  const [liveRouteDistance, setLiveRouteDistance] = useState<number | null>(null);
  const [isStartingTrip, setIsStartingTrip] = useState(false);
  const [isCompletingTrip, setIsCompletingTrip] = useState(false);
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const walkingMarkerRef = useRef<mapboxgl.Marker | null>(null);

  // Walking route from user location to trip origin
  const walkingRoute = useWalkingRoute(
    trip?.origin_coordinates ?? null,
    MAPBOX_TOKEN,
  );

  // Obtener perfil del conductor
  const driverId = trip?.driver_id;
  const { data: driverProfileData } = useUserProfile(
    driverId || null,
    isDriverPopupOpen && !!driverId && !!accessToken
  );

  // Convertir perfil a User
  const driverProfile: User | null = useMemo(() => {
    if (!driverId || !trip) return null;

    if (driverProfileData) {
      return convertProfileToUser(
        driverProfileData,
        trip.driver_name,
        undefined
      );
    }

    // Fallback: usar datos básicos del trip
    return {
      id: driverId,
      full_name: trip.driver_name || 'Conductor',
      email: '',
      avatar: undefined,
      description: undefined,
      rating: trip.driver_reputation || 4.5,
      tripsCompleted: 0,
      is_driver: true,
      total_trips_as_driver: undefined,
      total_trips_as_passenger: undefined,
      user_role: 'driver' as UserRole
    };
  }, [driverProfileData, trip, driverId]);

  useEffect(() => {
    if (!id) {
      navigate('/search');
      return;
    }

    const loadTripDetails = async () => {
      try {
        setIsLoading(true);
        // Pasar el token para que el backend verifique si el usuario tiene reserva
        const tripData = await getTripDetails(id, accessToken || undefined);
        setTrip(tripData);

        // Si el usuario ya tiene reservas, actualizar el estado del botón
        console.log('Trip data loaded:', tripData);
        console.log('User reservations:', tripData.user_reservations);
        console.log('User reservations count:', tripData.user_reservations?.length || 0);
        if (tripData.user_reservations && tripData.user_reservations.length > 0) {
          console.log('=== RESERVAS DETALLADAS ===');
          tripData.user_reservations.forEach((reservation, index) => {
            console.log(`Reserva ${index + 1}:`, {
              id: reservation.id,
              status: reservation.status,
              seat_count: reservation.seat_count,
              created_at: reservation.created_at,
              full_data: reservation
            });
          });
          console.log('=== FIN RESERVAS ===');
        } else {
          console.log('No hay reservas para este usuario en este viaje');
        }

        // Log coordenadas de origen y destino
        console.log('Origin coordinates:', tripData.origin_coordinates);
        console.log('Destination coordinates:', tripData.destination_coordinates);

        // Log coordenadas de paradas
        if (tripData.stops && tripData.stops.length > 0) {
          console.log('Stops data:', tripData.stops);
          tripData.stops.forEach((stop, index) => {
            console.log(`Stop ${index + 1} (${stop.name}):`, stop.coordinates);
            console.log(`  - Latitude: ${stop.coordinates.latitude}`);
            console.log(`  - Longitude: ${stop.coordinates.longitude}`);
          });
        } else {
          console.log('No stops found');
        }

        // Verificar si hay reservas activas (la más reciente determina el estado del botón)
        if (tripData.user_reservations && tripData.user_reservations.length > 0) {
          // Las reservas ya vienen ordenadas por fecha descendente
          const latestReservation = tripData.user_reservations[0];
          if (latestReservation.status === 'confirmed') {
            setReservationStatus('confirmed');
            console.log('Setting reservation status to confirmed');
          } else if (latestReservation.status === 'pending') {
            setReservationStatus('pending');
            console.log('Setting reservation status to pending');
          } else {
            setReservationStatus('none');
            console.log('Latest reservation is cancelled, setting status to none');
          }
        } else {
          setReservationStatus('none');
          console.log('No reservations found, setting status to none');
        }
      } catch (error) {
        console.error('Error loading trip details:', error);
        const errorMessage = error instanceof Error ? error.message : '';
        if (/token|401|autenticaci[óo]n requerido/i.test(errorMessage)) {
          navigate('/login', {
            state: {
              redirectTo: `${location.pathname}${location.search}`,
            },
          });
          return;
        }
        toast({
          title: "Error",
          description: "No se pudieron cargar los detalles del viaje",
          variant: "destructive",
        });
        navigate('/search');
      } finally {
        setIsLoading(false);
      }
    };

    loadTripDetails();
  }, [id, navigate, toast, accessToken, location.pathname, location.search]);

  // Actualizar estado de reserva cuando cambia el trip
  useEffect(() => {
    if (trip?.user_reservations && trip.user_reservations.length > 0) {
      // Las reservas ya vienen ordenadas por fecha descendente
      const latestReservation = trip.user_reservations[0];
      if (latestReservation.status === 'confirmed') {
        setReservationStatus('confirmed');
      } else if (latestReservation.status === 'pending') {
        setReservationStatus('pending');
      } else {
        setReservationStatus('none');
      }
    } else {
      // Solo resetear si no hay reserva y el estado actual no es 'none'
      // (para evitar resetear después de crear una reserva)
      if (reservationStatus !== 'none' && (!trip?.user_reservations || trip.user_reservations.length === 0)) {
        setReservationStatus('none');
      }
    }

    // Resetear contador de asientos cuando cambia el viaje
    if (trip) {
      setSeatCount(1);
      setChildrenCount(0);
    }
  }, [trip?.user_reservations, reservationStatus, trip]);

  // Initialize map
  useEffect(() => {
    if (!trip || !mapContainerRef.current) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;

    // Clean up previous map
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    const origin: [number, number] = [
      trip.origin_coordinates.longitude,
      trip.origin_coordinates.latitude
    ];
    const destination: [number, number] = [
      trip.destination_coordinates.longitude,
      trip.destination_coordinates.latitude
    ];

    // Create map
    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: origin,
      zoom: 10,
    });

    mapRef.current = map;

    map.on('load', () => {
      // Add origin marker with click interaction
      const originMarker = new mapboxgl.Marker({ color: '#10b981' })
        .setLngLat(origin)
        .setPopup(new mapboxgl.Popup().setText(trip.origin_name))
        .addTo(map);

      // Make origin marker clickable to center map
      originMarker.getElement().addEventListener('click', () => {
        map.flyTo({
          center: origin,
          zoom: 14,
          duration: 1000,
        });
        originMarker.togglePopup();
      });

      // Add destination marker with click interaction
      const destinationMarker = new mapboxgl.Marker({ color: '#ef4444' })
        .setLngLat(destination)
        .setPopup(new mapboxgl.Popup().setText(trip.destination_name))
        .addTo(map);

      // Make destination marker clickable to center map
      destinationMarker.getElement().addEventListener('click', () => {
        map.flyTo({
          center: destination,
          zoom: 14,
          duration: 1000,
        });
        destinationMarker.togglePopup();
      });

      // Add stops markers with click interaction
      if (trip.stops && trip.stops.length > 0) {
        trip.stops.forEach((stop, index) => {
          const stopCoords: [number, number] = [
            stop.coordinates.longitude,
            stop.coordinates.latitude
          ];
          const stopMarker = new mapboxgl.Marker({ color: '#f59e0b' })
            .setLngLat(stopCoords)
            .setPopup(new mapboxgl.Popup().setText(`${index + 1}. ${stop.name}`))
            .addTo(map);

          // Make stop marker clickable to center map
          stopMarker.getElement().addEventListener('click', () => {
            map.flyTo({
              center: stopCoords,
              zoom: 14,
              duration: 1000,
            });
            stopMarker.togglePopup();
          });
        });
      }

      // Build waypoints for route - only origin to destination (no stops in route)
      // Stops are displayed as independent markers (yellow) but not part of the route calculation
      const waypoints: [number, number][] = [origin, destination];

      // Fetch and display route (only from origin to destination)
      const coordinates = waypoints.map(wp => `${wp[0]},${wp[1]}`).join(';');
      fetch(
        `https://api.mapbox.com/directions/v5/mapbox/driving/${coordinates}?geometries=geojson&overview=full&access_token=${MAPBOX_TOKEN}`
      )
        .then(res => res.json())
        .then(data => {
          if (data.routes && data.routes.length > 0) {
            const route = data.routes[0];
            const routeGeometry = route.geometry;

            // Guardar duración/distancia en vivo como fallback si no están en BD
            if (!trip.route_duration_min && route.duration) {
              setLiveRouteDuration(Math.round(route.duration / 60));
            }
            if (!trip.route_distance_km && route.distance) {
              setLiveRouteDistance(Math.round(route.distance / 100) / 10);
            }

            // Add route to map
            map.addSource('route', {
              type: 'geojson',
              data: {
                type: 'Feature',
                properties: {},
                geometry: routeGeometry,
              },
            });

            map.addLayer({
              id: 'route',
              type: 'line',
              source: 'route',
              layout: {
                'line-join': 'round',
                'line-cap': 'round',
              },
              paint: {
                'line-color': '#3b82f6',
                'line-width': 4,
              },
            });

            // Fit map to route bounds
            const coordinates = routeGeometry.coordinates as [number, number][];
            const bounds = coordinates.reduce(
              (bounds, coord) => bounds.extend(coord),
              new mapboxgl.LngLatBounds(coordinates[0], coordinates[0])
            );

            // Add padding for stops
            if (trip.stops && trip.stops.length > 0) {
              trip.stops.forEach(stop => {
                bounds.extend([stop.coordinates.longitude, stop.coordinates.latitude]);
              });
            }

            map.fitBounds(bounds, {
              padding: { top: 50, bottom: 50, left: 50, right: 50 },
            });
          }
        })
        .catch(error => {
          console.error('Error fetching route:', error);
        });
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [trip]);

  // Walking route layer — separate from map init to keep concerns isolated
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !walkingRoute.data) return;

    const addWalkingLayer = () => {
      const { userLocation, routeGeometry } = walkingRoute.data!;

      // Add walking route source + layer (guard against duplicates)
      if (!map.getSource('walking-route')) {
        map.addSource('walking-route', {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: routeGeometry,
          },
        });

        map.addLayer({
          id: 'walking-route-layer',
          type: 'line',
          source: 'walking-route',
          layout: {
            'line-join': 'round',
            'line-cap': 'round',
          },
          paint: {
            'line-color': '#2563eb',
            'line-width': 3,
            'line-dasharray': [2, 2],
          },
        });
      }

      // Add user location marker (blue pulsing dot)
      if (walkingMarkerRef.current) {
        walkingMarkerRef.current.remove();
      }

      // Inject walking-pulse keyframe style only once
      if (!document.getElementById('walking-pulse-style')) {
        const style = document.createElement('style');
        style.id = 'walking-pulse-style';
        style.textContent = `
          @keyframes walking-pulse-ring {
            0% { box-shadow: 0 0 0 0 rgba(37, 99, 235, 0.4); }
            70% { box-shadow: 0 0 0 10px rgba(37, 99, 235, 0); }
            100% { box-shadow: 0 0 0 0 rgba(37, 99, 235, 0); }
          }
        `;
        document.head.appendChild(style);
      }

      const markerEl = document.createElement('div');
      markerEl.innerHTML = `
        <div style="
          width: 16px; height: 16px;
          background: #2563eb;
          border: 3px solid white;
          border-radius: 50%;
          box-shadow: 0 0 0 0 rgba(37, 99, 235, 0.4);
          animation: walking-pulse-ring 1.5s cubic-bezier(0.215, 0.61, 0.355, 1) infinite;
        "></div>
      `;

      const marker = new mapboxgl.Marker({ element: markerEl })
        .setLngLat(userLocation)
        .setPopup(new mapboxgl.Popup().setText('Tu ubicación'))
        .addTo(map);

      walkingMarkerRef.current = marker;

      // Extend bounds to include user location
      const currentBounds = map.getBounds();
      if (currentBounds) {
        const newBounds = new mapboxgl.LngLatBounds(
  currentBounds.getSouthWest(),
  currentBounds.getNorthEast()
);
        newBounds.extend(userLocation);
        map.fitBounds(newBounds, {
          padding: { top: 50, bottom: 50, left: 50, right: 50 },
          duration: 500,
        });
      }
    };

    if (map.isStyleLoaded()) {
      addWalkingLayer();
    } else {
      map.on('load', addWalkingLayer);
    }

    // Cleanup on unmount or data change
    return () => {
      if (walkingMarkerRef.current) {
        walkingMarkerRef.current.remove();
        walkingMarkerRef.current = null;
      }
      if (map && map.getStyle && map.getStyle()) {
        if (map.getLayer('walking-route-layer')) {
          map.removeLayer('walking-route-layer');
        }
        if (map.getSource('walking-route')) {
          map.removeSource('walking-route');
        }
      }
      const pulseStyle = document.getElementById('walking-pulse-style');
      if (pulseStyle) {
        pulseStyle.remove();
      }
    };
  }, [walkingRoute.data]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!trip) {
    return null;
  }

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
      month: 'long',
      year: 'numeric',
    });
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('es-ES', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleContactDriver = async () => {
    if (!accessToken || !user) {
      toast({
        title: "Inicia sesión",
        description: "Debes iniciar sesión para contactar al conductor",
        variant: "destructive",
      });
      navigate('/login', {
        state: {
          redirectTo: `${location.pathname}${location.search}`,
        },
      });
      return;
    }

    if (!trip || !trip.driver_id) {
      return;
    }

    if (trip.driver_id === user.id) {
      toast({
        title: "Acción no permitida",
        description: "No puedes enviarte mensajes a ti mismo",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsContactingDriver(true);

      // Determinar el tipo de conversación basándose en si hay una reserva confirmada
      // Si hay al menos una reserva confirmada, es "post", de lo contrario es "pre"
      const hasConfirmedReservation = trip.user_reservations?.some(
        (reservation) => reservation.status === 'confirmed'
      ) || false;

      const conversationType = hasConfirmedReservation ? 'post' : 'pre';

      // Crear o obtener conversación existente
      const conversation = await createConversation(
        {
          other_user_id: trip.driver_id,
          trip_id: trip.id,
          conversation_type: conversationType,
          subject: 'Consulta sobre viaje',
        },
        accessToken
      );

      // Navegar directamente a la conversación usando el ID en el estado
      navigate('/messages', {
        state: {
          selectedConversationId: conversation.id
        }
      });
    } catch (error) {
      console.error('Error creating conversation:', error);
      toast({
        title: "Error",
        description: "No se pudo iniciar la conversación",
        variant: "destructive",
      });
    } finally {
      setIsContactingDriver(false);
    }
  };

  const centerMapOnPoint = (coordinates: [number, number]) => {
    if (mapRef.current) {
      mapRef.current.flyTo({
        center: coordinates,
        zoom: 14,
        duration: 1000,
      });
    }
  };

  const isOwner = !!user && !!trip && user.id === trip.driver_id;

  const reloadTrip = async () => {
    if (!id) return;
    try {
      const updated = await getTripDetails(id, accessToken || undefined);
      setTrip(updated);
    } catch (err) {
      console.error('Error reloading trip:', err);
    }
  };

  const handleStartTrip = async () => {
    if (!accessToken || !trip) return;

    try {
      setIsStartingTrip(true);
      await startTrip(trip.id, accessToken);
      toast({
        title: 'Viaje iniciado',
        description: 'El viaje esta ahora en curso.',
      });
      await reloadTrip();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      const isInsufficientBalance =
        message.toLowerCase().includes('saldo insuficiente') ||
        message.toLowerCase().includes('insufficient');
      const isTooEarlyStart =
        message.toLowerCase().includes('1 hora antes') ||
        message.toLowerCase().includes('no puedes iniciar el viaje todavia');

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
      } else if (isTooEarlyStart) {
        toast({
          title: 'Aun no puedes iniciar',
          description: message,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Error',
          description: message,
          variant: 'destructive',
        });
      }
    } finally {
      setIsStartingTrip(false);
    }
  };

  const handleCompleteTrip = async () => {
    if (!accessToken || !trip) return;

    try {
      setIsCompletingTrip(true);
      const result = await completeTrip(trip.id, accessToken);
      const commission = result.commission;

      toast({
        title: 'Viaje completado',
        description: `Comision: S/ ${commission.commission_amount.toFixed(2)} (${commission.confirmed_seats} asiento${commission.confirmed_seats !== 1 ? 's' : ''} confirmado${commission.confirmed_seats !== 1 ? 's' : ''}). Nuevo saldo: S/ ${commission.new_balance.toFixed(2)}`,
      });
      await reloadTrip();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsCompletingTrip(false);
      setShowCompleteDialog(false);
    }
  };

  const handleReserveTrip = async () => {
    if (!accessToken || !user) {
      toast({
        title: "Inicia sesión",
        description: "Debes iniciar sesión para reservar un viaje",
        variant: "destructive",
      });
      navigate('/login', {
        state: {
          redirectTo: `${location.pathname}${location.search}`,
        },
      });
      return;
    }

    if (!trip) {
      return;
    }

    if (trip.driver_id === user.id) {
      toast({
        title: "Acción no permitida",
        description: "No puedes reservar tu propio viaje",
        variant: "destructive",
      });
      return;
    }

    // Validar asientos disponibles (también se valida en backend con lock)
    if (trip.available_seats < seatCount) {
      toast({
        title: "No hay suficientes asientos disponibles",
        description: `Solo hay ${trip.available_seats} asiento(s) disponible(s)`,
        variant: "destructive",
      });
      return;
    }

    if (seatCount < 1) {
      toast({
        title: "Cantidad inválida",
        description: "Debes reservar al menos 1 asiento",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsReserving(true);

      // Crear reserva (sin pago por ahora)
      const reservation = await createReservation(
        {
          trip_id: trip.id,
          seat_count: seatCount,
          children_count: Math.min(childrenCount, seatCount),
        },
        accessToken
      );

      // Determinar mensaje según el modo de reserva
      const bookingMode = trip.booking_mode || 'auto';
      const isAuto = bookingMode === 'auto';

      // Mostrar animación de éxito
      setShowSuccessAnimation(true);

      // Ocultar animación después de 3 segundos y preguntar por viaje de vuelta
      setTimeout(() => {
        setShowSuccessAnimation(false);
        if (isAuto || reservation.status === 'confirmed') {
          setShowReturnTripDialog(true);
        }
      }, 3000);

      // Invalidar caché de conversaciones si la reserva está confirmada
      // Esto actualiza el tipo de conversación de "pre" a "post" en el listado
      if (isAuto || reservation.status === 'confirmed') {
        setReservationStatus('confirmed');
        console.log('[TripDetails] 🗑️ Invalidando caché de conversaciones después de crear reserva confirmada');
        // Invalidar caché de conversaciones para actualizar el tipo
        queryClient.invalidateQueries({ queryKey: chatKeys.conversations() });
        console.log('[TripDetails] ✅ Caché de listado de conversaciones invalidado');
        // También invalidar la conversación específica si existe
        if (trip.driver_id) {
          // Buscar conversación relacionada con este viaje
          queryClient.invalidateQueries({
            queryKey: chatKeys.conversation(''),
            exact: false
          });
          console.log('[TripDetails] ✅ Caché de conversaciones específicas invalidado');
        }
        toast({
          title: "¡Registro Exitoso!",
          description: "Tu reserva ha sido confirmada automáticamente",
        });
      } else {
        setReservationStatus('pending');
        toast({
          title: "Solicitud enviada",
          description: "Tu solicitud de reserva ha sido enviada. El conductor la revisará pronto.",
        });
      }

      // Invalidar caché de "Mis Viajes" para que aparezca la nueva reserva/solicitud
      queryClient.invalidateQueries({ queryKey: myTripsKeys.all });
      console.log('[TripDetails] ✅ Caché de MyTrips invalidado');

      // Recargar detalles del viaje para ver asientos actualizados
      // Esto actualiza el botón y muestra el estado correcto
      if (id) {
        try {
          const updatedTrip = await getTripDetails(id, accessToken || undefined);
          console.log('=== TRIP RECARGADO DESPUÉS DE RESERVA ===');
          console.log('Updated trip:', updatedTrip);
          console.log('User reservations after reload:', updatedTrip.user_reservations);
          console.log('User reservations count:', updatedTrip.user_reservations?.length || 0);
          if (updatedTrip.user_reservations && updatedTrip.user_reservations.length > 0) {
            console.log('=== RESERVAS DESPUÉS DE CREAR ===');
            updatedTrip.user_reservations.forEach((reservation, index) => {
              console.log(`Reserva ${index + 1}:`, {
                id: reservation.id,
                status: reservation.status,
                seat_count: reservation.seat_count,
                created_at: reservation.created_at,
                full_data: reservation
              });
            });
            console.log('=== FIN RESERVAS DESPUÉS DE CREAR ===');
          }
          setTrip(updatedTrip);

          // Actualizar estado de reserva si existe
          if (updatedTrip.user_reservations && updatedTrip.user_reservations.length > 0) {
            const latestReservation = updatedTrip.user_reservations[0];
            console.log('Latest reservation after reload:', latestReservation);
            if (latestReservation.status === 'confirmed') {
              setReservationStatus('confirmed');
            } else if (latestReservation.status === 'pending') {
              setReservationStatus('pending');
            } else {
              setReservationStatus('none');
            }
          } else {
            console.log('No reservations found after reload');
            setReservationStatus('none');
          }
        } catch (error) {
          console.error('Error reloading trip details:', error);
        }
      }
    } catch (error: any) {
      console.error('[TripDetails] Reservation failed:', error?.message, error);
      toast({
        title: "Error al reservar",
        description: error?.message || "No se pudo crear la reserva",
        variant: "destructive",
      });
    } finally {
      setIsReserving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-card border-b border-border">
        <div className="px-4 py-4 flex items-center">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-secondary rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold ml-4">Detalles del Viaje</h1>
        </div>
      </div>

      <div className="pb-6">
        {/* Map Section */}
        <div className="mb-4">
          <div className="h-64 w-full" ref={mapContainerRef} />
        </div>

        {/* Walking info banner */}
        {walkingRoute.data && (
          <div className="mx-4 mb-2 -mt-2">
            <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl px-4 py-2.5 flex items-center gap-2">
              <Navigation className="w-4 h-4 text-blue-600 flex-shrink-0" />
              <p className="text-sm text-blue-700 dark:text-blue-300">
                <span className="font-medium">{walkingRoute.data.durationMin} min</span> caminando
                <span className="text-blue-500 dark:text-blue-400"> ({walkingRoute.data.distanceKm.toFixed(1)} km)</span>
              </p>
            </div>
          </div>
        )}

        {/* Route Information */}
        <div className="px-4 mb-4">
          <div className="bg-card rounded-2xl p-4 shadow-md">
            <div className="space-y-3">
              {/* Origin */}
              <div
                className="flex items-start gap-3 cursor-pointer hover:bg-secondary/50 rounded-lg p-2 -m-2 transition-colors"
                onClick={() => centerMapOnPoint([
                  trip.origin_coordinates.longitude,
                  trip.origin_coordinates.latitude
                ])}
              >
                <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <MapPin className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground mb-1">Origen</p>
                  <p className="font-medium text-foreground">{trip.origin_name}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {formatTime(trip.departure_time)} • {formatDate(trip.departure_time)}
                  </p>
                </div>
              </div>

              {/* Stops */}
              {trip.stops && trip.stops.length > 0 && (
                <>
                  {trip.stops
                    .sort((a, b) => a.stop_order - b.stop_order)
                    .map((stop, index) => (
                      <div
                        key={stop.id}
                        className="flex items-start gap-3 cursor-pointer hover:bg-secondary/50 rounded-lg p-2 -m-2 transition-colors"
                        onClick={() => centerMapOnPoint([
                          stop.coordinates.longitude,
                          stop.coordinates.latitude
                        ])}
                      >
                        <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <span className="text-white text-xs font-bold">{index + 1}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-muted-foreground mb-1">Parada {index + 1}</p>
                          <p className="font-medium text-foreground">{stop.name}</p>
                          {stop.estimated_time && (
                            <p className="text-sm text-muted-foreground mt-1">
                              ~{formatTime(stop.estimated_time)}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                </>
              )}

              {/* Destination */}
              <div
                className="flex items-start gap-3 cursor-pointer hover:bg-secondary/50 rounded-lg p-2 -m-2 transition-colors"
                onClick={() => centerMapOnPoint([
                  trip.destination_coordinates.longitude,
                  trip.destination_coordinates.latitude
                ])}
              >
                <div className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <MapPin className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground mb-1">Destino</p>
                  <p className="font-medium text-foreground">{trip.destination_name}</p>
                  {(() => {
                    const dur = trip.route_duration_min ?? liveRouteDuration;
                    const arrTime = trip.arrival_time || (dur ? new Date(new Date(trip.departure_time).getTime() + dur * 60000).toISOString() : null);
                    if (!arrTime) return null;
                    return (
                      <p className="text-sm text-muted-foreground mt-1">
                        {!trip.arrival_time ? '~' : ''}{formatTime(arrTime)} • {formatDate(arrTime)}
                      </p>
                    );
                  })()}
                </div>
              </div>

              {/* Route Info */}
              {(trip.route_distance_km || trip.route_duration_min || liveRouteDistance || liveRouteDuration) && (
                <div className="pt-3 border-t border-border flex items-center gap-4 text-sm text-muted-foreground">
                  {(trip.route_distance_km || liveRouteDistance) && (() => {
                    const dist = trip.route_distance_km ?? liveRouteDistance!;
                    return (
                      <div className="flex items-center gap-2">
                        <Navigation className="w-4 h-4" />
                        <span>{dist.toFixed(1)} km</span>
                      </div>
                    );
                  })()}
                  {(trip.route_duration_min || liveRouteDuration) && (() => {
                    const mins = trip.route_duration_min ?? liveRouteDuration!;
                    const h = Math.floor(mins / 60);
                    const m = Math.round(mins % 60);
                    const label = mins < 60 ? `${mins} min` : m > 0 ? `${h}h ${m}min` : `${h}h`;
                    return (
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        <span>~{label}</span>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Driver Info */}
        {trip.driver_name && (
          <div className="px-4 mb-4">
            <div className="bg-card rounded-2xl p-4 shadow-md">
              <h2 className="text-lg font-bold text-foreground mb-4">Conductor</h2>

              <div className="flex items-center gap-3 mb-3">
                <UserProfilePopup
                  user={driverProfile}
                  open={isDriverPopupOpen}
                  onOpenChange={setIsDriverPopupOpen}
                  side="right"
                  align="start"
                  trigger={
                    <div
                      className="w-12 h-12 bg-primary-light rounded-full flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity flex-shrink-0"
                      onClick={() => setIsDriverPopupOpen(!isDriverPopupOpen)}
                    >
                      <span className="text-primary font-semibold text-lg">
                        {trip.driver_name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  }
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground truncate">{trip.driver_name}</p>
                  {trip.driver_reputation && (
                    <div className="flex items-center gap-1 mt-1">
                      <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                      <span className="text-sm text-muted-foreground">
                        {trip.driver_reputation.toFixed(1)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              {trip?.status === 'published' && (
                <div className="flex justify-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleContactDriver}
                    disabled={isContactingDriver}
                    className="flex items-center gap-2"
                  >
                    {isContactingDriver ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Conectando...</span>
                      </>
                    ) : (
                      <>
                        <MessageCircle className="w-4 h-4" />
                        <span>Contactar</span>
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Trip Details */}
        <div className="px-4 mb-4">
          <div className="bg-card rounded-2xl p-4 shadow-md">
            <h2 className="text-lg font-bold text-foreground mb-4">Detalles del Viaje</h2>

            <div className="space-y-4">
              {/* Price and Seats */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Asientos disponibles</span>
                </div>
                {trip.available_seats === 0 ? (
                  <span className="font-semibold text-red-500 dark:text-red-400">
                    Ya no queda más espacio
                  </span>
                ) : trip.available_seats === 1 ? (
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-amber-500 dark:text-amber-400">
                      {trip.available_seats} / {trip.total_seats}
                    </span>
                    <span className="text-xs bg-amber-500/15 text-amber-600 dark:text-amber-400 px-2 py-1 rounded-full flex items-center gap-1 font-medium">
                      <Flame className="w-3 h-3" />
                      ¡Últimos asientos!
                    </span>
                  </div>
                ) : (
                  <span className="font-semibold text-foreground">
                    {trip.available_seats} / {trip.total_seats}
                  </span>
                )}
              </div>

              {/* Booking Mode */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Modo de Aprobación</span>
                </div>
                {trip.booking_mode === 'manual' ? (
                  <span className="text-xs bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 px-3 py-1.5 rounded-full font-medium flex items-center gap-1">
                    <UserCheck className="w-4 h-4" />
                    Manual
                  </span>
                ) : (
                  <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-3 py-1.5 rounded-full font-medium flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" />
                    Automática
                  </span>
                )}
              </div>

              {/* User Reservations List */}
              {trip.user_reservations && trip.user_reservations.length > 0 && (
                <div className="pt-3 border-t border-border">
                  <p className="text-sm font-medium text-foreground mb-3">
                    Tus Reservas ({trip.user_reservations.length})
                  </p>
                  <div className="space-y-3">
                    {trip.user_reservations.map((reservation) => {
                      console.log('Rendering reservation:', reservation);
                      return (
                        <div
                          key={reservation.id}
                          className={`rounded-lg p-3 border ${reservation.status === 'confirmed'
                            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                            : reservation.status === 'pending'
                              ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
                              : 'bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-800'
                            }`}
                        >
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-muted-foreground">Asientos reservados</span>
                              <span className="font-semibold text-foreground">
                                {reservation.seat_count}
                              </span>
                            </div>
                            {Number(reservation.children_count) > 0 && (
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground">Niños incluidos</span>
                                <span className="font-semibold text-foreground">
                                  {reservation.children_count}
                                </span>
                              </div>
                            )}
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-muted-foreground">Fecha de reserva</span>
                              <span className="font-semibold text-foreground">
                                {formatDate(reservation.created_at)} • {formatTime(reservation.created_at)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-muted-foreground">Estado</span>
                              <span className={`font-semibold ${reservation.status === 'confirmed'
                                ? 'text-green-600 dark:text-green-400'
                                : reservation.status === 'pending'
                                  ? 'text-amber-600 dark:text-amber-400'
                                  : 'text-gray-600 dark:text-gray-400'
                                }`}>
                                {reservation.status === 'confirmed' && 'Confirmada'}
                                {reservation.status === 'pending' && 'Pendiente'}
                                {reservation.status === 'cancelled' && 'Cancelada'}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Precio - Comentado por ahora, se usará en el futuro */}
              {/* <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Precio por persona</span>
                </div>
                <span className="text-2xl font-bold text-primary">
                  {trip.currency === 'SOL' ? 'S/' : '$'}{trip.price_per_seat}
                </span>
              </div> */}

              {/* Description */}
              {trip.description && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Descripción</p>
                  <p className="text-foreground">{trip.description}</p>
                </div>
              )}

              {/* Preferences */}
              {trip.preferences && (
                <div>
                  <p className="text-sm text-muted-foreground mb-3">Preferencias</p>
                  <div className="flex flex-wrap gap-2">
                    {trip.preferences.allow_pets && (
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-secondary rounded-full">
                        <Dog className="w-4 h-4 text-primary" />
                        <span className="text-sm text-foreground">Mascotas permitidas</span>
                      </div>
                    )}
                    {trip.preferences.allow_smoking && (
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-secondary rounded-full">
                        <Cigarette className="w-4 h-4 text-primary" />
                        <span className="text-sm text-foreground">Fumar permitido</span>
                      </div>
                    )}
                    {trip.preferences.allow_luggage !== false && (
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-secondary rounded-full">
                        <Package className="w-4 h-4 text-primary" />
                        <span className="text-sm text-foreground">Equipaje permitido</span>
                      </div>
                    )}
                    {trip.preferences.music_preference && (
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-secondary rounded-full">
                        <Music className="w-4 h-4 text-primary" />
                        <span className="text-sm text-foreground">{trip.preferences.music_preference}</span>
                      </div>
                    )}
                    {trip.preferences.car_features && trip.preferences.car_features.length > 0 && (
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-secondary rounded-full">
                        <span className="text-sm text-foreground">
                          {trip.preferences.car_features.join(', ')}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Created Date */}
              <div className="flex items-center gap-2 pt-3 border-t border-border">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  Publicado el {formatDateTime(trip.created_at)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Vehicle Details */}
        {(trip.vehicle_brand || trip.vehicle_model) && (
          <div className="px-4 mb-4">
            <div className="bg-card rounded-2xl p-4 shadow-md">
              <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
                <Car className="w-5 h-5 text-primary" />
                Detalles del Vehículo
              </h2>

              <div className="grid grid-cols-2 gap-4">
                {trip.vehicle_brand && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Marca</p>
                    <p className="font-medium text-foreground">{trip.vehicle_brand}</p>
                  </div>
                )}
                {trip.vehicle_model && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Modelo</p>
                    <p className="font-medium text-foreground">{trip.vehicle_model}</p>
                  </div>
                )}
                {trip.vehicle_year && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Año</p>
                    <p className="font-medium text-foreground">{trip.vehicle_year}</p>
                  </div>
                )}
                {trip.vehicle_color && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Color</p>
                    <p className="font-medium text-foreground capitalize">{trip.vehicle_color}</p>
                  </div>
                )}
                {trip.vehicle_plate && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Placa</p>
                    <p className="font-medium text-foreground font-mono">{trip.vehicle_plate}</p>
                  </div>
                )}
                {trip.vehicle_seat_capacity && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Capacidad</p>
                    <p className="font-medium text-foreground">{trip.vehicle_seat_capacity} asientos</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Success Animation Overlay */}
        {showSuccessAnimation && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
            <div className="bg-card rounded-3xl p-8 mx-4 max-w-sm w-full text-center animate-slide-up shadow-2xl">
              <div className={`w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 transition-all ${reservationStatus === 'confirmed'
                ? 'bg-green-500/20 animate-bounce'
                : 'bg-amber-500/20 animate-pulse'
                }`}>
                <Check className={`w-12 h-12 transition-all ${reservationStatus === 'confirmed' ? 'text-green-500' : 'text-amber-500'
                  }`} />
              </div>
              <h2 className="text-2xl font-bold text-foreground mb-2">
                {reservationStatus === 'confirmed'
                  ? '¡Registro Exitoso!'
                  : trip?.booking_mode === 'auto'
                    ? '¡Registro Exitoso!'
                    : 'Solicitud Enviada'}
              </h2>
              <p className="text-muted-foreground">
                {reservationStatus === 'confirmed'
                  ? 'Tu reserva ha sido confirmada automáticamente'
                  : trip?.booking_mode === 'auto'
                    ? 'Tu reserva ha sido confirmada automáticamente'
                    : 'El conductor revisará tu solicitud pronto'}
              </p>
            </div>
          </div>
        )}

        {/* Dialog: ¿Viaje de vuelta? */}
        {trip && (
          <Dialog open={showReturnTripDialog} onOpenChange={setShowReturnTripDialog}>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>¿También necesitas viaje de vuelta?</DialogTitle>
                <DialogDescription className="flex items-center gap-2 pt-1">
                  <span className="font-medium text-foreground">{trip.destination_name}</span>
                  <ArrowRight className="w-4 h-4 shrink-0" />
                  <span className="font-medium text-foreground">{trip.origin_name}</span>
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="flex-col gap-2 sm:flex-col">
                <Button
                  onClick={() => {
                    const dateStr = trip.departure_time.slice(0, 10); // "YYYY-MM-DD" en UTC
                    setShowReturnTripDialog(false);
                    navigate('/search', {
                      state: {
                        returnTrip: {
                          originName: trip.destination_name,
                          originCoords: [
                            trip.destination_coordinates.longitude,
                            trip.destination_coordinates.latitude,
                          ] as [number, number],
                          destinationName: trip.origin_name,
                          destinationCoords: [
                            trip.origin_coordinates.longitude,
                            trip.origin_coordinates.latitude,
                          ] as [number, number],
                          date: dateStr,
                        },
                      },
                    });
                  }}
                  className="w-full"
                >
                  Sí, buscar regreso
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowReturnTripDialog(false)}
                  className="w-full"
                >
                  No, gracias
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {/* Driver Trip Lifecycle Buttons */}
        {isOwner && trip.status === 'published' && (
          <div className="px-4 mb-3">
            <Button
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
              size="lg"
              onClick={handleStartTrip}
              disabled={isStartingTrip}
            >
              {isStartingTrip ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Iniciando...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Iniciar Viaje
                </>
              )}
            </Button>
          </div>
        )}

        {isOwner && trip.status === 'in_progress' && (
          <div className="px-4 mb-3">
            <Button
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              size="lg"
              onClick={() => setShowCompleteDialog(true)}
              disabled={isCompletingTrip}
            >
              {isCompletingTrip ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Completando...
                </>
              ) : (
                <>
                  <CircleCheck className="w-4 h-4 mr-2" />
                  Completar Viaje
                </>
              )}
            </Button>

            <div className="flex justify-center mt-2">
              <button
                onClick={() => navigate('/wallet')}
                className="text-sm text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors"
              >
                <Wallet className="w-3.5 h-3.5" />
                Ver mi billetera
              </button>
            </div>
          </div>
        )}

        {/* Confirm Complete Trip Dialog */}
        <AlertDialog open={showCompleteDialog} onOpenChange={setShowCompleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Completar viaje</AlertDialogTitle>
              <AlertDialogDescription>
                Esta accion no se puede deshacer. Se deducira la comision de tu billetera
                y el viaje se marcara como completado.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isCompletingTrip}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleCompleteTrip}
                disabled={isCompletingTrip}
              >
                {isCompletingTrip ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Procesando...
                  </>
                ) : (
                  'Si, completar viaje'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Seat Selector and Action Button */}
        <div className="px-4 space-y-3">
          {/* Seat Count Selector */}
          {trip && trip.status === 'published' && trip.available_seats > 0 && (
            <div className="bg-card rounded-2xl p-4 shadow-md">
              <label className="text-sm font-medium text-foreground mb-2 block">
                Asientos a reservar
              </label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setSeatCount(Math.max(1, seatCount - 1))}
                  disabled={seatCount <= 1}
                  className="w-10 h-10 rounded-lg border border-border bg-background hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
                >
                  <span className="text-lg font-semibold">−</span>
                </button>
                <input
                  type="number"
                  min={1}
                  max={trip.available_seats}
                  value={seatCount}
                  onChange={(e) => {
                    const value = parseInt(e.target.value) || 1;
                    const clampedValue = Math.max(1, Math.min(value, trip.available_seats));
                    setSeatCount(clampedValue);
                  }}
                  className="flex-1 h-10 px-4 text-center text-lg font-semibold border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <button
                  type="button"
                  onClick={() => setSeatCount(Math.min(trip.available_seats, seatCount + 1))}
                  disabled={seatCount >= trip.available_seats}
                  className="w-10 h-10 rounded-lg border border-border bg-background hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
                >
                  <span className="text-lg font-semibold">+</span>
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-2 text-center">
                Máximo {trip.available_seats} asiento{trip.available_seats !== 1 ? 's' : ''} disponible{trip.available_seats !== 1 ? 's' : ''}
              </p>
              <div className="flex items-start gap-3 mt-4 pt-3 border-t border-border">
                <Checkbox
                  id="travels-with-children"
                  checked={childrenCount > 0}
                  onCheckedChange={(checked) => setChildrenCount(checked ? 1 : 0)}
                  aria-label="Viajo con niños"
                />
                <label htmlFor="travels-with-children" className="text-sm leading-5 cursor-pointer">
                  <span className="font-medium text-foreground flex items-center gap-1.5">
                    <Baby className="w-4 h-4 text-primary" />
                    Viajo con niños
                  </span>
                  <span className="block text-xs text-muted-foreground mt-0.5">
                    Avísale al conductor para coordinar un viaje adecuado.
                  </span>
                </label>
              </div>
              {childrenCount > 0 && (
                <div className="flex items-center gap-2 mt-3">
                  <label htmlFor="children-count" className="text-xs text-muted-foreground flex-1">
                    ¿Cuántos niños?
                  </label>
                  <input
                    id="children-count"
                    type="number"
                    min={1}
                    max={seatCount}
                    value={childrenCount}
                    onChange={(event) => {
                      const value = Number(event.target.value) || 1;
                      setChildrenCount(Math.max(1, Math.min(value, seatCount)));
                    }}
                    className="w-16 h-9 px-2 text-center border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              )}
            </div>
          )}

          <Button
            className={`w-full ${reservationStatus === 'confirmed'
              ? 'bg-green-600 hover:bg-green-700 text-white'
              : reservationStatus === 'pending'
                ? 'bg-amber-500 hover:bg-amber-600 text-white'
                : trip && trip.status === 'completed'
                  ? 'bg-amber-600 hover:bg-amber-700 text-white cursor-not-allowed'
                  : trip && (trip.available_seats < 1 || trip.status !== 'published')
                    ? 'bg-gray-400 text-white cursor-not-allowed'
                    : ''
              }`}
            size="lg"
            onClick={handleReserveTrip}
            disabled={
              isReserving ||
              (trip?.available_seats ?? 0) < 1 ||
              trip?.status !== 'published'
            }
          >
            {isReserving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Procesando...
              </>
            ) : trip && trip.status === 'completed' ? (
              <>
                <CheckCircle className="w-4 h-4 mr-2" />
                Viaje Completado
              </>
            ) : trip && trip.status === 'cancelled' ? (
              <>
                <XCircle className="w-4 h-4 mr-2" />
                Viaje Cancelado
              </>
            ) : trip && trip.status === 'in_progress' ? (
              <>
                <Clock className="w-4 h-4 mr-2" />
                Viaje En Curso
              </>
            ) : trip && trip.available_seats < 1 ? (
              <>
                <XCircle className="w-4 h-4 mr-2" />
                Ya no queda más espacio
              </>
            ) : (trip?.user_reservations && trip.user_reservations.length > 0) ? (
              <>
                <Plus className="w-4 h-4 mr-2" />
                {trip?.booking_mode === 'manual' ? 'Solicitar reserva de' : 'Reservar'} {seatCount} Asiento{seatCount !== 1 ? 's' : ''}
              </>
            ) : (
              <>
                {trip?.booking_mode === 'manual' ? 'Solicitar reserva de' : 'Reservar'} {seatCount} Asiento{seatCount !== 1 ? 's' : ''}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default TripDetails;
