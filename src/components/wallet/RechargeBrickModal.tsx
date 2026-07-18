import React, { useState } from 'react';
import { Loader2, ShieldCheck, CreditCard } from 'lucide-react';
import { YapePaymentForm } from './YapePaymentForm';
import { CardPaymentForm } from './CardPaymentForm';

type PaymentMethod = 'card' | 'yape';

interface RechargeBrickModalProps {
  amount: number;
  isOpen: boolean;
  onClose: () => void;
  onSubmitPayment?: (formData: any) => Promise<void>; // kept for legacy compat
  isProcessing: boolean;
  onYapeSuccess?: () => void;
  onYapeError?: (msg: string) => void;
  onCardSuccess?: () => void;
  onCardError?: (msg: string) => void;
  setIsProcessing?: (v: boolean) => void;
}

// Yape logo inline
const YapeIcon = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="48" height="48" rx="12" fill="#722ED1" />
    <text x="50%" y="58%" dominantBaseline="middle" textAnchor="middle" fill="white" fontSize="22" fontWeight="bold">Y</text>
  </svg>
);

export const RechargeBrickModal: React.FC<RechargeBrickModalProps> = ({
  amount,
  isOpen,
  onClose,
  isProcessing,
  onYapeSuccess,
  onYapeError,
  onCardSuccess,
  onCardError,
  setIsProcessing,
}) => {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('card');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 overflow-y-auto backdrop-blur-sm">
      <div className="bg-card rounded-[2rem] w-full max-w-lg shadow-2xl overflow-hidden mt-10 mb-10 max-h-[90vh] flex flex-col border border-border/50">

        {/* Header */}
        <div className="p-5 border-b border-border flex justify-between items-center bg-card sticky top-0 z-10">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Recargar Saldo</h2>
            <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              Pago seguro por Mercado Pago
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground bg-secondary/50 hover:text-foreground p-3 rounded-full hover:bg-secondary transition-all"
          >
            ✕
          </button>
        </div>

        <div className="p-4 md:p-6 overflow-y-auto flex-1 relative bg-slate-50/50 dark:bg-slate-900/20">

          {/* Amount display */}
          <div className="mb-5 p-4 bg-white dark:bg-slate-800 rounded-2xl border border-border flex items-center justify-between shadow-sm">
            <span className="font-medium text-muted-foreground tracking-wide">Monto a pagar</span>
            <span className="text-2xl font-black text-foreground">S/ {amount.toFixed(2)}</span>
          </div>

          {/* Payment Method Selector */}
          <div className="mb-5 grid grid-cols-2 gap-3">
            <button
              onClick={() => setPaymentMethod('card')}
              className={`flex items-center justify-center gap-2 py-3.5 px-4 rounded-2xl border-2 font-semibold transition-all text-sm ${
                paymentMethod === 'card'
                  ? 'border-primary bg-primary/5 text-primary'
                  : 'border-border bg-secondary/30 text-muted-foreground hover:border-border/70'
              }`}
            >
              <CreditCard className="w-4 h-4" />
              Tarjeta
            </button>
            <button
              onClick={() => setPaymentMethod('yape')}
              className={`flex items-center justify-center gap-2 py-3.5 px-4 rounded-2xl border-2 font-semibold transition-all text-sm ${
                paymentMethod === 'yape'
                  ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/30 text-violet-700 dark:text-violet-300'
                  : 'border-border bg-secondary/30 text-muted-foreground hover:border-border/70'
              }`}
            >
              <YapeIcon />
              Yape
            </button>
          </div>

          {/* ── CARD FORM ────────────────────────────────── */}
          {paymentMethod === 'card' && (
            <CardPaymentForm
              amount={amount}
              isProcessing={isProcessing}
              setIsProcessing={setIsProcessing ?? (() => {})}
              onSuccess={() => { onCardSuccess?.(); }}
              onError={(msg) => { onCardError?.(msg); }}
            />
          )}

          {/* ── YAPE FORM ────────────────────────────────── */}
          {paymentMethod === 'yape' && (
            <YapePaymentForm
              amount={amount}
              isProcessing={isProcessing}
              setIsProcessing={setIsProcessing ?? (() => {})}
              onSuccess={() => { onYapeSuccess?.(); }}
              onError={(msg) => { onYapeError?.(msg); }}
            />
          )}

          {/* Global processing overlay */}
          {isProcessing && (
            <div className="absolute inset-0 bg-background/80 flex items-center justify-center backdrop-blur-sm z-20">
              <div className="bg-card p-6 flex flex-col items-center rounded-2xl shadow-xl">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
                <h3 className="font-bold text-lg">Procesando recarga</h3>
                <p className="text-sm text-muted-foreground mt-2">Por favor no cierres la ventana</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
