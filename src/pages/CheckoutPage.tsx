/**
 * CheckoutPage.tsx
 * 
 * Página de checkout con integración de Culqi.
 * Permite al usuario seleccionar método de pago y procesar transacciones.
 */

import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Check,
  MapPin,
  Clock,
  Users,
  AlertCircle,
  Loader,
} from 'lucide-react';
import CulqiPayment from '@/components/CulqiPayment';
import { Button } from '@/components/ui/button';

interface ReservationData {
  reservationId: string;
  tripId: string;
  origin: string;
  destination: string;
  date: string;
  time: string;
  price: number;
  currency: string;
  passengers: number;
  email: string;
}

export const CheckoutPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const [reservation, setReservation] = useState<ReservationData | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Obtener datos de reservación del estado de navegación
    const data = location.state?.reservation as ReservationData;

    if (!data) {
      // Modo test: reservar hardcodeada
      setReservation({
        reservationId: '550e8400-e29b-41d4-a716-446655440000',
        tripId: 'trip_test_001',
        origin: 'Lima',
        destination: 'Arequipa',
        date: '2026-02-15',
        time: '08:00 AM',
        price: 150.5,
        currency: 'S/',
        passengers: 2,
        email: 'test@example.com',
      });
      setLoading(false);
      return;
    }

    setReservation(data);
    setLoading(false);
  }, [location, navigate]);

  const handlePaymentSuccess = (paymentId: string) => {
    setPaymentSuccess(true);
    setPaymentId(paymentId);
    setPaymentError(null);

    // Esperar un poco antes de redirigir
    setTimeout(() => {
      navigate('/my-trips', { state: { paymentId } });
    }, 3000);
  };

  const handlePaymentError = (error: string) => {
    setPaymentError(error);
    setPaymentSuccess(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Cargando información...</p>
        </div>
      </div>
    );
  }

  if (!reservation) {
    return null;
  }

  // Convertir precio a formato de vista
  const priceDisplay = reservation.price.toFixed(2);

  // === ESTADO: PAGO EXITOSO ===
  if (paymentSuccess) {
    return (
      <div className="min-h-screen bg-background px-4 py-8 flex flex-col items-center justify-center">
        <div className="bg-card rounded-2xl p-8 shadow-lg max-w-md w-full text-center animate-in fade-in zoom-in">
          {/* Icono de éxito */}
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Check className="w-8 h-8 text-green-600" />
          </div>

          {/* Título */}
          <h1 className="text-2xl font-bold text-foreground mb-2">
            ¡Pago confirmado!
          </h1>
          <p className="text-sm text-muted-foreground mb-6">
            Tu viaje ha sido reservado exitosamente
          </p>

          {/* Detalles del viaje */}
          <div className="bg-secondary/50 rounded-lg p-4 mb-6 space-y-3 text-left">
            {/* Origen y destino */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="w-4 h-4 text-primary flex-shrink-0" />
                <span className="font-medium text-foreground">
                  {reservation.origin}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm ml-6 relative">
                <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-border/50" />
                <MapPin className="w-4 h-4 text-primary flex-shrink-0" />
                <span className="text-muted-foreground">
                  {reservation.destination}
                </span>
              </div>
            </div>

            {/* Fecha y hora */}
            <div className="flex items-center gap-2 text-sm pt-2">
              <Clock className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <span className="text-muted-foreground">
                {new Date(reservation.date).toLocaleDateString('es-ES', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                })}
                {' • '}
                {reservation.time}
              </span>
            </div>

            {/* Pasajeros */}
            <div className="flex items-center gap-2 text-sm">
              <Users className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <span className="text-muted-foreground">
                {reservation.passengers}{' '}
                {reservation.passengers === 1 ? 'pasajero' : 'pasajeros'}
              </span>
            </div>

            {/* Total pagado */}
            <div className="pt-3 border-t border-border flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Total pagado</span>
              <div className="text-right">
                <div className="font-bold text-lg text-primary">
                  {reservation.currency} {priceDisplay}
                </div>
                <div className="text-xs text-muted-foreground">
                  ID: {paymentId?.slice(0, 12)}...
                </div>
              </div>
            </div>
          </div>

          {/* Botón de acción */}
          <Button
            onClick={() => navigate('/my-trips')}
            className="w-full"
            size="lg"
          >
            Ver mis viajes
          </Button>

          <p className="text-xs text-muted-foreground mt-4">
            Serás redirigido automáticamente en 3 segundos...
          </p>
        </div>
      </div>
    );
  }

  // === ESTADO: ESPERANDO PAGO ===
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-card border-b border-border">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-secondary rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold ml-4">Confirmar y pagar</h1>
        </div>
      </div>

      {/* Contenido */}
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Columna izquierda: Resumen del viaje */}
          <div className="lg:col-span-2">
            {/* Resumen del viaje */}
            <div className="bg-card rounded-lg border border-border p-6 mb-6">
              <h2 className="text-lg font-bold mb-4">Resumen del viaje</h2>

              {/* Ruta */}
              <div className="space-y-4 mb-6">
                <div className="flex items-start gap-4">
                  <div className="bg-primary/10 rounded-lg p-3 flex-shrink-0">
                    <MapPin className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">Origen</p>
                    <p className="font-bold text-foreground">
                      {reservation.origin}
                    </p>
                  </div>
                </div>

                {/* Línea divisoria */}
                <div className="ml-8 border-l-2 border-dashed border-border h-4" />

                <div className="flex items-start gap-4">
                  <div className="bg-primary/10 rounded-lg p-3 flex-shrink-0">
                    <MapPin className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">Destino</p>
                    <p className="font-bold text-foreground">
                      {reservation.destination}
                    </p>
                  </div>
                </div>
              </div>

              {/* Detalles */}
              <div className="border-t border-border pt-6 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Fecha</p>
                  <p className="font-semibold">
                    {new Date(reservation.date).toLocaleDateString('es-ES', {
                      day: 'numeric',
                      month: 'short',
                    })}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Hora</p>
                  <p className="font-semibold">{reservation.time}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Pasajeros</p>
                  <p className="font-semibold">
                    {reservation.passengers}{' '}
                    {reservation.passengers === 1 ? 'pasajero' : 'pasajeros'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Precio unitario</p>
                  <p className="font-semibold">
                    {reservation.currency} {(reservation.price / reservation.passengers).toFixed(2)}
                  </p>
                </div>
              </div>
            </div>

            {/* Información de seguridad */}
            <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4 flex items-start gap-3 mb-6">
              <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  Transacción segura
                </p>
                <p className="text-xs text-blue-700 dark:text-blue-200 mt-1">
                  Tu información de pago está protegida por Culqi con encriptación
                  de nivel bancario.
                </p>
              </div>
            </div>
          </div>

          {/* Columna derecha: Componente de pago */}
          <div className="lg:col-span-1">
            <div className="bg-card rounded-lg border border-border p-6 sticky top-24">
              {/* Monto a pagar */}
              <div className="mb-6">
                <p className="text-sm text-muted-foreground mb-1">Monto a pagar</p>
                <div className="text-3xl font-bold text-primary">
                  {reservation.currency}{' '}
                  <span className="text-2xl">{priceDisplay}</span>
                </div>
              </div>

              {/* Componente Culqi */}
              {paymentError && (
                <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-red-900 dark:text-red-100">
                      Error en el pago
                    </p>
                    <p className="text-xs text-red-700 dark:text-red-200 mt-1">
                      {paymentError}
                    </p>
                  </div>
                </div>
              )}

              <CulqiPayment
                reservationId={reservation.reservationId}
                email={reservation.email}
                amountSoles={reservation.price}
                onSuccess={handlePaymentSuccess}
                onError={handlePaymentError}
                buttonLabel="Pagar ahora con Culqi"
              />

              {/* Métodos aceptados */}
              <div className="mt-4 pt-4 border-t border-border">
                <p className="text-xs text-muted-foreground text-center">
                  Métodos aceptados: Yape • Tarjetas de crédito/débito
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CheckoutPage;
