// Agente de itinerarios (demo) — elige lugares exactos en un mapa offline interactivo,
// arma el plan día a día respetando viajeros/mascotas/equipaje, y busca viajeros con ruta similar.
import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Wand2,
  Sparkles,
  Calendar,
  Coins,
  Mountain,
  Landmark,
  Leaf,
  UtensilsCrossed,
  Coffee,
  Footprints,
  Car,
  Bus,
  Users,
  RefreshCw,
  ArrowRight,
  Star,
  MapPin,
  Plus,
  Minus,
  X,
  PawPrint,
  Baby,
  Luggage,
  Check,
  AlertTriangle,
  Route as RouteIcon,
} from 'lucide-react';
import { getPublishedTrips, TripResponse } from '@/services/trips';
import { useAuth } from '@/contexts/AuthContext';

type Category = 'aventura' | 'cultura' | 'naturaleza' | 'gastronomia' | 'relax';
type LuggageSize = 'ligero' | 'mediano' | 'grande';

interface Poi {
  name: string;
  category: Category;
  hours: number;
  cost: number;
  x: number; // posición en el mapa offline, 0-100
  y: number; // posición en el mapa offline, 0-100
  intense?: boolean; // actividad exigente, aviso si viajas con niños
}

const CATEGORY_META: Record<Category, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  aventura: { label: 'Aventura', icon: Mountain },
  cultura: { label: 'Cultura', icon: Landmark },
  naturaleza: { label: 'Naturaleza', icon: Leaf },
  gastronomia: { label: 'Gastronomía', icon: UtensilsCrossed },
  relax: { label: 'Relax', icon: Coffee },
};

const STOPS_PER_DAY = 3;

const DESTINATIONS: { name: string; matchKeyword: string }[] = [
  { name: 'Lima', matchKeyword: 'Lima' },
  { name: 'Cusco', matchKeyword: 'Cusco' },
  { name: 'Machu Picchu', matchKeyword: 'Machu Picchu' },
  { name: 'Arequipa', matchKeyword: 'Arequipa' },
  { name: 'Lago Titicaca', matchKeyword: 'Puno' },
];

const POIS: Record<string, Poi[]> = {
  Lima: [
    { name: 'Centro Histórico y Plaza Mayor', category: 'cultura', hours: 2, cost: 0, x: 30, y: 38 },
    { name: 'Circuito Mágico del Agua', category: 'relax', hours: 2, cost: 4, x: 55, y: 58 },
    { name: 'Barranco y el Puente de los Suspiros', category: 'cultura', hours: 1.5, cost: 0, x: 46, y: 74 },
    { name: 'Malecón de Miraflores', category: 'naturaleza', hours: 1.5, cost: 0, x: 62, y: 80 },
    { name: 'Mercado Central (comida criolla)', category: 'gastronomia', hours: 1.5, cost: 25, x: 22, y: 50 },
  ],
  Cusco: [
    { name: 'Plaza de Armas de Cusco', category: 'cultura', hours: 1.5, cost: 0, x: 40, y: 45 },
    { name: 'Qorikancha', category: 'cultura', hours: 1.5, cost: 20, x: 52, y: 55 },
    { name: 'Barrio de San Blas', category: 'cultura', hours: 1.5, cost: 0, x: 33, y: 28 },
    { name: 'Mercado San Pedro', category: 'gastronomia', hours: 1, cost: 20, x: 57, y: 38 },
    { name: 'Sacsayhuamán', category: 'aventura', hours: 2, cost: 70, x: 44, y: 14 },
  ],
  'Machu Picchu': [
    { name: 'Ciudadela de Machu Picchu', category: 'cultura', hours: 3, cost: 152, x: 50, y: 40 },
    { name: 'Caminata a Huayna Picchu', category: 'aventura', hours: 2, cost: 200, x: 56, y: 18, intense: true },
    { name: 'Baños termales de Aguas Calientes', category: 'relax', hours: 1.5, cost: 30, x: 24, y: 70 },
    { name: 'Tramo corto del Camino Inca', category: 'aventura', hours: 4, cost: 0, x: 72, y: 55, intense: true },
  ],
  Arequipa: [
    { name: 'Plaza de Armas y Catedral', category: 'cultura', hours: 1.5, cost: 10, x: 45, y: 45 },
    { name: 'Monasterio de Santa Catalina', category: 'cultura', hours: 2, cost: 40, x: 56, y: 33 },
    { name: 'Mirador de Yanahuara', category: 'naturaleza', hours: 1, cost: 0, x: 24, y: 24 },
    { name: 'Cañón del Colca (día completo)', category: 'aventura', hours: 8, cost: 80, x: 14, y: 70, intense: true },
    { name: 'Picantería local', category: 'gastronomia', hours: 1.5, cost: 25, x: 62, y: 56 },
  ],
  'Lago Titicaca': [
    { name: 'Islas flotantes de los Uros', category: 'cultura', hours: 2, cost: 35, x: 30, y: 45 },
    { name: 'Isla Taquile', category: 'aventura', hours: 3, cost: 45, x: 67, y: 55 },
    { name: 'Mirador Kuntur Wasi', category: 'naturaleza', hours: 1, cost: 5, x: 45, y: 18 },
    { name: 'Almuerzo con trucha del lago', category: 'gastronomia', hours: 1, cost: 30, x: 50, y: 66 },
    { name: 'Atardecer en el muelle de Puno', category: 'relax', hours: 1, cost: 0, x: 24, y: 72 },
  ],
};

