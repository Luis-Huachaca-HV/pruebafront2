import React, { useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { MapPin, X, Loader2 } from 'lucide-react';

const MAPBOX_TOKEN =
  import.meta.env.VITE_MAPBOX_ACCESS_TOKEN ||
  'pk.eyJ1IjoibGVzZWwiLCJhIjoiY21rcTMzZHZpMGx2dzNrb3FuanUxNjZ3cyJ9.QckkRB2ojiFgnJL9dLeVew';

const AREQUIPA_CENTER = { lat: -16.409, lng: -71.537 };

interface PlaceSuggestion {
  id: string;
  mainText: string;
  secondaryText: string;
  fullText: string;
  coordinates: [number, number]; // [lng, lat]
}

interface AddressAutocompleteProps {
  value: string;
  onChange: (val: { display: string; coords?: [number, number] }) => void;
  placeholder: string;
  className?: string;
  inputClassName?: string;
}

const AddressAutocomplete: React.FC<AddressAutocompleteProps> = ({
  value,
  onChange,
  placeholder,
  className = '',
  inputClassName = '',
}) => {
  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [hasSelected, setHasSelected] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!hasSelected) {
      setQuery(value);
    }
  }, [value, hasSelected]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close dropdown on scroll / resize to avoid misalignment
  useEffect(() => {
    if (!showSuggestions) return;
    const close = () => setShowSuggestions(false);
    window.addEventListener('scroll', close, { passive: true });
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', close);
      window.removeEventListener('resize', close);
    };
  }, [showSuggestions]);

  const updateDropdownPosition = useCallback(() => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setDropdownStyle({
        position: 'fixed',
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
        zIndex: 9999,
      });
    }
  }, []);

  const searchMapbox = useCallback(async (text: string) => {
    const response = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(text)}.json?access_token=${MAPBOX_TOKEN}&language=es&autocomplete=true&limit=6&country=pe&proximity=${AREQUIPA_CENTER.lng},${AREQUIPA_CENTER.lat}`
    );
    const data = await response.json();
    const features = Array.isArray(data.features) ? data.features : [];
    return features.map((feature: any) => {
      const placeName = String(feature.place_name || '');
      const parts = placeName.split(',').map((p: string) => p.trim()).filter(Boolean);
      return {
        id: String(feature.id || placeName),
        mainText: String(feature.text || parts[0] || placeName),
        secondaryText: parts.slice(1).join(', '),
        fullText: placeName,
        coordinates: Array.isArray(feature.center)
          ? ([feature.center[0], feature.center[1]] as [number, number])
          : undefined,
      };
    }).filter((s: PlaceSuggestion) => s.coordinates) as PlaceSuggestion[];
  }, []);

  const handleInputChange = useCallback(
    (text: string) => {
      setHasSelected(false);
      setQuery(text);
      onChange({ display: text, coords: undefined });

      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      if (text.length < 2) {
        setSuggestions([]);
        setShowSuggestions(false);
        return;
      }
      setIsSearching(true);
      debounceTimerRef.current = setTimeout(async () => {
        try {
          const results = await searchMapbox(text);
          setSuggestions(results);
          if (results.length > 0) {
            setShowSuggestions(true);
            updateDropdownPosition();
          } else {
            setShowSuggestions(false);
          }
        } catch (err) {
          console.error('Autocomplete error:', err);
          setSuggestions([]);
          setShowSuggestions(false);
        } finally {
          setIsSearching(false);
        }
      }, 250);
    },
    [onChange, searchMapbox, updateDropdownPosition]
  );

  const handleSelect = useCallback(
    (s: PlaceSuggestion) => {
      setHasSelected(true);
      setQuery(s.fullText);
      setShowSuggestions(false);
      onChange({ display: s.fullText, coords: s.coordinates });
    },
    [onChange]
  );

  const dropdown = showSuggestions ? (
    <div
      style={dropdownStyle}
      className="bg-white rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.15)] border border-gray-100 max-h-64 overflow-y-auto"
    >
      {suggestions.map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={() => handleSelect(s)}
          className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-start gap-3 border-b border-gray-50 last:border-0"
        >
          <MapPin className="w-4 h-4 text-[#8c6df5] mt-0.5 shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{s.mainText}</p>
            <p className="text-xs text-gray-500 truncate">{s.secondaryText}</p>
          </div>
        </button>
      ))}
    </div>
  ) : null;

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative flex items-center">
        <input
          type="text"
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => {
            if (suggestions.length > 0) {
              setShowSuggestions(true);
              updateDropdownPosition();
            }
          }}
          placeholder={placeholder}
          autoComplete="off"
          className={`w-full outline-none ${inputClassName}`}
        />
        {isSearching && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
        )}
        {!isSearching && query && (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setSuggestions([]);
              setShowSuggestions(false);
              onChange({ display: '', coords: undefined });
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {dropdown && createPortal(dropdown, document.body)}
    </div>
  );
};

export default AddressAutocomplete;
