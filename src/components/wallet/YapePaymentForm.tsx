import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { rechargeWalletYape } from '@/services/walletService';

interface YapePaymentFormProps {
  amount: number;
  onSuccess: () => void;
  onError: (message: string) => void;
  isProcessing: boolean;
  setIsProcessing: (v: boolean) => void;
}

const YapeLogo = () => (
  <svg width="22" height="22" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="48" height="48" rx="12" fill="#722ED1"/>
    <text x="50%" y="58%" dominantBaseline="middle" textAnchor="middle" fill="white" fontSize="22" fontWeight="bold">Y</text>
  </svg>
);

/**
 * Genera un identificador local para el flujo de pago demo.
 */
function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

async function generateYapeToken(phoneNumber: string, otp: string): Promise<string> {
  // Simulated token: no phone or OTP is sent to Mercado Pago.
  return `demo-yape-${uuid()}-${phoneNumber.slice(-2)}-${otp.slice(-2)}`;
}

export const YapePaymentForm: React.FC<YapePaymentFormProps> = ({
  amount,
  onSuccess,
  onError,
  isProcessing,
  setIsProcessing,
}) => {
  const { accessToken, user } = useAuth();
  const [phone, setPhone] = useState(import.meta.env.VITE_DEV_YAPE_PHONE || '');
  const [otp, setOtp] = useState(import.meta.env.VITE_DEV_YAPE_OTP || '');
  const [errors, setErrors] = useState<{ phone?: string; otp?: string }>({});


  const validatePhone = (v: string) => /^\d{9}$/.test(v);
  const validateOtp   = (v: string) => /^\d{6}$/.test(v);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value.replace(/\D/g, '').slice(0, 9);
    setPhone(v);
    if (errors.phone) setErrors(prev => ({ ...prev, phone: undefined }));
  };

  const handleOtpChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value.replace(/\D/g, '').slice(0, 6);
    setOtp(v);
    if (errors.otp) setErrors(prev => ({ ...prev, otp: undefined }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: typeof errors = {};
    if (!validatePhone(phone)) newErrors.phone = 'Debe tener exactamente 9 dígitos.';
    if (!validateOtp(otp))     newErrors.otp   = 'El código debe tener 6 dígitos.';
    if (Object.keys(newErrors).length) { setErrors(newErrors); return; }
    if (!accessToken) { onError('No hay sesión activa.'); return; }

    setIsProcessing(true);
    try {
      // Step 1: Generate Yape token via correct MP endpoint
      const yapToken = await generateYapeToken(phone, otp);

      // Step 2: Send token to backend
      await rechargeWalletYape(accessToken, {
        transaction_amount: amount,
        phone,
        otp: yapToken,
        payer_email: user?.email || 'noreply@yape.com',
      });

      onSuccess();
    } catch (err: any) {
      onError(err?.message || 'Error al procesar el pago con Yape.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <div className="flex items-center gap-3">
        <YapeLogo />
        <div>
          <p className="font-bold text-foreground">Pagar con Yape</p>
          <p className="text-xs text-muted-foreground">Usa tu celular registrado en Yape</p>
        </div>
      </div>

      <div className="bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-900/40 rounded-2xl p-4 text-sm space-y-1.5">
        <p className="font-semibold text-violet-700 dark:text-violet-300">¿Cómo pagar?</p>
        {[
          'Ingresa tu número de celular asociado a Yape.',
          'Abre tu app Yape → toca «Código QR» para obtener tu código.',
          'Copia el código de 6 dígitos e ingrésalo abajo.',
        ].map((step, i) => (
          <div key={i} className="flex gap-2 text-violet-600 dark:text-violet-400">
            <span className="font-bold">{i + 1}.</span>
            <span>{step}</span>
          </div>
        ))}
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-semibold text-muted-foreground block">Número de celular</label>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">+51</span>
          <input
            type="tel"
            inputMode="numeric"
            value={phone}
            onChange={handlePhoneChange}
            placeholder="9XXXXXXXX"
            disabled={isProcessing}
            className={`w-full pl-14 pr-4 py-4 rounded-2xl text-lg font-bold outline-none transition-all bg-secondary/30 border-2 ${
              errors.phone ? 'border-destructive' : 'border-transparent focus:border-violet-400'
            } disabled:opacity-60`}
          />
        </div>
        {errors.phone && <p className="text-xs text-destructive font-medium ml-1">{errors.phone}</p>}
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-semibold text-muted-foreground block">
          Código de 6 dígitos (desde tu app Yape)
        </label>
        <input
          type="tel"
          inputMode="numeric"
          value={otp}
          onChange={handleOtpChange}
          placeholder="● ● ● ● ● ●"
          disabled={isProcessing}
          maxLength={6}
          className={`w-full px-4 py-4 rounded-2xl text-2xl font-black tracking-[0.5em] text-center outline-none transition-all bg-secondary/30 border-2 ${
            errors.otp ? 'border-destructive' : 'border-transparent focus:border-violet-400'
          } disabled:opacity-60`}
        />
        {errors.otp && <p className="text-xs text-destructive font-medium ml-1">{errors.otp}</p>}
      </div>

      <button
        type="submit"
        disabled={isProcessing || phone.length !== 9 || otp.length !== 6}
        className="w-full py-5 rounded-2xl font-bold text-lg bg-violet-600 hover:bg-violet-700 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-violet-500/20 active:scale-[0.98] flex items-center justify-center gap-2"
      >
        {isProcessing ? (
          <><Loader2 className="w-5 h-5 animate-spin" /> Procesando...</>
        ) : (
          <><YapeLogo /> Pagar S/ {amount.toFixed(2)} con Yape</>
        )}
      </button>
    </form>
  );
};
