// Carrusel de destinos — mecánica de marquee documentada en DESIGN_SYSTEM.md §3
import React, { useState } from "react";
import { MapPin, ArrowRight } from "lucide-react";

interface Destination {
  id: string;
  name: string;
  region: string;
  description: string;
  image: string;
}

const DESTINATIONS: Destination[] = [
  {
    id: "lima",
    name: "Lima",
    region: "Costa · Lima",
    description: "La capital, punto de partida de mil rutas.",
    image: "/destinos/lima.jpg",
  },
  {
    id: "cusco",
    name: "Cusco",
    region: "Sierra · Cusco",
    description: "Historia inca en cada calle empedrada.",
    image: "/destinos/cusco.jpg",
  },
  {
    id: "machu-picchu",
    name: "Machu Picchu",
    region: "Sierra · Cusco",
    description: "La maravilla que todo viajero quiere ver.",
    image: "/destinos/machu-picchu.jpg",
  },
  {
    id: "arequipa",
    name: "Arequipa",
    region: "Sierra · Arequipa",
    description: "La Ciudad Blanca al pie del Misti.",
    image: "/destinos/arequipa.jpg",
  },
  {
    id: "lago-titicaca",
    name: "Lago Titicaca",
    region: "Sierra · Puno",
    description: "El lago navegable más alto del mundo.",
    image: "/destinos/lago-titicaca.jpg",
  },
];

interface DestinationCarouselProps {
  onSelectDestination?: (destination: string) => void;
}

const DestinationCarousel: React.FC<DestinationCarouselProps> = ({ onSelectDestination }) => {
  const [paused, setPaused] = useState(false);

  // duración = cantidad_de_lugares × 5s, así la velocidad por tarjeta se mantiene constante
  const durationSeconds = DESTINATIONS.length * 5;
  const track = [...DESTINATIONS, ...DESTINATIONS, ...DESTINATIONS];

  return (
    <section id="destinos" className="py-20 sm:py-24 bg-white border-y border-[#DCE8F5] scroll-mt-16">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex flex-col items-center text-center mb-12 space-y-3">
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-[#F97316]/10 border border-[#F97316]/30 text-[#EA580C] uppercase tracking-wider">
            <MapPin className="w-3 h-3" />
            Explora más
          </span>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-[#0F2A4D]">
            Destinos que te esperan <span className="text-[#F97316] italic">en el Perú</span>
          </h2>
          <p className="text-[#0F2A4D]/50 text-base sm:text-lg max-w-lg leading-relaxed">
            Encuentra conductores verificados viajando a los lugares más increíbles del país.
          </p>
        </div>
      </div>

      <div
        className="relative"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onPointerDown={() => setPaused(true)}
        onPointerUp={() => setPaused(false)}
      >
        {/* Fade edges — deben coincidir con el fondo blanco de la sección */}
        <div className="pointer-events-none absolute inset-y-0 left-0 w-12 sm:w-20 z-10 bg-gradient-to-r from-white to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-12 sm:w-20 z-10 bg-gradient-to-l from-white to-transparent" />

        <div
          className="flex w-max px-6 animate-carousel-marquee"
          style={{
            animationDuration: `${durationSeconds}s`,
            animationPlayState: paused ? "paused" : "running",
          }}
        >
          {track.map((place, idx) => (
            <button
              key={`${place.id}-${idx}`}
              type="button"
              onClick={() => onSelectDestination?.(place.name)}
              className="group/card relative shrink-0 mx-2.5 rounded-2xl overflow-hidden text-left shadow-md hover:shadow-2xl transition-shadow duration-300"
              style={{ width: "min(320px, 78vw)", height: "440px" }}
            >
              <img
                src={place.image}
                alt={place.name}
                loading="lazy"
                className="absolute inset-0 w-full h-full object-cover scale-100 group-hover/card:scale-[1.08] transition-transform duration-700"
              />

              {/* Scrim inferior — neutro, siempre funciona sobre fotografía */}
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(to top, rgba(10,20,40,0.92) 0%, rgba(10,20,40,0.35) 55%, rgba(10,20,40,0.05) 100%)",
                }}
              />

              {/* Badge región */}
              <div
                className="absolute top-4 left-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-white"
                style={{
                  background: "rgba(15,42,77,0.55)",
                  backdropFilter: "blur(6px)",
                  border: "1px solid rgba(255,255,255,0.2)",
                }}
              >
                🇵🇪 {place.region}
              </div>

              {/* Bloque de texto */}
              <div className="absolute inset-x-0 bottom-0 p-5 flex flex-col gap-1">
                <h3 className="text-2xl font-black text-white leading-tight">{place.name}</h3>
                <p className="text-sm text-white/70">{place.description}</p>

                <span
                  className="mt-3 inline-flex items-center gap-1.5 self-start px-4 py-2 rounded-full text-sm font-bold text-white opacity-0 translate-y-2 group-hover/card:opacity-100 group-hover/card:translate-y-0 transition-all duration-200"
                  style={{ background: "linear-gradient(135deg, #F97316, #EA580C)" }}
                >
                  Buscar viajes <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
};

export default DestinationCarousel;
