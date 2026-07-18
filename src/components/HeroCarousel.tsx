// Fondo del Hero — rotación automática de fotos, mismo patrón de motion que el carrusel de destinos
import React, { useEffect, useState } from "react";

const SLIDES = [
  { src: "/hero/machu-picchu.png", alt: "Machu Picchu, Cusco" },
  { src: "/hero/lima.png", alt: "Plaza Mayor de Lima" },
  { src: "/hero/arequipa.png", alt: "Catedral de Arequipa al atardecer" },
];

const SLIDE_DURATION_MS = 5500;

interface HeroCarouselProps {
  children?: React.ReactNode;
}

const HeroCarousel: React.FC<HeroCarouselProps> = ({ children }) => {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % SLIDES.length);
    }, SLIDE_DURATION_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <section className="relative min-h-[78vh] sm:min-h-[88vh] flex flex-col overflow-hidden bg-[#0F2A4D]">
      {SLIDES.map((slide, i) => (
        <img
          key={slide.src}
          src={slide.src}
          alt={slide.alt}
          className="absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ease-in-out"
          style={{ opacity: i === index ? 1 : 0 }}
        />
      ))}
      <div className="absolute inset-0 bg-gradient-to-b from-[#0F2A4D]/70 via-[#0F2A4D]/55 to-[#0F2A4D]" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#0F2A4D] via-transparent to-transparent" />

      {children}

      {/* Indicadores del carrusel de fondo */}
      <div className="relative z-20 mt-auto mb-6 flex items-center justify-center gap-2 pb-2">
        {SLIDES.map((slide, i) => (
          <button
            key={slide.src}
            type="button"
            aria-label={`Ver ${slide.alt}`}
            onClick={() => setIndex(i)}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i === index ? "w-8 bg-[#F97316]" : "w-1.5 bg-white/40 hover:bg-white/60"
            }`}
          />
        ))}
      </div>
    </section>
  );
};

export default HeroCarousel;
