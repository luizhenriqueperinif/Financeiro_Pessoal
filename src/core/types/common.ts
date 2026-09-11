export type TransactionType = 'INCOME' | 'EXPENSE';

export type PaymentMethod =
  | 'MONEY'
  | 'PIX'
  | 'DEBIT'
  | 'CREDIT'
  | 'BOLETO'
  | 'OTHER';

export type TransactionStatus =
  | 'PENDING'
  | 'PAID'
  | 'RECEIVED'
  | 'OVERDUE'
  | 'CANCELLED';

export type RecurringFrequency = 'MONTHLY' | 'WEEKLY' | 'YEARLY';

export type InstallmentStatus = 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED';
