export type CommitmentLevel = 'HEALTHY' | 'WARNING' | 'CRITICAL' | 'NO_INCOME';

export type ReminderType = 'OVERDUE_EXPENSE' | 'UPCOMING_EXPENSE' | 'UNRECEIVED_INCOME';

export interface ReminderItem {
  id: string;
  transactionId: string;
  type: ReminderType;
  title: string;
  amountCents: number;
  dueDate: string; // "YYYY-MM-DD"
  isCritical: boolean; // true se atrasado
  daysDiff: number; // negativo se atrasado, 0 se hoje, positivo se futuro
}

export interface FinancialAlertsSummary {
  commitmentLevel: CommitmentLevel;
  commitmentPercentage: number; // 0 a 100+
  totalIncomeCents: number;
  totalProjectedExpenseCents: number;
  remainingBalanceCents: number; // totalIncomeCents - totalProjectedExpenseCents
  dailyAvailableBudgetCents: number; // remainingBalanceCents / dias restantes (0 se deficit ou sem receita)
  daysRemainingInMonth: number;
  hasDeficit: boolean;
  deficitCents: number;
  reminders: ReminderItem[];
  hasCriticalAlert: boolean; // true se CRITICAL ou tiver pendências atrasadas
}
