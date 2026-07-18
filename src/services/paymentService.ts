/**
 * paymentService.ts
 * 
 * Servicio de API para operaciones de pagos.
 * Realiza llamadas fetch al backend FastAPI.
 */

import { API_BASE_URL } from '@/config/api';

export interface CreateChargeRequest {
  /** Token generado por Culqi SDK */
  token: string;

  /** UUID de la reservación */
  reservation_id: string;

  /** Email del pagador */
  email: string;

  /** Monto en céntimos (10000 = S/ 100.00) */
  amount: number;
}

export interface PaymentResponse {
  /** UUID del pago */
  id: string;

  /** ID de carga en Culqi */
  culqi_charge_id: string;

  /** Estado actual del pago */
  status: 'pending' | 'paid' | 'failed' | 'refunded';

  /** Método de pago usado */
  payment_method: 'yape' | 'card' | 'unknown';

  /** Monto en céntimos */
  amount: number;

  /** Código de moneda */
  currency_code: string;

  /** Mensaje descriptivo */
  message: string;
}

class PaymentService {
  private apiBaseUrl: string;

  constructor() {
    this.apiBaseUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';
  }

  /**
   * Crea un cargo en Culqi a través del backend.
   * 
   * @param request - Datos del pago (token, monto, email)
   * @returns Respuesta del backend con estado del pago
   * @throws Error si la solicitud falla
   */
  async createCharge(request: CreateChargeRequest): Promise<PaymentResponse> {
    const url = `${this.apiBaseUrl}/api/payments/charge`;

    console.log(`📡 POST ${url}`, request);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': '1',
        },
        body: JSON.stringify(request),
      });

      // Parsear respuesta
      const data = await response.json();

      if (!response.ok) {
        // Error del backend (4xx, 5xx)
        throw new Error(
          data.detail || `Error ${response.status}: ${response.statusText}`
        );
      }

      console.log('✓ Charge response:', data);

      return data as PaymentResponse;
    } catch (error) {
      console.error('Payment API error:', error);

      if (error instanceof TypeError) {
        // Error de red/conexión
        throw new Error('No se pudo conectar con el servidor de pagos');
      }

      if (error instanceof Error) {
        throw error;
      }

      throw new Error('Error desconocido al procesar pago');
    }
  }

  /**
   * Obtiene el estado actual de un pago.
   * 
   * @param paymentId - UUID del pago
   * @returns Estado actual del pago
   */
  async getPaymentStatus(paymentId: string): Promise<PaymentResponse> {
    const url = `${this.apiBaseUrl}/api/payments/${paymentId}`;

    console.log(`📡 GET ${url}`);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': '1',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || `Error ${response.status}`);
      }

      return data as PaymentResponse;
    } catch (error) {
      console.error('Get payment status error:', error);
      throw error;
    }
  }

  /**
   * Verifica si el backend está disponible.
   * Útil para healthchecks.
   */
  async isBackendAvailable(): Promise<boolean> {
    try {
      const response = await fetch(
        `${this.apiBaseUrl}/health`,
        {
          method: 'GET',
          signal: AbortSignal.timeout(5000),
          headers: { 'ngrok-skip-browser-warning': '1' }
        }
      );
      return response.ok;
    } catch {
      return false;
    }
  }
}

// Instancia única del servicio
export const paymentService = new PaymentService();

export default paymentService;
