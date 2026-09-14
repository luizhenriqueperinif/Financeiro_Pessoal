import { ForecastResult } from './forecast.js';
import { FinancialAlertsSummary } from './alerts.js';

export interface CategorySummary {
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  totalCents: number;
  percentage: number;
}

export interface MonthlyHistoryItem {
  yearMonth: string;
  monthName: string;
  incomeCents: number;
  expenseCents: number;
}

export interface DashboardMetrics {
  selectedYearMonth: string;
  currentBalanceCents: number; // Saldo real em conta (recebidas - pagas histórico)
  monthIncomeCents: number; // Total receitas recebidas no mês
  monthExpenseCents: number; // Total despesas pagas no mês
  expectedIncomeCents: number; // Receitas previstas ainda não recebidas
  pendingExpenseCents: number; // Despesas pendentes/atrasadas no mês
  paidExpenseCents: number; // Despesas pagas no mês
  monthProjectedBalanceCents: number; // Saldo previsto do mês
  fixedExpensesCents: number; // Total de gastos fixos no mês
  installmentExpensesCents: number; // Total de parcelas no mês
  expensesByCategory: CategorySummary[];
  monthlyHistory: MonthlyHistoryItem[]; // Últimos 6 meses para o gráfico comparativo
  forecast: ForecastResult; // Próximos 6 meses
  alerts: FinancialAlertsSummary; // Alertas e inteligência proativa de orçamento
}

