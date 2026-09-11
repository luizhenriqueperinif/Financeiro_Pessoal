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
  notes?: string | null;
}

export interface UpdateInstallmentDTO {
  amountCents?: number;
  dueDate?: string;
  paymentDate?: string | null;
  status?: InstallmentStatus;
}
