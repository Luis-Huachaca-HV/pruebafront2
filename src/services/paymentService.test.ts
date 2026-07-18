import { describe, expect, it } from 'vitest';
import { paymentService } from '@/services/paymentService';

describe('paymentService demo', () => {
  const request = { token: 'demo-token', reservation_id: 'reservation-demo', email: 'demo@local', amount: 2500 };

  it('approves a local demo charge without calling a gateway', async () => {
    const payment = await paymentService.createCharge(request);
    expect(payment.status).toBe('approved');
    expect(payment.amount).toBe(2500);
  });

  it('validates the required demo fields', async () => {
    await expect(paymentService.createCharge({ ...request, token: '' })).rejects.toThrow('Token');
    await expect(paymentService.createCharge({ ...request, amount: 0 })).rejects.toThrow('mayor a 0');
  });
});
