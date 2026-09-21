import { TransactionType, PaymentMethod } from '../types/common.js';
import { Transaction } from './transaction.js';

export interface BankStatementItem {
  externalId: string | null;
  date: string; // Formato AAAA-MM-DD
  description: string;
  amountCents: number; // Inteiro positivo em centavos
  type: TransactionType; // 'INCOME' ou 'EXPENSE'
  memo?: string;
  suggestedCategory?: string;
}

export interface BankStatementParseResult {
  bankName: string;
  accountType: 'CHECKING' | 'CREDIT_CARD';
  startDate: string;
  endDate: string;
  items: BankStatementItem[];
}

export interface ReconciliationPreviewItem {
  id: string;
  item: BankStatementItem;
  isDuplicate: boolean;
  duplicateReason?: string;
  matchedTransactionId?: string;
  /** Lançamento pendente que este item do extrato quita (em vez de criar um novo). */
  settlesTransactionId?: string;
  categoryId: string;
  categoryName?: string;
  selected: boolean;
}

export interface ConfirmedStatementItem {
  date: string;
  description: string;
  amountCents: number;
  type: TransactionType;
  categoryId: string;
  paymentMethod?: PaymentMethod;
  notes?: string;
  /** Quando presente, marca este lançamento pendente como pago/recebido em vez de criar outro. */
  settlesTransactionId?: string;
}

export interface ReconciliationResult {
  importedCount: number;
  settledCount: number;
  skippedCount: number;
  transactions: Transaction[];
}
