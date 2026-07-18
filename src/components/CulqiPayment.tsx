import React from 'react';
import { AlertCircle, CheckCircle, Loader } from 'lucide-react';
import { usePayment } from '@/hooks/useCulqiPayment';

interface CulqiPaymentProps { reservationId: string; email: string; amountSoles: number; onSuccess?: (paymentId: string) => void; onError?: (error: string) => void; buttonLabel?: string; disabled?: boolean; }

/** Local payment simulator. It never loads Culqi or submits payment data. */
export const CulqiPayment: React.FC<CulqiPaymentProps> = ({ reservationId, email, amountSoles, onSuccess, onError, buttonLabel = 'Simular pago', disabled = false }) => {
  const { loading, error, success, processPayment, clearMessages } = usePayment();
  const pay = async () => {
    try { onSuccess?.(await processPayment({ token: 'demo-culqi-token', reservationId, email, amountSoles })); }
    catch (reason) { onError?.(reason instanceof Error ? reason.message : 'No se pudo simular el pago.'); }
  };
  return <div className="w-full space-y-4">
    {error && <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"><AlertCircle className="h-5 w-5" />{error}</div>}
    {success && <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700"><CheckCircle className="h-5 w-5" />Pago demo aprobado.</div>}
    <button type="button" onClick={pay} disabled={disabled || loading} className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white disabled:bg-gray-300">
      {loading && <Loader className="h-5 w-5 animate-spin" />}{buttonLabel}
    </button>
    <p className="text-center text-sm text-gray-600">Simulación local: S/ {amountSoles.toFixed(2)}. No se procesa ningún cobro.</p>
    {(error || success) && <button type="button" onClick={clearMessages} className="mx-auto block text-xs text-blue-600">Descartar</button>}
  </div>;
};
export default CulqiPayment;
