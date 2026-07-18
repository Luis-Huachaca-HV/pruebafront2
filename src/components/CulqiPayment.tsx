/**
 * CulqiPayment.tsx
 * 
 * Componente React que maneja la integración con Culqi Checkout v4.
 * 
 * Responsabilidades:
 * 1. Inyectar script de Culqi en el DOM
 * 2. Configurar window.Culqi con public key
 * 3. Capturar token generado
 * 4. Enviar token al backend para procesar pago
 * 5. Mostrar estado y errores al usuario
 */

import React, { useEffect, useState } from 'react';
import { usePayment } from '@/hooks/useCulqiPayment';
import { AlertCircle, CheckCircle, Loader } from 'lucide-react';

interface CulqiPaymentProps {
  /** UUID de la reservación a pagar */
  reservationId: string;

  /** Email del pagador */
  email: string;

  /** Monto en soles (ej: 100.50 = S/ 100.50) */
  amountSoles: number;

  /** Callback después de pago exitoso */
  onSuccess?: (paymentId: string) => void;

  /** Callback en caso de error */
  onError?: (error: string) => void;

  /** Texto del botón (default: "Pagar con Culqi") */
  buttonLabel?: string;

  /** Desabilitar el botón */
  disabled?: boolean;
}

export const CulqiPayment: React.FC<CulqiPaymentProps> = ({
  reservationId,
  email,
  amountSoles,
  onSuccess,
  onError,
  buttonLabel = 'Pagar con Culqi',
  disabled = false
}) => {
  const {
    loading,
    error,
    success,
    processPayment,
    clearMessages
  } = usePayment();

  const [scriptLoaded, setScriptLoaded] = useState(false);

  /**
   * Inyecta el script de Culqi y configura window.Culqi
   */
  useEffect(() => {
    // Si ya está cargado, no inyectar de nuevo
    if (scriptLoaded || (window as any).Culqi) {
      setScriptLoaded(true);
      return;
    }

    // Crear script element
    const script = document.createElement('script');
    script.src = 'https://checkout.culqi.com/js/v4';
    script.async = true;

    script.onload = () => {
      // Script cargado, inicializar Culqi
      if ((window as any).Culqi) {
        (window as any).Culqi.publicKey = import.meta.env.VITE_CULQI_PUBLIC_KEY;
        console.log('✓ Culqi SDK initialized');
        setScriptLoaded(true);
      }
    };

    script.onerror = () => {
      console.error('✗ Failed to load Culqi script');
      onError?.('Error al cargar la pasarela de pagos');
    };

    document.head.appendChild(script);

    return () => {
      // Cleanup no necesario para scripts, pero podemos remover si queremos
      // document.head.removeChild(script);
    };
  }, [onError, scriptLoaded]);

  /**
   * Abre el modal de Culqi y captura el token
   */
  const handleOpenCulqi = async () => {
    if (!scriptLoaded || !(window as any).Culqi) {
      onError?.('Culqi no está disponible');
      return;
    }

    // Configurar la función global que Culqi llama al confirmar
    (window as any).culqi = async (token: string) => {
      try {
        // Enviar token al backend
        const paymentId = await processPayment({
          token,
          reservationId,
          email,
          amountSoles
        });

        onSuccess?.(paymentId);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Error desconocido';
        onError?.(errorMsg);
      }
    };

    // Abrir modal de Culqi
    (window as any).Culqi.open({
      title: 'Sumac Travel - Pagar Viaje',
      currency: 'PEN',
      amount: Math.round(amountSoles * 100), // Convertir a céntimos
      email: email,
      description: `Pago de reservación ${reservationId}`,
      orderId: reservationId,
      clientName: email.split('@')[0], // Nombre del cliente (aproximado)
    });
  };

  return (
    <div className="w-full space-y-4">
      {/* Mensajes de estado */}
      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 p-4 bg-green-50 border border-green-200 rounded-lg">
          <CheckCircle className="w-5 h-5 text-green-600" />
          <p className="text-sm text-green-700">
            Pago procesado correctamente. Espera confirmación...
          </p>
        </div>
      )}

      {/* Botón de pago */}
      <button
        onClick={handleOpenCulqi}
        disabled={disabled || loading || !scriptLoaded}
        className={`
          w-full px-6 py-3 rounded-lg font-semibold
          transition-all duration-200
          flex items-center justify-center gap-2
          
          ${disabled || loading || !scriptLoaded
            ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
            : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-95'
          }
        `}
      >
        {loading && <Loader className="w-5 h-5 animate-spin" />}
        {!loading && scriptLoaded && buttonLabel}
        {!scriptLoaded && 'Cargando...'}
      </button>

      {/* Información de monto */}
      <div className="text-center text-sm text-gray-600">
        <p>Monto a pagar: <span className="font-bold text-gray-900">S/ {amountSoles.toFixed(2)}</span></p>
        <p className="text-xs mt-1">Métodos: Yape | Tarjeta de Crédito/Débito</p>
      </div>

      {/* Link para limpiar mensajes */}
      {(error || success) && (
        <button
          onClick={clearMessages}
          className="text-xs text-blue-600 hover:text-blue-700 mx-auto"
        >
          Descartar
        </button>
      )}
    </div>
  );
};

export default CulqiPayment;
