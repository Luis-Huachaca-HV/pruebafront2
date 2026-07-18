import React from 'react';
import { WalletIcon, ArrowRightLeft, ShieldCheck, Zap } from 'lucide-react';

interface WalletBalanceCardProps {
  balance: number;
  onRechargeClick: () => void;
}

export const WalletBalanceCard: React.FC<WalletBalanceCardProps> = ({ balance, onRechargeClick }) => {
  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-indigo-900 via-purple-900 to-indigo-800 rounded-[2rem] p-6 shadow-xl text-white">
      {/* Decorative blurred circles for Glassmorphism feel */}
      <div className="absolute top-0 right-0 -mt-8 -mr-8 w-32 h-32 bg-white opacity-10 rounded-full blur-2xl"></div>
      <div className="absolute bottom-0 left-0 -mb-8 -ml-8 w-24 h-24 bg-pink-500 opacity-20 rounded-full blur-xl"></div>
      
      <div className="relative z-10 flex flex-col justify-between h-full min-h-[160px]">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-indigo-100">
            <WalletIcon className="w-6 h-6 opacity-80" />
            <span className="text-sm font-medium tracking-wide uppercase tracking-widest opacity-80">
              Mi Balance
            </span>
          </div>
        </div>

        {/* Balance Display */}
        <div className="mb-6">
          <div className="flex items-end gap-1">
            <span className="text-2xl font-semibold opacity-80">S/</span>
            <span className="text-5xl font-black tracking-tight">{Number(balance).toFixed(2)}</span>
          </div>
          {balance <= 0 && (
            <div className="mt-2 inline-flex items-center gap-1.5 bg-red-500/20 text-red-200 px-3 py-1 rounded-full text-xs font-semibold backdrop-blur-sm border border-red-500/30">
              Saldo insuficiente para iniciar viajes
            </div>
          )}
          {balance > 0 && balance < 10 && (
            <div className="mt-2 inline-flex items-center gap-1.5 bg-amber-500/20 text-amber-200 px-3 py-1 rounded-full text-xs font-semibold backdrop-blur-sm border border-amber-500/30">
              Saldo bajo
            </div>
          )}
        </div>

        {/* Action Button */}
        <div className="pt-2">
          <button 
            onClick={onRechargeClick}
            className="w-full bg-white/10 hover:bg-white/20 active:bg-white/30 backdrop-blur-md border border-white/20 text-white font-medium py-3.5 px-4 rounded-xl transition-all duration-200 flex flex-col items-center justify-center gap-1 shadow-[0_4px_12px_rgba(0,0,0,0.1)] group"
          >
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-yellow-400 group-hover:scale-110 transition-transform" />
              <span>Recargar Billetera</span>
            </div>
            <div className="flex items-center gap-2 mt-1 opacity-70 text-[10px] uppercase font-bold tracking-widest">
              <span>Mercado Pago</span>
              <span className="w-1 h-1 rounded-full bg-white/50"></span>
              <span>Yape</span>
              <span className="w-1 h-1 rounded-full bg-white/50"></span>
              <span>Tarjetas</span>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};
