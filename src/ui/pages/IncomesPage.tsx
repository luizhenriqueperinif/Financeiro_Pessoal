import React, { useEffect, useState } from 'react';
import {
  Plus,
  CheckCircle2,
  XCircle,
  Trash2,
  ArrowUpCircle,
  Repeat,
} from 'lucide-react';
import { Transaction } from '../../core/domain/transaction.js';
import { Category } from '../../core/domain/category.js';
import { formatMoney, formatDate, paymentMethodLabel } from '../utils/formatters.js';
import { Money } from '../../core/value-objects/money.js';
import { MoneyInput } from '../components/MoneyInput.js';
import { DateUtils } from '../../core/utils/date-utils.js';
import { api } from '../services/api.js';
import {
  TransactionFiltersBar,
  EMPTY_FILTERS,
  buildListFilters,
  hasCustomPeriod,
} from '../components/TransactionFiltersBar.js';

interface IncomesPageProps {
  selectedYearMonth: string;
  refreshKey?: number;
  /** Lançamento recém-criado, destacado por alguns segundos. */
  highlightId?: string | null;
  /** Chamado após pagar, receber, excluir etc., para o App atualizar o saldo. */
  onDataChanged?: () => void;
  onOpenNewIncome: () => void;
  categories: Category[];
}

