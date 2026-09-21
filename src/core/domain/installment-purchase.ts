import { PaymentMethod, InstallmentStatus } from '../types/common.js';

export interface Installment {
  id: string;
  purchaseId: string;
  installmentNumber: number;
  totalInstallments: number;
  amountCents: number;
  dueDate: string; // YYYY-MM-DD
  paymentDate?: string | null;
  status: InstallmentStatus;
  transactionId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InstallmentPurchase {
  id: string;
  description: string;
  totalAmountCents: number;
  totalInstallments: number;
  firstDueDate: string; // YYYY-MM-DD
  categoryId: string;
  categoryName?: string;
  categoryColor?: string;
  categoryIcon?: string;
  paymentMethod: PaymentMethod;
  /** Cartão de crédito em que a compra foi feita (ex.: "Nu CPF"). */
  cardName?: string | null;
  notes?: string | null;
  installments?: Installment[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateInstallmentPurchaseDTO {
  description: string;
  totalAmountCents: number;
  totalInstallments: number;
  firstDueDate: string;
  categoryId: string;
  paymentMethod?: PaymentMethod;
  cardName?: string | null;
  notes?: string | null;
}

export interface CardMonthTotal {
  yearMonth: string; // YYYY-MM
  amountCents: number;
  remainingCents: number;
}

/** Soma das parcelas de todas as compras feitas num mesmo cartão. */
export interface CardSummary {
  cardName: string;
  purchaseCount: number;
  totalCents: number;
  remainingCents: number;
  months: CardMonthTotal[];
}

export interface UpdateInstallmentDTO {
  amountCents?: number;
  dueDate?: string;
  paymentDate?: string | null;
  status?: InstallmentStatus;
}
