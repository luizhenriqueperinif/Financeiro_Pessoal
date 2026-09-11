import React, { useEffect, useState } from 'react';
import {
  Plus,
  Search,
  CheckCircle2,
  Trash2,
  ArrowUpCircle,
  Tag,
  Filter,
} from 'lucide-react';
import { Transaction } from '../../core/domain/transaction.js';
import { Category } from '../../core/domain/category.js';
import { formatMoney, formatDate } from '../utils/formatters.js';
import { api } from '../services/api.js';

interface IncomesPageProps {
  selectedYearMonth: string;
  onOpenNewIncome: () => void;
  categories: Category[];
}

export const IncomesPage: React.FC<IncomesPageProps> = ({
  selectedYearMonth,
  onOpenNewIncome,
  categories,
}) => {
  const [incomes, setIncomes] = useState<Transaction[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await api.listTransactions({
        yearMonth: selectedYearMonth,
        type: 'INCOME',
        categoryId: selectedCategory || undefined,
        status: statusFilter as any || undefined,
        search: search || undefined,
      });
      setIncomes(res);
    } catch (err) {
      console.error('Erro ao carregar receitas', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedYearMonth, selectedCategory, statusFilter, search]);

  const handleMarkReceived = async (id: string) => {
    try {
      await api.markTransactionPaid(id);
      loadData();
    } catch (err) {
      alert('Erro ao marcar receita como recebida');
    }
  };

  const handleDelete = async (id: string, description: string) => {
    if (confirm(`Tem certeza que deseja excluir a receita "${description}"?`)) {
      try {
        await api.deleteTransaction(id);
        loadData();
      } catch (err) {
        alert('Erro ao excluir receita');
      }
    }
  };

  const totalIncomesCents = incomes.reduce((acc, cur) => acc + cur.amountCents, 0);
  const receivedCents = incomes
    .filter((i) => i.status === 'RECEIVED' || i.status === 'PAID')
    .reduce((acc, cur) => acc + cur.amountCents, 0);

  const incomeCategories = categories.filter((c) => c.type === 'INCOME');

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in">
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
          <span className="text-xs text-slate-500 block font-medium">Total de Receitas no Mês</span>
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

      {/* Barra de Filtros e Busca */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-wrap gap-3 items-center justify-between">
        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          <div className="relative w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Pesquisar por descrição ou nota..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300"
          >
            <option value="">Todas Categorias</option>
            {incomeCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300"
          >
            <option value="">Todos Status</option>
            <option value="RECEIVED">Recebida</option>
            <option value="PENDING">Prevista</option>
            <option value="CANCELLED">Cancelada</option>
          </select>
        </div>
      </div>

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
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-4 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {formatDate(item.date)}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                        {item.description}
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
                      <td className="py-3 px-4 text-slate-500">{item.paymentMethod}</td>
                      <td className="py-3 px-4 text-right font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                        +{formatMoney(item.amountCents)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            isReceived
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                              : 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                          }`}
                        >
                          {isReceived ? 'Recebida' : 'Prevista'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {!isReceived && (
                            <button
                              onClick={() => handleMarkReceived(item.id)}
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
