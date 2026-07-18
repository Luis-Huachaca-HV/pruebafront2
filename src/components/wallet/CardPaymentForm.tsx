import React, { useState } from 'react';
import { Loader2, CreditCard, Lock, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { rechargeWalletCard } from '@/services/walletService';

interface CardPaymentFormProps {
  amount: number;
  onSuccess: () => void;
  onError: (message: string) => void;
  isProcessing: boolean;
  setIsProcessing: (v: boolean) => void;
}

function formatCardNumber(value: string): string {
  return value.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim();
}

function detectCardBrand(num: string): string {
  const n = num.replace(/\s/g, '');
  if (/^4/.test(n)) return 'visa';
  // MP puede devolver tarjetas de prueba con BIN 50xx que igual deben procesarse como master.
  if (/^5[0-5]/.test(n) || /^2(2[2-9]|[3-6]\d|7[01]|720)/.test(n)) return 'master';
  if (/^3[47]/.test(n)) return 'amex';
  if (/^36|^38|^30[0-5]/.test(n)) return 'diners';
  return '';
}

async function generateCardToken(params: {
  cardNumber: string;
  expMonth: string;
  expYear: string;
  cvv: string;
  cardholderName: string;
  docNumber: string;
}): Promise<{ id: string; payment_method_id: string }> {
  // No card data leaves this browser in demo mode.
  const paymentMethodId = detectCardBrand(params.cardNumber);

  if (!paymentMethodId) {
    throw new Error(
      'No se pudo identificar la marca de la tarjeta. Intenta con otra tarjeta de prueba o verifica los datos.'
    );
  }

  return { id: `demo-card-${Date.now()}`, payment_method_id: paymentMethodId };
}

export const CardPaymentForm: React.FC<CardPaymentFormProps> = ({
  amount,
  onSuccess,
  onError,
  isProcessing,
  setIsProcessing,
}) => {
  const { accessToken, user } = useAuth();
  const [cardNumber, setCardNumber] = useState(import.meta.env.VITE_DEV_CARD_NUMBER || '');
  const [expiry, setExpiry] = useState(import.meta.env.VITE_DEV_CARD_EXPIRY || '');   // MM/YY
  const [cvv, setCvv] = useState(import.meta.env.VITE_DEV_CARD_CVV || '');
  const [name, setName] = useState(import.meta.env.VITE_DEV_CARD_NAME || '');
  const [doc, setDoc] = useState(import.meta.env.VITE_DEV_CARD_DOC || '');
  const [showCvv, setShowCvv] = useState(false);

  const [errors, setErrors] = useState<Record<string, string>>({});

  const brand = detectCardBrand(cardNumber);

  const handleCardNumber = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCardNumber(formatCardNumber(e.target.value));
    if (errors.cardNumber) setErrors(p => ({ ...p, cardNumber: '' }));
  };

  const handleExpiry = (e: React.ChangeEvent<HTMLInputElement>) => {
    let v = e.target.value.replace(/\D/g, '').slice(0, 4);
    if (v.length >= 3) v = `${v.slice(0, 2)}/${v.slice(2)}`;
    setExpiry(v);
    if (errors.expiry) setErrors(p => ({ ...p, expiry: '' }));
  };

  const handleCvv = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCvv(e.target.value.replace(/\D/g, '').slice(0, 4));
    if (errors.cvv) setErrors(p => ({ ...p, cvv: '' }));
  };

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (cardNumber.replace(/\s/g, '').length < 13) e.cardNumber = 'Número de tarjeta inválido.';
    const [mm, yy] = expiry.split('/');
    if (!mm || !yy || mm.length !== 2 || (yy.length !== 2 && yy.length !== 4)) {
      e.expiry = 'Formato inválido (MM/AA).';
    } else {
      const month = parseInt(mm, 10);
      if (month < 1 || month > 12) {
        e.expiry = 'Mes inválido (01-12).';
      }
      // Se eliminó la validación de fecha vencida para permitir pruebas con tarjetas de sandbox antiguas
    }


    if (cvv.length < 3) e.cvv = 'CVV inválido.';
    if (name.trim().length < 3) e.name = 'Ingresa el nombre del titular.';
    if (!/^\d{7,12}$/.test(doc)) e.doc = 'Número de documento inválido.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    if (!accessToken) { onError('No hay sesión activa.'); return; }

    setIsProcessing(true);
    try {
      const [mm, yy] = expiry.split('/');
      const { id: tokenId, payment_method_id } = await generateCardToken({
        cardNumber,
        expMonth: mm,
        expYear: yy,
        cvv,
        cardholderName: name.trim().toUpperCase(),
        docNumber: doc,
      });

      await rechargeWalletCard(accessToken, {
        transaction_amount: amount,
        token: tokenId,
        installments: 1,
        payment_method_id,
        payer_email: user?.email || 'noreply@covoiturage.com',
      });

      onSuccess();
    } catch (err: any) {
      onError(err?.message || 'Error al procesar el pago con tarjeta.');
    } finally {
      setIsProcessing(false);
    }
  };

  const inputClass = (field: string) =>
    `w-full px-4 py-4 rounded-2xl text-base outline-none transition-all bg-secondary/30 border-2 ${
      errors[field] ? 'border-destructive' : 'border-transparent focus:border-primary/50'
    } disabled:opacity-60`;

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div className="flex items-center gap-3 mb-1">
        <CreditCard className="w-5 h-5 text-primary" />
        <div>
          <p className="font-bold text-foreground">Tarjeta de crédito o débito</p>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Lock className="w-3 h-3" /> Pago seguro procesado por Mercado Pago
          </p>
        </div>
        {brand && (
          <span className="ml-auto text-xs font-bold uppercase px-2 py-1 rounded-lg bg-primary/10 text-primary">
            {brand}
          </span>
        )}
      </div>

      {/* Card Number */}
      <div className="space-y-1">
        <label className="text-xs font-semibold text-muted-foreground">Número de tarjeta</label>
        <input
          type="text"
          inputMode="numeric"
          value={cardNumber}
          onChange={handleCardNumber}
          placeholder="0000 0000 0000 0000"
          disabled={isProcessing}
          className={`${inputClass('cardNumber')} font-mono text-lg tracking-widest`}
        />
        {errors.cardNumber && <p className="text-xs text-destructive ml-1">{errors.cardNumber}</p>}
      </div>

      {/* Expiry + CVV */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-semibold text-muted-foreground">Vencimiento (MM/AA)</label>
          <input
            type="text"
            inputMode="numeric"
            value={expiry}
            onChange={handleExpiry}
            placeholder="MM/AA"
            disabled={isProcessing}
            maxLength={5}
            className={`${inputClass('expiry')} font-mono text-center text-lg`}
          />
          {errors.expiry && <p className="text-xs text-destructive ml-1">{errors.expiry}</p>}
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold text-muted-foreground">CVV</label>
          <div className="relative">
            <input
              type={showCvv ? "text" : "password"}
              inputMode="numeric"
              value={cvv}
              onChange={handleCvv}
              placeholder="000"
              disabled={isProcessing}
              maxLength={brand === 'amex' ? 4 : 3}
              className={`${inputClass('cvv')} font-mono text-center text-lg pr-10`}
            />
            <button
              type="button"
              onClick={() => setShowCvv(!showCvv)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary transition-colors"
              title={showCvv ? "Ocultar" : "Mostrar"}
            >
              {showCvv ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1 text-center">
            {brand === 'amex' ? '4 dígitos para AMEX' : '3 dígitos (atrás)'}
          </p>
          {errors.cvv && <p className="text-xs text-destructive ml-1">{errors.cvv}</p>}

        </div>
      </div>

      {/* Cardholder Name */}
      <div className="space-y-1">
        <label className="text-xs font-semibold text-muted-foreground">Nombre del titular</label>
        <input
          type="text"
          value={name}
          onChange={e => { setName(e.target.value); if (errors.name) setErrors(p => ({ ...p, name: '' })); }}
          placeholder="Como aparece en la tarjeta"
          disabled={isProcessing}
          className={inputClass('name')}
        />
        {errors.name && <p className="text-xs text-destructive ml-1">{errors.name}</p>}
      </div>

      {/* Document */}
      <div className="space-y-1">
        <label className="text-xs font-semibold text-muted-foreground">DNI / Documento</label>
        <input
          type="text"
          inputMode="numeric"
          value={doc}
          onChange={e => { setDoc(e.target.value.replace(/\D/g, '')); if (errors.doc) setErrors(p => ({ ...p, doc: '' })); }}
          placeholder="Número de documento"
          disabled={isProcessing}
          maxLength={12}
          className={inputClass('doc')}
        />
        {errors.doc && <p className="text-xs text-destructive ml-1">{errors.doc}</p>}
      </div>

      <button
        type="submit"
        disabled={isProcessing}
        className="w-full py-5 rounded-2xl font-bold text-lg bg-primary hover:bg-primary/90 text-primary-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-primary/20 active:scale-[0.98] flex items-center justify-center gap-2"
      >
        {isProcessing ? (
          <><Loader2 className="w-5 h-5 animate-spin" /> Procesando...</>
        ) : (
          <><CreditCard className="w-5 h-5" /> Pagar S/ {amount.toFixed(2)}</>
        )}
      </button>

      <p className="text-center text-xs text-muted-foreground">
        🔒 Tus datos están protegidos con cifrado SSL
      </p>
    </form>
  );
};
