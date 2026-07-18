import React from 'react';
import { ReceiptText, ArrowUpCircle, ArrowDownCircle, CreditCard, AlertTriangle, Smartphone } from 'lucide-react';
import { WalletTransaction } from '@/services/walletService';

const transactionConfig: Record<
  string,
  { label: string; icon: React.ElementType; color: string; prefix: string; bgClass: string; }
> = {
  credit: {
    label: 'Recarga Billetera',
    icon: ArrowUpCircle,
    color: 'text-emerald-600 dark:text-emerald-400',
    bgClass: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100',
    prefix: '+',
  },
  commission: {
    label: 'Comisión de Plataforma',
    icon: ReceiptText,
    color: 'text-orange-600 dark:text-orange-400',
    bgClass: 'bg-orange-50 dark:bg-orange-900/20 border-orange-100',
    prefix: '-',
  },
  debit: {
    label: 'Cobro de Viaje',
    icon: ArrowDownCircle,
    color: 'text-rose-600 dark:text-rose-400',
    bgClass: 'bg-rose-50 dark:bg-rose-900/20 border-rose-100',
    prefix: '-',
  },
  payment: {
    label: 'Pago a Conductor',
    icon: CreditCard,
    color: 'text-sky-600 dark:text-sky-400',
    bgClass: 'bg-sky-50 dark:bg-sky-900/20 border-sky-100',
    prefix: '+',
  },
  penalty: {
    label: 'Penalidad por Cancelación',
    icon: AlertTriangle,
    color: 'text-rose-600 dark:text-rose-400',
    bgClass: 'bg-rose-50 dark:bg-rose-900/20 border-rose-100',
    prefix: '-',
  },
};

const getTransactionConfig = (type: string) =>
  transactionConfig[type] ?? {
    label: type,
    icon: ReceiptText,
    color: 'text-slate-600 dark:text-slate-400',
    bgClass: 'bg-slate-50 border-slate-100',
    prefix: '',
  };

interface TransactionHistoryTableProps {
  transactions: WalletTransaction[];
  isLoading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
}

export const TransactionHistoryTable: React.FC<TransactionHistoryTableProps> = ({ transactions, isLoading, hasMore, onLoadMore }) => {
  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

  const formatTime = (dateString: string) =>
    new Date(dateString).toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
    });

  return (
    <div className="bg-card rounded-3xl p-6 shadow-sm border border-border">
      <div className="flex items-center justify-between mb-6">
         <h2 className="text-xl font-bold tracking-tight text-foreground">Historial de Movimientos</h2>
      </div>

      {transactions.length === 0 && !isLoading ? (
        <div className="text-center py-16 flex flex-col items-center">
          <div className="w-16 h-16 bg-muted/50 rounded-full flex items-center justify-center mb-4">
             <ReceiptText className="w-8 h-8 text-muted-foreground opacity-50" />
          </div>
          <h3 className="font-semibold text-lg">No hay movimientos aún</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-[200px] mx-auto">Realiza tu primera recarga para empezar a viajar</p>
        </div>
      ) : (
        <div className="space-y-3">
          {transactions.map((tx) => {
            const config = getTransactionConfig(tx.transaction_type);
            let Icon = config.icon;
            let bgClass = config.bgClass;
            let color = config.color;
            let label = config.label;

            if (tx.transaction_type === 'credit' && tx.description) {
               label = tx.description;
               const descLower = tx.description.toLowerCase();
               if (descLower.includes('yape')) {
                  Icon = Smartphone;
                  bgClass = 'bg-violet-50 dark:bg-violet-900/20 border-violet-100';
                  color = 'text-violet-600 dark:text-violet-400';
               } else if (descLower.includes('tarjeta')) {
                  Icon = CreditCard;
               }
            }

            const amount = Math.abs(Number(tx.amount));

            return (
              <div
                key={tx.id}
                className="flex items-center justify-between gap-4 p-4 rounded-2xl hover:bg-slate-50/50 dark:hover:bg-slate-900/50 transition-colors border border-transparent hover:border-border cursor-default group"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 border ${config.bgClass}`}
                  >
                    <Icon className={`w-5 h-5 ${config.color}`} />
                  </div>

                  <div className="min-w-0">
                    <p className="text-sm font-[600] text-foreground truncate max-w-[150px] md:max-w-full">
                      {label}
                    </p>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                       <span>{formatDate(tx.created_at)}</span>
                       <span className="w-0.5 h-0.5 bg-muted-foreground rounded-full"></span>
                       <span>{formatTime(tx.created_at)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-end flex-shrink-0 text-right justify-center">
                  <span className={`font-bold tracking-tight uppercase ${color} text-base`}>
                    {config.prefix} S/ {amount.toFixed(2)}
                  </span>
                  {tx.description && tx.transaction_type !== 'credit' && (
                     <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500 max-w-[120px] truncate opacity-0 group-hover:opacity-100 transition-opacity">
                        {tx.description}
                     </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {hasMore && (
        <button
          className="w-full mt-6 py-4 bg-secondary/50 text-sm focus:ring-2 ring-primary text-primary font-semibold rounded-2xl hover:bg-secondary/70 transition-colors disabled:opacity-50"
          onClick={onLoadMore}
          disabled={isLoading}
        >
          {isLoading ? 'Cargando movimientos...' : 'Cargar más movimientos'}
        </button>
      )}
    </div>
  );
};
