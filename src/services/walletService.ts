/**
 * walletService.ts
 *
 * Servicio de API para operaciones de billetera del conductor.
 * Realiza llamadas fetch al backend FastAPI.
 */

const BASE_URL = (import.meta.env.VITE_BACKEND_URL as string || '').replace(/\/$/, '');
const WALLETS_URL = `${BASE_URL}/api/v1/wallets`;

// =====================
// TIPOS
// =====================

export interface WalletResponse {
  id: string;
  user_id: string;
  balance: number;
}

export interface WalletTransaction {
  id: string;
  wallet_id: string;
  amount: number;
  transaction_type: 'credit' | 'debit' | 'commission' | 'payment';
  description: string | null;
  reference_id: string | null;
  created_at: string;
}

export interface WalletTransactionListResponse {
  transactions: WalletTransaction[];
  total: number;
  page: number;
  page_size: number;
}

// =====================
// HELPERS
// =====================

const authHeaders = (token: string) => ({
  'Content-Type': 'application/json',
  'ngrok-skip-browser-warning': '1',
  Authorization: `Bearer ${token}`,
});

const handleResponse = async <T>(response: Response): Promise<T> => {
  const result = await response.json();

  if (response.ok) return result as T;

  if (Array.isArray(result?.detail)) {
    const messages = result.detail.map((err: Record<string, unknown>) =>
      `${(err.loc as string[])?.join('.') || 'Campo'}: ${err.msg}`
    );
    throw new Error(messages.join('\n'));
  }

  throw new Error(result?.detail || result?.error?.message || result?.message || 'Error en la petición');
};

// =====================
// REQUESTS
// =====================

/** GET /api/v1/wallets/me — obtiene la billetera del usuario autenticado */
export const getMyWallet = async (token: string): Promise<WalletResponse> => {
  const response = await fetch(`${WALLETS_URL}/me`, {
    headers: authHeaders(token),
  });
  return handleResponse<WalletResponse>(response);
};

/** GET /api/v1/wallets/me/transactions — historial paginado de transacciones */
export const getMyTransactions = async (
  token: string,
  page = 1,
  pageSize = 20
): Promise<WalletTransactionListResponse> => {
  const query = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
  }).toString();

  const response = await fetch(`${WALLETS_URL}/me/transactions?${query}`, {
    headers: authHeaders(token),
  });
  return handleResponse<WalletTransactionListResponse>(response);
};

export interface TopUpBrickRequest {
  transaction_amount: number;
  token: string;
  description: string;
  installments: number;
  payment_method_id: string;
  issuer_id?: string;
  payer: Record<string, any>;
}

export interface RechargeOrderResponse {
  id: string;
  amount: number;
  status: string;
  mp_preference_id?: string;
  created_at: string;
}

export const rechargeWalletBrick = async (
  token: string,
  payload: TopUpBrickRequest
): Promise<RechargeOrderResponse> => {
  const response = await fetch(`${WALLETS_URL}/recharge`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
  return handleResponse<RechargeOrderResponse>(response);
};

// =====================
// YAPE
// =====================

export interface YapeRechargePayload {
  transaction_amount: number;
  phone: string;   // 9 dígitos
  otp: string;     // Token Yape generado por MP
  payer_email: string;
}

export const rechargeWalletYape = async (
  token: string,
  payload: YapeRechargePayload
): Promise<RechargeOrderResponse> => {
  const response = await fetch(`${WALLETS_URL}/recharge/yape`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
  return handleResponse<RechargeOrderResponse>(response);
};

// =====================
// CARD (Custom Form)
// =====================

export interface CardRechargePayload {
  transaction_amount: number;
  token: string;           // Card token ID generado por MP /v1/card_tokens
  installments: number;
  payment_method_id: string; // 'visa', 'master', 'amex', etc.
  payer_email: string;
}

export const rechargeWalletCard = async (
  authToken: string,
  payload: CardRechargePayload
): Promise<RechargeOrderResponse> => {
  const response = await fetch(`${WALLETS_URL}/recharge/card`, {
    method: 'POST',
    headers: authHeaders(authToken),
    body: JSON.stringify(payload),
  });
  return handleResponse<RechargeOrderResponse>(response);
};
