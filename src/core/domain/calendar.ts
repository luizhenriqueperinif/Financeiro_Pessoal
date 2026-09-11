import { TransactionStatus, TransactionType } from '../types/common.js';

export interface CalendarEvent {
  id: string;
  description: string;
  amountCents: number;
  type: TransactionType;
  status: TransactionStatus;
  isRecurring: boolean;
  isInstallment: boolean;
  categoryName?: string;
  categoryColor?: string;
}

export interface CalendarDay {
  date: string; // YYYY-MM-DD
  dayNumber: number;
  isToday: boolean;
  events: CalendarEvent[];
  totalIncomeCents: number;
  totalExpenseCents: number;
}

export interface CalendarMonthData {
  yearMonth: string;
  year: number;
  month: number;
  firstDayOfWeek: number; // 0 = Domingo, 1 = Segunda, etc.
  daysInMonth: number;
  days: CalendarDay[];
  totalIncomeMonthCents: number;
  totalExpenseMonthCents: number;
}
