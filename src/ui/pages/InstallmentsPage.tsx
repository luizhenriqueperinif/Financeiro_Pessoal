import React, { useEffect, useState } from 'react';
import {
  CreditCard,
  CheckCircle2,
  XCircle,
  Trash2,
  Calendar,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { InstallmentPurchase, CardSummary } from '../../core/domain/installment-purchase.js';
import { CardSummaryList } from '../components/CardSummaryList.js';
import { formatMoney, formatDate } from '../utils/formatters.js';
import { api } from '../services/api.js';

interface InstallmentsPageProps {
  refreshKey?: number;
  /** Chamado após pagar, receber, excluir etc., para o App atualizar o saldo. */
  onDataChanged?: () => void;
  onOpenNewExpense: () => void;
}

export const InstallmentsPage: React.FC<InstallmentsPageProps> = ({
  onOpenNewExpense,
  refreshKey,
  onDataChanged,
}) => {
  const [purchases, setPurchases] = useState<InstallmentPurchase[]>([]);
  const [expandedPurchaseId, setExpandedPurchaseId] = useState<string | null>(null);
  const [view, setView] = useState<'purchases' | 'cards'>('purchases');
  const [cards, setCards] = useState<CardSummary[]>([]);
  const [loading, setLoading] = useState(true);

  // Recarrega a página e avisa o App (saldo da barra lateral)
  const refresh = () => {
    loadData();
    onDataChanged?.();
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [res, cardTotals] = await Promise.all([api.listInstallmentPurchases(), api.getCardSummaries()]);
      setPurchases(res);
      setCards(cardTotals);
      if (res.length > 0 && !expandedPurchaseId) {
        setExpandedPurchaseId(res[0].id);
      }
    } catch (err) {
      console.error('Erro ao carregar parcelamentos', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [refreshKey]);

  const handlePayInstallment = async (installmentId: string) => {
    try {
      await api.payInstallment(installmentId);
      refresh();
    } catch (err) {
      alert('Erro ao pagar parcela');
    }
  };

  const handleUnpayInstallment = async (installmentId: string, label: string, paymentDate?: string | null) => {
    const paidOn = paymentDate ? ` feito em ${formatDate(paymentDate)}` : '';
    if (!confirm(`Desmarcar o pagamento da parcela ${label}${paidOn}?`)) return;
    try {
      await api.unpayInstallment(installmentId);
      refresh();
    } catch (err) {
      alert('Erro ao desmarcar pagamento da parcela');
    }
  };

  const handleDeletePurchase = async (id: string, description: string) => {
    if (confirm(`Deseja excluir a compra "${description}" e todas as suas parcelas?`)) {
      try {
        await api.deleteInstallmentPurchase(id);
        refresh();
      } catch (err) {
        alert('Erro ao excluir compra parcelada');
      }
    }
  };

  const totalCommittedCents = purchases.reduce((acc, p) => {
    const pendingAmount = (p.installments || [])
      .filter((i) => i.status === 'PENDING' || i.status === 'OVERDUE')
      .reduce((s, cur) => s + cur.amountCents, 0);
    return acc + pendingAmount;
  }, 0);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            Compras Parceladas & Faturas
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Acompanhe o parcelamento de compras no cartão sem distorcer o seu orçamento mensal
          </p>
        </div>

        <button
          onClick={onOpenNewExpense}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-md shadow-purple-600/30 transition-all active:scale-95"
        >
          <CreditCard className="w-4 h-4" />
          Nova Compra Parcelada
        </button>
      </div>

      {/* Card de Comprometimento com Parcelas */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-sm">
        <div>
          <span className="text-xs text-slate-500 dark:text-slate-400 block font-semibold uppercase tracking-wider">
            Total Comprometido em Parcelas Futuras
          </span>
          <span className="text-2xl font-black text-purple-600 dark:text-purple-400 mt-1 block">
            {formatMoney(totalCommittedCents)}
          </span>
          <span className="text-[11px] text-slate-400">
            Soma de todas as parcelas ainda pendentes de compras no cartão
          </span>
        </div>
        <div className="text-right">
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
            {purchases.length} compras parceladas ativas
          </span>
        </div>
      </div>

      {/* Alternância entre visão por compra e por cartão */}
      <div className="inline-flex p-1 rounded-xl bg-slate-100 dark:bg-slate-800/70 text-xs font-bold">
        {([
          ['purchases', 'Por compra'],
          ['cards', 'Por cartão'],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setView(key)}
            className={`px-4 py-1.5 rounded-lg transition-all ${
              view === key
                ? 'bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-400 shadow-sm'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {view === 'cards' && !loading && <CardSummaryList cards={cards} />}

      {/* Lista de Compras Parceladas */}
      <div className={`space-y-4 ${view === 'cards' ? 'hidden' : ''}`}>
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-400">Carregando parcelamentos...</div>
        ) : purchases.length === 0 ? (
          <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
            <CreditCard className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">Nenhuma compra parcelada cadastrada</p>
            <button
              onClick={onOpenNewExpense}
              className="mt-3 text-xs text-purple-600 font-bold hover:underline"
            >
              + Cadastrar compra no cartão
            </button>
          </div>
        ) : (
          purchases.map((purchase) => {
            const isExpanded = expandedPurchaseId === purchase.id;
            const installments = purchase.installments || [];
            const paidCount = installments.filter((i) => i.status === 'PAID').length;
            const progressPercent = Math.round((paidCount / purchase.totalInstallments) * 100);
            const remainingCents = installments
              .filter((i) => i.status === 'PENDING' || i.status === 'OVERDUE')
              .reduce((acc, cur) => acc + cur.amountCents, 0);

            return (
              <div
                key={purchase.id}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm transition-all"
              >
                {/* Header do Card de Compra */}
                <div
                  onClick={() => setExpandedPurchaseId(isExpanded ? null : purchase.id)}
                  className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer hover:bg-slate-50/60 dark:hover:bg-slate-800/40"
                >
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-base font-bold text-slate-900 dark:text-white">
                        {purchase.description}
                      </h3>
                      <span className="text-xs font-bold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40 px-2 py-0.5 rounded-full">
                        {purchase.totalInstallments}x de {formatMoney(installments[0]?.amountCents || 0)}
                      </span>
                      {purchase.cardName && purchase.cardName !== purchase.description && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                          <CreditCard className="w-3 h-3" />
                          {purchase.cardName}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <span>Total: <strong className="text-slate-700 dark:text-slate-300">{formatMoney(purchase.totalAmountCents)}</strong></span>
                      <span>•</span>
                      <span>Restante: <strong className="text-purple-600 dark:text-purple-400">{formatMoney(remainingCents)}</strong></span>
                      <span>•</span>
                      <span>1ª Parcela: {formatDate(purchase.firstDueDate)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    {/* Barra de Progresso de Quitação */}
                    <div className="w-36 text-right">
                      <div className="flex justify-between text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                        <span>Progresso</span>
                        <span>{paidCount}/{purchase.totalInstallments}</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                        <div
                          className="h-full bg-purple-600 rounded-full transition-all duration-300"
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeletePurchase(purchase.id, purchase.description);
                      }}
                      className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                      title="Excluir compra e parcelas"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-slate-400" />
                    )}
                  </div>
                </div>

                {/* Lista Expandida de Parcelas Individuais */}
                {isExpanded && (
                  <div className="border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 p-4">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="text-[11px] text-slate-400 uppercase tracking-wider">
                          <tr>
                            <th className="py-2 px-3 font-semibold">Nº</th>
                            <th className="py-2 px-3 font-semibold">Vencimento</th>
                            <th className="py-2 px-3 font-semibold text-right">Valor</th>
                            <th className="py-2 px-3 font-semibold text-center">Status</th>
                            <th className="py-2 px-3 font-semibold text-right">Ação</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200/50 dark:divide-slate-800/60">
                          {installments.map((inst) => {
                            const isPaid = inst.status === 'PAID';
                            const isOverdue = inst.status === 'OVERDUE';
                            return (
                              <tr key={inst.id} className="hover:bg-white dark:hover:bg-slate-800 transition-colors">
                                <td className="py-2.5 px-3 font-bold text-slate-700 dark:text-slate-300">
                                  {inst.installmentNumber}/{inst.totalInstallments}
                                </td>
                                <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">
                                  {formatDate(inst.dueDate)}
                                </td>
                                <td className="py-2.5 px-3 text-right font-bold text-slate-900 dark:text-white">
                                  {formatMoney(inst.amountCents)}
                                </td>
                                <td className="py-2.5 px-3 text-center">
                                  <span
                                    className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                      isPaid
                                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                                        : isOverdue
                                        ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
                                        : 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                                    }`}
                                  >
                                    {isPaid ? 'Paga' : isOverdue ? 'Atrasada' : 'Pendente'}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 text-right">
                                  {!isPaid && (
                                    <button
                                      onClick={() => handlePayInstallment(inst.id)}
                                      className="px-2 py-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded border border-emerald-500/30 transition-all inline-flex items-center gap-1"
                                    >
                                      <CheckCircle2 className="w-3 h-3" />
                                      Pagar / Adiantar
                                    </button>
                                  )}
                                  {isPaid && (
                                    <button
                                      onClick={() =>
                                        handleUnpayInstallment(
                                          inst.id,
                                          `${inst.installmentNumber}/${inst.totalInstallments} de "${purchase.description}"`,
                                          inst.paymentDate
                                        )
                                      }
                                      className="px-2 py-1 text-[11px] font-bold text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded border border-amber-500/30 transition-all inline-flex items-center gap-1"
                                    >
                                      <XCircle className="w-3 h-3" />
                                      Desmarcar
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
