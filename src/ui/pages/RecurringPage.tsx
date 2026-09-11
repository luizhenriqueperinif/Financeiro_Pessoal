import React, { useEffect, useState } from 'react';
import {
  Repeat,
  Plus,
  Trash2,
  Power,
  Calendar,
  CreditCard,
  AlertCircle,
} from 'lucide-react';
import { RecurringRule } from '../../core/domain/recurring-rule.js';
import { formatMoney, formatDate } from '../utils/formatters.js';
import { api } from '../services/api.js';

interface RecurringPageProps {
  onOpenNewRecurring: () => void;
}

export const RecurringPage: React.FC<RecurringPageProps> = ({
  onOpenNewRecurring,
}) => {
  const [rules, setRules] = useState<RecurringRule[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await api.listRecurringRules();
      setRules(res);
    } catch (err) {
      console.error('Erro ao carregar despesas fixas', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleToggleActive = async (rule: RecurringRule) => {
    try {
      await api.updateRecurringRule(rule.id, { isActive: !rule.isActive });
      loadData();
    } catch (err) {
      alert('Erro ao atualizar status da regra fixa');
    }
  };

  const handleDelete = async (id: string, description: string) => {
    if (confirm(`Deseja excluir a despesa fixa "${description}"?`)) {
      try {
        await api.deleteRecurringRule(id);
        loadData();
      } catch (err) {
        alert('Erro ao excluir regra');
      }
    }
  };

  const totalMonthlyActiveCents = rules
    .filter((r) => r.isActive && r.type === 'EXPENSE')
    .reduce((acc, cur) => acc + cur.amountCents, 0);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Repeat className="w-6 h-6 text-amber-500" />
            Despesas Fixas e Recorrentes
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Contas que se repetem todo mês (Aluguel, Internet, Streaming, Condomínio)
          </p>
        </div>

        <button
          onClick={onOpenNewRecurring}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/30 transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" />
          Nova Despesa Fixa
        </button>
      </div>

      {/* Card de Impacto Orçamentário */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-sm">
        <div>
          <span className="text-xs text-slate-500 dark:text-slate-400 block font-semibold uppercase tracking-wider">
            Comprometimento Fixo Mensal Ativo
          </span>
          <span className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1 block">
            {formatMoney(totalMonthlyActiveCents)}
          </span>
          <span className="text-[11px] text-slate-400">
            Lançadas automaticamente no seu financeiro todo mês
          </span>
        </div>
        <div className="text-right">
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
            {rules.filter((r) => r.isActive).length} regras ativas
          </span>
        </div>
      </div>

      {/* Grid de Regras Cadastradas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {rules.map((rule) => {
          const isExpense = rule.type === 'EXPENSE';
          return (
            <div
              key={rule.id}
              className={`bg-white dark:bg-slate-900 rounded-2xl border p-5 transition-all shadow-sm flex flex-col justify-between ${
                rule.isActive
                  ? 'border-slate-200 dark:border-slate-800'
                  : 'border-slate-200/50 dark:border-slate-800/40 opacity-60'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <span
                      className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full inline-block mb-1.5"
                      style={{
                        backgroundColor: `${rule.categoryColor || '#F59E0B'}15`,
                        color: rule.categoryColor || '#F59E0B',
                      }}
                    >
                      {rule.categoryName || 'Categoria'}
                    </span>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      {rule.description}
                    </h3>
                  </div>

                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      rule.isActive
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                    }`}
                  >
                    {rule.isActive ? 'Ativa' : 'Pausada'}
                  </span>
                </div>

                <div className="my-3">
                  <span
                    className={`text-xl font-black ${
                      isExpense ? 'text-slate-900 dark:text-white' : 'text-emerald-600'
                    }`}
                  >
                    {formatMoney(rule.amountCents)}
                  </span>
                  <span className="text-[11px] text-slate-400 ml-1">
                    /{rule.frequency === 'MONTHLY' ? 'mês' : rule.frequency === 'WEEKLY' ? 'sem' : 'ano'}
                  </span>
                </div>

                <div className="space-y-1 text-xs text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800 pt-3">
                  <div className="flex items-center justify-between">
                    <span>Vencimento todo dia:</span>
                    <span className="font-bold text-slate-700 dark:text-slate-200">
                      Dia {rule.dueDay}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Forma de pagamento:</span>
                    <span className="font-medium text-slate-700 dark:text-slate-200">
                      {rule.paymentMethod}
                    </span>
                  </div>
                </div>
              </div>

              {/* Ações */}
              <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-3 mt-4">
                <button
                  onClick={() => handleToggleActive(rule)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                    rule.isActive
                      ? 'text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40'
                      : 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                  }`}
                >
                  <Power className="w-3.5 h-3.5" />
                  {rule.isActive ? 'Pausar' : 'Reativar'}
                </button>

                <button
                  onClick={() => handleDelete(rule.id, rule.description)}
                  className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                  title="Excluir regra"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
