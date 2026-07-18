import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { MapPin, X, Search, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Geolocation } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';
import { setOptions, importLibrary } from '@googlemaps/js-api-loader';

// Access token - Public key (safe to include in client code)
const MAPBOX_TOKEN =
  import.meta.env.VITE_MAPBOX_ACCESS_TOKEN ||
  'pk.eyJ1IjoibGVzZWwiLCJhIjoiY21rcTMzZHZpMGx2dzNrb3FuanUxNjZ3cyJ9.QckkRB2ojiFgnJL9dLeVew';

const GOOGLE_PLACES_API_KEY = import.meta.env.VITE_GOOGLE_PLACES_API_KEY || '';

// Centro de Arequipa para bias de Google Places
const AREQUIPA_CENTER = { lat: -16.409, lng: -71.537 };

// Inicializar Google Maps JS API (singleton — safe ante montajes concurrentes)
let placesLibrary: google.maps.PlacesLibrary | null = null;
let initPromise: Promise<void> | null = null;
let googlePlacesUnavailable = false;

const initGooglePlaces = () => {
  if (!initPromise) {
    initPromise = (async () => {
      if (!GOOGLE_PLACES_API_KEY) {
        console.warn('Google Places API key not configured');
        googlePlacesUnavailable = true;
        return;
      }
      try {
        setOptions({ key: GOOGLE_PLACES_API_KEY, v: 'weekly', language: 'es', region: 'pe' });
        placesLibrary = await importLibrary('places');
        googlePlacesUnavailable = false;
      } catch (error) {
        googlePlacesUnavailable = true;
        console.error('Google Places init error:', error);
      }
    })();
  }
  return initPromise;
};

interface PlaceSuggestion {
  placeId: string;
  mainText: string;
  secondaryText: string;
  fullText: string;
  provider: 'google' | 'mapbox';
  coordinates?: [number, number];
}

interface MapboxLocationPickerProps {
  value: string;
  onChange: (location: string, coordinates?: [number, number]) => void;
  placeholder: string;
  icon?: 'origin' | 'destination';
  /** Coordenadas iniciales para preseleccionar el marker al abrir */
  initialCoordinates?: [number, number];
  /** Abre el mapa inmediatamente al montar (sin necesitar clic en el trigger) */
  defaultOpen?: boolean;
  /** Oculta el botón trigger — útil cuando el padre gestiona la apertura */
  hideTrigger?: boolean;
  /** Callback cuando el usuario cierra el mapa sin confirmar */
  onClose?: () => void;
}

