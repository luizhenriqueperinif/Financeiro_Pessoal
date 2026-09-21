import {
  TransactionType,
  PaymentMethod,
  RecurringFrequency,
} from '../types/common.js';

export interface RecurringRule {
  id: string;
  description: string;
  amountCents: number;
  type: TransactionType;
  categoryId: string;
  categoryName?: string;
  categoryColor?: string;
  categoryIcon?: string;
  frequency: RecurringFrequency;
  dueDay: number;
  startDate: string; // YYYY-MM-DD
  endDate?: string | null; // YYYY-MM-DD
  paymentMethod: PaymentMethod;
  isActive: boolean;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRecurringRuleDTO {
  description: string;
  amountCents: number;
  type: TransactionType;
  categoryId: string;
  frequency: RecurringFrequency;
  dueDay: number;
  startDate: string;
  endDate?: string | null;
  paymentMethod: PaymentMethod;
  isActive?: boolean;
  notes?: string | null;
}

export interface UpdateRecurringRuleDTO {
  description?: string;
  amountCents?: number;
  type?: TransactionType;
  categoryId?: string;
  frequency?: RecurringFrequency;
  dueDay?: number;
  startDate?: string;
  endDate?: string | null;
  paymentMethod?: PaymentMethod;
  isActive?: boolean;
  notes?: string | null;
}

/**
 * Datas de vencimento (YYYY-MM-DD) de uma regra dentro do mês informado (YYYY-MM),
 * já limitadas ao intervalo [startDate, endDate] da regra.
 * - MONTHLY: uma vez por mês no dueDay (ajustado ao último dia em meses curtos).
 * - YEARLY: uma vez por ano, no mês de startDate, no dueDay.
 * - WEEKLY: a cada 7 dias contados a partir de startDate (dueDay é ignorado).
 */
export function recurringOccurrencesInMonth(
  rule: Pick<RecurringRule, 'frequency' | 'dueDay' | 'startDate' | 'endDate'>,
  yearMonth: string
): string[] {
  const [year, month] = yearMonth.split('-').map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  const toIso = (d: number) => `${yearMonth}-${String(d).padStart(2, '0')}`;

  let dates: string[];
  if (rule.frequency === 'WEEKLY') {
    const [sy, sm, sd] = rule.startDate.split('-').map(Number);
    const start = Date.UTC(sy, sm - 1, sd);
    const monthStart = Date.UTC(year, month - 1, 1);
    const dayMs = 24 * 60 * 60 * 1000;
    const offsetDays = Math.max(0, Math.ceil((monthStart - start) / dayMs / 7) * 7);
    dates = [];
    for (let t = start + offsetDays * dayMs; ; t += 7 * dayMs) {
      const d = new Date(t);
      if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1) break;
      dates.push(toIso(d.getUTCDate()));
    }
  } else if (rule.frequency === 'YEARLY') {
    const startMonth = Number(rule.startDate.slice(5, 7));
    dates = startMonth === month ? [toIso(Math.min(rule.dueDay, lastDay))] : [];
  } else {
    dates = [toIso(Math.min(rule.dueDay, lastDay))];
  }

  return dates.filter((d) => d >= rule.startDate && (!rule.endDate || d <= rule.endDate));
}
