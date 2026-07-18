//INDEX IMPORTANTE
import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  HelpCircle,
  Info,
  LogIn,
  ChevronRight,
  Loader2,
  MessageCircle,
  Calendar,
  Users,
  ShieldCheck,
  PiggyBank,
  FileCheck,
  Compass,
  Sparkles,
  Wand2,
  Car,
} from 'lucide-react';
import SearchBar from "../components/SearchBar";
import DestinationCarousel from "../components/DestinationCarousel";
import HeroCarousel from "../components/HeroCarousel";
import { getPublishedTrips, TripResponse } from '@/services/trips';
import { createConversation } from '@/services/chat';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface TripWithDriver extends TripResponse {
  driver?: {
    id: string;
    name: string;
    email: string;
    rating: number;
    tripsCompleted: number;
  };
}

// --- COMPONENTE PRINCIPAL ---
const Index = () => {
  const navigate = useNavigate();
  const { isAuthenticated, accessToken, user } = useAuth();
  const { toast } = useToast();
  const [trips, setTrips] = useState<TripWithDriver[]>([]);
  const [loadingTrips, setLoadingTrips] = useState(true);
  const [contactingTripId, setContactingTripId] = useState<string | null>(null);

  useEffect(() => {
    const loadTrips = async () => {
      try {
        setLoadingTrips(true);
        const publishedTrips = await getPublishedTrips(1, 6, { minSeats: 1 });
        setTrips(publishedTrips as TripWithDriver[]);
      } catch (error) {
        console.error('Error loading landing trips:', error);
      } finally {
        setLoadingTrips(false);
      }
    };

    loadTrips();
  }, []);

  const formatDateTime = (dateString: string) => {
    const d = new Date(dateString);
    return {
      date: d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }),
      time: d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: true }).replace(/([ap])\. m\./i, '$1.m.'),
    };
  };

  const requireLogin = (redirectTo: string) => {
    navigate('/login', {
      state: {
        redirectTo,
      },
    });
  };

  const handleViewTrip = (trip: TripWithDriver) => {
    if (!isAuthenticated) {
      requireLogin(`/trip-details/${trip.id}`);
      return;
    }
    navigate(`/trip-details/${trip.id}`);
  };

  const handleMessageDriver = async (trip: TripWithDriver) => {
    if (!accessToken || !user) {
      requireLogin(`/trip-details/${trip.id}`);
      return;
    }
    if (trip.driver_id === user.id) {
      toast({
        title: 'Acción no permitida',
        description: 'No puedes enviarte mensajes a ti mismo',
        variant: 'destructive',
      });
      return;
    }

    try {
      setContactingTripId(trip.id);
      const conversation = await createConversation(
        {
          other_user_id: trip.driver_id,
          trip_id: trip.id,
          conversation_type: 'pre',
          subject: 'Consulta sobre viaje',
        },
        accessToken
      );

      navigate('/messages', {
        state: {
          selectedConversationId: conversation.id,
        },
      });
    } catch {
      toast({
        title: 'Error',
        description: 'No se pudo iniciar la conversación',
        variant: 'destructive',
      });
    } finally {
      setContactingTripId(null);
    }
  };

  // Esta función recibe los datos del SearchBar y nos lleva a la página de resultados
  const handleSearch = (filters: any) => {
    navigate("/search", {
      state: filters
    });
  };

  // Click en una tarjeta del carrusel de destinos: precarga el destino y va a la búsqueda
  const handleSelectDestination = (destination: string) => {
    navigate("/search", {
      state: {
        origin: { display: '', coords: undefined },
        destination: { display: destination, coords: undefined },
        date: '',
        time: '',
        seats: 1,
      },
    });
  };

  return (
    <div className="min-h-screen bg-white font-sans text-[#0F2A4D] overflow-x-hidden">

      {/* SECCIÓN 1: HERO — carrusel de fotos de fondo (Machu Picchu / Lima / Arequipa) */}
      <HeroCarousel>
        {/* Nav superior delgada — el logo ya no domina el hero, va discreto arriba */}
        <div className="relative z-20 max-w-7xl mx-auto w-full px-4 sm:px-6 pt-5 sm:pt-6 flex items-center justify-between">
          <img
            src="/logoblanco.png"
            alt="Logo de SumaqTravel"
            className="h-14 sm:h-16 w-auto object-contain drop-shadow-[0_2px_8px_rgba(0,0,0,0.45)]"
          />
          <Link
            to="/login"
            className="inline-flex items-center gap-2 px-4 sm:px-5 py-2 rounded-full text-sm font-bold text-white bg-white/10 border border-white/25 backdrop-blur-sm hover:bg-white/20 transition-colors"
          >
            <LogIn className="w-4 h-4" /> Iniciar sesión
          </Link>
        </div>

        <div className="relative z-20 flex-1 flex items-center justify-center px-4 sm:px-6">
          <div className="max-w-7xl mx-auto text-center py-10">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 mb-6 rounded-full text-xs sm:text-sm font-bold uppercase tracking-widest text-white bg-[#F97316] shadow-lg">
              Descubre el Perú
            </span>

            <h1 className="text-3xl sm:text-5xl md:text-7xl font-black text-white mb-6 sm:mb-8 tracking-tighter leading-tight sm:leading-none">
              VIAJA SEGURO, AHORRA MÁS, <br className="hidden sm:block" />
              <span className="text-[#FDBA74] italic font-light">viaja formal.</span>
            </h1>
            <p className="text-base sm:text-xl md:text-2xl text-[#DCE8F5] max-w-3xl mx-auto leading-relaxed font-medium mb-8 sm:mb-10">
              La forma más inteligente, económica y humana de moverte por el país.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <button
                type="button"
                onClick={() => navigate('/itinerary')}
                className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl text-base sm:text-lg font-black text-white bg-[#F97316] hover:bg-[#EA580C] shadow-xl shadow-orange-900/30 hover:scale-105 transition-all"
              >
                <Wand2 className="w-5 h-5" /> Arma tu itinerario
              </button>
              <button
                type="button"
                onClick={() => document.getElementById('destinos')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl text-base sm:text-lg font-bold text-white bg-white/10 border-2 border-white/30 backdrop-blur-sm hover:bg-white/20 transition-all"
              >
                <Compass className="w-5 h-5" /> Ver destinos
              </button>
            </div>
          </div>
        </div>
      </HeroCarousel>

      {/* SECCIÓN DEL FORMULARIO (Usando el componente reutilizable) */}
      <section id="buscador" className="max-w-7xl mx-auto px-4 sm:px-6 relative z-30 -mt-10 sm:-mt-20 scroll-mt-24">
        <SearchBar onSearch={handleSearch} />
      </section>

      {/* FILA DE BENEFICIOS — inspirada en el flyer de marca */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 mt-10 sm:mt-14">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
          {[
            { icon: ShieldCheck, title: 'Viaja seguro', desc: 'Transportistas verificados para tu tranquilidad.' },
            { icon: PiggyBank, title: 'Ahorra más', desc: 'Encuentra las mejores opciones al mejor precio.' },
            { icon: FileCheck, title: 'Viaja formal', desc: 'Promovemos el transporte formal en el Perú.' },
            { icon: Compass, title: 'Explora más', desc: 'Descubre nuevos destinos con total confianza.' },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="flex flex-col items-center text-center gap-2 sm:gap-3 p-4">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-[#F97316]/10 border border-[#F97316]/20 flex items-center justify-center text-[#F97316]">
                <Icon className="w-6 h-6 sm:w-7 sm:h-7" />
              </div>
              <h3 className="text-sm sm:text-base font-black text-[#0F2A4D] uppercase tracking-tight">{title}</h3>
              <p className="hidden sm:block text-xs text-slate-500 leading-snug">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 mt-14 sm:mt-16">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-[#0F2A4D] uppercase tracking-tight">Viajes disponibles ahora</h2>
          <button
            type="button"
            onClick={() => navigate('/search')}
            className="text-sm font-bold text-[#F97316] hover:underline"
          >
            Ver todos
          </button>
        </div>

        {loadingTrips ? (
          <div className="bg-white rounded-[2rem] border-2 border-[#DCE8F5] p-10 flex items-center justify-center">
            <Loader2 className="w-7 h-7 animate-spin text-[#0F2A4D]" />
          </div>
        ) : trips.length === 0 ? (
          <div className="bg-white rounded-[2rem] border-2 border-[#DCE8F5] p-10 text-center">
            <p className="text-slate-600 font-semibold">Aún no hay viajes publicados.</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {trips.map((trip) => {
              const dt = formatDateTime(trip.departure_time);
              return (
                <article key={trip.id} className="bg-white rounded-[2rem] border-2 border-[#DCE8F5] p-5 shadow-sm overflow-hidden min-w-0 w-full">
                  <p className="text-sm font-black text-[#0F2A4D] truncate">{trip.origin_name} → {trip.destination_name}</p>
                  <div className="mt-2 flex items-center gap-3 text-xs text-slate-600">
                    <span className="inline-flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {dt.date} · {dt.time}</span>
                    <span className="inline-flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {trip.available_seats} asientos</span>
                  </div>

                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-lg font-black text-[#F97316]">
                      {trip.currency === 'SOL' ? 'S/' : '$'} {trip.price_per_seat}
                    </span>
                    <span className="text-xs font-semibold text-slate-500">{trip.driver?.name || trip.driver_name || 'Conductor'}</span>
                  </div>

                  <div className="mt-4 flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleViewTrip(trip)}
                      className="flex-1 rounded-xl border border-[#0F2A4D] text-[#0F2A4D] font-bold py-2 text-sm hover:bg-[#0F2A4D] hover:text-white transition-all"
                    >
                      Ver detalle
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMessageDriver(trip)}
                      disabled={contactingTripId === trip.id}
                      className="rounded-xl bg-[#F97316] text-white px-3 py-2 hover:bg-[#EA580C] transition-colors disabled:opacity-70"
                      title="Mensajear"
                    >
                      {contactingTripId === trip.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageCircle className="w-4 h-4" />}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* SECCIÓN: CARRUSEL DE DESTINOS */}
      <DestinationCarousel onSelectDestination={handleSelectDestination} />

      {/* SECCIÓN 2: CÓMO FUNCIONA */}
      <section className="py-24 bg-[#DCE8F5]/20 border-y border-[#DCE8F5]/30 mt-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col items-center mb-6 text-center">
            <div className="w-16 h-16 bg-[#2F5C94] rounded-full flex items-center justify-center mb-6 shadow-xl text-white">
              <HelpCircle className="w-8 h-8" />
            </div>
            <span className="inline-flex items-center gap-2 px-3 py-1.5 mb-4 rounded-full text-xs font-semibold bg-[#F97316]/10 border border-[#F97316]/30 text-[#EA580C] uppercase tracking-wider">
              <Sparkles className="w-3 h-3" />
              Itinerarios con IA
            </span>
            <h2 className="text-4xl md:text-5xl font-black tracking-tight text-[#0F2A4D] uppercase">¿Cómo funciona la app?</h2>
            <p className="mt-5 text-slate-600 text-lg max-w-2xl leading-relaxed">
              Creamos un itinerario inteligente para tu viaje y, a partir de él, optimizamos automáticamente
              el transporte compartido, los horarios, las rutas y el costo en tiempo real.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8 mt-14">
            <div className="group relative p-8 bg-white rounded-[2.5rem] shadow-sm border-2 border-[#DCE8F5] hover:border-[#F97316] transition-all hover:-translate-y-2">
              <span className="absolute top-6 right-7 text-5xl font-black text-[#DCE8F5] group-hover:text-[#F97316]/20 transition-colors">01</span>
              <div className="w-16 h-16 bg-[#0F2A4D]/5 rounded-2xl flex items-center justify-center mb-6 text-[#0F2A4D] group-hover:scale-110 transition-transform">
                <Sparkles className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-black mb-3 text-[#0F2A4D]">Cuéntanos tu viaje</h3>
              <p className="text-slate-600 text-sm leading-relaxed">Ingresa destino, fechas, presupuesto y preferencias. Así de simple.</p>
            </div>

            <div className="group relative p-8 bg-white rounded-[2.5rem] shadow-sm border-2 border-[#DCE8F5] hover:border-[#F97316] transition-all hover:-translate-y-2">
              <span className="absolute top-6 right-7 text-5xl font-black text-[#DCE8F5] group-hover:text-[#F97316]/20 transition-colors">02</span>
              <div className="w-16 h-16 bg-[#0F2A4D]/5 rounded-2xl flex items-center justify-center mb-6 text-[#0F2A4D] group-hover:scale-110 transition-transform">
                <Wand2 className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-black mb-3 text-[#0F2A4D]">La IA arma tu itinerario</h3>
              <p className="text-slate-600 text-sm leading-relaxed">Lugares, horarios, costos y transporte recomendados. Si cambias algo, se actualiza solo.</p>
            </div>

            <div className="group relative p-8 bg-white rounded-[2.5rem] shadow-sm border-2 border-[#DCE8F5] hover:border-[#F97316] transition-all hover:-translate-y-2">
              <span className="absolute top-6 right-7 text-5xl font-black text-[#DCE8F5] group-hover:text-[#F97316]/20 transition-colors">03</span>
              <div className="w-16 h-16 bg-[#0F2A4D]/5 rounded-2xl flex items-center justify-center mb-6 text-[#0F2A4D] group-hover:scale-110 transition-transform">
                <Users className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-black mb-3 text-[#0F2A4D]">Match con otros viajeros</h3>
              <p className="text-slate-600 text-sm leading-relaxed">Agrupamos rutas y horarios similares, optimizando el punto de encuentro y el precio ya dividido.</p>
            </div>

            <div className="group relative p-8 bg-white rounded-[2.5rem] shadow-sm border-2 border-[#DCE8F5] hover:border-[#F97316] transition-all hover:-translate-y-2">
              <span className="absolute top-6 right-7 text-5xl font-black text-[#DCE8F5] group-hover:text-[#F97316]/20 transition-colors">04</span>
              <div className="w-16 h-16 bg-[#0F2A4D]/5 rounded-2xl flex items-center justify-center mb-6 text-[#0F2A4D] group-hover:scale-110 transition-transform">
                <Car className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-black mb-3 text-[#0F2A4D]">Un conductor te lleva</h3>
              <p className="text-slate-600 text-sm leading-relaxed">Si faltan cupos, lo publicamos automáticamente en más canales. Un conductor lo acepta y listo.</p>
            </div>
          </div>
        </div>
      </section>

      {/* SECCIÓN 3: QUIÉNES SOMOS */}
      <section className="py-32 bg-white overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center gap-20">
            <div className="flex-1 relative">
              <div className="absolute -top-10 -left-10 w-40 h-40 bg-[#FDBA74] rounded-full blur-[80px] opacity-40"></div>
              <img
                src="/destinos/lago-titicaca.jpg"
                className="rounded-[3rem] shadow-2xl relative z-10 w-full object-cover h-[500px] border-8 border-white"
                alt="Comunidad viajera en el Lago Titicaca, Perú"
              />
              <div className="absolute -bottom-10 -right-10 bg-[#F97316] text-white font-black text-center py-8 px-6 rounded-full z-20 shadow-2xl animate-bounce">
                ✨ 100% <br /> Seguro
              </div>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-6 text-[#F97316]">
                <Info className="w-8 h-8" />
                <span className="font-black uppercase tracking-[0.2em] text-sm">Sobre nosotros</span>
              </div>
              <h2 className="text-4xl md:text-6xl font-black mb-8 text-[#0F2A4D] leading-[1.1] tracking-tighter">
                Conectamos personas para trayectos más inteligentes 🤝
              </h2>
              <p className="text-xl text-slate-600 leading-relaxed mb-10 font-medium">
                Somos una plataforma creada por viajeros para viajeros. Creemos que compartir un vehículo no solo reduce gastos, sino que crea una comunidad más unida y responsable con el medio ambiente. 🌿
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {['Seguridad verificada 🛡️', 'Ahorro masivo 💰', 'Menos tráfico 🚗', 'Nuevos amigos 👋'].map((item, idx) => (
                  <div key={idx} className="flex items-center gap-3 bg-[#DCE8F5]/20 p-4 rounded-2xl border border-[#DCE8F5]">
                    <div className="w-6 h-6 bg-[#F97316] text-white rounded-full flex items-center justify-center text-xs">✓</div>
                    <span className="font-bold text-[#0F2A4D]">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECCIÓN 4: CTA FINAL */}
      <section className="py-32">
        <div className="max-w-7xl mx-auto px-6">
          <div className="bg-[#0F2A4D] rounded-[4rem] p-12 md:p-24 text-center text-white shadow-[0_30px_60px_-15px_rgba(15,42,77,0.5)] relative overflow-hidden">
            <div className="relative z-10">
              <h2 className="text-4xl md:text-7xl font-black mb-8 italic underline decoration-[#F97316] decoration-8 underline-offset-8">
                ¿Tienes un asiento libre? 🙋‍♂️
              </h2>
              <p className="text-[#DCE8F5] mb-16 text-xl md:text-2xl max-w-2xl mx-auto leading-relaxed font-medium">
                Publica tu viaje o encuentra el tuyo uniéndote a nuestra comunidad de viajeros hoy mismo. ¡Te esperamos! 🚀
              </p>
              <div className="flex flex-col sm:flex-row gap-6 justify-center">
                <Link
                  to="/login"
                  className="bg-white text-[#0F2A4D] px-14 py-6 rounded-[2rem] font-black text-xl hover:scale-105 transition-transform flex items-center justify-center gap-3 shadow-2xl"
                >
                  <LogIn className="w-6 h-6" /> Iniciar Sesión
                </Link>
                <Link
                  to="/register"
                  className="bg-[#2F5C94] text-white border-2 border-[#DCE8F5]/50 px-14 py-6 rounded-[2rem] font-black text-xl hover:bg-[#F97316] transition-all flex items-center justify-center gap-3 shadow-2xl"
                >
                  Crea tu cuenta <ChevronRight className="w-6 h-6" />
                </Link>
              </div>
            </div>
            <div className="absolute top-0 right-0 w-96 h-96 bg-[#2F5C94] rounded-full -mr-48 -mt-48 opacity-20 blur-3xl"></div>
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-[#F97316] rounded-full -ml-48 -mb-48 opacity-20 blur-3xl"></div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-16 border-t border-[#DCE8F5]/30 text-center text-slate-400 font-bold">
        <p className="text-[#0F2A4D]/60 uppercase tracking-widest text-sm">
          &copy; 2024 SumaqTravel. Viaja seguro, viaja formal.
        </p>
      </footer>
    </div>
  );
};

export default Index;
