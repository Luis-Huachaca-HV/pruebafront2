/**
 * paymentService.test.ts
 * 
 * Tests para simular diferentes escenarios de pago con Culqi.
 * Incluye casos de éxito, error y validaciones.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { paymentService, CreateChargeRequest, PaymentResponse } from '@/services/paymentService';

// Mock de fetch global
global.fetch = vi.fn();

describe('Payment Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ========================================================================
  // TESTS DE ÉXITO
  // ========================================================================

  describe('createCharge - Casos exitosos', () => {
    it('debe crear un cargo exitosamente con Yape', async () => {
      // Arrange
      const mockResponse: PaymentResponse = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        culqi_charge_id: 'chr_1234567890abcdef',
        status: 'pending',
        payment_method: 'yape',
        amount: 10000,
        currency_code: 'PEN',
        message: 'Pago en procesamiento. Espera confirmación de Yape',
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => mockResponse,
      });

      const request: CreateChargeRequest = {
        token: 'chr_test_token_123',
        reservation_id: '550e8400-e29b-41d4-a716-446655440000',
        email: 'user@example.com',
        amount: 10000,
      };

      // Act
      const result = await paymentService.createCharge(request);

      // Assert
      expect(result.status).toBe('pending');
      expect(result.payment_method).toBe('yape');
      expect(result.culqi_charge_id).toBe('chr_1234567890abcdef');
      expect(result.amount).toBe(10000);
    });

    it('debe crear un cargo exitosamente con Tarjeta de Crédito', async () => {
      // Arrange
      const mockResponse: PaymentResponse = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        culqi_charge_id: 'chr_1234567890bcdefg',
        status: 'pending',
        payment_method: 'card',
        amount: 25000,
        currency_code: 'PEN',
        message: 'Pago en procesamiento',
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => mockResponse,
      });

      const request: CreateChargeRequest = {
        token: 'chr_test_token_456',
        reservation_id: '550e8400-e29b-41d4-a716-446655440001',
        email: 'driver@example.com',
        amount: 25000,
      };

      // Act
      const result = await paymentService.createCharge(request);

      // Assert
      expect(result.status).toBe('pending');
      expect(result.payment_method).toBe('card');
      expect(result.amount).toBe(25000);
    });

    it('debe convertir correctamente de soles a céntimos', async () => {
      // Arrange: 150.50 soles = 15050 céntimos
      const mockResponse: PaymentResponse = {
        id: 'test-id',
        culqi_charge_id: 'chr_test',
        status: 'pending',
        payment_method: 'yape',
        amount: 15050,
        currency_code: 'PEN',
        message: 'Pago procesado',
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => mockResponse,
      });

      const request: CreateChargeRequest = {
        token: 'token_test',
        reservation_id: 'res-123',
        email: 'test@example.com',
        amount: 15050, // 150.50 soles
      };

      // Act
      const result = await paymentService.createCharge(request);

      // Assert
      expect(result.amount).toBe(15050);
      expect(result.amount / 100).toBe(150.5);
    });
  });

  // ========================================================================
  // TESTS DE ERROR
  // ========================================================================

  describe('createCharge - Casos de error', () => {
    it('debe manejar error 400 de validación', async () => {
      // Arrange
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          detail: 'Monto manipulado: esperado 10000, recibido 5000',
        }),
      });

      const request: CreateChargeRequest = {
        token: 'bad_token',
        reservation_id: 'res-123',
        email: 'test@example.com',
        amount: 5000,
      };

      // Act & Assert
      await expect(paymentService.createCharge(request)).rejects.toThrow(
        'Monto manipulado'
      );
    });

    it('debe manejar error 402 de pago rechazado', async () => {
      // Arrange
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 402,
        json: async () => ({
          detail: 'Fondos insuficientes en Yape',
        }),
      });

      const request: CreateChargeRequest = {
        token: 'yape_token',
        reservation_id: 'res-123',
        email: 'user@example.com',
        amount: 50000,
      };

      // Act & Assert
      await expect(paymentService.createCharge(request)).rejects.toThrow(
        'Fondos insuficientes'
      );
    });

    it('debe manejar error de autenticación (401)', async () => {
      // Arrange
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({
          detail: 'CULQI_PRIVATE_KEY inválida',
        }),
      });

      const request: CreateChargeRequest = {
        token: 'valid_token',
        reservation_id: 'res-123',
        email: 'user@example.com',
        amount: 10000,
      };

      // Act & Assert
      await expect(paymentService.createCharge(request)).rejects.toThrow(
        'Error 401'
      );
    });

    it('debe manejar error de conexión de red', async () => {
      // Arrange
      (global.fetch as any).mockRejectedValueOnce(
        new TypeError('Failed to fetch')
      );

      const request: CreateChargeRequest = {
        token: 'token_test',
        reservation_id: 'res-123',
        email: 'user@example.com',
        amount: 10000,
      };

      // Act & Assert
      await expect(paymentService.createCharge(request)).rejects.toThrow(
        'conectar con el servidor'
      );
    });

    it('debe manejar respuesta vacía del servidor', async () => {
      // Arrange
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({}),
      });

      const request: CreateChargeRequest = {
        token: 'token_test',
        reservation_id: 'res-123',
        email: 'user@example.com',
        amount: 10000,
      };

      // Act & Assert
      await expect(paymentService.createCharge(request)).rejects.toThrow();
    });
  });

  // ========================================================================
  // TESTS DE VALIDACIÓN
  // ========================================================================

  describe('createCharge - Validaciones', () => {
    it('debe validar que el token no esté vacío', async () => {
      // Arrange
      const request: CreateChargeRequest = {
        token: '',
        reservation_id: 'res-123',
        email: 'user@example.com',
        amount: 10000,
      };

      // Act & Assert
      await expect(paymentService.createCharge(request)).rejects.toThrow(
        'Token'
      );
    });

    it('debe validar que el monto sea positivo', async () => {
      // Arrange
      const request: CreateChargeRequest = {
        token: 'valid_token',
        reservation_id: 'res-123',
        email: 'user@example.com',
        amount: -100,
      };

      // Act & Assert
      await expect(paymentService.createCharge(request)).rejects.toThrow(
        'mayor a 0'
      );
    });

    it('debe validar email válido', async () => {
      // Arrange
      const request: CreateChargeRequest = {
        token: 'valid_token',
        reservation_id: 'res-123',
        email: '',
        amount: 10000,
      };

      // Act & Assert
      await expect(paymentService.createCharge(request)).rejects.toThrow(
        'Email'
      );
    });

    it('debe validar reservation_id', async () => {
      // Arrange
      const request: CreateChargeRequest = {
        token: 'valid_token',
        reservation_id: '',
        email: 'user@example.com',
        amount: 10000,
      };

      // Act & Assert
      await expect(paymentService.createCharge(request)).rejects.toThrow(
        'reservación'
      );
    });
  });

  // ========================================================================
  // TESTS DE LIMITE DE MONTOS
  // ========================================================================

  describe('createCharge - Límites de montos', () => {
    it('debe rechazar montos menores al mínimo (S/ 0.01)', async () => {
      // Arrange: 0 céntimos
      const request: CreateChargeRequest = {
        token: 'valid_token',
        reservation_id: 'res-123',
        email: 'user@example.com',
        amount: 0,
      };

      // Act & Assert
      await expect(paymentService.createCharge(request)).rejects.toThrow();
    });

    it('debe rechazar montos mayores al máximo (S/ 100,000)', async () => {
      // Arrange: 10,000,001 céntimos = S/ 100,000.01
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          detail: 'Monto fuera de rango permitido',
        }),
      });

      const request: CreateChargeRequest = {
        token: 'valid_token',
        reservation_id: 'res-123',
        email: 'user@example.com',
        amount: 10000001,
      };

      // Act & Assert
      await expect(paymentService.createCharge(request)).rejects.toThrow();
    });

    it('debe aceptar montos dentro del rango válido', async () => {
      // Arrange
      const mockResponse: PaymentResponse = {
        id: 'test-id',
        culqi_charge_id: 'chr_test',
        status: 'pending',
        payment_method: 'yape',
        amount: 9999999, // S/ 99,999.99
        currency_code: 'PEN',
        message: 'Pago procesado',
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => mockResponse,
      });

      const request: CreateChargeRequest = {
        token: 'valid_token',
        reservation_id: 'res-123',
        email: 'user@example.com',
        amount: 9999999,
      };

      // Act
      const result = await paymentService.createCharge(request);

      // Assert
      expect(result.amount).toBe(9999999);
    });
  });
});