const MapboxLocationPicker = React.forwardRef<HTMLDivElement, MapboxLocationPickerProps>(({
  value,
  onChange,
  placeholder,
  icon = 'destination',
  initialCoordinates,
  defaultOpen = false,
  hideTrigger = false,
  onClose,
}, ref) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [selectedLocation, setSelectedLocation] = useState(value);
  const [coordinates, setCoordinates] = useState<[number, number] | null>(initialCoordinates || null);
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchProvider, setSearchProvider] = useState<'google' | 'mapbox'>(
    GOOGLE_PLACES_API_KEY ? 'google' : 'mapbox'
  );
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const userLocationMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setSelectedLocation(value);
  }, [value]);

  // Inicializar Google Places al abrir el mapa
  useEffect(() => {
    if (isOpen) {
      initGooglePlaces()
        .then(() => {
          if (placesLibrary && !googlePlacesUnavailable) {
            setSearchProvider('google');
          } else {
            setSearchProvider('mapbox');
          }
        })
        .catch(() => {
          setSearchProvider('mapbox');
        });
    }
  }, [isOpen]);

  const getSessionToken = useCallback(() => {
    if (!sessionTokenRef.current && placesLibrary) {
      sessionTokenRef.current = new placesLibrary.AutocompleteSessionToken();
    }
    return sessionTokenRef.current;
  }, []);

  const resetSessionToken = useCallback(() => {
    sessionTokenRef.current = null;
  }, []);

  const searchPlacesWithMapbox = useCallback(async (query: string) => {
    const response = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${MAPBOX_TOKEN}&language=es&autocomplete=true&limit=8&country=pe&proximity=${AREQUIPA_CENTER.lng},${AREQUIPA_CENTER.lat}`
    );
    const data = await response.json();
    const features = Array.isArray(data.features) ? data.features : [];
    const mapped: PlaceSuggestion[] = features.map((feature: any) => {
      const placeName = String(feature.place_name || '');
      const parts = placeName.split(',').map((part) => part.trim()).filter(Boolean);
      return {
        placeId: String(feature.id || placeName),
        mainText: String(feature.text || parts[0] || placeName),
        secondaryText: parts.slice(1).join(', '),
        fullText: placeName,
        provider: 'mapbox',
        coordinates: Array.isArray(feature.center) ? [feature.center[0], feature.center[1]] : undefined,
      };
    });
    setSearchProvider('mapbox');
    setSuggestions(mapped);
    setShowSuggestions(mapped.length > 0);
  }, []);

  const searchPlaces = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSuggestions([]);
      return;
    }

    setIsSearching(true);
    try {
      if (!placesLibrary || googlePlacesUnavailable || searchProvider === 'mapbox') {
        await searchPlacesWithMapbox(query);
        return;
      }

      const request: google.maps.places.AutocompleteRequest = {
        input: query,
        locationBias: { center: AREQUIPA_CENTER, radius: 30000 },
        language: 'es',
        region: 'pe',
        sessionToken: getSessionToken(),
      };

      const { suggestions: autocompleteSuggestions } =
        await placesLibrary.AutocompleteSuggestion.fetchAutocompleteSuggestions(request);

      const mapped: PlaceSuggestion[] = autocompleteSuggestions
        .filter((s) => s.placePrediction)
        .map((s) => ({
          placeId: s.placePrediction!.placeId,
          mainText: s.placePrediction!.mainText?.text || '',
          secondaryText: s.placePrediction!.secondaryText?.text || '',
          fullText: s.placePrediction!.text?.text || '',
          provider: 'google',
        }));

      setSearchProvider('google');
      setSuggestions(mapped);
      setShowSuggestions(mapped.length > 0);
    } catch (error) {
      console.error('Google Places autocomplete error:', error);
      await searchPlacesWithMapbox(query);
    } finally {
      setIsSearching(false);
    }
  }, [getSessionToken, searchPlacesWithMapbox, searchProvider]);

  const handleSearchInput = useCallback((value: string) => {
    setSearchQuery(value);
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    if (value.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    debounceTimerRef.current = setTimeout(() => searchPlaces(value), 300);
  }, [searchPlaces]);

  const handleSelectSuggestion = useCallback(async (suggestion: PlaceSuggestion) => {
    setShowSuggestions(false);
    setSearchQuery(suggestion.mainText);

    try {
      if (suggestion.provider === 'mapbox') {
        if (!suggestion.coordinates) return;
        const [lng, lat] = suggestion.coordinates;
        setSelectedLocation(suggestion.fullText);
        setCoordinates([lng, lat]);
        if (markerRef.current && mapRef.current) {
          markerRef.current.setLngLat([lng, lat]).addTo(mapRef.current);
          mapRef.current.flyTo({ center: [lng, lat], zoom: 16, essential: true });
        }
        return;
      }

      if (!placesLibrary) return;

      const place = new placesLibrary.Place({ id: suggestion.placeId });
      await place.fetchFields({ fields: ['location', 'displayName', 'formattedAddress'] });

      const location = place.location;
      if (!location) return;

      const lng = location.lng();
      const lat = location.lat();
      const displayName = place.displayName || suggestion.mainText;
      const name = suggestion.secondaryText
        ? `${displayName}, ${suggestion.secondaryText}`
        : displayName;

      setSelectedLocation(name);
      setCoordinates([lng, lat]);

      // Posicionar marker en el mapa
      if (markerRef.current && mapRef.current) {
        markerRef.current.setLngLat([lng, lat]).addTo(mapRef.current);
        mapRef.current.flyTo({ center: [lng, lat], zoom: 16, essential: true });
      }

      // Resetear session token después de selección (Google cobra por sesión)
      resetSessionToken();
    } catch (error) {
      console.error('Error fetching place details:', error);
    }
  }, [resetSessionToken]);

  useEffect(() => {
    if (!isOpen || !mapContainerRef.current || !MAPBOX_TOKEN) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;

    // Default center: Arequipa, Peru (o coordenadas previas si existen)
    const defaultCenter: [number, number] = initialCoordinates || [-71.537, -16.409];
    const initialZoom = initialCoordinates ? 16 : 12;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/standard',
      center: defaultCenter,
      zoom: initialZoom,
    });

    mapRef.current = map;

    // ── GeolocateControl: punto azul que muestra tu ubicación real ──────────────
    const geolocate = new mapboxgl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      trackUserLocation: true,     // Punto azul sigue al usuario
      showUserHeading: true,       // Muestra dirección de movimiento
      showAccuracyCircle: false,   // Evita círculo gigante de baja precisión (desktop)
    });

    map.addControl(geolocate, 'top-right');

    const renderUserLocation = (longitude: number, latitude: number) => {
      const userCoords: [number, number] = [longitude, latitude];

      if (!userLocationMarkerRef.current) {
        userLocationMarkerRef.current = new mapboxgl.Marker({ color: '#2563eb' })
          .setLngLat(userCoords)
          .addTo(map);
      } else {
        userLocationMarkerRef.current.setLngLat(userCoords);
      }

      map.flyTo({ center: userCoords, zoom: 14, essential: true });
    };

    const getCurrentLocation = async (): Promise<{ longitude: number; latitude: number } | null> => {
      try {
        if (Capacitor.isNativePlatform()) {
          const permission = await Geolocation.requestPermissions();
          if (permission.location === 'denied') return null;
          const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 10000 });
          return { longitude: pos.coords.longitude, latitude: pos.coords.latitude };
        }
        if (!('geolocation' in navigator)) return null;
        return await new Promise((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (p) => resolve({ longitude: p.coords.longitude, latitude: p.coords.latitude }),
            () => resolve(null),
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
          );
        });
      } catch {
        return null;
      }
    };

    // Solo centrar si ya hay permiso concedido — no solicitar automáticamente al cargar
    map.on('load', async () => {
      try {
        if (Capacitor.isNativePlatform()) {
          const perm = await Geolocation.checkPermissions();
          if (perm.location === 'granted') {
            const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 5000 });
            renderUserLocation(pos.coords.longitude, pos.coords.latitude);
          }
        } else {
          const currentLocation = await getCurrentLocation();
          if (currentLocation) renderUserLocation(currentLocation.longitude, currentLocation.latitude);
        }
      } catch {
        // permiso no concedido aún — el usuario usará el botón
      }
    });

    // Ajustar proximidad del geocoder a la ubicación real si está disponible
    geolocate.on('geolocate', (e: GeolocationPosition) => {
      renderUserLocation(e.coords.longitude, e.coords.latitude);
    });

    geolocate.on('error', async () => {
      try {
        const currentLocation = await getCurrentLocation();
        if (currentLocation) {
          renderUserLocation(currentLocation.longitude, currentLocation.latitude);
        }
      } catch (e) {
        console.warn('Geolocate fallback failed:', e);
      }
    });

    // ── Controles de navegación (zoom) ─────────────────────────────────────────
    map.addControl(new mapboxgl.NavigationControl(), 'top-right');

    // ── Marcador de selección (color violeta, arrastrable) ─────────────────────
    const marker = new mapboxgl.Marker({
      color: '#8B5CF6',
      draggable: true,
    });

    markerRef.current = marker;

    // Preseleccionar marker si hay coordenadas iniciales
    if (initialCoordinates) {
      marker.setLngLat(initialCoordinates).addTo(map);
    }

    // Handle marker drag
    marker.on('dragend', async () => {
      const lngLat = marker.getLngLat();
      setCoordinates([lngLat.lng, lngLat.lat]);
      try {
        const response = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${lngLat.lng},${lngLat.lat}.json?access_token=${MAPBOX_TOKEN}&language=es`
        );
        const data = await response.json();
        if (data.features && data.features.length > 0) {
          setSelectedLocation(data.features[0].place_name);
        }
      } catch (error) {
        console.error('Error reverse geocoding:', error);
      }
    });

    // Handle map click
    map.on('click', async (e) => {
      const { lng, lat } = e.lngLat;
      marker.setLngLat([lng, lat]).addTo(map);
      setCoordinates([lng, lat]);

      try {
        const response = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${MAPBOX_TOKEN}&language=es`
        );
        const data = await response.json();
        if (data.features && data.features.length > 0) {
          setSelectedLocation(data.features[0].place_name);
        }
      } catch (error) {
        console.error('Error reverse geocoding:', error);
      }
    });

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      if (userLocationMarkerRef.current) {
        userLocationMarkerRef.current.remove();
        userLocationMarkerRef.current = null;
      }
      map.remove();
    };
  }, [isOpen, placeholder]);

  const handleConfirm = () => {
    if (selectedLocation) {
      const coords = markerRef.current?.getLngLat();
      onChange(selectedLocation, coords ? [coords.lng, coords.lat] : undefined);
    }
    setIsOpen(false);
  };

  const handleClose = () => {
    setSelectedLocation(value);
    setIsOpen(false);
    onClose?.();
  };

  return (
    <>
      {/* Input trigger — oculto cuando el padre gestiona la apertura */}
      {!hideTrigger && (
        <div
          onClick={() => setIsOpen(true)}
          className="relative cursor-pointer"
        >
          <MapPin
            className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 ${icon === 'origin' ? 'text-primary' : 'text-muted-foreground'
              }`}
          />
          <div className="w-full h-12 pl-12 pr-4 rounded-xl border-2 border-input bg-background text-foreground flex items-center hover:border-primary transition-colors">
            {value || <span className="text-muted-foreground">{placeholder}</span>}
          </div>
        </div>
      )}

      {/* Map Modal — portal al body para escapar de stacking contexts padres */}
      {isOpen && createPortal(
        <div className="fixed inset-0 z-50 bg-background animate-fade-in">
          {!MAPBOX_TOKEN && (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center">
              <MapPin className="w-16 h-16 text-destructive mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">Token de Mapbox no configurado</h3>
              <p className="text-muted-foreground mb-4">
                Configura la variable de entorno VITE_MAPBOX_ACCESS_TOKEN con tu token de Mapbox.
              </p>
              <Button onClick={handleClose} variant="outline">Cerrar</Button>
            </div>
          )}
          {MAPBOX_TOKEN && (
            <div className="flex flex-col h-full">
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-border bg-card">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleClose}
                >
                  <X className="w-5 h-5" />
                </Button>
                <h2 className="font-display font-semibold text-foreground">
                  {placeholder}
                </h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleConfirm}
                  disabled={!selectedLocation}
                  className="text-primary font-medium"
                >
                  Confirmar
                </Button>
              </div>

              {/* Google Places search input */}
              <div className="relative p-3 border-b border-border bg-card">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => handleSearchInput(e.target.value)}
                    onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                    placeholder={placeholder}
                    className="w-full h-10 pl-10 pr-10 rounded-lg border border-input bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    autoFocus
                  />
                  {isSearching && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />
                  )}
                  {!isSearching && searchQuery && (
                    <button
                      onClick={() => {
                        setSearchQuery('');
                        setSuggestions([]);
                        setShowSuggestions(false);
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="mt-2 px-1 text-[11px] text-muted-foreground">
                  {searchProvider === 'google'
                    ? 'Autocomplete: Google Places'
                    : 'Autocomplete: fallback Mapbox (modo compatible con WebView Android)'}
                </div>

                {/* Suggestions dropdown */}
                {showSuggestions && suggestions.length > 0 && (
                  <div className="absolute left-3 right-3 top-full mt-1 bg-card border border-border rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
                    {suggestions.map((suggestion) => (
                      <button
                        key={`${suggestion.provider}:${suggestion.placeId}`}
                        onClick={() => handleSelectSuggestion(suggestion)}
                        className="w-full px-4 py-3 text-left hover:bg-accent transition-colors border-b border-border last:border-b-0 flex items-start gap-3"
                      >
                        <MapPin className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-foreground truncate">
                            {suggestion.mainText}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {suggestion.secondaryText}
                          </div>
                          <div className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground/70">
                            {suggestion.provider}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Selected location preview */}
              {selectedLocation && (
                <div className="p-3 bg-primary-light border-b border-border">
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="w-4 h-4 text-primary flex-shrink-0" />
                    <span className="text-foreground line-clamp-1">{selectedLocation}</span>
                  </div>
                  {coordinates && (
                    <div className="mt-1 text-xs text-muted-foreground font-mono">
                      📍 {coordinates[1].toFixed(6)}, {coordinates[0].toFixed(6)}
                    </div>
                  )}
                </div>
              )}

              {/* Map container */}
              <div
                ref={mapContainerRef}
                className="flex-1 w-full"
              />

              {/* Bottom instructions */}
              <div className="p-4 bg-card border-t border-border">
                <p className="text-sm text-muted-foreground text-center">
                  Busca una ubicación o toca el mapa para seleccionar
                </p>
              </div>
            </div>
          )}
        </div>,
        document.body
      )}
    </>
  );
});

MapboxLocationPicker.displayName = 'MapboxLocationPicker';

export default MapboxLocationPicker;
