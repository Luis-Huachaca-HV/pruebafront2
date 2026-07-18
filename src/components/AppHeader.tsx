import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Wallet } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { NotificationBell } from './NotificationBell';

// Header delgado y persistente — evita que la marca "se pierda" al entrar a la app logueada
export const AppHeader: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-[#DCE8F5] safe-area-top">
      <div className="flex items-center justify-between h-14 px-4 max-w-2xl mx-auto">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="flex items-center gap-2"
          aria-label="Ir al inicio"
        >
          <img src="/sumaq-travel-logo-nobg.png" alt="SumaqTravel" className="h-8 w-auto object-contain" />
          <span className="font-black text-[#0F2A4D] tracking-tight hidden xs:inline">SumaqTravel</span>
        </button>

        {isAuthenticated && (
          <div className="flex items-center gap-1.5">
            <NotificationBell />
            <button
              type="button"
              onClick={() => navigate('/wallet')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#0F2A4D]/5 text-[#0F2A4D] text-xs font-bold hover:bg-[#0F2A4D]/10 transition-colors"
              aria-label="Mi billetera"
            >
              <Wallet className="w-3.5 h-3.5 text-[#F97316]" />
              Billetera
            </button>
          </div>
        )}
      </div>
    </header>
  );
};

export default AppHeader;
