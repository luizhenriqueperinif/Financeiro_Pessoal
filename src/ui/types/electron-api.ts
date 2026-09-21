import { Category, CreateCategoryDTO, UpdateCategoryDTO } from '../../core/domain/category.js';
import { Transaction, CreateTransactionDTO, UpdateTransactionDTO, TransactionFilters } from '../../core/domain/transaction.js';
import { RecurringRule, CreateRecurringRuleDTO, UpdateRecurringRuleDTO } from '../../core/domain/recurring-rule.js';
import { InstallmentPurchase, Installment, CreateInstallmentPurchaseDTO, UpdateInstallmentDTO } from '../../core/domain/installment-purchase.js';
import { DashboardMetrics } from '../../core/domain/dashboard.js';
import { CalendarMonthData } from '../../core/domain/calendar.js';
import { FinancialReportsResult } from '../../core/domain/reports.js';
import { ForecastResult } from '../../core/domain/forecast.js';
import { TransactionType } from '../../core/types/common.js';

export interface IElectronAPI {
  // Categorias
  listCategories(type?: TransactionType): Promise<Category[]>;
  createCategory(dto: CreateCategoryDTO): Promise<Category>;
  updateCategory(id: string, dto: UpdateCategoryDTO): Promise<Category>;
  deleteCategory(id: string): Promise<boolean>;

  // Transações
  listTransactions(filters?: TransactionFilters & { yearMonth?: string }): Promise<Transaction[]>;
  createTransaction(dto: CreateTransactionDTO): Promise<Transaction>;
  updateTransaction(id: string, dto: UpdateTransactionDTO): Promise<Transaction>;
  deleteTransaction(id: string): Promise<boolean>;
  markTransactionPaid(id: string, paymentDate?: string): Promise<Transaction>;
  markTransactionUnpaid(id: string): Promise<Transaction>;

  // Despesas Fixas
  listRecurringRules(activeOnly?: boolean): Promise<RecurringRule[]>;
  createRecurringRule(dto: CreateRecurringRuleDTO): Promise<RecurringRule>;
  updateRecurringRule(id: string, dto: UpdateRecurringRuleDTO): Promise<RecurringRule>;
  deleteRecurringRule(id: string): Promise<boolean>;

  // Compras Parceladas
  listInstallmentPurchases(): Promise<InstallmentPurchase[]>;
  createInstallmentPurchase(dto: CreateInstallmentPurchaseDTO): Promise<InstallmentPurchase>;
  payInstallment(id: string, paymentDate?: string): Promise<Installment>;
  unpayInstallment(id: string): Promise<Installment>;
  updateInstallment(id: string, dto: UpdateInstallmentDTO): Promise<Installment>;
  deleteInstallmentPurchase(id: string): Promise<boolean>;

  // Visões Consolidadas
  getDashboardMetrics(yearMonth?: string): Promise<DashboardMetrics>;
  getCalendarData(yearMonth?: string): Promise<CalendarMonthData>;
  getReports(year?: number): Promise<FinancialReportsResult>;
  getForecast(startYearMonth?: string, count?: number): Promise<ForecastResult>;

  // Backup e Restauração
  exportBackupJSON(): Promise<string>;
  importBackupJSON(jsonContent: string): Promise<boolean>;

  // Extratos e Conciliação Bancária
  parseStatement(fileContent: string, fileName?: string): Promise<import('../../core/domain/statement.js').BankStatementParseResult>;
  reconcilePreview(items: import('../../core/domain/statement.js').BankStatementItem[]): Promise<import('../../core/domain/statement.js').ReconciliationPreviewItem[]>;
  reconcileCommit(items: import('../../core/domain/statement.js').ConfirmedStatementItem[]): Promise<import('../../core/domain/statement.js').ReconciliationResult>;
  // Limpeza de Dados
  clearAllData(includeCategories?: boolean): Promise<boolean>;
}

declare global {
  interface Window {
    api?: IElectronAPI;
  }
}
