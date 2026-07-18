/**
 * useCulqiPayment.ts
 * 
 * Hook personalizado para manejar lógica de pagos Culqi.
 * Encapsula llamadas a la API del backend y gestión de estado.
 */

import { useState, useCallback } from 'react';
import { paymentService } from '@/services/paymentService';

interface ProcessPaymentParams {
  token: string;
  reservationId: string;
  email: string;
  amountSoles: number;
}

interface UseCulqiPaymentReturn {
  loading: boolean;
  error: string | null;
  success: boolean;
  processPayment: (params: ProcessPaymentParams) => Promise<string>;
  clearMessages: () => void;
}

/**
 * Hook para procesar pagos con Culqi.
 * 
 * Returns:
 * - loading: Si está procesando
 * - error: Mensaje de error (si hay)
 * - success: Si el pago fue exitoso
 * - processPayment: Función para enviar token al backend
 * - clearMessages: Limpiar errores/éxito
 */
export const usePayment = (): UseCulqiPaymentReturn => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const processPayment = useCallback(
    async (params: ProcessPaymentParams): Promise<string> => {
      setLoading(true);
      setError(null);
      setSuccess(false);

      try {
        // Validar parámetros en cliente
        if (!params.token) {
          throw new Error('Token de Culqi no disponible');
        }

        if (params.amountSoles <= 0) {
          throw new Error('Monto debe ser mayor a 0');
        }

        if (!params.email) {
          throw new Error('Email requerido');
        }

        if (!params.reservationId) {
          throw new Error('ID de reservación requerido');
        }

        console.log('📤 Enviando pago al backend...');

        // Convertir soles a céntimos
        const amountCentimos = Math.round(params.amountSoles * 100);

        // Llamar endpoint backend
        const response = await paymentService.createCharge({
          token: params.token,
          reservation_id: params.reservationId,
          email: params.email,
          amount: amountCentimos  // Enviar en céntimos
        });

        console.log('✓ Respuesta del backend:', response);

        setSuccess(true);

        // Retornar el ID del pago
        return response.id;
      } catch (err) {
        const errorMessage = err instanceof Error 
          ? err.message 
          : 'Error al procesar pago';
        
        console.error('✗ Payment error:', errorMessage);
        setError(errorMessage);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const clearMessages = useCallback(() => {
    setError(null);
    setSuccess(false);
  }, []);

  return {
    loading,
    error,
    success,
    processPayment,
    clearMessages
  };
};

export default usePayment;
