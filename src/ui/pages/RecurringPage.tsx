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
  refreshKey?: number;
  onOpenNewRecurring: () => void;
}

export const RecurringPage: React.FC<RecurringPageProps> = ({
  onOpenNewRecurring,
  refreshKey,
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
  }, [refreshKey]);

  const handleToggleActive = async (rule: RecurringRule) => {
    try {
      await api.updateRecurringRule(rule.id, { isActive: !rule.isActive });
      loadData();
    } catch (err) {
      alert('Erro ao atualizar status da regra fixa');
    }
  };

  const handleDelete = async (id: string, description: string) => {
    if (confirm(`Deseja excluir a regra fixa "${description}"?`)) {
      try {
        await api.deleteRecurringRule(id);
        loadData();
      } catch (err) {
        alert('Erro ao excluir regra');
      }
    }
  };

  // Valor médio por mês: semanal ≈ 52/12 ocorrências, anual = 1/12
  const monthlyEquivalent = (r: RecurringRule) =>
    r.frequency === 'WEEKLY' ? Math.round((r.amountCents * 52) / 12) : r.frequency === 'YEARLY' ? Math.round(r.amountCents / 12) : r.amountCents;
  const byDueDay = (a: RecurringRule, b: RecurringRule) => a.dueDay - b.dueDay || a.description.localeCompare(b.description);
  const incomeRules = rules.filter((r) => r.type === 'INCOME').sort(byDueDay);
  const expenseRules = rules.filter((r) => r.type === 'EXPENSE').sort(byDueDay);
  const activeMonthly = (list: RecurringRule[]) =>
    list.filter((r) => r.isActive).reduce((acc, r) => acc + monthlyEquivalent(r), 0);
  const fixedIncomeCents = activeMonthly(incomeRules);
  const fixedExpenseCents = activeMonthly(expenseRules);
  const fixedBalanceCents = fixedIncomeCents - fixedExpenseCents;

  const renderRule = (rule: RecurringRule) => {
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
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Repeat className="w-6 h-6 text-amber-500" />
            Receitas e Despesas Fixas
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            O que entra e sai todo mês (salários, prestação, internet, contas de consumo)
          </p>
        </div>

        <button
          onClick={onOpenNewRecurring}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/30 transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" />
          Nova Regra Fixa
        </button>
      </div>

      {/* Resumo mensal das regras ativas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
          <span className="text-xs text-slate-500 block font-medium">Receitas fixas por mês</span>
          <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">{formatMoney(fixedIncomeCents)}</span>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
          <span className="text-xs text-slate-500 block font-medium">Despesas fixas por mês</span>
          <span className="text-xl font-black text-rose-600 dark:text-rose-400">{formatMoney(fixedExpenseCents)}</span>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
          <span className="text-xs text-slate-500 block font-medium">Sobra das fixas</span>
          <span className={`text-xl font-black ${fixedBalanceCents >= 0 ? 'text-slate-900 dark:text-white' : 'text-rose-600'}`}>
            {formatMoney(fixedBalanceCents)}
          </span>
          <span className="text-[10px] text-slate-400 block">antes de cartões e gastos variáveis</span>
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-center text-xs text-slate-400">Carregando regras fixas...</div>
      ) : (
        <>
          <RuleSection title="Receitas Fixas" color="text-emerald-600 dark:text-emerald-400" rules={incomeRules} emptyText="Nenhuma receita fixa cadastrada (ex.: salário)." render={renderRule} />
          <RuleSection title="Despesas Fixas" color="text-rose-600 dark:text-rose-400" rules={expenseRules} emptyText="Nenhuma despesa fixa cadastrada." render={renderRule} />
        </>
      )}
    </div>
  );
};

interface RuleSectionProps {
  title: string;
  color: string;
  rules: RecurringRule[];
  emptyText: string;
  render: (rule: RecurringRule) => React.ReactNode;
}

const RuleSection: React.FC<RuleSectionProps> = ({ title, color, rules, emptyText, render }) => (
  <section className="space-y-3">
    <h3 className={`text-sm font-bold uppercase tracking-wider ${color}`}>
      {title} <span className="text-slate-400 font-semibold">({rules.length})</span>
    </h3>
    {rules.length === 0 ? (
      <div className="p-6 text-center text-xs text-slate-400 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
        {emptyText}
      </div>
    ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{rules.map(render)}</div>
    )}
  </section>
);
