import React, { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Car, ArrowRight } from 'lucide-react';
import { useActiveTrip } from '@/hooks/useActiveTrip';

export const ActiveTripBanner: React.FC = () => {
  const { activeTrip, isLoading } = useActiveTrip();
  const location = useLocation();
  const navigate = useNavigate();
  const hasRedirected = useRef(false);

  useEffect(() => {
    if (!hasRedirected.current && !isLoading && activeTrip) {
      hasRedirected.current = true;
      navigate(`/trip-details/${activeTrip.id}`);
    }
  }, [isLoading, activeTrip, navigate]);

  if (!activeTrip) return null;

  const tripPath = `/trip-details/${activeTrip.id}`;
  if (location.pathname === tripPath) return null;

  return (
    <div className="sticky top-0 z-50 flex items-center justify-between bg-amber-500 px-4 py-2 text-white shadow-md">
      <div className="flex items-center gap-2">
        <Car className="h-5 w-5" />
        <span className="text-sm font-medium">Tienes un viaje en curso</span>
      </div>
      <button
        onClick={() => navigate(tripPath)}
        className="flex items-center gap-1 rounded-full bg-white/20 px-3 py-1 text-sm font-medium transition-colors hover:bg-white/30"
      >
        Ir al viaje
        <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
};
