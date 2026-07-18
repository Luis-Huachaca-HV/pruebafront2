import React, { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Navigation, MapPin, Check, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

const MAPBOX_TOKEN = 'pk.eyJ1IjoibGVzZWwiLCJhIjoiY21rcTMzZHZpMGx2dzNrb3FuanUxNjZ3cyJ9.QckkRB2ojiFgnJL9dLeVew';

export interface RouteOption {
  id: string;
  geometry: GeoJSON.LineString;
  duration: number;
  distance: number;
  summary: string;
}

interface IntermediateCity {
  name: string;
  coordinates: [number, number];
  distance: number;
}

interface RouteMapDisplayProps {
  originCoords?: [number, number];
  destinationCoords?: [number, number];
  originName: string;
  destinationName: string;
  onRouteConfirmed?: (route: RouteOption, selectedStops: IntermediateCity[]) => void;
  selectedStops?: IntermediateCity[];
  onStopsChange?: (stops: IntermediateCity[]) => void;
  simpleMode?: boolean; // Only show markers, no route
}

const RouteMapDisplay: React.FC<RouteMapDisplayProps> = ({
  originCoords,
  destinationCoords,
  originName,
  destinationName,
  onRouteConfirmed,
  selectedStops = [],
  onStopsChange,
  simpleMode = false,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [routes, setRoutes] = useState<RouteOption[]>([]);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(0);
  const [intermediateCities, setIntermediateCities] = useState<IntermediateCity[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [routeConfirmed, setRouteConfirmed] = useState(false);
  const [showStops, setShowStops] = useState(true);
  const [localSelectedStops, setLocalSelectedStops] = useState<IntermediateCity[]>(selectedStops);

  const fetchRoutes = useCallback(async () => {
    if (!originCoords || !destinationCoords || simpleMode) return;

    setIsLoading(true);
    setRouteConfirmed(false);
    setIntermediateCities([]);
    setLocalSelectedStops([]);

    try {
      const response = await fetch(
        `https://api.mapbox.com/directions/v5/mapbox/driving/${originCoords[0]},${originCoords[1]};${destinationCoords[0]},${destinationCoords[1]}?alternatives=true&geometries=geojson&overview=full&steps=true&access_token=${MAPBOX_TOKEN}`
      );
      const data = await response.json();

      if (data.routes && data.routes.length > 0) {
        const routeOptions: RouteOption[] = data.routes.map((route: any, index: number) => ({
          id: `route-${index}`,
          geometry: route.geometry,
          duration: route.duration,
          distance: route.distance,
          summary: route.legs[0]?.summary || `Ruta ${index + 1}`,
        }));

        setRoutes(routeOptions);
        setSelectedRouteIndex(0);
      }
    } catch (error) {
      console.error('Error fetching routes:', error);
    } finally {
      setIsLoading(false);
    }
  }, [originCoords, destinationCoords, simpleMode]);

  useEffect(() => {
    fetchRoutes();
  }, [fetchRoutes]);

  useEffect(() => {
    if (!mapContainerRef.current || !originCoords || !destinationCoords) return;
    if (!simpleMode && routes.length === 0) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;

    // Clean up previous map instance safely
    if (mapRef.current) {
      try {
        mapRef.current.remove();
      } catch (e) {
        // Map might already be removed or not fully initialized
        console.log('Map cleanup skipped');
      }
      mapRef.current = null;
    }

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [
        (originCoords[0] + destinationCoords[0]) / 2,
        (originCoords[1] + destinationCoords[1]) / 2,
      ],
      zoom: 6,
    });

    mapRef.current = map;
    let isMapLoaded = false;

    map.on('load', () => {
      isMapLoaded = true;

      // Only add routes if not in simple mode
      if (!simpleMode) {
        routes.forEach((route, index) => {
          const isSelected = index === selectedRouteIndex;

          map.addSource(`route-${index}`, {
            type: 'geojson',
            data: {
              type: 'Feature',
              properties: {},
              geometry: route.geometry,
            },
          });

          map.addLayer({
            id: `route-${index}`,
            type: 'line',
            source: `route-${index}`,
            layout: {
              'line-join': 'round',
              'line-cap': 'round',
            },
            paint: {
              'line-color': isSelected ? '#8B5CF6' : '#94a3b8',
              'line-width': isSelected ? 5 : 3,
              'line-opacity': isSelected ? 1 : 0.5,
            },
          });

          // Click handler for route selection
          map.on('click', `route-${index}`, () => {
            if (!routeConfirmed) {
              setSelectedRouteIndex(index);
            }
          });

          map.on('mouseenter', `route-${index}`, () => {
            map.getCanvas().style.cursor = 'pointer';
          });

          map.on('mouseleave', `route-${index}`, () => {
            map.getCanvas().style.cursor = '';
          });
        });
      }

      // Origin marker
      new mapboxgl.Marker({ color: '#22c55e' })
        .setLngLat(originCoords)
        .setPopup(new mapboxgl.Popup().setHTML(`<strong>Origen:</strong> ${originName}`))
        .addTo(map);

      // Destination marker
      new mapboxgl.Marker({ color: '#ef4444' })
        .setLngLat(destinationCoords)
        .setPopup(new mapboxgl.Popup().setHTML(`<strong>Destino:</strong> ${destinationName}`))
        .addTo(map);

      // Fit bounds to show both points
      const bounds = new mapboxgl.LngLatBounds()
        .extend(originCoords)
        .extend(destinationCoords);

      map.fitBounds(bounds, { padding: 50 });
    });

    return () => {
      // Only remove if the map was loaded and still exists
      if (mapRef.current && isMapLoaded) {
        try {
          mapRef.current.remove();
        } catch (e) {
          // Ignore cleanup errors
        }
      }
      mapRef.current = null;
    };
  }, [originCoords, destinationCoords, routes, selectedRouteIndex, originName, destinationName, routeConfirmed, simpleMode]);

  useEffect(() => {
    if (!mapRef.current || routes.length === 0 || simpleMode) return;

    const map = mapRef.current;

    routes.forEach((_, index) => {
      const isSelected = index === selectedRouteIndex;

      if (map.getLayer(`route-${index}`)) {
        map.setPaintProperty(`route-${index}`, 'line-color', isSelected ? '#8B5CF6' : '#94a3b8');
        map.setPaintProperty(`route-${index}`, 'line-width', isSelected ? 5 : 3);
        map.setPaintProperty(`route-${index}`, 'line-opacity', isSelected ? 1 : 0.5);
      }
    });
  }, [selectedRouteIndex, routes, simpleMode]);

  const extractIntermediateCities = async () => {
    if (routes.length === 0 || !routes[selectedRouteIndex]) return;

    setIsLoading(true);
    const selectedRoute = routes[selectedRouteIndex];
    const coords = selectedRoute.geometry.coordinates;

    // Sample points along the route (every ~20% of the route)
    const sampleCount = 5;
    const cities: IntermediateCity[] = [];

    for (let i = 1; i < sampleCount; i++) {
      const index = Math.floor((coords.length * i) / sampleCount);
      const coord = coords[index] as [number, number];

      try {
        const response = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${coord[0]},${coord[1]}.json?types=place&access_token=${MAPBOX_TOKEN}&language=es`
        );
        const data = await response.json();

        if (data.features && data.features.length > 0) {
          const cityName = data.features[0].text || data.features[0].place_name;

          // Avoid duplicates
          if (!cities.some(c => c.name === cityName) &&
            cityName !== originName.split(',')[0] &&
            cityName !== destinationName.split(',')[0]) {
            cities.push({
              name: cityName,
              coordinates: coord,
              distance: (selectedRoute.distance * i) / sampleCount / 1000, // km
            });
          }
        }
      } catch (error) {
        console.error('Error fetching city name:', error);
      }
    }

    setIntermediateCities(cities);
    setIsLoading(false);
  };

  const handleConfirmRoute = async () => {
    setRouteConfirmed(true);
    await extractIntermediateCities();

    if (onRouteConfirmed && routes[selectedRouteIndex]) {
      onRouteConfirmed(routes[selectedRouteIndex], localSelectedStops);
    }
  };

  const handleStopToggle = (city: IntermediateCity) => {
    const isSelected = localSelectedStops.some(s => s.name === city.name);
    let newStops: IntermediateCity[];

    if (isSelected) {
      newStops = localSelectedStops.filter(s => s.name !== city.name);
    } else {
      newStops = [...localSelectedStops, city];
    }

    setLocalSelectedStops(newStops);
    onStopsChange?.(newStops);
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${minutes}min` : `${minutes}min`;
  };

  const formatDistance = (meters: number) => {
    return `${(meters / 1000).toFixed(1)} km`;
  };

  if (!originCoords || !destinationCoords) {
    return (
      <div className="bg-muted/50 rounded-xl p-6 text-center">
        <Navigation className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">
          Selecciona origen y destino para ver la ruta
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Map */}
      <div className="relative rounded-xl overflow-hidden border border-border">
        <div ref={mapContainerRef} className="h-48 w-full" />

        {isLoading && (
          <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
          </div>
        )}
      </div>

      {/* Route Options */}
      {routes.length > 1 && !routeConfirmed && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Rutas disponibles:</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {routes.map((route, index) => (
              <button
                key={route.id}
                onClick={() => setSelectedRouteIndex(index)}
                className={cn(
                  "flex-shrink-0 px-3 py-2 rounded-lg border-2 transition-all text-left min-w-[140px]",
                  index === selectedRouteIndex
                    ? "border-primary bg-primary/10"
                    : "border-border bg-card hover:border-primary/50"
                )}
              >
                <p className="text-xs font-medium text-foreground truncate">
                  {route.summary || `Ruta ${index + 1}`}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDistance(route.distance)} • {formatDuration(route.duration)}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Selected Route Info */}
      {routes.length > 0 && routes[selectedRouteIndex] && (
        <div className="flex items-center justify-between bg-accent/50 rounded-lg px-3 py-2">
          <div className="flex items-center gap-2">
            <Navigation className="w-4 h-4 text-primary" />
            <span className="text-sm text-foreground">
              {formatDistance(routes[selectedRouteIndex].distance)} • {formatDuration(routes[selectedRouteIndex].duration)}
            </span>
          </div>

          {!routeConfirmed && (
            <Button size="sm" onClick={handleConfirmRoute} disabled={isLoading}>
              <Check className="w-4 h-4 mr-1" />
              Confirmar ruta
            </Button>
          )}
        </div>
      )}

      {/* Intermediate Cities */}
      {routeConfirmed && intermediateCities.length > 0 && (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <button
            onClick={() => setShowStops(!showStops)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-accent/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-foreground">
                Ciudades intermedias ({localSelectedStops.length} seleccionadas)
              </span>
            </div>
            {showStops ? (
              <ChevronUp className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            )}
          </button>

          {showStops && (
            <div className="border-t border-border divide-y divide-border">
              {intermediateCities.map((city) => {
                const isSelected = localSelectedStops.some(s => s.name === city.name);
                return (
                  <label
                    key={city.name}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-accent/30 cursor-pointer transition-colors"
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => handleStopToggle(city)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{city.name}</p>
                      <p className="text-xs text-muted-foreground">
                        A {city.distance.toFixed(0)} km del origen
                      </p>
                    </div>
                  </label>
                );
              })}
            </div>
          )}

          {localSelectedStops.length > 0 && (
            <div className="px-4 py-2 bg-primary/10 border-t border-border">
              <p className="text-xs text-primary">
                ✓ Escalas: {localSelectedStops.map(s => s.name).join(', ')}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default RouteMapDisplay;
