import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import {
  getMyWallet,
  getMyTransactions,
  rechargeWalletBrick,
  WalletResponse,
  WalletTransaction,
  TopUpBrickRequest
} from '@/services/walletService';

import { WalletBalanceCard } from '@/components/wallet/WalletBalanceCard';
import { TransactionHistoryTable } from '@/components/wallet/TransactionHistoryTable';
import { RechargeBrickModal } from '@/components/wallet/RechargeBrickModal';

const PAGE_SIZE = 20;

const Wallet: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { accessToken } = useAuth();

  const [wallet, setWallet] = useState<WalletResponse | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  
  const [isLoadingWallet, setIsLoadingWallet] = useState(true);
  const [isLoadingTx, setIsLoadingTx] = useState(false);
  const [isRecharging, setIsRecharging] = useState(false);

  const [isRechargeModalOpen, setIsRechargeModalOpen] = useState(false);
  const [rechargeAmount, setRechargeAmount] = useState<number>(50);

  const loadWallet = useCallback(async () => {
    if (!accessToken) return;
    try {
      setIsLoadingWallet(true);
      const data = await getMyWallet(accessToken);
      setWallet(data);
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Error desconocido',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingWallet(false);
    }
  }, [accessToken, toast]);

  useEffect(() => {
    loadWallet();
  }, [loadWallet]);

  const loadTransactions = useCallback(
    async (targetPage: number, append = false) => {
      if (!accessToken) return;

      try {
        setIsLoadingTx(true);
        const data = await getMyTransactions(accessToken, targetPage, PAGE_SIZE);
        setTransactions(prev =>
          append ? [...prev, ...data.transactions] : data.transactions
        );
        setTotal(data.total);
        setPage(targetPage);
      } catch (error: unknown) {
        toast({
          title: 'Error',
          description: error instanceof Error ? error.message : 'Error al cargar historial',
          variant: 'destructive',
        });
      } finally {
        setIsLoadingTx(false);
      }
    },
    [accessToken, toast]
  );

  useEffect(() => {
    loadTransactions(1);
  }, [loadTransactions]);

  const hasMore = transactions.length < total;

  const handlePaymentSubmit = async (formData: any) => {
    if (!accessToken) return;
    
    setIsRecharging(true);
    try {
      const payload: TopUpBrickRequest = {
        transaction_amount: rechargeAmount,
        token: formData.token,
        description: 'Recarga de billetera',
        installments: formData.installments || 1,
        payment_method_id: formData.payment_method_id,
        issuer_id: formData.issuer_id,
        payer: formData.payer
      };
      
      const response = await rechargeWalletBrick(accessToken, payload);
      
      console.log('Recarga respuesta MP:', response);
      toast({
        title: 'Recarga exitosa',
        description: `Se procesó el ingreso de S/ ${rechargeAmount.toFixed(2)}.`,
      });
      
      setIsRechargeModalOpen(false);
      
      await loadWallet();
      await loadTransactions(1);
    } catch (error: any) {
      toast({
        title: 'Error en el pago',
        description: error.message || 'No se pudo procesar la recarga',
        variant: 'destructive',
      });
    } finally {
      setIsRecharging(false);
    }
  };

  if (isLoadingWallet) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const balance = wallet?.balance ?? 0;

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-50 bg-card border-b border-border">
        <div className="px-4 py-4 flex items-center">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-secondary rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold ml-4">Mi Billetera</h1>
        </div>
      </div>

      <div className="pb-6">
        <div className="px-4 mt-6 mb-6">
          <WalletBalanceCard 
            balance={balance} 
            onRechargeClick={() => {
              // Now it just scrolls or ensures the selection is visible
              const el = document.getElementById('amount-selection');
              el?.scrollIntoView({ behavior: 'smooth' });
            }} 
          />
        </div>

        {/* Amount Selection Section */}
        <div id="amount-selection" className="px-4 mb-8">
          <div className="bg-card border border-border rounded-[2rem] p-6 shadow-sm">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <span className="w-8 h-8 bg-primary/10 text-primary rounded-full flex items-center justify-center text-sm">1</span>
              Selecciona el monto a recargar
            </h2>
            
            <div className="grid grid-cols-3 gap-3 mb-6">
              {[20, 50, 100].map((amount) => (
                <button
                  key={amount}
                  onClick={() => setRechargeAmount(amount)}
                  className={`py-4 rounded-2xl border-2 transition-all font-bold ${
                    rechargeAmount === amount 
                      ? 'border-primary bg-primary/5 text-primary' 
                      : 'border-border bg-secondary/30 text-muted-foreground hover:border-border/80'
                  }`}
                >
                  S/ {amount}
                </button>
              ))}
            </div>

            <div className="space-y-3">
              <label className="text-sm font-semibold text-muted-foreground ml-1">O ingrese otro monto (mín. S/ 20, máx. S/ 500)</label>
                <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-lg text-muted-foreground">S/</span>
                <input
                  type="number"
                  min="20"
                  max="500"
                  value={rechargeAmount === 0 ? '' : rechargeAmount}
                  onChange={(e) => {
                    const val = e.target.value;
                    setRechargeAmount(val === '' ? 0 : Number(val));
                  }}
                  className="w-full pl-11 pr-4 py-4 bg-secondary/30 border-2 border-transparent focus:border-primary/30 rounded-2xl text-xl font-black outline-none transition-all"
                  placeholder="0.00"
                />

              </div>
              {rechargeAmount < 20 && rechargeAmount > 0 && (
                <p className="text-xs text-destructive font-medium ml-1">El monto mínimo de recarga es S/ 20.00</p>
              )}
              {rechargeAmount > 500 && (
                <p className="text-xs text-destructive font-medium ml-1">El monto máximo de recarga es S/ 500.00</p>
              )}
            </div>

            <button
              disabled={rechargeAmount < 20 || rechargeAmount > 500 || isRecharging}

              onClick={() => setIsRechargeModalOpen(true)}
              className="w-full mt-6 py-5 bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-primary-foreground rounded-2xl font-bold text-lg shadow-lg shadow-primary/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
            >
              {isRecharging ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <>Continuar con la recarga</>
              )}
            </button>
          </div>
        </div>

        <div className="px-4 pb-20">
          <TransactionHistoryTable 
            transactions={transactions}
            isLoading={isLoadingTx}
            hasMore={hasMore}
            onLoadMore={() => loadTransactions(page + 1, true)}
          />
        </div>
      </div>
      
      <RechargeBrickModal 
         isOpen={isRechargeModalOpen}
         amount={rechargeAmount}
         isProcessing={isRecharging}
         onClose={() => !isRecharging && setIsRechargeModalOpen(false)}
         setIsProcessing={setIsRecharging}
         onCardSuccess={async () => {
           toast({
             title: 'Recarga exitosa',
             description: `Se procesó el ingreso de S/ ${rechargeAmount.toFixed(2)} con tarjeta.`,
           });
           setIsRechargeModalOpen(false);
           await loadWallet();
           await loadTransactions(1);
         }}
         onCardError={(msg) => {
           toast({
             title: 'Error en el pago',
             description: msg || 'No se pudo procesar la recarga con tarjeta',
             variant: 'destructive',
           });
         }}
         onYapeSuccess={async () => {
           toast({
             title: 'Recarga exitosa',
             description: `Se procesó el ingreso de S/ ${rechargeAmount.toFixed(2)} vía Yape.`,
           });
           setIsRechargeModalOpen(false);
           await loadWallet();
           await loadTransactions(1);
         }}
         onYapeError={(msg) => {
           toast({
             title: 'Error en el pago Yape',
             description: msg || 'No se pudo procesar la recarga',
             variant: 'destructive',
           });
         }}
      />


    </div>
  );
};

export default Wallet;