const LUGGAGE_OPTIONS: { value: LuggageSize; label: string }[] = [
  { value: 'ligero', label: 'Ligero' },
  { value: 'mediano', label: 'Mediano' },
  { value: 'grande', label: 'Grande' },
];

interface Traveler {
  adults: number;
  children: number;
  hasPets: boolean;
  luggage: LuggageSize;
}

interface DayStop extends Poi {
  time: string;
  transport: string;
  TransportIcon: React.ComponentType<{ className?: string }>;
}

interface DayPlan {
  day: number;
  stops: DayStop[];
  totalCost: number;
}

interface GeneratedItinerary {
  destination: string;
  days: DayPlan[];
  totalCost: number;
  travelers: Traveler;
}

interface TripWithDriver extends TripResponse {
  driver_name?: string;
  driver_rating?: number;
  pets_allowed?: boolean;
}

const addMinutesToTime = (base: { h: number; m: number }, minutesToAdd: number) => {
  const totalMinutes = base.h * 60 + base.m + minutesToAdd;
  const h = Math.floor(totalMinutes / 60) % 24;
  const m = totalMinutes % 60;
  return { h, m, label: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}` };
};

const pickTransport = (traveler: Traveler, index: number) => {
  if (traveler.hasPets) return { label: 'Taxi privado (apto mascotas)', icon: Car };
  if (traveler.luggage === 'grande') return index % 2 === 0 ? { label: 'Taxi privado', icon: Car } : { label: 'Taxi compartido', icon: Car };
  const cycle = [
    { label: 'A pie', icon: Footprints },
    { label: 'Taxi compartido', icon: Car },
    { label: 'Bus turístico', icon: Bus },
  ];
  return cycle[index % cycle.length];
};

const buildItinerary = (destination: string, selected: Poi[], traveler: Traveler): GeneratedItinerary => {
  const days: DayPlan[] = [];
  let grandTotal = 0;
  let transportIndex = 0;

  for (let i = 0; i < selected.length; i += STOPS_PER_DAY) {
    const dayNumber = Math.floor(i / STOPS_PER_DAY) + 1;
    const dayPois = selected.slice(i, i + STOPS_PER_DAY);
    let time = addMinutesToTime({ h: 8, m: 0 }, 0);
    let dayCost = 0;
    const stops: DayStop[] = dayPois.map((poi) => {
      const transport = pickTransport(traveler, transportIndex++);
      const stop: DayStop = { ...poi, time: time.label, transport: transport.label, TransportIcon: transport.icon };
      dayCost += poi.cost;
      time = addMinutesToTime(time, poi.hours * 60 + 30);
      return stop;
    });
    days.push({ day: dayNumber, stops, totalCost: dayCost });
    grandTotal += dayCost;
  }

  return { destination, days, totalCost: grandTotal, travelers: traveler };
};

const Itinerary: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const [destination, setDestination] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedNames, setSelectedNames] = useState<string[]>([]);
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [hasPets, setHasPets] = useState(false);
  const [luggage, setLuggage] = useState<LuggageSize>('ligero');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GeneratedItinerary | null>(null);
  const [matches, setMatches] = useState<TripWithDriver[]>([]);

  const pois = useMemo(() => (destination ? POIS[destination] ?? [] : []), [destination]);
  const selectedPois = useMemo(
    () => selectedNames.map((name) => pois.find((p) => p.name === name)).filter((p): p is Poi => Boolean(p)),
    [selectedNames, pois]
  );

  const handleSelectDestination = (name: string) => {
    setDestination(name);
    setSelectedNames([]);
    setResult(null);
  };

  const togglePoi = (name: string) => {
    setSelectedNames((prev) => (prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]));
  };

  const movePoi = (index: number, direction: -1 | 1) => {
    setSelectedNames((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const totalTravelers = adults + children;

  const handleGenerate = async () => {
    if (!destination || selectedPois.length === 0) return;
    setLoading(true);
    setResult(null);

    const traveler: Traveler = { adults, children, hasPets, luggage };

    const [itinerary, allTrips] = await Promise.all([
      new Promise<GeneratedItinerary>((resolve) =>
        window.setTimeout(() => resolve(buildItinerary(destination, selectedPois, traveler)), 1400)
      ),
      getPublishedTrips().catch(() => [] as TripWithDriver[]),
    ]);

    const dest = DESTINATIONS.find((d) => d.name === destination);
    const relatedTrips = (allTrips as TripWithDriver[])
      .filter(
        (trip) =>
          dest &&
          (trip.destination_name?.includes(dest.matchKeyword) || trip.origin_name?.includes(dest.matchKeyword)) &&
          (trip.available_seats ?? 0) >= totalTravelers
      )
      .sort((a, b) => (hasPets ? Number(b.pets_allowed) - Number(a.pets_allowed) : 0));

    setResult(itinerary);
    setMatches(relatedTrips.slice(0, 3));
    setLoading(false);
  };

  const handleReset = () => {
    setResult(null);
    setMatches([]);
  };

  const handleRemoveStop = (dayIndex: number, stopIndex: number) => {
    setResult((prev) => {
      if (!prev) return prev;
      const days = prev.days.map((d, di) => {
        if (di !== dayIndex) return d;
        const stops = d.stops.filter((_, si) => si !== stopIndex);
        return { ...d, stops, totalCost: stops.reduce((sum, s) => sum + s.cost, 0) };
      }).filter((d) => d.stops.length > 0);
      return { ...prev, days, totalCost: days.reduce((sum, d) => sum + d.totalCost, 0) };
    });
  };

  const handleViewTrip = (trip: TripWithDriver) => {
    if (!isAuthenticated) {
      navigate('/login', { state: { redirectTo: `/trip-details/${trip.id}` } });
      return;
    }
    navigate(`/trip-details/${trip.id}`);
  };

  const goToSearch = () => {
    navigate('/search', {
      state: {
        origin: { display: '', coords: undefined },
        destination: { display: destination, coords: undefined },
        date: '',
        time: '',
        seats: totalTravelers,
      },
    });
  };

  return (
    <div className="min-h-screen bg-[#F4F8FC] pb-16">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-8 pb-4">
        <span className="inline-flex items-center gap-2 px-3 py-1.5 mb-4 rounded-full text-xs font-semibold bg-[#F97316]/10 border border-[#F97316]/30 text-[#EA580C] uppercase tracking-wider">
          <Sparkles className="w-3 h-3" />
          Itinerarios con IA
        </span>
        <h1 className="text-3xl sm:text-4xl font-black text-[#0F2A4D] tracking-tight mb-2">Arma tu itinerario</h1>
        <p className="text-slate-600 leading-relaxed max-w-xl">
          Elige tu destino, marca los lugares exactos que quieres visitar en el mapa y cuéntanos con quién viajas.
          Armamos el plan día a día y buscamos viajeros con tu misma ruta.
        </p>
      </div>

      {!result && (
        <div className="max-w-3xl mx-auto px-4 sm:px-6 space-y-6">
          <div className="bg-white rounded-[2rem] border-2 border-[#DCE8F5] p-6 sm:p-8 shadow-sm space-y-6">
            {/* Destino */}
            <div>
              <label className="text-sm font-bold text-[#0F2A4D] mb-2 block">¿A dónde quieres ir?</label>
              <div className="flex flex-wrap gap-2">
                {DESTINATIONS.map((d) => (
                  <button
                    key={d.name}
                    type="button"
                    onClick={() => handleSelectDestination(d.name)}
                    className={`px-4 py-2 rounded-full text-sm font-bold border-2 transition-all ${
                      destination === d.name
                        ? 'bg-[#0F2A4D] border-[#0F2A4D] text-white'
                        : 'bg-white border-[#DCE8F5] text-[#0F2A4D] hover:border-[#F97316]'
                    }`}
                  >
                    {d.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Fechas */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-bold text-[#0F2A4D] mb-2 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4" /> Salida
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full p-3 border-2 border-[#DCE8F5] rounded-2xl outline-none focus:border-[#F97316]"
                />
              </div>
              <div>
                <label className="text-sm font-bold text-[#0F2A4D] mb-2 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4" /> Regreso
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full p-3 border-2 border-[#DCE8F5] rounded-2xl outline-none focus:border-[#F97316]"
                />
              </div>
            </div>

            {/* Viajeros y equipaje */}
            <div>
              <label className="text-sm font-bold text-[#0F2A4D] mb-3 block">Viajeros y equipaje</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-2xl border-2 border-[#DCE8F5] p-3">
                  <p className="text-xs font-bold text-slate-500 mb-1.5">Adultos</p>
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setAdults((n) => Math.max(1, n - 1))}
                      className="w-7 h-7 rounded-full bg-[#0F2A4D]/5 flex items-center justify-center text-[#0F2A4D] hover:bg-[#0F2A4D]/10"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="font-black text-[#0F2A4D]">{adults}</span>
                    <button
                      type="button"
                      onClick={() => setAdults((n) => Math.min(8, n + 1))}
                      className="w-7 h-7 rounded-full bg-[#0F2A4D]/5 flex items-center justify-center text-[#0F2A4D] hover:bg-[#0F2A4D]/10"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="rounded-2xl border-2 border-[#DCE8F5] p-3">
                  <p className="text-xs font-bold text-slate-500 mb-1.5 flex items-center gap-1"><Baby className="w-3 h-3" /> Niños</p>
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setChildren((n) => Math.max(0, n - 1))}
                      className="w-7 h-7 rounded-full bg-[#0F2A4D]/5 flex items-center justify-center text-[#0F2A4D] hover:bg-[#0F2A4D]/10"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="font-black text-[#0F2A4D]">{children}</span>
                    <button
                      type="button"
                      onClick={() => setChildren((n) => Math.min(8, n + 1))}
                      className="w-7 h-7 rounded-full bg-[#0F2A4D]/5 flex items-center justify-center text-[#0F2A4D] hover:bg-[#0F2A4D]/10"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setHasPets((v) => !v)}
                  className={`rounded-2xl border-2 p-3 text-left transition-all ${
                    hasPets ? 'bg-[#F97316] border-[#F97316] text-white' : 'border-[#DCE8F5] text-[#0F2A4D] hover:border-[#F97316]'
                  }`}
                >
                  <p className={`text-xs font-bold mb-1.5 flex items-center gap-1 ${hasPets ? 'text-white/80' : 'text-slate-500'}`}>
                    <PawPrint className="w-3 h-3" /> Mascota
                  </p>
                  <span className="font-black flex items-center gap-1">
                    {hasPets && <Check className="w-4 h-4" />} {hasPets ? 'Sí viajo' : 'No viajo'}
                  </span>
                </button>

                <div className="rounded-2xl border-2 border-[#DCE8F5] p-3 col-span-2 sm:col-span-1">
                  <p className="text-xs font-bold text-slate-500 mb-1.5 flex items-center gap-1"><Luggage className="w-3 h-3" /> Equipaje</p>
                  <div className="flex gap-1">
                    {LUGGAGE_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setLuggage(opt.value)}
                        className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                          luggage === opt.value ? 'bg-[#0F2A4D] text-white' : 'bg-[#0F2A4D]/5 text-[#0F2A4D] hover:bg-[#0F2A4D]/10'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Mapa interactivo de lugares */}
          {destination && (
            <div className="bg-white rounded-[2rem] border-2 border-[#DCE8F5] p-6 sm:p-8 shadow-sm space-y-5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <label className="text-sm font-bold text-[#0F2A4D] flex items-center gap-1.5">
                  <RouteIcon className="w-4 h-4" /> Marca los lugares que quieres visitar en {destination}
                </label>
                <span className="text-xs font-bold text-[#F97316]">{selectedPois.length} seleccionados</span>
              </div>

              {/* Mapa offline: pines posicionados sobre una cuadrícula, sin conexión ni SDK externo */}
              <div
                className="relative w-full h-64 sm:h-72 rounded-2xl border-2 border-[#DCE8F5] overflow-hidden"
                style={{
                  backgroundColor: '#F4F8FC',
                  backgroundImage:
                    'radial-gradient(circle, rgba(15,42,77,0.12) 1px, transparent 1px)',
                  backgroundSize: '18px 18px',
                }}
              >
                <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
                  {selectedPois.slice(1).map((poi, idx) => {
                    const prev = selectedPois[idx];
                    return (
                      <line
                        key={poi.name}
                        x1={prev.x}
                        y1={prev.y}
                        x2={poi.x}
                        y2={poi.y}
                        stroke="#F97316"
                        strokeWidth="0.6"
                        strokeDasharray="2,2"
                      />
                    );
                  })}
                </svg>

                {pois.map((poi) => {
                  const order = selectedNames.indexOf(poi.name);
                  const isSelected = order !== -1;
                  return (
                    <button
                      key={poi.name}
                      type="button"
                      onClick={() => togglePoi(poi.name)}
                      title={poi.name}
                      className="absolute -translate-x-1/2 -translate-y-full group/pin"
                      style={{ left: `${poi.x}%`, top: `${poi.y}%` }}
                    >
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center shadow-md border-2 border-white transition-transform group-hover/pin:scale-110 ${
                          isSelected ? 'bg-[#F97316] text-white' : 'bg-[#0F2A4D] text-white'
                        }`}
                      >
                        {isSelected ? <span className="text-xs font-black">{order + 1}</span> : <MapPin className="w-4 h-4" />}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Lista de lugares — misma selección, más precisa/accesible que el mapa */}
              <div className="grid sm:grid-cols-2 gap-2">
                {pois.map((poi) => {
                  const CatIcon = CATEGORY_META[poi.category].icon;
                  const isSelected = selectedNames.includes(poi.name);
                  return (
                    <button
                      key={poi.name}
                      type="button"
                      onClick={() => togglePoi(poi.name)}
                      className={`flex items-center gap-3 p-3 rounded-2xl border-2 text-left transition-all ${
                        isSelected ? 'border-[#F97316] bg-[#F97316]/5' : 'border-[#DCE8F5] hover:border-[#F97316]/50'
                      }`}
                    >
                      <div
                        className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center ${
                          isSelected ? 'bg-[#F97316] text-white' : 'bg-[#0F2A4D]/5 text-[#0F2A4D]'
                        }`}
                      >
                        {isSelected ? <Check className="w-4 h-4" /> : <CatIcon className="w-4 h-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-[#0F2A4D] leading-tight truncate">{poi.name}</p>
                        <p className="text-xs text-slate-500">
                          {CATEGORY_META[poi.category].label} · {poi.cost > 0 ? `S/ ${poi.cost}` : 'Gratis'}
                          {poi.intense ? ' · Exigente' : ''}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Orden de la ruta seleccionada, reordenable */}
              {selectedPois.length > 0 && (
                <div className="pt-2 border-t border-[#DCE8F5] space-y-2">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Orden de tu ruta</p>
                  {selectedPois.map((poi, idx) => (
                    <div key={poi.name} className="flex items-center gap-2 bg-[#0F2A4D]/5 rounded-xl px-3 py-2">
                      <span className="w-5 h-5 rounded-full bg-[#0F2A4D] text-white text-[11px] font-black flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <span className="flex-1 text-sm font-semibold text-[#0F2A4D] truncate">{poi.name}</span>
                      <button type="button" onClick={() => movePoi(idx, -1)} disabled={idx === 0} className="p-1 text-[#0F2A4D] disabled:opacity-30">
                        ↑
                      </button>
                      <button type="button" onClick={() => movePoi(idx, 1)} disabled={idx === selectedPois.length - 1} className="p-1 text-[#0F2A4D] disabled:opacity-30">
                        ↓
                      </button>
                      <button type="button" onClick={() => togglePoi(poi.name)} className="p-1 text-slate-400 hover:text-red-500">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <button
            type="button"
            disabled={!destination || selectedPois.length === 0 || loading}
            onClick={handleGenerate}
            className="w-full py-4 rounded-2xl font-black text-lg text-white bg-[#F97316] hover:bg-[#EA580C] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-orange-900/20 transition-all flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" /> Generando itinerario...
              </>
            ) : (
              <>
                <Wand2 className="w-5 h-5" /> Generar itinerario con IA
              </>
            )}
          </button>
        </div>
      )}

      {result && (
        <div className="max-w-3xl mx-auto px-4 sm:px-6 space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h2 className="text-2xl font-black text-[#0F2A4D]">
              Tu itinerario para <span className="text-[#F97316]">{result.destination}</span>
            </h2>
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 text-sm font-bold text-[#0F2A4D] hover:text-[#F97316] transition-colors"
            >
              <RefreshCw className="w-4 h-4" /> Ajustar de nuevo
            </button>
          </div>

          {/* Resumen de viajeros */}
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-white border-2 border-[#DCE8F5] text-[#0F2A4D]">
              <Users className="w-3.5 h-3.5" /> {result.travelers.adults} adulto{result.travelers.adults !== 1 ? 's' : ''}
            </span>
            {result.travelers.children > 0 && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-white border-2 border-[#DCE8F5] text-[#0F2A4D]">
                <Baby className="w-3.5 h-3.5" /> {result.travelers.children} niño{result.travelers.children !== 1 ? 's' : ''}
              </span>
            )}
            {result.travelers.hasPets && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-white border-2 border-[#DCE8F5] text-[#0F2A4D]">
                <PawPrint className="w-3.5 h-3.5" /> Con mascota
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-white border-2 border-[#DCE8F5] text-[#0F2A4D]">
              <Luggage className="w-3.5 h-3.5" /> Equipaje {result.travelers.luggage}
            </span>
          </div>

          {/* Resumen de costo */}
          <div className="rounded-2xl p-5 border-2 bg-[#0F2A4D]/5 border-[#DCE8F5] flex items-center gap-3">
            <div className="w-11 h-11 shrink-0 rounded-xl bg-white flex items-center justify-center text-[#F97316]">
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Costo estimado del plan</p>
              <p className="text-2xl font-black text-[#0F2A4D]">S/ {result.totalCost.toFixed(0)}</p>
            </div>
          </div>

          {/* Días */}
          <div className="space-y-4">
            {result.days.map((day, dayIndex) => (
              <div key={day.day} className="bg-white rounded-[1.75rem] border-2 border-[#DCE8F5] p-5 sm:p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-black text-[#0F2A4D]">Día {day.day}</h3>
                  <span className="text-sm font-bold text-[#F97316]">S/ {day.totalCost.toFixed(0)}</span>
                </div>
                <div className="space-y-3">
                  {day.stops.map((stop, idx) => {
                    const CatIcon = CATEGORY_META[stop.category].icon;
                    const TransportIcon = stop.TransportIcon;
                    return (
                      <div key={idx} className="flex items-start gap-3 pb-3 border-b border-[#DCE8F5] last:border-0 last:pb-0">
                        <div className="w-10 h-10 shrink-0 rounded-xl bg-[#0F2A4D]/5 flex items-center justify-center text-[#0F2A4D]">
                          <CatIcon className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-[#0F2A4D] leading-tight">{stop.name}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 font-medium">
                            <span>{stop.time}</span>
                            <span className="inline-flex items-center gap-1">
                              <TransportIcon className="w-3 h-3" /> {stop.transport}
                            </span>
                            <span>{stop.cost > 0 ? `S/ ${stop.cost}` : 'Gratis'}</span>
                          </div>
                          {stop.intense && result.travelers.children > 0 && (
                            <p className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                              <AlertTriangle className="w-3 h-3" /> Actividad exigente, evalúa si es apta para tus niños
                            </p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveStop(dayIndex, idx)}
                          className="p-1 text-slate-300 hover:text-red-500 shrink-0"
                          aria-label="Quitar del plan"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Matching de viajeros */}
          <div className="bg-white rounded-[1.75rem] border-2 border-[#DCE8F5] p-5 sm:p-6">
            <div className="flex items-center gap-2 mb-1 text-[#0F2A4D]">
              <Users className="w-5 h-5" />
              <h3 className="text-lg font-black">Viajeros con tu misma ruta</h3>
            </div>
            <p className="text-sm text-slate-500 mb-4">
              Comparte el transporte, divide el costo y viaja más seguro
              {totalTravelers > 1 ? ` (buscamos cupo para ${totalTravelers} personas)` : ''}.
            </p>

            {matches.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-slate-500 font-medium mb-4">
                  Aún no hay viajeros con esta ruta exacta{hasPets ? ' y cupo apto para mascotas' : ''}. Si no
                  completamos el cupo, publicamos tu viaje automáticamente en más canales para conseguir compañeros.
                </p>
                <button
                  type="button"
                  onClick={goToSearch}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-bold text-white bg-[#0F2A4D] hover:bg-[#163B67] transition-colors"
                >
                  Ver todos los viajes <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {matches.map((trip, idx) => (
                  <button
                    key={trip.id}
                    type="button"
                    onClick={() => handleViewTrip(trip)}
                    className="w-full text-left flex items-center gap-4 p-4 rounded-2xl border-2 border-[#DCE8F5] hover:border-[#F97316] transition-all"
                  >
                    <div className="w-11 h-11 shrink-0 rounded-full bg-[#0F2A4D] text-white font-black flex items-center justify-center">
                      {(trip.driver_name || 'C').charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-[#0F2A4D] truncate">{trip.origin_name} → {trip.destination_name}</p>
                      <div className="flex items-center gap-2 text-xs text-slate-500 font-medium mt-0.5">
                        <span>{trip.driver_name}</span>
                        <span className="inline-flex items-center gap-0.5"><Star className="w-3 h-3 fill-amber-400 text-amber-400" /> {trip.driver_rating}</span>
                        {hasPets && trip.pets_allowed && (
                          <span className="inline-flex items-center gap-0.5 text-emerald-600"><PawPrint className="w-3 h-3" /> Apto mascotas</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="inline-block px-2.5 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-700 mb-1">
                        {92 - idx * 7}% match
                      </span>
                      <p className="font-black text-[#F97316]">S/ {trip.price_per_seat}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Itinerary;
