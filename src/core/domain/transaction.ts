import {
  TransactionType,
  PaymentMethod,
  TransactionStatus,
} from '../types/common.js';

export interface Transaction {
  id: string;
  description: string;
  amountCents: number;
  type: TransactionType;
  categoryId: string;
  categoryName?: string;
  categoryColor?: string;
  categoryIcon?: string;
  date: string; // YYYY-MM-DD (data de competência / vencimento)
  paymentDate?: string | null; // YYYY-MM-DD (data em que foi liquidada)
  paymentMethod: PaymentMethod;
  status: TransactionStatus;
  notes?: string | null;
  installmentId?: string | null;
  installmentNumber?: number | null;
  totalInstallments?: number | null;
  recurringRuleId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTransactionDTO {
  description: string;
  amountCents: number;
  type: TransactionType;
  categoryId: string;
  date: string;
  paymentDate?: string | null;
  paymentMethod: PaymentMethod;
  status?: TransactionStatus;
  notes?: string | null;
  installmentId?: string | null;
  recurringRuleId?: string | null;
}

export interface UpdateTransactionDTO {
  description?: string;
  amountCents?: number;
  type?: TransactionType;
  categoryId?: string;
  date?: string;
  paymentDate?: string | null;
  paymentMethod?: PaymentMethod;
  status?: TransactionStatus;
  notes?: string | null;
}

export interface TransactionFilters {
  startDate?: string;
  endDate?: string;
  type?: TransactionType;
  categoryId?: string;
  paymentMethod?: PaymentMethod;
  status?: TransactionStatus;
  search?: string;
}
