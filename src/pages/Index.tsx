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
} from 'lucide-react';
import SearchBar from "../components/SearchBar";
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

  return (
    <div className="min-h-screen bg-white font-sans text-[#81638b] overflow-x-hidden">

      {/* SECCIÓN 1: HERO */}
      <section className="relative min-h-[72vh] sm:min-h-[85vh] flex items-center justify-center bg-[#81638b] overflow-hidden">
        <img
          src="https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?q=80&w=2070"
          className="absolute inset-0 w-full h-full object-cover opacity-30"
          alt="Viaje divertido"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#81638b]/60 via-[#81638b]/80 to-[#81638b]"></div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 text-center">
          <img
            src="/sumac-travel-logo.jpeg"
            alt="Logo de Sumac Travel"
            className="mx-auto w-32 sm:w-40 md:w-48 object-contain drop-shadow-lg mb-6 sm:mb-8"
          />
          <h1 className="text-3xl sm:text-5xl md:text-8xl font-black text-white mb-6 sm:mb-8 tracking-tighter leading-tight sm:leading-none">
            LLEGA A TU DESTINO <br />
            <span className="text-[#9ce0db] italic font-light"> con Sumac Travel.</span>
          </h1>
          <p className="text-base sm:text-xl md:text-2xl text-[#dac9df] max-w-3xl mx-auto leading-relaxed font-medium">
            La forma más inteligente, económica y humana de moverte por el país.
          </p>
        </div>
      </section>

      {/* SECCIÓN DEL FORMULARIO (Usando el componente reutilizable) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 relative z-30 -mt-10 sm:-mt-20">
        <SearchBar onSearch={handleSearch} />
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 mt-10 sm:mt-12">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-[#81638b] uppercase tracking-tight">Viajes disponibles ahora</h2>
          <button
            type="button"
            onClick={() => navigate('/search')}
            className="text-sm font-bold text-[#5dc1b9] hover:underline"
          >
            Ver todos
          </button>
        </div>

        {loadingTrips ? (
          <div className="bg-white rounded-[2rem] border-2 border-[#dac9df] p-10 flex items-center justify-center">
            <Loader2 className="w-7 h-7 animate-spin text-[#81638b]" />
          </div>
        ) : trips.length === 0 ? (
          <div className="bg-white rounded-[2rem] border-2 border-[#dac9df] p-10 text-center">
            <p className="text-slate-600 font-semibold">Aún no hay viajes publicados.</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {trips.map((trip) => {
              const dt = formatDateTime(trip.departure_time);
              return (
                <article key={trip.id} className="bg-white rounded-[2rem] border-2 border-[#dac9df] p-5 shadow-sm overflow-hidden min-w-0 w-full">
                  <p className="text-sm font-black text-[#81638b] truncate">{trip.origin_name} → {trip.destination_name}</p>
                  <div className="mt-2 flex items-center gap-3 text-xs text-slate-600">
                    <span className="inline-flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {dt.date} · {dt.time}</span>
                    <span className="inline-flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {trip.available_seats} asientos</span>
                  </div>

                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-lg font-black text-[#5dc1b9]">
                      {trip.currency === 'SOL' ? 'S/' : '$'} {trip.price_per_seat}
                    </span>
                    <span className="text-xs font-semibold text-slate-500">{trip.driver?.name || trip.driver_name || 'Conductor'}</span>
                  </div>

                  <div className="mt-4 flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleViewTrip(trip)}
                      className="flex-1 rounded-xl border border-[#81638b] text-[#81638b] font-bold py-2 text-sm hover:bg-[#81638b] hover:text-white transition-all"
                    >
                      Ver detalle
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMessageDriver(trip)}
                      disabled={contactingTripId === trip.id}
                      className="rounded-xl bg-[#5dc1b9] text-white px-3 py-2 hover:bg-[#4ab0a8] transition-colors disabled:opacity-70"
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

      {/* SECCIÓN 2: CÓMO FUNCIONA */}
      <section className="py-24 bg-[#dac9df]/20 border-y border-[#dac9df]/30 mt-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col items-center mb-20 text-center">
            <div className="w-16 h-16 bg-[#b695c0] rounded-full flex items-center justify-center mb-6 shadow-xl text-white">
              <HelpCircle className="w-8 h-8" />
            </div>
            <h2 className="text-4xl md:text-5xl font-black tracking-tight text-[#81638b] uppercase">¿Cómo funciona la app? 🤔</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-12 text-center">
            <div className="group p-10 bg-white rounded-[3rem] shadow-sm border-2 border-[#dac9df] hover:border-[#5dc1b9] transition-all hover:-translate-y-2">
              <div className="w-20 h-20 bg-[#dac9df]/30 rounded-3xl flex items-center justify-center mx-auto mb-8 text-4xl group-hover:scale-110 transition-transform">
                🔍
              </div>
              <h3 className="text-2xl font-black mb-4 text-[#81638b]">1. Busca</h3>
              <p className="text-slate-600 font-medium">Encuentra conductores que viajan a donde tú vas en segundos. ¡Súper fácil!</p>
            </div>

            <div className="group p-10 bg-white rounded-[3rem] shadow-sm border-2 border-[#dac9df] hover:border-[#5dc1b9] transition-all hover:-translate-y-2">
              <div className="w-20 h-20 bg-[#dac9df]/30 rounded-3xl flex items-center justify-center mx-auto mb-8 text-4xl group-hover:scale-110 transition-transform">
                ✅
              </div>
              <h3 className="text-2xl font-black mb-4 text-[#81638b]">2. Reserva</h3>
              <p className="text-slate-600 font-medium">Elige tu asiento favorito y confirma el viaje con un solo toque. 👆</p>
            </div>

            <div className="group p-10 bg-white rounded-[3rem] shadow-sm border-2 border-[#dac9df] hover:border-[#5dc1b9] transition-all hover:-translate-y-2">
              <div className="w-20 h-20 bg-[#dac9df]/30 rounded-3xl flex items-center justify-center mx-auto mb-8 text-4xl group-hover:scale-110 transition-transform">
                🚗
              </div>
              <h3 className="text-2xl font-black mb-4 text-[#81638b]">3. Viaja</h3>
              <p className="text-slate-600 font-medium">Encuéntrate con tu conductor, comparte historias y disfruta el camino. 🌈</p>
            </div>
          </div>
        </div>
      </section>

      {/* SECCIÓN 3: QUIÉNES SOMOS */}
      <section className="py-32 bg-white overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center gap-20">
            <div className="flex-1 relative">
              <div className="absolute -top-10 -left-10 w-40 h-40 bg-[#9ce0db] rounded-full blur-[80px] opacity-40"></div>
              <img
                src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?q=80&w=1049"
                className="rounded-[3rem] shadow-2xl relative z-10 w-full object-cover h-[500px] border-8 border-white"
                alt="Comunidad feliz"
              />
              <div className="absolute -bottom-10 -right-10 bg-[#5dc1b9] text-white font-black text-center py-8 px-6 rounded-full z-20 shadow-2xl animate-bounce">
                ✨ 100% <br /> Seguro
              </div>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-6 text-[#5dc1b9]">
                <Info className="w-8 h-8" />
                <span className="font-black uppercase tracking-[0.2em] text-sm">Sobre nosotros</span>
              </div>
              <h2 className="text-4xl md:text-6xl font-black mb-8 text-[#81638b] leading-[1.1] tracking-tighter">
                Conectamos personas para trayectos más inteligentes 🤝
              </h2>
              <p className="text-xl text-slate-600 leading-relaxed mb-10 font-medium">
                Somos una plataforma creada por viajeros para viajeros. Creemos que compartir un vehículo no solo reduce gastos, sino que crea una comunidad más unida y responsable con el medio ambiente. 🌿
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {['Seguridad verificada 🛡️', 'Ahorro masivo 💰', 'Menos tráfico 🚗', 'Nuevos amigos 👋'].map((item, idx) => (
                  <div key={idx} className="flex items-center gap-3 bg-[#dac9df]/20 p-4 rounded-2xl border border-[#dac9df]">
                    <div className="w-6 h-6 bg-[#5dc1b9] text-white rounded-full flex items-center justify-center text-xs">✓</div>
                    <span className="font-bold text-[#81638b]">{item}</span>
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
          <div className="bg-[#81638b] rounded-[4rem] p-12 md:p-24 text-center text-white shadow-[0_30px_60px_-15px_rgba(129,99,139,0.5)] relative overflow-hidden">
            <div className="relative z-10">
              <h2 className="text-4xl md:text-7xl font-black mb-8 italic underline decoration-[#5dc1b9] decoration-8 underline-offset-8">
                ¿Tienes un asiento libre? 🙋‍♂️
              </h2>
              <p className="text-[#dac9df] mb-16 text-xl md:text-2xl max-w-2xl mx-auto leading-relaxed font-medium">
                Publica tu viaje o encuentra el tuyo uniéndote a nuestra comunidad de viajeros hoy mismo. ¡Te esperamos! 🚀
              </p>
              <div className="flex flex-col sm:flex-row gap-6 justify-center">
                <Link
                  to="/login"
                  className="bg-white text-[#81638b] px-14 py-6 rounded-[2rem] font-black text-xl hover:scale-105 transition-transform flex items-center justify-center gap-3 shadow-2xl"
                >
                  <LogIn className="w-6 h-6" /> Iniciar Sesión
                </Link>
                <Link
                  to="/register"
                  className="bg-[#b695c0] text-white border-2 border-[#dac9df]/50 px-14 py-6 rounded-[2rem] font-black text-xl hover:bg-[#5dc1b9] transition-all flex items-center justify-center gap-3 shadow-2xl"
                >
                  Crea tu cuenta <ChevronRight className="w-6 h-6" />
                </Link>
              </div>
            </div>
            <div className="absolute top-0 right-0 w-96 h-96 bg-[#b695c0] rounded-full -mr-48 -mt-48 opacity-20 blur-3xl"></div>
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-[#5dc1b9] rounded-full -ml-48 -mb-48 opacity-20 blur-3xl"></div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-16 border-t border-[#dac9df]/30 text-center text-slate-400 font-bold">
        <p className="text-[#81638b]/60 uppercase tracking-widest text-sm">
          &copy; 2024 TuPlataformaDeViajes. Hecho con ❤️ para el mundo.
        </p>
      </footer>
    </div>
  );
};

export default Index;
