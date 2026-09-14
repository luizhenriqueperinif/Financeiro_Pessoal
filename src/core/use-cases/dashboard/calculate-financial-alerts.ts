import {
  FinancialAlertsSummary,
  CommitmentLevel,
  ReminderItem,
  ReminderType,
} from '../../domain/alerts.js';
import { Transaction } from '../../domain/transaction.js';
import { DateUtils } from '../../utils/date-utils.js';

export interface CalculateFinancialAlertsParams {
  selectedYearMonth: string;
  totalMonthIncomesCents: number;
  totalMonthExpensesProjectedCents: number;
  transactions: Transaction[];
  todayDate?: string;
}

export class CalculateFinancialAlertsUseCase {
  execute(params: CalculateFinancialAlertsParams): FinancialAlertsSummary {
    const {
      selectedYearMonth,
      totalMonthIncomesCents,
      totalMonthExpensesProjectedCents,
      transactions,
    } = params;

    const todayStr = params.todayDate || new Date().toISOString().slice(0, 10);
    const totalDaysInMonth = DateUtils.getDaysInMonth(selectedYearMonth);
    const currentYM = DateUtils.getYearMonth(todayStr);

    // Determina os dias restantes do mês
    let daysRemainingInMonth = 0;
    if (selectedYearMonth === currentYM) {
      const currentDay = parseInt(todayStr.slice(8, 10), 10);
      daysRemainingInMonth = Math.max(1, totalDaysInMonth - currentDay + 1);
    } else if (selectedYearMonth > currentYM) {
      daysRemainingInMonth = totalDaysInMonth;
    } else {
      // Mês anterior já encerrado
      daysRemainingInMonth = 0;
    }

    // Cálculos orçamentários
    const remainingBalanceCents =
      totalMonthIncomesCents - totalMonthExpensesProjectedCents;

    let commitmentLevel: CommitmentLevel = 'HEALTHY';
    let commitmentPercentage = 0;
    let dailyAvailableBudgetCents = 0;
    let hasDeficit = false;
    let deficitCents = 0;

    if (totalMonthIncomesCents <= 0) {
      commitmentLevel = 'NO_INCOME';
      commitmentPercentage = 0;
      dailyAvailableBudgetCents = 0;
      hasDeficit = false;
      deficitCents = 0;
    } else {
      hasDeficit = remainingBalanceCents < 0;
      deficitCents = hasDeficit ? Math.abs(remainingBalanceCents) : 0;
      commitmentPercentage = Math.round(
        (totalMonthExpensesProjectedCents / totalMonthIncomesCents) * 100
      );

      if (hasDeficit || commitmentPercentage > 85) {
        commitmentLevel = 'CRITICAL';
      } else if (commitmentPercentage > 70) {
        commitmentLevel = 'WARNING';
      } else {
        commitmentLevel = 'HEALTHY';
      }

      dailyAvailableBudgetCents =
        hasDeficit || daysRemainingInMonth === 0
          ? 0
          : Math.floor(remainingBalanceCents / daysRemainingInMonth);
    }

    // Lembretes de Vencimento
    const reminders: ReminderItem[] = [];

    const buildReminder = (
      tx: Transaction,
      type: ReminderType,
      isCritical: boolean,
      daysDiff: number
    ): ReminderItem => ({
      id: `rem-${tx.id}`,
      transactionId: tx.id,
      type,
      title: tx.description,
      amountCents: tx.amountCents,
      dueDate: tx.date,
      isCritical,
      daysDiff,
    });

    for (const tx of transactions) {
      if (tx.status === 'CANCELLED') continue;

      const effectiveDue = tx.date;
      if (!effectiveDue) continue;

      const daysDiff = DateUtils.diffInDays(effectiveDue, todayStr);

      if (tx.type === 'EXPENSE') {
        if (tx.status !== 'PAID') {
          if (daysDiff < 0) {
            // Despesa atrasada
            reminders.push(buildReminder(tx, 'OVERDUE_EXPENSE', true, daysDiff));
          } else if (daysDiff <= 5) {
            // Despesa a vencer nos próximos 5 dias (ou hoje)
            reminders.push(buildReminder(tx, 'UPCOMING_EXPENSE', false, daysDiff));
          }
        }
      } else if (tx.type === 'INCOME') {
        if (tx.status !== 'RECEIVED' && tx.status !== 'PAID') {
          if (daysDiff <= 0) {
            // Receita esperada não recebida na data prevista (inclusive hoje)
            reminders.push(buildReminder(tx, 'UNRECEIVED_INCOME', false, daysDiff));
          }
        }
      }
    }

    // Ordena lembretes: atrasados primeiro, depois mais próximos
    reminders.sort((a, b) => a.daysDiff - b.daysDiff);

    const hasCriticalAlert =
      commitmentLevel === 'CRITICAL' || reminders.some((r) => r.isCritical);

    return {
      commitmentLevel,
      commitmentPercentage,
      totalIncomeCents: totalMonthIncomesCents,
      totalProjectedExpenseCents: totalMonthExpensesProjectedCents,
      remainingBalanceCents,
      dailyAvailableBudgetCents,
      daysRemainingInMonth,
      hasDeficit,
      deficitCents,
      reminders,
      hasCriticalAlert,
    };
  }
}
