import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CreditCard, ArrowLeft, Check, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Trip } from '@/types';
import { useToast } from '@/hooks/use-toast';

type PaymentMethod = 'card' | 'paypal' | null;

const Payment: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const trip = location.state?.trip as Trip | undefined;

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);

  // Card form state
  const [cardNumber, setCardNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [cvv, setCvv] = useState('');
  const [cardName, setCardName] = useState('');

  if (!trip) {
    navigate('/search');
    return null;
  }

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);

    // Simulate payment processing
    await new Promise((resolve) => setTimeout(resolve, 2000));

    setIsProcessing(false);
    setIsConfirmed(true);
    toast({
      title: "¡Pago exitoso!",
      description: "Tu viaje ha sido reservado correctamente.",
    });
  };

  const handlePayPal = async () => {
    setIsProcessing(true);

    // Simulate PayPal redirect and processing
    await new Promise((resolve) => setTimeout(resolve, 2000));

    setIsProcessing(false);
    setIsConfirmed(true);
    toast({
      title: "¡Pago exitoso!",
      description: "Tu viaje ha sido reservado correctamente.",
    });
  };

  if (isConfirmed) {
    return (
      <div className="min-h-screen bg-background px-4 py-6 flex flex-col items-center justify-center animate-fade-in">
        <div className="bg-card rounded-3xl p-8 shadow-lg max-w-md w-full text-center">
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <Check className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-2xl font-display font-bold text-foreground mb-2">
            ¡Reserva confirmada!
          </h1>
          <p className="text-muted-foreground mb-6">
            Tu viaje de {trip.origin} a {trip.destination} ha sido reservado exitosamente.
          </p>
          
          <div className="bg-secondary/50 rounded-xl p-4 mb-6 text-left">
            <div className="flex items-center gap-2 mb-2">
              <MapPin className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">{trip.origin}</span>
            </div>
            <div className="flex items-center gap-2 mb-3">
              <MapPin className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm">{trip.destination}</span>
            </div>
            <div className="text-sm text-muted-foreground">
              {new Date(trip.date).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })} • {trip.time}
            </div>
            <div className="mt-3 pt-3 border-t border-border flex justify-between">
              <span className="text-sm text-muted-foreground">Total pagado</span>
              <span className="font-bold text-primary">${trip.price} MXN</span>
            </div>
          </div>

          <Button onClick={() => navigate('/my-trips')} className="w-full" size="lg">
            Ver mis viajes
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 py-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Pago</h1>
          <p className="text-muted-foreground text-sm">Completa tu reserva</p>
        </div>
      </div>

      {/* Trip Summary */}
      <div className="bg-card rounded-2xl p-4 shadow-md mb-6">
        <h2 className="font-semibold text-foreground mb-3">Resumen del viaje</h2>
        <div className="flex items-center gap-2 mb-1">
          <MapPin className="w-4 h-4 text-primary" />
          <span className="text-sm">{trip.origin}</span>
        </div>
        <div className="flex items-center gap-2 mb-3">
          <MapPin className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm">{trip.destination}</span>
        </div>
        <div className="text-sm text-muted-foreground mb-3">
          {new Date(trip.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} • {trip.time}
        </div>
        <div className="flex justify-between items-center pt-3 border-t border-border">
          <span className="text-muted-foreground">Total a pagar</span>
          <span className="text-2xl font-bold text-primary">${trip.price}</span>
        </div>
      </div>

      {/* Payment Method Selection */}
      <div className="mb-6">
        <h2 className="font-semibold text-foreground mb-3">Método de pago</h2>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setPaymentMethod('card')}
            className={`p-4 rounded-xl border-2 transition-all ${
              paymentMethod === 'card'
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-primary/50'
            }`}
          >
            <CreditCard className={`w-8 h-8 mx-auto mb-2 ${paymentMethod === 'card' ? 'text-primary' : 'text-muted-foreground'}`} />
            <span className={`text-sm font-medium ${paymentMethod === 'card' ? 'text-primary' : 'text-foreground'}`}>
              Tarjeta
            </span>
          </button>
          <button
            onClick={() => setPaymentMethod('paypal')}
            className={`p-4 rounded-xl border-2 transition-all ${
              paymentMethod === 'paypal'
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-primary/50'
            }`}
          >
            <div className={`w-8 h-8 mx-auto mb-2 flex items-center justify-center text-xl font-bold ${paymentMethod === 'paypal' ? 'text-primary' : 'text-muted-foreground'}`}>
              P
            </div>
            <span className={`text-sm font-medium ${paymentMethod === 'paypal' ? 'text-primary' : 'text-foreground'}`}>
              PayPal
            </span>
          </button>
        </div>
      </div>

      {/* Card Form */}
      {paymentMethod === 'card' && (
        <form onSubmit={handlePayment} className="space-y-4 animate-slide-up">
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">
              Nombre en la tarjeta
            </label>
            <Input
              value={cardName}
              onChange={(e) => setCardName(e.target.value)}
              placeholder="Juan Pérez"
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">
              Número de tarjeta
            </label>
            <Input
              value={cardNumber}
              onChange={(e) => setCardNumber(e.target.value.replace(/\D/g, '').slice(0, 16))}
              placeholder="1234 5678 9012 3456"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">
                Fecha de expiración
              </label>
              <Input
                value={expiryDate}
                onChange={(e) => {
                  let value = e.target.value.replace(/\D/g, '').slice(0, 4);
                  if (value.length >= 2) {
                    value = value.slice(0, 2) + '/' + value.slice(2);
                  }
                  setExpiryDate(value);
                }}
                placeholder="MM/YY"
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">
                CVV
              </label>
              <Input
                type="password"
                value={cvv}
                onChange={(e) => setCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="123"
                required
              />
            </div>
          </div>
          <Button type="submit" className="w-full" size="lg" disabled={isProcessing}>
            {isProcessing ? 'Procesando...' : `Pagar $${trip.price} MXN`}
          </Button>
        </form>
      )}

      {/* PayPal */}
      {paymentMethod === 'paypal' && (
        <div className="animate-slide-up">
          <p className="text-sm text-muted-foreground text-center mb-4">
            Serás redirigido a PayPal para completar tu pago de forma segura.
          </p>
          <Button onClick={handlePayPal} className="w-full" size="lg" disabled={isProcessing}>
            {isProcessing ? 'Conectando con PayPal...' : `Pagar con PayPal $${trip.price} MXN`}
          </Button>
        </div>
      )}
    </div>
  );
};

export default Payment;
