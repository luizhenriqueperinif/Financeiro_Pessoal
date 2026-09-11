import { CategorySummary, MonthlyHistoryItem } from './dashboard.js';
import { ForecastResult } from './forecast.js';

export interface InstallmentOverviewItem {
  purchaseId: string;
  description: string;
  totalAmountCents: number;
  totalInstallments: number;
  remainingInstallments: number;
  remainingAmountCents: number;
  nextDueDate: string;
  categoryName?: string;
}

export interface FixedExpenseOverviewItem {
  ruleId: string;
  description: string;
  amountCents: number;
  frequency: string;
  dueDay: number;
  categoryName?: string;
  paymentMethod: string;
}

export interface FinancialReportsResult {
  period: string; // Ex: "2026" ou "2026-09"
  totalIncomeCents: number;
  totalExpenseCents: number;
  netSavingsCents: number;
  savingsRatePercentage: number;
  expensesByCategory: CategorySummary[];
  incomesByCategory: CategorySummary[];
  monthlyCashFlow: MonthlyHistoryItem[];
  activeFixedExpenses: FixedExpenseOverviewItem[];
  activeInstallments: InstallmentOverviewItem[];
  totalFutureInstallmentsCents: number;
  forecast: ForecastResult;
}
