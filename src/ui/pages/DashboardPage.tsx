import React, { useEffect, useState } from 'react';
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  Clock,
  Repeat,
  CreditCard,
  CheckCircle,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { DashboardMetrics } from '../../core/domain/dashboard.js';
import { formatMoney } from '../utils/formatters.js';
import { api } from '../services/api.js';
import { FinancialAlertsBanner } from '../components/FinancialAlertsBanner.js';

interface DashboardPageProps {
  selectedYearMonth: string;
  refreshKey?: number;
  onNavigateToIncomes: () => void;
  onNavigateToExpenses: () => void;
  onNavigateToInstallments: () => void;
  onNavigateToRecurring: () => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  selectedYearMonth,
  refreshKey,
  onNavigateToIncomes,
  onNavigateToExpenses,
  onNavigateToInstallments,
  onNavigateToRecurring,
}) => {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await api.getDashboardMetrics(selectedYearMonth);
      setMetrics(res);
    } catch (err) {
      console.error('Erro ao carregar métricas do dashboard', err);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickPay = async (transactionId: string) => {
    try {
      await api.markTransactionPaid(transactionId);
      await loadData();
    } catch (err) {
      console.error('Erro ao marcar como pago via lembrete rápido:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedYearMonth, refreshKey]);

  if (loading || !metrics) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  // Prepara dados dos gráficos
  const historyChartData = metrics.monthlyHistory.map((h) => ({
    name: h.monthName,
    Receitas: h.incomeCents / 100,
    Despesas: h.expenseCents / 100,
  }));

  const categoryPieData = metrics.expensesByCategory.map((c) => ({
    name: c.categoryName,
    value: c.totalCents / 100,
    color: c.categoryColor,
  }));

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-150">
      {/* 0. Banner Inteligente de Alertas e Lembretes Proativos */}
      {metrics.alerts && (
        <FinancialAlertsBanner
          alerts={metrics.alerts}
          onQuickPay={handleQuickPay}
        />
      )}

      {/* 1. Grid dos Cards Principais de Indicadores */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Saldo Atual */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Saldo Atual Real
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className={`text-2xl font-black tracking-tight ${metrics.currentBalanceCents >= 0 ? 'text-slate-900 dark:text-white' : 'text-rose-600'}`}>
            {formatMoney(metrics.currentBalanceCents)}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">
            Dinheiro efetivamente em conta hoje
          </span>
        </div>

        {/* Receitas do Mês */}
        <div
          onClick={onNavigateToIncomes}
          className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm hover:border-emerald-500/50 cursor-pointer transition-all group"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Receitas do Mês
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black tracking-tight text-emerald-600 dark:text-emerald-400">
            {formatMoney(metrics.monthIncomeCents)}
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1">
            <span>Previstas: {formatMoney(metrics.expectedIncomeCents)}</span>
            <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        {/* Despesas do Mês */}
        <div
          onClick={onNavigateToExpenses}
          className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm hover:border-rose-500/50 cursor-pointer transition-all group"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Despesas Pagas
            </span>
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black tracking-tight text-rose-600 dark:text-rose-400">
            {formatMoney(metrics.paidExpenseCents)}
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1">
            <span>Pendentes: {formatMoney(metrics.pendingExpenseCents)}</span>
            <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        {/* Saldo Previsto do Mês */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Saldo Previsto do Mês
            </span>
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div
            className={`text-2xl font-black tracking-tight ${
              metrics.monthProjectedBalanceCents >= 0
                ? 'text-indigo-600 dark:text-indigo-400'
                : 'text-rose-600'
            }`}
          >
            {formatMoney(metrics.monthProjectedBalanceCents)}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">
            Considerando todas as contas a pagar e receber
          </span>
        </div>
      </div>

      {/* 2. Mini-Cards de Compromissos (Fixas, Parcelas, Pendentes) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div
          onClick={onNavigateToRecurring}
          className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/70 dark:border-slate-800 flex items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Repeat className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs text-slate-500 dark:text-slate-400 block font-medium">
                Gastos Fixos do Mês
              </span>
              <span className="text-base font-bold text-slate-800 dark:text-slate-200">
                {formatMoney(metrics.fixedExpensesCents)}
              </span>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-400" />
        </div>

        <div
          onClick={onNavigateToInstallments}
          className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/70 dark:border-slate-800 flex items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs text-slate-500 dark:text-slate-400 block font-medium">
                Gastos com Parcelas
              </span>
              <span className="text-base font-bold text-slate-800 dark:text-slate-200">
                {formatMoney(metrics.installmentExpensesCents)}
              </span>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-400" />
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/70 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs text-slate-500 dark:text-slate-400 block font-medium">
                Total a Pagar Pendente
              </span>
              <span className="text-base font-bold text-rose-600 dark:text-rose-400">
                {formatMoney(metrics.pendingExpenseCents)}
              </span>
            </div>
          </div>
          <span className="text-xs font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
            A Vencer
          </span>
        </div>
      </div>

      {/* 3. Seção de Gráficos Principais */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Gráfico de Barras: Histórico Receitas x Despesas */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Receitas x Despesas (Últimos 6 Meses)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Comparativo de entradas e saídas realizadas
              </p>
            </div>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={historyChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} tickFormatter={(v) => `R$${v >= 1000 ? `${v / 1000}k` : v}`} />
                <Tooltip
                  formatter={(value: any) => [`R$ ${Number(value).toFixed(2)}`, '']}
                  contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: '1px solid #334155', color: '#fff', fontSize: '12px' }}
                />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                <Bar dataKey="Receitas" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Despesas" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico de Rosca: Despesas por Categoria */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Despesas por Categoria
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
              Distribuição de gastos no mês
            </p>
          </div>

          <div className="h-44 w-full relative flex items-center justify-center">
            {categoryPieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {categoryPieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val: any) => [`R$ ${Number(val).toFixed(2)}`, '']}
                    contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', border: 'none', color: '#fff', fontSize: '11px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <span className="text-xs text-slate-400">Nenhuma despesa registrada neste mês</span>
            )}
          </div>

          {/* Legenda Resumida */}
          <div className="space-y-1.5 mt-2 max-h-32 overflow-y-auto pr-1">
            {metrics.expensesByCategory.slice(0, 4).map((c) => (
              <div key={c.categoryId} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c.categoryColor }} />
                  <span className="text-slate-700 dark:text-slate-300 font-medium truncate max-w-[120px]">{c.categoryName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900 dark:text-white">{formatMoney(c.totalCents)}</span>
                  <span className="text-[10px] text-slate-400 font-semibold">{c.percentage}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 4. Tabela de Previsão Financeira Prospectiva dos Próximos 6 Meses */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>Previsão Financeira dos Próximos 6 Meses</span>
              <span className="text-xs font-normal text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full">
                Análise Prospectiva
              </span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Projeção integrando despesas fixas, compras parceladas e receitas programadas
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/60 rounded-xl">
              <tr>
                <th className="py-3 px-4 rounded-l-xl font-bold">Mês</th>
                <th className="py-3 px-4 font-bold text-right">Receitas Previstas</th>
                <th className="py-3 px-4 font-bold text-right">Despesas Previstas</th>
                <th className="py-3 px-4 font-bold text-right">Saldo do Mês</th>
                <th className="py-3 px-4 font-bold text-right">Saldo Acumulado</th>
                <th className="py-3 px-4 rounded-r-xl font-bold text-center">Comprometimento</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {metrics.forecast.months.map((m) => (
                <tr key={m.yearMonth} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-slate-100">
                    {m.monthName}
                  </td>
                  <td className="py-3.5 px-4 text-right font-semibold text-emerald-600 dark:text-emerald-400">
                    {formatMoney(m.incomeCents)}
                  </td>
                  <td className="py-3.5 px-4 text-right font-semibold text-rose-600 dark:text-rose-400">
                    {formatMoney(m.expenseCents)}
                  </td>
                  <td className={`py-3.5 px-4 text-right font-bold ${m.projectedBalanceCents >= 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-rose-600'}`}>
                    {formatMoney(m.projectedBalanceCents)}
                  </td>
                  <td className={`py-3.5 px-4 text-right font-black ${m.accumulatedBalanceCents >= 0 ? 'text-slate-900 dark:text-white' : 'text-rose-600'}`}>
                    {formatMoney(m.accumulatedBalanceCents)}
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <span
                      className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold ${
                        m.commitmentPercentage > 80
                          ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300'
                          : m.commitmentPercentage > 60
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'
                          : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                      }`}
                    >
                      {m.commitmentPercentage}% de renda
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
