import React, { useImperativeHandle, useState } from 'react';
import { MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';

const places = [
  ['Plaza de Armas, Arequipa', [-71.537, -16.398]],
  ['Terminal Terrestre, Arequipa', [-71.556, -16.424]],
  ['Camaná, Arequipa', [-72.711, -16.624]],
  ['Mollendo, Arequipa', [-72.023, -17.024]],
] as const;

interface MapboxLocationPickerProps {
  value: string; onChange: (location: string, coordinates?: [number, number]) => void; placeholder: string;
  icon?: 'origin' | 'destination'; initialCoordinates?: [number, number]; defaultOpen?: boolean;
  hideTrigger?: boolean; onClose?: () => void;
}

/** Offline location picker that replaces Mapbox and Google Places in the demo repository. */
const MapboxLocationPicker = React.forwardRef<HTMLDivElement, MapboxLocationPickerProps>((props, ref) => {
  const [open, setOpen] = useState(props.defaultOpen || false);
  const [query, setQuery] = useState(props.value);
  const matches = places.filter(([name]) => name.toLowerCase().includes(query.toLowerCase()));
  useImperativeHandle(ref, () => document.createElement('div'));
  const choose = (name: string, coords: readonly number[]) => { props.onChange(name, [coords[0], coords[1]]); setOpen(false); props.onClose?.(); };
  return <div className="space-y-2">
    {!props.hideTrigger && <Button type="button" variant="outline" className="w-full justify-start" onClick={() => setOpen(true)}><MapPin className="mr-2 h-4 w-4" />{props.value || props.placeholder}</Button>}
    {open && <div className="rounded-xl border bg-white p-3 shadow-lg">
      <p className="mb-2 text-sm font-medium">Ubicación demo sin conexión</p>
      <input autoFocus value={query} placeholder={props.placeholder} onChange={event => setQuery(event.target.value)} className="mb-2 w-full rounded-md border px-3 py-2" />
      <div className="space-y-1">{matches.map(([name, coords]) => <button key={name} type="button" className="block w-full rounded px-2 py-2 text-left text-sm hover:bg-muted" onClick={() => choose(name, coords)}>{name}</button>)}</div>
      <Button type="button" variant="ghost" className="mt-2" onClick={() => { setOpen(false); props.onClose?.(); }}>Cerrar</Button>
    </div>}
  </div>;
});
MapboxLocationPicker.displayName = 'MapboxLocationPicker';
export default MapboxLocationPicker;