export const IncomesPage: React.FC<IncomesPageProps> = ({
  selectedYearMonth,
  refreshKey,
  highlightId,
  onDataChanged,
  onOpenNewIncome,
  categories,
}) => {
  const [incomes, setIncomes] = useState<Transaction[]>([]);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [loading, setLoading] = useState(true);

  // Recarrega a página e avisa o App (saldo da barra lateral)
  const refresh = () => {
    loadData();
    onDataChanged?.();
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await api.listTransactions(buildListFilters(filters, selectedYearMonth, 'INCOME'));
      setIncomes(res);
    } catch (err) {
      console.error('Erro ao carregar receitas', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedYearMonth, filters, refreshKey]);

  // Confirmação do recebimento: permite ajustar o valor que caiu de fato (ex.: rendimento variável)
  const [receiving, setReceiving] = useState<{ item: Transaction; amount: string; date: string; error?: string } | null>(null);

  const openReceive = (item: Transaction) =>
    setReceiving({
      item,
      amount: Money.format(item.amountCents).replace(/^R\$\s?/, ''),
      date: DateUtils.today(),
    });

  const confirmReceive = async () => {
    if (!receiving) return;
    try {
      const amountCents = Money.fromReal(receiving.amount);
      if (amountCents <= 0) throw new Error('Informe um valor maior que zero');
      if (amountCents !== receiving.item.amountCents) {
        await api.updateTransaction(receiving.item.id, { amountCents });
      }
      await api.markTransactionPaid(receiving.item.id, receiving.date);
      setReceiving(null);
      refresh();
    } catch (err: any) {
      setReceiving({ ...receiving, error: err.message || 'Erro ao marcar receita como recebida' });
    }
  };

  const handleMarkNotReceived = async (item: Transaction) => {
    const receivedOn = item.paymentDate ? ` em ${formatDate(item.paymentDate)}` : '';
    if (!confirm(`Desmarcar o recebimento de "${item.description}"${receivedOn}?`)) return;
    try {
      await api.markTransactionUnpaid(item.id);
      refresh();
    } catch (err) {
      alert('Erro ao desmarcar receita como recebida');
    }
  };

  const handleDelete = async (id: string, description: string) => {
    if (confirm(`Tem certeza que deseja excluir a receita "${description}"?`)) {
      try {
        await api.deleteTransaction(id);
        refresh();
      } catch (err: any) {
        alert(err?.message || 'Erro ao excluir receita');
      }
    }
  };

  const totalIncomesCents = incomes.reduce((acc, cur) => acc + cur.amountCents, 0);
  const receivedCents = incomes
    .filter((i) => i.status === 'RECEIVED' || i.status === 'PAID')
    .reduce((acc, cur) => acc + cur.amountCents, 0);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in">
      {receiving && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-sm p-5 space-y-4 shadow-2xl">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Confirmar recebimento</h3>
              <p className="text-xs text-slate-500">{receiving.item.description} — previsto {formatMoney(receiving.item.amountCents)}</p>
            </div>
            {receiving.error && <div className="text-xs text-rose-600">{receiving.error}</div>}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Valor recebido</label>
                <MoneyInput
                  autoFocus
                  value={receiving.amount}
                  onChange={(amount) => setReceiving({ ...receiving, amount })}
                  onKeyDown={(e) => e.key === 'Enter' && confirmReceive()}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Recebido em</label>
                <input
                  type="date"
                  value={receiving.date}
                  onChange={(e) => setReceiving({ ...receiving, date: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setReceiving(null)} className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">
                Cancelar
              </button>
              <button onClick={confirmReceive} className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold">
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ArrowUpCircle className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            Controle de Receitas
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Gerencie seus salários, comissões, freelas e rendimentos
          </p>
        </div>

        <button
          onClick={onOpenNewIncome}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/30 transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" />
          Nova Receita
        </button>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
          <span className="text-xs text-slate-500 block font-medium">Total de Receitas {hasCustomPeriod(filters) ? 'no Período' : 'no Mês'}</span>
          <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">
            {formatMoney(totalIncomesCents)}
          </span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
          <span className="text-xs text-slate-500 block font-medium">Já Recebido</span>
          <span className="text-xl font-black text-slate-800 dark:text-slate-100">
            {formatMoney(receivedCents)}
          </span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
          <span className="text-xs text-slate-500 block font-medium">A Receber / Previsto</span>
          <span className="text-xl font-black text-amber-500">
            {formatMoney(totalIncomesCents - receivedCents)}
          </span>
        </div>
      </div>

      <TransactionFiltersBar type="INCOME" categories={categories} value={filters} onChange={setFilters} />

      {/* Tabela de Lançamentos */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-400">Carregando lançamentos...</div>
        ) : incomes.length === 0 ? (
          <div className="p-12 text-center">
            <ArrowUpCircle className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">Nenhuma receita encontrada no período</p>
            <button
              onClick={onOpenNewIncome}
              className="mt-3 text-xs text-emerald-600 font-bold hover:underline"
            >
              + Adicionar primeira receita
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4 font-bold">Data</th>
                  <th className="py-3 px-4 font-bold">Descrição</th>
                  <th className="py-3 px-4 font-bold">Categoria</th>
                  <th className="py-3 px-4 font-bold">Forma</th>
                  <th className="py-3 px-4 font-bold text-right">Valor</th>
                  <th className="py-3 px-4 font-bold text-center">Status</th>
                  <th className="py-3 px-4 font-bold text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {incomes.map((item) => {
                  const isReceived = item.status === 'RECEIVED' || item.status === 'PAID';
                  const isOverdue = item.status === 'OVERDUE';
                  const isCancelled = item.status === 'CANCELLED';
                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors duration-700 ${
                        item.id === highlightId ? 'bg-emerald-500/15 dark:bg-emerald-500/10' : ''
                      }`}
                    >
                      <td className="py-3 px-4 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {formatDate(item.date)}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                        <div className="flex items-center gap-2">
                          <span>{item.description}</span>
                          {item.recurringRuleId && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300">
                              <Repeat className="w-3 h-3" />
                              Fixa
                            </span>
                          )}
                        </div>
                        {item.notes && <span className="text-[10px] text-slate-400 block font-normal">{item.notes}</span>}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium"
                          style={{
                            backgroundColor: `${item.categoryColor || '#10B981'}15`,
                            color: item.categoryColor || '#10B981',
                          }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: item.categoryColor || '#10B981' }} />
                          {item.categoryName}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-500">{paymentMethodLabel(item.paymentMethod)}</td>
                      <td className="py-3 px-4 text-right font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                        +{formatMoney(item.amountCents)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            isReceived
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                              : isOverdue
                              ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
                              : isCancelled
                              ? 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                              : 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                          }`}
                        >
                          {isReceived ? 'Recebida' : isOverdue ? 'Atrasada' : isCancelled ? 'Cancelada' : 'Pendente'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {isReceived && (
                            <button
                              onClick={() => handleMarkNotReceived(item)}
                              className="p-1.5 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded-lg transition-colors"
                              title="Desmarcar como recebida"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          )}
                          {!isReceived && !isCancelled && (
                            <button
                              onClick={() => openReceive(item)}
                              className="p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-lg transition-colors"
                              title="Marcar como recebida"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(item.id, item.description)}
                            className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                            title="Excluir receita"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
