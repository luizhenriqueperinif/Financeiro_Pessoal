import React, { useEffect, useState } from 'react';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  PiggyBank,
  CreditCard,
  Repeat,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from 'recharts';
import { FinancialReportsResult } from '../../core/domain/reports.js';
import { formatMoney } from '../utils/formatters.js';
import { api } from '../services/api.js';

export const ReportsPage: React.FC = () => {
  const [report, setReport] = useState<FinancialReportsResult | null>(null);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await api.getReports(selectedYear);
      setReport(res);
    } catch (err) {
      console.error('Erro ao carregar relatórios', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedYear]);

  if (loading || !report) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  const chartData = report.monthlyCashFlow.map((m) => ({
    name: m.monthName.slice(0, 3),
    Receitas: m.incomeCents / 100,
    Despesas: m.expenseCents / 100,
  }));

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            Relatórios e Auditoria Anual
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Visão panorâmica da sua saúde financeira, economia anual e evolução
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-500">Ano:</span>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-200"
          >
            {[2024, 2025, 2026, 2027, 2028].map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Indicadores Principais do Ano */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-xs text-slate-500 dark:text-slate-400 block font-semibold uppercase">Total Entradas {selectedYear}</span>
          <span className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1 block">
            {formatMoney(report.totalIncomeCents)}
          </span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-xs text-slate-500 dark:text-slate-400 block font-semibold uppercase">Total Saídas {selectedYear}</span>
          <span className="text-xl font-black text-rose-600 dark:text-rose-400 mt-1 block">
            {formatMoney(report.totalExpenseCents)}
          </span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-xs text-slate-500 dark:text-slate-400 block font-semibold uppercase">Economia Líquida</span>
          <span className={`text-xl font-black mt-1 block ${report.netSavingsCents >= 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-rose-600'}`}>
            {formatMoney(report.netSavingsCents)}
          </span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-xs text-slate-500 dark:text-slate-400 block font-semibold uppercase">Taxa de Poupança</span>
          <span className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1 block">
            {report.savingsRatePercentage}% da renda
          </span>
        </div>
      </div>

      {/* Gráfico do Fluxo de Caixa Anual (12 Meses) */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">
          Fluxo de Caixa Mensal ({selectedYear})
        </h3>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
              <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} />
              <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} tickFormatter={(v) => `R$${v >= 1000 ? `${v / 1000}k` : v}`} />
              <Tooltip
                formatter={(val: any) => [`R$ ${Number(val).toFixed(2)}`, '']}
                contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: '1px solid #334155', color: '#fff', fontSize: '12px' }}
              />
              <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
              <Bar dataKey="Receitas" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Despesas" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Distribuição por Categorias */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">
            Maiores Gastos por Categoria
          </h3>
          <div className="space-y-3">
            {report.expensesByCategory.slice(0, 6).map((c) => (
              <div key={c.categoryId}>
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span className="text-slate-700 dark:text-slate-300">{c.categoryName}</span>
                  <span className="text-slate-900 dark:text-white">{formatMoney(c.totalCents)} ({c.percentage}%)</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${c.percentage}%`, backgroundColor: c.categoryColor || '#EF4444' }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">
            Fontes de Receita
          </h3>
          <div className="space-y-3">
            {report.incomesByCategory.slice(0, 6).map((c) => (
              <div key={c.categoryId}>
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span className="text-slate-700 dark:text-slate-300">{c.categoryName}</span>
                  <span className="text-slate-900 dark:text-white">{formatMoney(c.totalCents)} ({c.percentage}%)</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${c.percentage}%`, backgroundColor: c.categoryColor || '#10B981' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
