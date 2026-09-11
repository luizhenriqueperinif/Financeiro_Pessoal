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
