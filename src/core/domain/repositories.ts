import { Investment, CreateInvestmentDTO, UpdateInvestmentDTO } from './investment.js';
import {
  Category,
  CreateCategoryDTO,
  UpdateCategoryDTO,
} from './category.js';
import {
  Transaction,
  CreateTransactionDTO,
  UpdateTransactionDTO,
  TransactionFilters,
} from './transaction.js';
import {
  RecurringRule,
  CreateRecurringRuleDTO,
  UpdateRecurringRuleDTO,
} from './recurring-rule.js';
import {
  InstallmentPurchase,
  Installment,
  CreateInstallmentPurchaseDTO,
  UpdateInstallmentDTO,
} from './installment-purchase.js';
import { TransactionType } from '../types/common.js';

export interface ICategoryRepository {
  create(data: CreateCategoryDTO): Category;
  findById(id: string): Category | null;
  findByName(name: string): Category | null;
  list(type?: TransactionType): Category[];
  update(id: string, data: UpdateCategoryDTO): Category | null;
  delete(id: string): boolean;
  countTransactions(categoryId: string): number;
}

export interface ITransactionRepository {
  create(data: CreateTransactionDTO): Transaction;
  findById(id: string): Transaction | null;
  list(filters?: TransactionFilters): Transaction[];
  update(id: string, data: UpdateTransactionDTO): Transaction | null;
  delete(id: string): boolean;
  markAsPaid(id: string, paymentDate?: string): Transaction | null;
  markAsUnpaid(id: string): Transaction | null;
  /** period: YYYY-MM (qualquer dia do mês) ou YYYY-MM-DD (data exata). */
  findByRecurringInstance(ruleId: string, period: string): Transaction | null;
}

export interface IRecurringRuleRepository {
  create(data: CreateRecurringRuleDTO): RecurringRule;
  findById(id: string): RecurringRule | null;
  list(activeOnly?: boolean): RecurringRule[];
  update(id: string, data: UpdateRecurringRuleDTO): RecurringRule | null;
  delete(id: string): boolean;
  /** Marca a ocorrência da data informada como excluída pelo usuário. */
  skipOccurrence(ruleId: string, date: string): void;
  /** period: YYYY-MM (alguma ocorrência do mês) ou YYYY-MM-DD (data exata). */
  isOccurrenceSkipped(ruleId: string, period: string): boolean;
}

export interface IInstallmentPurchaseRepository {
  create(
    data: CreateInstallmentPurchaseDTO,
    installments: Array<Omit<Installment, 'id' | 'createdAt' | 'updatedAt'>>
  ): InstallmentPurchase;
  findById(id: string): InstallmentPurchase | null;
  list(): InstallmentPurchase[];
  delete(id: string): boolean;
  findInstallmentById(installmentId: string): Installment | null;
  updateInstallment(
    installmentId: string,
    data: UpdateInstallmentDTO
  ): Installment | null;
  listInstallmentsByMonth(yearMonth: string): Installment[];
}

export interface IInvestmentRepository {
  create(data: CreateInvestmentDTO): Investment;
  findById(id: string): Investment | null;
  list(): Investment[];
  update(id: string, data: UpdateInvestmentDTO): Investment | null;
  setRecurringRule(id: string, ruleId: string | null): void;
  delete(id: string): boolean;
}
