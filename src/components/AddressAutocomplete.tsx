import React, { useMemo, useState } from 'react';
import { MapPin } from 'lucide-react';

const places = [
  { name: 'Plaza de Armas, Arequipa', coords: [-71.537, -16.398] as [number, number] },
  { name: 'Terminal Terrestre, Arequipa', coords: [-71.556, -16.424] as [number, number] },
  { name: 'Camaná, Arequipa', coords: [-72.711, -16.624] as [number, number] },
  { name: 'Mollendo, Arequipa', coords: [-72.023, -17.024] as [number, number] },
];

interface AddressAutocompleteProps {
  value: string;
  onChange: (val: { display: string; coords?: [number, number] }) => void;
  placeholder: string;
  className?: string;
  inputClassName?: string;
}

/** Offline address picker used only by the collaborative demo. */
const AddressAutocomplete: React.FC<AddressAutocompleteProps> = ({ value, onChange, placeholder, className = '', inputClassName = '' }) => {
  const [query, setQuery] = useState(value);
  const results = useMemo(() => places.filter(place => place.name.toLowerCase().includes(query.toLowerCase())).slice(0, 5), [query]);
  return <div className={`relative ${className}`}>
    <input value={query} placeholder={placeholder} autoComplete="off" className={`w-full outline-none ${inputClassName}`}
      onChange={event => { setQuery(event.target.value); onChange({ display: event.target.value }); }} />
    {query.length >= 2 && <div className="absolute z-50 mt-1 w-full rounded-lg border bg-white shadow-lg">
      {results.map(place => <button key={place.name} type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
        onClick={() => { setQuery(place.name); onChange({ display: place.name, coords: place.coords }); }}>
        <MapPin className="h-4 w-4 text-primary" />{place.name}
      </button>)}
      {!results.length && <p className="px-3 py-2 text-sm text-muted-foreground">No hay coincidencias demo.</p>}
    </div>}
  </div>;
};

export default AddressAutocomplete;
