import React, { useEffect } from 'react';
import { MapPin, Navigation } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface RouteOption { id: string; geometry: GeoJSON.LineString; duration: number; distance: number; summary: string; }
interface IntermediateCity { name: string; coordinates: [number, number]; distance: number; }
interface RouteMapDisplayProps {
  originCoords?: [number, number]; destinationCoords?: [number, number]; originName: string; destinationName: string;
  onRouteConfirmed?: (route: RouteOption, selectedStops: IntermediateCity[]) => void;
  selectedStops?: IntermediateCity[]; onStopsChange?: (stops: IntermediateCity[]) => void; simpleMode?: boolean;
}

/** Static offline route preview. It deliberately uses no mapping SDK or network access. */
const RouteMapDisplay: React.FC<RouteMapDisplayProps> = ({ originCoords = [-71.537, -16.409], destinationCoords = [-72.711, -16.624], originName, destinationName, onRouteConfirmed, selectedStops = [], onStopsChange, simpleMode = false }) => {
  const route: RouteOption = { id: 'demo-route', geometry: { type: 'LineString', coordinates: [originCoords, destinationCoords] }, duration: 180 * 60, distance: 173000, summary: 'Ruta demo Arequipa – Camaná' };
  useEffect(() => { if (simpleMode) onRouteConfirmed?.(route, selectedStops); }, []);
  return <section className="rounded-xl border bg-gradient-to-br from-sky-50 to-blue-50 p-5 text-sm">
    <div className="mb-4 flex items-center gap-2 font-semibold"><Navigation className="h-5 w-5 text-primary" />Vista de ruta demo (sin conexión)</div>
    <div className="space-y-3">
      <p className="flex gap-2"><MapPin className="h-4 w-4 text-green-600" /><span><b>Origen:</b> {originName}</span></p>
      <div className="ml-2 h-8 border-l-2 border-dashed border-primary/50" />
      <p className="flex gap-2"><MapPin className="h-4 w-4 text-red-600" /><span><b>Destino:</b> {destinationName}</span></p>
    </div>
    {!simpleMode && <div className="mt-4 flex flex-wrap gap-2"><Button type="button" onClick={() => onRouteConfirmed?.(route, selectedStops)}>Confirmar ruta demo</Button>{onStopsChange && <Button type="button" variant="outline" onClick={() => onStopsChange([])}>Quitar paradas</Button>}</div>}
  </section>;
};
export default RouteMapDisplay;
