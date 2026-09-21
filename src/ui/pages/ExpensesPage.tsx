import React, { useEffect, useState } from 'react';
import {
  Plus,
  CheckCircle2,
  XCircle,
  Trash2,
  ArrowDownCircle,
  CreditCard,
  Repeat,
  AlertTriangle,
} from 'lucide-react';
import { Transaction } from '../../core/domain/transaction.js';
import { Category } from '../../core/domain/category.js';
import { formatMoney, formatDate } from '../utils/formatters.js';
import { api } from '../services/api.js';
import {
  TransactionFiltersBar,
  EMPTY_FILTERS,
  buildListFilters,
  hasCustomPeriod,
} from '../components/TransactionFiltersBar.js';

interface ExpensesPageProps {
  selectedYearMonth: string;
  onOpenNewExpense: () => void;
  categories: Category[];
}

export const ExpensesPage: React.FC<ExpensesPageProps> = ({
  selectedYearMonth,
  onOpenNewExpense,
  categories,
}) => {
  const [expenses, setExpenses] = useState<Transaction[]>([]);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await api.listTransactions(buildListFilters(filters, selectedYearMonth, 'EXPENSE'));
      setExpenses(res);
    } catch (err) {
      console.error('Erro ao carregar despesas', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedYearMonth, filters]);

  const handleMarkPaid = async (id: string) => {
    try {
      await api.markTransactionPaid(id);
      loadData();
    } catch (err) {
      alert('Erro ao marcar despesa como paga');
    }
  };

  const handleMarkUnpaid = async (item: Transaction) => {
    const paidOn = item.paymentDate ? ` feito em ${formatDate(item.paymentDate)}` : '';
    if (!confirm(`Desmarcar o pagamento de "${item.description}"${paidOn}?`)) return;
    try {
      await api.markTransactionUnpaid(item.id);
      loadData();
    } catch (err) {
      alert('Erro ao desmarcar despesa como paga');
    }
  };

  const handleDelete = async (id: string, description: string) => {
    if (confirm(`Tem certeza que deseja excluir a despesa "${description}"?`)) {
      try {
        await api.deleteTransaction(id);
        loadData();
      } catch (err) {
        alert('Erro ao excluir despesa');
      }
    }
  };

  const totalExpenseCents = expenses.reduce((acc, cur) => acc + cur.amountCents, 0);
  const paidCents = expenses
    .filter((e) => e.status === 'PAID')
    .reduce((acc, cur) => acc + cur.amountCents, 0);
  const pendingCents = expenses
    .filter((e) => e.status === 'PENDING' || e.status === 'OVERDUE')
    .reduce((acc, cur) => acc + cur.amountCents, 0);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ArrowDownCircle className="w-6 h-6 text-rose-600 dark:text-rose-400" />
            Controle de Despesas
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Acompanhe contas, compras no cartão, boletos e despesas do dia a dia
          </p>
        </div>

        <button
          onClick={onOpenNewExpense}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-600/30 transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" />
          Nova Despesa
        </button>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
          <span className="text-xs text-slate-500 block font-medium">Total de Despesas {hasCustomPeriod(filters) ? 'do Período' : 'do Mês'}</span>
          <span className="text-xl font-black text-slate-900 dark:text-white">
            {formatMoney(totalExpenseCents)}
          </span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
          <span className="text-xs text-slate-500 block font-medium">Já Pagas</span>
          <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">
            {formatMoney(paidCents)}
          </span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
          <span className="text-xs text-slate-500 block font-medium">Pendentes / Atrasadas</span>
          <span className="text-xl font-black text-rose-600 dark:text-rose-400">
            {formatMoney(pendingCents)}
          </span>
        </div>
      </div>

      <TransactionFiltersBar type="EXPENSE" categories={categories} value={filters} onChange={setFilters} />

      {/* Tabela de Lançamentos */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-400">Carregando despesas...</div>
        ) : expenses.length === 0 ? (
          <div className="p-12 text-center">
            <ArrowDownCircle className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">Nenhuma despesa registrada no período</p>
            <button
              onClick={onOpenNewExpense}
              className="mt-3 text-xs text-rose-600 font-bold hover:underline"
            >
              + Adicionar primeira despesa
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4 font-bold">Vencimento</th>
                  <th className="py-3 px-4 font-bold">Descrição</th>
                  <th className="py-3 px-4 font-bold">Categoria</th>
                  <th className="py-3 px-4 font-bold">Forma</th>
                  <th className="py-3 px-4 font-bold text-right">Valor</th>
                  <th className="py-3 px-4 font-bold text-center">Status</th>
                  <th className="py-3 px-4 font-bold text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {expenses.map((item) => {
                  const isPaid = item.status === 'PAID';
                  const isOverdue = item.status === 'OVERDUE';
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-4 text-slate-500 dark:text-slate-400 whitespace-nowrap font-medium">
                        {formatDate(item.date)}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                        <div className="flex items-center gap-2">
                          <span>{item.description}</span>
                          {item.installmentNumber && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300">
                              <CreditCard className="w-3 h-3" />
                              {item.installmentNumber}/{item.totalInstallments}
                            </span>
                          )}
                          {item.recurringRuleId && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300">
                              <Repeat className="w-3 h-3" />
                              Fixa
                            </span>
                          )}
                        </div>
                        {item.notes && <span className="text-[10px] text-slate-400 block font-normal mt-0.5">{item.notes}</span>}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium"
                          style={{
                            backgroundColor: `${item.categoryColor || '#EF4444'}15`,
                            color: item.categoryColor || '#EF4444',
                          }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: item.categoryColor || '#EF4444' }} />
                          {item.categoryName}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-500">{item.paymentMethod}</td>
                      <td className="py-3 px-4 text-right font-bold text-rose-600 dark:text-rose-400 text-sm">
                        -{formatMoney(item.amountCents)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
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
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {!isPaid && (
                            <button
                              onClick={() => handleMarkPaid(item.id)}
                              className="px-2.5 py-1 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-lg text-xs font-bold border border-emerald-500/30 flex items-center gap-1 transition-all"
                              title="Marcar como paga"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Pagar
                            </button>
                          )}
                          {isPaid && (
                            <button
                              onClick={() => handleMarkUnpaid(item)}
                              className="px-2.5 py-1 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded-lg text-xs font-bold border border-amber-500/30 flex items-center gap-1 transition-all"
                              title="Desmarcar como paga"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              Desmarcar
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(item.id, item.description)}
                            className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                            title="Excluir despesa"
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
