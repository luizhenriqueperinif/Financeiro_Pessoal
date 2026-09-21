import { IElectronAPI } from '../types/electron-api.js';
import { Category, CreateCategoryDTO, UpdateCategoryDTO } from '../../core/domain/category.js';
import { Transaction, CreateTransactionDTO, UpdateTransactionDTO, TransactionFilters } from '../../core/domain/transaction.js';
import { RecurringRule, CreateRecurringRuleDTO, UpdateRecurringRuleDTO } from '../../core/domain/recurring-rule.js';
import { InstallmentPurchase, Installment, CreateInstallmentPurchaseDTO, UpdateInstallmentDTO, CardSummary } from '../../core/domain/installment-purchase.js';
import { GetCardSummariesUseCase } from '../../core/use-cases/installments/installment-operations.js';
import { DashboardMetrics } from '../../core/domain/dashboard.js';
import { Investment, CreateInvestmentDTO, UpdateInvestmentDTO, ReserveSummary } from '../../core/domain/investment.js';
import { GetReserveSummaryUseCase } from '../../core/use-cases/investments/index.js';
import { CalendarMonthData } from '../../core/domain/calendar.js';
import { FinancialReportsResult } from '../../core/domain/reports.js';
import { ForecastResult } from '../../core/domain/forecast.js';
import { TransactionType } from '../../core/types/common.js';
import {
  BankStatementItem,
  BankStatementParseResult,
  ReconciliationPreviewItem,
  ConfirmedStatementItem,
  ReconciliationResult,
} from '../../core/domain/statement.js';
import { StatementParserService } from '../../core/services/statement-parser-service.js';
import { DateUtils } from '../../core/utils/date-utils.js';

const DEFAULT_WEB_CATEGORIES: Category[] = [
  { id: 'cat-alimentacao', name: 'Alimentação', type: 'EXPENSE', description: 'Mercado e restaurantes', color: '#EF4444', icon: 'Utensils', createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' },
  { id: 'cat-moradia', name: 'Moradia', type: 'EXPENSE', description: 'Prestação, água, luz e moradia', color: '#F97316', icon: 'Home', createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' },
  { id: 'cat-transporte', name: 'Transporte', type: 'EXPENSE', description: 'Combustível e transporte', color: '#F59E0B', icon: 'Car', createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' },
  { id: 'cat-salario', name: 'Salário', type: 'INCOME', description: 'Remuneração mensal fixa', color: '#10B981', icon: 'Briefcase', createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' },
  { id: 'cat-investimentos', name: 'Investimentos', type: 'INCOME', description: 'Dividendos e rendimentos', color: '#84CC16', icon: 'TrendingUp', createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' },
  { id: 'cat-assinaturas', name: 'Assinaturas', type: 'EXPENSE', description: 'Internet e assinaturas', color: '#EC4899', icon: 'Tv', createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' },
  { id: 'cat-outras', name: 'Outras Despesas', type: 'EXPENSE', description: 'Dízimo e débito CAP', color: '#6B7280', icon: 'MoreHorizontal', createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' },
  { id: 'cat-cartao', name: 'Cartão de Crédito', type: 'EXPENSE', description: 'Faturas e compras parceladas de cartão', color: '#8B5CF6', icon: 'CreditCard', createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' },
];

const DEFAULT_WEB_RECURRING: RecurringRule[] = [
  { id: 'rec-1', description: 'Salário Luiz', amountCents: 230000, type: 'INCOME', categoryId: 'cat-salario', categoryName: 'Salário', frequency: 'MONTHLY', dueDay: 5, startDate: '2026-09-01', paymentMethod: 'PIX', isActive: true, notes: 'Remuneração mensal Luiz', createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' },
  { id: 'rec-2', description: 'Salário Joyce', amountCents: 193500, type: 'INCOME', categoryId: 'cat-salario', categoryName: 'Salário', frequency: 'MONTHLY', dueDay: 5, startDate: '2026-09-01', paymentMethod: 'PIX', isActive: true, notes: 'Remuneração mensal Joyce', createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' },
  { id: 'rec-3', description: 'Rendimentos', amountCents: 14000, type: 'INCOME', categoryId: 'cat-investimentos', categoryName: 'Investimentos', frequency: 'MONTHLY', dueDay: 15, startDate: '2026-09-01', paymentMethod: 'PIX', isActive: true, notes: 'Rendimentos e dividendos', createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' },
  { id: 'rec-4', description: 'Dízimo (10% + R$ 60)', amountCents: 49750, type: 'EXPENSE', categoryId: 'cat-outras', categoryName: 'Outras Despesas', frequency: 'MONTHLY', dueDay: 10, startDate: '2026-09-01', paymentMethod: 'PIX', isActive: true, notes: '10% de R$ 4.375,00 + R$ 60,00 fixo', createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' },
  { id: 'rec-5', description: 'Prestação', amountCents: 192825, type: 'EXPENSE', categoryId: 'cat-moradia', categoryName: 'Moradia', frequency: 'MONTHLY', dueDay: 10, startDate: '2026-09-01', paymentMethod: 'BOLETO', isActive: true, notes: 'Prestação habitacional', createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' },
  { id: 'rec-6', description: 'Débito CAP', amountCents: 8000, type: 'EXPENSE', categoryId: 'cat-outras', categoryName: 'Outras Despesas', frequency: 'MONTHLY', dueDay: 10, startDate: '2026-09-01', paymentMethod: 'DEBIT', isActive: true, notes: 'Débito automático CAP', createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' },
  { id: 'rec-7', description: 'Internet', amountCents: 9990, type: 'EXPENSE', categoryId: 'cat-assinaturas', categoryName: 'Assinaturas', frequency: 'MONTHLY', dueDay: 15, startDate: '2026-09-01', paymentMethod: 'BOLETO', isActive: true, notes: 'Internet residencial fibra', createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' },
  { id: 'rec-8', description: 'Água', amountCents: 5000, type: 'EXPENSE', categoryId: 'cat-moradia', categoryName: 'Moradia', frequency: 'MONTHLY', dueDay: 20, startDate: '2026-09-01', paymentMethod: 'BOLETO', isActive: true, notes: 'Conta de água', createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' },
  { id: 'rec-9', description: 'Energia', amountCents: 16000, type: 'EXPENSE', categoryId: 'cat-moradia', categoryName: 'Moradia', frequency: 'MONTHLY', dueDay: 20, startDate: '2026-09-01', paymentMethod: 'BOLETO', isActive: true, notes: 'Conta de energia', createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' },
  { id: 'rec-10', description: 'Combustível', amountCents: 24000, type: 'EXPENSE', categoryId: 'cat-transporte', categoryName: 'Transporte', frequency: 'MONTHLY', dueDay: 5, startDate: '2026-09-01', paymentMethod: 'DEBIT', isActive: true, notes: 'Despesa de combustível', createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' },
];

const DEFAULT_WEB_INSTALLMENTS: InstallmentPurchase[] = [
  {
    id: 'inst-p-1',
    description: 'Cartão Nu PJ',
    totalAmountCents: 160737,
    totalInstallments: 3,
    firstDueDate: '2026-10-10',
    categoryId: 'cat-cartao',
    categoryName: 'Cartão de Crédito',
    categoryColor: '#8B5CF6',
    paymentMethod: 'CREDIT',
    notes: 'Faturas Cartão Nu PJ - Outubro a Dezembro',
    installments: [
      { id: 'inst-1-1', purchaseId: 'inst-p-1', installmentNumber: 1, totalInstallments: 3, amountCents: 53579, dueDate: '2026-10-10', status: 'PENDING', transactionId: 'tx-card-1', createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' },
      { id: 'inst-1-2', purchaseId: 'inst-p-1', installmentNumber: 2, totalInstallments: 3, amountCents: 53579, dueDate: '2026-11-10', status: 'PENDING', transactionId: 'tx-card-2', createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' },
      { id: 'inst-1-3', purchaseId: 'inst-p-1', installmentNumber: 3, totalInstallments: 3, amountCents: 53579, dueDate: '2026-12-10', status: 'PENDING', transactionId: 'tx-card-3', createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' },
    ],
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  },
  {
    id: 'inst-p-2',
    description: 'Cartão Nu CPF',
    totalAmountCents: 83532,
    totalInstallments: 9,
    firstDueDate: '2026-10-10',
    categoryId: 'cat-cartao',
    categoryName: 'Cartão de Crédito',
    categoryColor: '#8B5CF6',
    paymentMethod: 'CREDIT',
    notes: 'Faturas Cartão Nu CPF - Outubro/2026 a Junho/2027',
    installments: [
      { id: 'inst-2-1', purchaseId: 'inst-p-2', installmentNumber: 1, totalInstallments: 9, amountCents: 22080, dueDate: '2026-10-10', status: 'PENDING', transactionId: 'tx-card-4', createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' },
      { id: 'inst-2-2', purchaseId: 'inst-p-2', installmentNumber: 2, totalInstallments: 9, amountCents: 19494, dueDate: '2026-11-10', status: 'PENDING', transactionId: 'tx-card-5', createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' },
      { id: 'inst-2-3', purchaseId: 'inst-p-2', installmentNumber: 3, totalInstallments: 9, amountCents: 5994, dueDate: '2026-12-10', status: 'PENDING', transactionId: 'tx-card-6', createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' },
      { id: 'inst-2-4', purchaseId: 'inst-p-2', installmentNumber: 4, totalInstallments: 9, amountCents: 5994, dueDate: '2027-01-10', status: 'PENDING', transactionId: 'tx-card-7', createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' },
      { id: 'inst-2-5', purchaseId: 'inst-p-2', installmentNumber: 5, totalInstallments: 9, amountCents: 5994, dueDate: '2027-02-10', status: 'PENDING', transactionId: 'tx-card-8', createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' },
      { id: 'inst-2-6', purchaseId: 'inst-p-2', installmentNumber: 6, totalInstallments: 9, amountCents: 5994, dueDate: '2027-03-10', status: 'PENDING', transactionId: 'tx-card-9', createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' },
      { id: 'inst-2-7', purchaseId: 'inst-p-2', installmentNumber: 7, totalInstallments: 9, amountCents: 5994, dueDate: '2027-04-10', status: 'PENDING', transactionId: 'tx-card-10', createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' },
      { id: 'inst-2-8', purchaseId: 'inst-p-2', installmentNumber: 8, totalInstallments: 9, amountCents: 5994, dueDate: '2027-05-10', status: 'PENDING', transactionId: 'tx-card-11', createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' },
      { id: 'inst-2-9', purchaseId: 'inst-p-2', installmentNumber: 9, totalInstallments: 9, amountCents: 5994, dueDate: '2027-06-10', status: 'PENDING', transactionId: 'tx-card-12', createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' },
    ],
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  },
  {
    id: 'inst-p-3',
    description: 'Cartão Mercado Pago',
    totalAmountCents: 96956,
    totalInstallments: 2,
    firstDueDate: '2026-10-15',
    categoryId: 'cat-cartao',
    categoryName: 'Cartão de Crédito',
    categoryColor: '#8B5CF6',
    paymentMethod: 'CREDIT',
    notes: 'Faturas Mercado Pago - Outubro e Novembro',
    installments: [
      { id: 'inst-3-1', purchaseId: 'inst-p-3', installmentNumber: 1, totalInstallments: 2, amountCents: 76256, dueDate: '2026-10-15', status: 'PENDING', transactionId: 'tx-card-13', createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' },
      { id: 'inst-3-2', purchaseId: 'inst-p-3', installmentNumber: 2, totalInstallments: 2, amountCents: 20700, dueDate: '2026-11-15', status: 'PENDING', transactionId: 'tx-card-14', createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' },
    ],
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  },
  {
    id: 'inst-p-4',
    description: 'Cartão Joyce',
    totalAmountCents: 143004,
    totalInstallments: 3,
    firstDueDate: '2026-10-15',
    categoryId: 'cat-cartao',
    categoryName: 'Cartão de Crédito',
    categoryColor: '#8B5CF6',
    paymentMethod: 'CREDIT',
    notes: 'Faturas Cartão Joyce - Outubro a Dezembro',
    installments: [
      { id: 'inst-4-1', purchaseId: 'inst-p-4', installmentNumber: 1, totalInstallments: 3, amountCents: 59084, dueDate: '2026-10-15', status: 'PENDING', transactionId: 'tx-card-15', createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' },
      { id: 'inst-4-2', purchaseId: 'inst-p-4', installmentNumber: 2, totalInstallments: 3, amountCents: 58085, dueDate: '2026-11-15', status: 'PENDING', transactionId: 'tx-card-16', createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' },
      { id: 'inst-4-3', purchaseId: 'inst-p-4', installmentNumber: 3, totalInstallments: 3, amountCents: 25835, dueDate: '2026-12-15', status: 'PENDING', transactionId: 'tx-card-17', createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' },
    ],
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  },
];

const DEFAULT_WEB_TRANSACTIONS: Transaction[] = [
  // Setembro/2026
  { id: 'tx-sep-1', description: 'Salário Luiz', amountCents: 230000, type: 'INCOME', categoryId: 'cat-salario', categoryName: 'Salário', date: '2026-09-05', paymentDate: '2026-09-05', paymentMethod: 'PIX', status: 'RECEIVED', notes: 'Remuneração mensal Luiz', recurringRuleId: 'rec-1', createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' },
  { id: 'tx-sep-2', description: 'Salário Joyce', amountCents: 193500, type: 'INCOME', categoryId: 'cat-salario', categoryName: 'Salário', date: '2026-09-05', paymentDate: '2026-09-05', paymentMethod: 'PIX', status: 'RECEIVED', notes: 'Remuneração mensal Joyce', recurringRuleId: 'rec-2', createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' },
  { id: 'tx-sep-3', description: 'Combustível', amountCents: 24000, type: 'EXPENSE', categoryId: 'cat-transporte', categoryName: 'Transporte', date: '2026-09-05', paymentDate: '2026-09-05', paymentMethod: 'DEBIT', status: 'PAID', notes: 'Combustível do mês', recurringRuleId: 'rec-10', createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' },
  { id: 'tx-sep-4', description: 'Dízimo (10% + R$ 60)', amountCents: 49750, type: 'EXPENSE', categoryId: 'cat-outras', categoryName: 'Outras Despesas', date: '2026-09-10', paymentDate: '2026-09-10', paymentMethod: 'PIX', status: 'PAID', notes: '10% de R$ 4.375 + R$ 60 fixo', recurringRuleId: 'rec-4', createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' },
  { id: 'tx-sep-5', description: 'Prestação', amountCents: 192825, type: 'EXPENSE', categoryId: 'cat-moradia', categoryName: 'Moradia', date: '2026-09-10', paymentDate: '2026-09-10', paymentMethod: 'BOLETO', status: 'PAID', notes: 'Prestação habitacional', recurringRuleId: 'rec-5', createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' },
  { id: 'tx-sep-6', description: 'Débito CAP', amountCents: 8000, type: 'EXPENSE', categoryId: 'cat-outras', categoryName: 'Outras Despesas', date: '2026-09-10', paymentDate: '2026-09-10', paymentMethod: 'DEBIT', status: 'PAID', notes: 'Débito CAP', recurringRuleId: 'rec-6', createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' },
  { id: 'tx-sep-7', description: 'Rendimentos', amountCents: 14000, type: 'INCOME', categoryId: 'cat-investimentos', categoryName: 'Investimentos', date: '2026-09-15', paymentDate: null, paymentMethod: 'PIX', status: 'PENDING', notes: 'Rendimentos e dividendos', recurringRuleId: 'rec-3', createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' },
  { id: 'tx-sep-8', description: 'Internet', amountCents: 9990, type: 'EXPENSE', categoryId: 'cat-assinaturas', categoryName: 'Assinaturas', date: '2026-09-15', paymentDate: null, paymentMethod: 'BOLETO', status: 'PENDING', notes: 'Internet residencial', recurringRuleId: 'rec-7', createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' },
  { id: 'tx-sep-9', description: 'Água', amountCents: 5000, type: 'EXPENSE', categoryId: 'cat-moradia', categoryName: 'Moradia', date: '2026-09-20', paymentDate: null, paymentMethod: 'BOLETO', status: 'PENDING', notes: 'Conta de água', recurringRuleId: 'rec-8', createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' },
  { id: 'tx-sep-10', description: 'Energia', amountCents: 16000, type: 'EXPENSE', categoryId: 'cat-moradia', categoryName: 'Moradia', date: '2026-09-20', paymentDate: null, paymentMethod: 'BOLETO', status: 'PENDING', notes: 'Conta de energia', recurringRuleId: 'rec-9', createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' },

  // Cartão Nu PJ
  { id: 'tx-card-1', description: 'Cartão Nu PJ (1/3)', amountCents: 53579, type: 'EXPENSE', categoryId: 'cat-cartao', categoryName: 'Cartão de Crédito', date: '2026-10-10', paymentDate: null, paymentMethod: 'CREDIT', status: 'PENDING', notes: 'Fatura Outubro', installmentId: 'inst-1-1', createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' },
  { id: 'tx-card-2', description: 'Cartão Nu PJ (2/3)', amountCents: 53579, type: 'EXPENSE', categoryId: 'cat-cartao', categoryName: 'Cartão de Crédito', date: '2026-11-10', paymentDate: null, paymentMethod: 'CREDIT', status: 'PENDING', notes: 'Fatura Novembro', installmentId: 'inst-1-2', createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' },
  { id: 'tx-card-3', description: 'Cartão Nu PJ (3/3)', amountCents: 53579, type: 'EXPENSE', categoryId: 'cat-cartao', categoryName: 'Cartão de Crédito', date: '2026-12-10', paymentDate: null, paymentMethod: 'CREDIT', status: 'PENDING', notes: 'Fatura Dezembro', installmentId: 'inst-1-3', createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' },

  // Cartão Nu CPF
  { id: 'tx-card-4', description: 'Cartão Nu CPF (1/9)', amountCents: 22080, type: 'EXPENSE', categoryId: 'cat-cartao', categoryName: 'Cartão de Crédito', date: '2026-10-10', paymentDate: null, paymentMethod: 'CREDIT', status: 'PENDING', notes: 'Fatura Outubro', installmentId: 'inst-2-1', createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' },
  { id: 'tx-card-5', description: 'Cartão Nu CPF (2/9)', amountCents: 19494, type: 'EXPENSE', categoryId: 'cat-cartao', categoryName: 'Cartão de Crédito', date: '2026-11-10', paymentDate: null, paymentMethod: 'CREDIT', status: 'PENDING', notes: 'Fatura Novembro', installmentId: 'inst-2-2', createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' },
  { id: 'tx-card-6', description: 'Cartão Nu CPF (3/9)', amountCents: 5994, type: 'EXPENSE', categoryId: 'cat-cartao', categoryName: 'Cartão de Crédito', date: '2026-12-10', paymentDate: null, paymentMethod: 'CREDIT', status: 'PENDING', notes: 'Parcela Dezembro', installmentId: 'inst-2-3', createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' },
  { id: 'tx-card-7', description: 'Cartão Nu CPF (4/9)', amountCents: 5994, type: 'EXPENSE', categoryId: 'cat-cartao', categoryName: 'Cartão de Crédito', date: '2027-01-10', paymentDate: null, paymentMethod: 'CREDIT', status: 'PENDING', notes: 'Parcela Janeiro', installmentId: 'inst-2-4', createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' },
  { id: 'tx-card-8', description: 'Cartão Nu CPF (5/9)', amountCents: 5994, type: 'EXPENSE', categoryId: 'cat-cartao', categoryName: 'Cartão de Crédito', date: '2027-02-10', paymentDate: null, paymentMethod: 'CREDIT', status: 'PENDING', notes: 'Parcela Fevereiro', installmentId: 'inst-2-5', createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' },
  { id: 'tx-card-9', description: 'Cartão Nu CPF (6/9)', amountCents: 5994, type: 'EXPENSE', categoryId: 'cat-cartao', categoryName: 'Cartão de Crédito', date: '2027-03-10', paymentDate: null, paymentMethod: 'CREDIT', status: 'PENDING', notes: 'Parcela Março', installmentId: 'inst-2-6', createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' },
  { id: 'tx-card-10', description: 'Cartão Nu CPF (7/9)', amountCents: 5994, type: 'EXPENSE', categoryId: 'cat-cartao', categoryName: 'Cartão de Crédito', date: '2027-04-10', paymentDate: null, paymentMethod: 'CREDIT', status: 'PENDING', notes: 'Parcela Abril', installmentId: 'inst-2-7', createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' },
  { id: 'tx-card-11', description: 'Cartão Nu CPF (8/9)', amountCents: 5994, type: 'EXPENSE', categoryId: 'cat-cartao', categoryName: 'Cartão de Crédito', date: '2027-05-10', paymentDate: null, paymentMethod: 'CREDIT', status: 'PENDING', notes: 'Parcela Maio', installmentId: 'inst-2-8', createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' },
  { id: 'tx-card-12', description: 'Cartão Nu CPF (9/9)', amountCents: 5994, type: 'EXPENSE', categoryId: 'cat-cartao', categoryName: 'Cartão de Crédito', date: '2027-06-10', paymentDate: null, paymentMethod: 'CREDIT', status: 'PENDING', notes: 'Parcela Junho', installmentId: 'inst-2-9', createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' },

  // Cartão Mercado Pago
  { id: 'tx-card-13', description: 'Cartão Mercado Pago (1/2)', amountCents: 76256, type: 'EXPENSE', categoryId: 'cat-cartao', categoryName: 'Cartão de Crédito', date: '2026-10-15', paymentDate: null, paymentMethod: 'CREDIT', status: 'PENDING', notes: 'Fatura Outubro', installmentId: 'inst-3-1', createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' },
  { id: 'tx-card-14', description: 'Cartão Mercado Pago (2/2)', amountCents: 20700, type: 'EXPENSE', categoryId: 'cat-cartao', categoryName: 'Cartão de Crédito', date: '2026-11-15', paymentDate: null, paymentMethod: 'CREDIT', status: 'PENDING', notes: 'Fatura Novembro', installmentId: 'inst-3-2', createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' },

  // Cartão Joyce
  { id: 'tx-card-15', description: 'Cartão Joyce (1/3)', amountCents: 59084, type: 'EXPENSE', categoryId: 'cat-cartao', categoryName: 'Cartão de Crédito', date: '2026-10-15', paymentDate: null, paymentMethod: 'CREDIT', status: 'PENDING', notes: 'Fatura Outubro', installmentId: 'inst-4-1', createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' },
  { id: 'tx-card-16', description: 'Cartão Joyce (2/3)', amountCents: 58085, type: 'EXPENSE', categoryId: 'cat-cartao', categoryName: 'Cartão de Crédito', date: '2026-11-15', paymentDate: null, paymentMethod: 'CREDIT', status: 'PENDING', notes: 'Fatura Novembro', installmentId: 'inst-4-2', createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' },
  { id: 'tx-card-17', description: 'Cartão Joyce (3/3)', amountCents: 25835, type: 'EXPENSE', categoryId: 'cat-cartao', categoryName: 'Cartão de Crédito', date: '2026-12-15', paymentDate: null, paymentMethod: 'CREDIT', status: 'PENDING', notes: 'Fatura Dezembro', installmentId: 'inst-4-3', createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' },
];

/**
 * Cliente de API da Interface.
 * Se estiver rodando dentro do Electron, delega para `window.api` (IPC seguro).
 * Se estiver rodando no navegador ou web preview, utiliza adaptador local com persistência no localStorage.
 */
class ApiClient implements IElectronAPI {
  private get hasElectron(): boolean {
    return typeof window !== 'undefined' && Boolean(window.api);
  }

  async listCategories(type?: TransactionType): Promise<Category[]> {
    if (this.hasElectron) return window.api!.listCategories(type);
    const stored = localStorage.getItem('fp_categories');
    let cats: Category[] = stored ? JSON.parse(stored) : [];
    if (cats.length === 0) {
      cats = DEFAULT_WEB_CATEGORIES;
      localStorage.setItem('fp_categories', JSON.stringify(cats));
    }
    return type ? cats.filter((c) => c.type === type) : cats;
  }

  async createCategory(dto: CreateCategoryDTO): Promise<Category> {
    if (this.hasElectron) return window.api!.createCategory(dto);
    const cats = await this.listCategories();
    const newCat: Category = {
      id: String(Date.now()),
      name: dto.name,
      type: dto.type,
      description: dto.description || null,
      color: dto.color || null,
      icon: dto.icon || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    cats.push(newCat);
    localStorage.setItem('fp_categories', JSON.stringify(cats));
    return newCat;
  }

  async updateCategory(id: string, dto: UpdateCategoryDTO): Promise<Category> {
    if (this.hasElectron) return window.api!.updateCategory(id, dto);
    const cats = await this.listCategories();
    const idx = cats.findIndex((c) => c.id === id);
    if (idx === -1) throw new Error('Categoria não encontrada');
    cats[idx] = { ...cats[idx], ...dto, updatedAt: new Date().toISOString() };
    localStorage.setItem('fp_categories', JSON.stringify(cats));
    return cats[idx];
  }

  async deleteCategory(id: string): Promise<boolean> {
    if (this.hasElectron) return window.api!.deleteCategory(id);
    const cats = await this.listCategories();
    const filtered = cats.filter((c) => c.id !== id);
    localStorage.setItem('fp_categories', JSON.stringify(filtered));
    return true;
  }

  async listTransactions(filters?: TransactionFilters & { yearMonth?: string }): Promise<Transaction[]> {
    if (this.hasElectron) return window.api!.listTransactions(filters);
    const stored = localStorage.getItem('fp_transactions');
    let txs: Transaction[] = stored ? JSON.parse(stored) : [];
    if (txs.length === 0) {
      txs = DEFAULT_WEB_TRANSACTIONS;
      localStorage.setItem('fp_transactions', JSON.stringify(txs));
    }
    if (filters?.type) txs = txs.filter((t) => t.type === filters.type);
    if (filters?.yearMonth) txs = txs.filter((t) => t.date.startsWith(filters.yearMonth!));
    return txs;
  }

  async createTransaction(dto: CreateTransactionDTO): Promise<Transaction> {
    if (this.hasElectron) return window.api!.createTransaction(dto);
    const txs = await this.listTransactions();
    const newTx: Transaction = {
      id: String(Date.now()),
      description: dto.description,
      amountCents: dto.amountCents,
      type: dto.type,
      categoryId: dto.categoryId,
      date: dto.date,
      paymentDate: dto.paymentDate,
      paymentMethod: dto.paymentMethod,
      status: dto.status || (dto.type === 'INCOME' ? 'RECEIVED' : 'PAID'),
      notes: dto.notes,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    txs.unshift(newTx);
    localStorage.setItem('fp_transactions', JSON.stringify(txs));
    return newTx;
  }

  async updateTransaction(id: string, dto: UpdateTransactionDTO): Promise<Transaction> {
    if (this.hasElectron) return window.api!.updateTransaction(id, dto);
    const txs = await this.listTransactions();
    const idx = txs.findIndex((t) => t.id === id);
    if (idx === -1) throw new Error('Transação não encontrada');
    txs[idx] = { ...txs[idx], ...dto, updatedAt: new Date().toISOString() };
    localStorage.setItem('fp_transactions', JSON.stringify(txs));
    return txs[idx];
  }

  async deleteTransaction(id: string): Promise<boolean> {
    if (this.hasElectron) return window.api!.deleteTransaction(id);
    const txs = await this.listTransactions();
    const filtered = txs.filter((t) => t.id !== id);
    localStorage.setItem('fp_transactions', JSON.stringify(filtered));
    return true;
  }

  async markTransactionPaid(id: string, paymentDate?: string): Promise<Transaction> {
    if (this.hasElectron) return window.api!.markTransactionPaid(id, paymentDate);
    const txs = await this.listTransactions();
    const target = txs.find((t) => t.id === id);
    if (!target) throw new Error('Transação não encontrada');
    target.status = target.type === 'INCOME' ? 'RECEIVED' : 'PAID';
    target.paymentDate = paymentDate || DateUtils.today();
    localStorage.setItem('fp_transactions', JSON.stringify(txs));
    return target;
  }

  async markTransactionUnpaid(id: string): Promise<Transaction> {
    if (this.hasElectron) return window.api!.markTransactionUnpaid(id);
    const stored = localStorage.getItem('fp_transactions');
    const txs: Transaction[] = stored ? JSON.parse(stored) : [];
    const target = txs.find((t) => t.id === id);
    if (!target) throw new Error('Transação não encontrada');
    target.status = target.date < DateUtils.today() ? 'OVERDUE' : 'PENDING';
    target.paymentDate = null;
    target.updatedAt = new Date().toISOString();
    localStorage.setItem('fp_transactions', JSON.stringify(txs));
    return target;
  }

  async listRecurringRules(activeOnly?: boolean): Promise<RecurringRule[]> {
    if (this.hasElectron) return window.api!.listRecurringRules(activeOnly);
    const stored = localStorage.getItem('fp_recurring');
    let rules: RecurringRule[] = stored ? JSON.parse(stored) : [];
    if (rules.length === 0) {
      rules = DEFAULT_WEB_RECURRING;
      localStorage.setItem('fp_recurring', JSON.stringify(rules));
    }
    return activeOnly ? rules.filter((r) => r.isActive) : rules;
  }

  async createRecurringRule(dto: CreateRecurringRuleDTO): Promise<RecurringRule> {
    if (this.hasElectron) return window.api!.createRecurringRule(dto);
    const rules = await this.listRecurringRules();
    const newRule: RecurringRule = {
      id: String(Date.now()),
      description: dto.description,
      amountCents: dto.amountCents,
      type: dto.type,
      categoryId: dto.categoryId,
      frequency: dto.frequency,
      dueDay: dto.dueDay,
      startDate: dto.startDate,
      endDate: dto.endDate,
      paymentMethod: dto.paymentMethod,
      isActive: dto.isActive !== undefined ? dto.isActive : true,
      notes: dto.notes,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    rules.push(newRule);
    localStorage.setItem('fp_recurring', JSON.stringify(rules));
    return newRule;
  }

  async updateRecurringRule(id: string, dto: UpdateRecurringRuleDTO): Promise<RecurringRule> {
    if (this.hasElectron) return window.api!.updateRecurringRule(id, dto);
    const rules = await this.listRecurringRules();
    const idx = rules.findIndex((r) => r.id === id);
    if (idx === -1) throw new Error('Regra não encontrada');
    rules[idx] = { ...rules[idx], ...dto, updatedAt: new Date().toISOString() };
    localStorage.setItem('fp_recurring', JSON.stringify(rules));
    return rules[idx];
  }

  async deleteRecurringRule(id: string): Promise<boolean> {
    if (this.hasElectron) return window.api!.deleteRecurringRule(id);
    const rules = await this.listRecurringRules();
    const filtered = rules.filter((r) => r.id !== id);
    localStorage.setItem('fp_recurring', JSON.stringify(filtered));
    return true;
  }

  async listInstallmentPurchases(): Promise<InstallmentPurchase[]> {
    if (this.hasElectron) return window.api!.listInstallmentPurchases();
    const stored = localStorage.getItem('fp_installments');
    let purchases: InstallmentPurchase[] = stored ? JSON.parse(stored) : [];
    if (purchases.length === 0) {
      purchases = DEFAULT_WEB_INSTALLMENTS;
      localStorage.setItem('fp_installments', JSON.stringify(purchases));
    }
    return purchases;
  }

  async getCardSummaries(): Promise<CardSummary[]> {
    if (this.hasElectron) return window.api!.getCardSummaries();
    const purchases = await this.listInstallmentPurchases();
    // No modo web as compras de exemplo usam o nome do cartão como descrição
    const withCards = purchases.map((p) => ({ ...p, cardName: p.cardName ?? p.description }));
    return new GetCardSummariesUseCase({ list: () => withCards } as any).execute();
  }

  async createInstallmentPurchase(dto: CreateInstallmentPurchaseDTO): Promise<InstallmentPurchase> {
    if (this.hasElectron) return window.api!.createInstallmentPurchase(dto);
    const purchases = await this.listInstallmentPurchases();
    const newPurchase: InstallmentPurchase = {
      id: String(Date.now()),
      description: dto.description,
      totalAmountCents: dto.totalAmountCents,
      totalInstallments: dto.totalInstallments,
      firstDueDate: dto.firstDueDate,
      categoryId: dto.categoryId,
      paymentMethod: dto.paymentMethod || 'CREDIT',
      cardName: dto.cardName,
      notes: dto.notes,
      installments: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    purchases.unshift(newPurchase);
    localStorage.setItem('fp_installments', JSON.stringify(purchases));
    return newPurchase;
  }

  async payInstallment(id: string, paymentDate?: string): Promise<Installment> {
    if (this.hasElectron) return window.api!.payInstallment(id, paymentDate);
    const purchases = await this.listInstallmentPurchases();
    let foundInst: Installment | null = null;
    for (const p of purchases) {
      const inst = p.installments?.find((i) => i.id === id);
      if (inst) {
        inst.status = 'PAID';
        inst.paymentDate = paymentDate || DateUtils.today();
        foundInst = inst;
        break;
      }
    }
    if (!foundInst) throw new Error('Parcela não encontrada');
    localStorage.setItem('fp_installments', JSON.stringify(purchases));
    return foundInst;
  }

  async unpayInstallment(id: string): Promise<Installment> {
    if (this.hasElectron) return window.api!.unpayInstallment(id);
    const purchases = await this.listInstallmentPurchases();
    let foundInst: Installment | null = null;
    for (const p of purchases) {
      const inst = p.installments?.find((i) => i.id === id);
      if (inst) {
        inst.status = inst.dueDate < DateUtils.today() ? 'OVERDUE' : 'PENDING';
        inst.paymentDate = null;
        foundInst = inst;
        break;
      }
    }
    if (!foundInst) throw new Error('Parcela não encontrada');
    localStorage.setItem('fp_installments', JSON.stringify(purchases));
    return foundInst;
  }

  async updateInstallment(id: string, dto: UpdateInstallmentDTO): Promise<Installment> {
    if (this.hasElectron) return window.api!.updateInstallment(id, dto);
    const purchases = await this.listInstallmentPurchases();
    let foundInst: Installment | null = null;
    for (const p of purchases) {
      const inst = p.installments?.find((i) => i.id === id);
      if (inst) {
        if (dto.amountCents !== undefined) inst.amountCents = dto.amountCents;
        if (dto.dueDate !== undefined) inst.dueDate = dto.dueDate;
        if (dto.paymentDate !== undefined) inst.paymentDate = dto.paymentDate;
        if (dto.status !== undefined) inst.status = dto.status;
        foundInst = inst;
        break;
      }
    }
    if (!foundInst) throw new Error('Parcela não encontrada');
    localStorage.setItem('fp_installments', JSON.stringify(purchases));
    return foundInst;
  }

  async deleteInstallmentPurchase(id: string): Promise<boolean> {
    if (this.hasElectron) return window.api!.deleteInstallmentPurchase(id);
    const purchases = await this.listInstallmentPurchases();
    const filtered = purchases.filter((p) => p.id !== id);
    localStorage.setItem('fp_installments', JSON.stringify(filtered));
    return true;
  }

  async getDashboardMetrics(yearMonth?: string): Promise<DashboardMetrics> {
    if (this.hasElectron) return window.api!.getDashboardMetrics(yearMonth);
    const ym = yearMonth || DateUtils.currentYearMonth();
    return {
      selectedYearMonth: ym,
      currentBalanceCents: 148925,
      monthIncomeCents: 437500,
      monthExpenseCents: 305565,
      expectedIncomeCents: 14000,
      pendingExpenseCents: 30990,
      paidExpenseCents: 274575,
      monthProjectedBalanceCents: 131935,
      fixedExpensesCents: 305565,
      installmentExpensesCents: 0,
      expensesByCategory: [
        { categoryId: 'cat-moradia', categoryName: 'Moradia', categoryColor: '#F97316', totalCents: 213825, percentage: 70 },
        { categoryId: 'cat-outras', categoryName: 'Outras Despesas', categoryColor: '#6B7280', totalCents: 57750, percentage: 19 },
        { categoryId: 'cat-transporte', categoryName: 'Transporte', categoryColor: '#F59E0B', totalCents: 24000, percentage: 8 },
        { categoryId: 'cat-assinaturas', categoryName: 'Assinaturas', categoryColor: '#EC4899', totalCents: 9990, percentage: 3 },
      ],
      monthlyHistory: [
        { yearMonth: '2026-06', monthName: 'Jun/26', incomeCents: 437500, expenseCents: 305565 },
        { yearMonth: '2026-07', monthName: 'Jul/26', incomeCents: 437500, expenseCents: 305565 },
        { yearMonth: '2026-08', monthName: 'Ago/26', incomeCents: 437500, expenseCents: 305565 },
        { yearMonth: '2026-09', monthName: 'Set/26', incomeCents: 437500, expenseCents: 305565 },
        { yearMonth: '2026-10', monthName: 'Out/26', incomeCents: 437500, expenseCents: 516564 },
        { yearMonth: '2026-11', monthName: 'Nov/26', incomeCents: 437500, expenseCents: 457423 },
      ],
      forecast: {
        startYearMonth: ym,
        totalMonths: 6,
        initialBalanceCents: 148925,
        months: [
          { yearMonth: '2026-09', monthName: 'Setembro/2026', incomeCents: 437500, expenseCents: 305565, projectedBalanceCents: 131935, accumulatedBalanceCents: 131935, commitmentPercentage: 70, isHighCommitment: false, breakdown: { fixedExpensesCents: 305565, installmentExpensesCents: 0, variableExpensesCents: 0, recurringIncomesCents: 437500, variableIncomesCents: 0 } },
          { yearMonth: '2026-10', monthName: 'Outubro/2026', incomeCents: 437500, expenseCents: 516564, projectedBalanceCents: -79064, accumulatedBalanceCents: 52871, commitmentPercentage: 118, isHighCommitment: true, breakdown: { fixedExpensesCents: 305565, installmentExpensesCents: 210999, variableExpensesCents: 0, recurringIncomesCents: 437500, variableIncomesCents: 0 } },
          { yearMonth: '2026-11', monthName: 'Novembro/2026', incomeCents: 437500, expenseCents: 457423, projectedBalanceCents: -19923, accumulatedBalanceCents: 32948, commitmentPercentage: 105, isHighCommitment: true, breakdown: { fixedExpensesCents: 305565, installmentExpensesCents: 151858, variableExpensesCents: 0, recurringIncomesCents: 437500, variableIncomesCents: 0 } },
          { yearMonth: '2026-12', monthName: 'Dezembro/2026', incomeCents: 437500, expenseCents: 390973, projectedBalanceCents: 46527, accumulatedBalanceCents: 79475, commitmentPercentage: 89, isHighCommitment: true, breakdown: { fixedExpensesCents: 305565, installmentExpensesCents: 85408, variableExpensesCents: 0, recurringIncomesCents: 437500, variableIncomesCents: 0 } },
          { yearMonth: '2027-01', monthName: 'Janeiro/2027', incomeCents: 437500, expenseCents: 311559, projectedBalanceCents: 125941, accumulatedBalanceCents: 205416, commitmentPercentage: 71, isHighCommitment: false, breakdown: { fixedExpensesCents: 305565, installmentExpensesCents: 5994, variableExpensesCents: 0, recurringIncomesCents: 437500, variableIncomesCents: 0 } },
          { yearMonth: '2027-02', monthName: 'Fevereiro/2027', incomeCents: 437500, expenseCents: 311559, projectedBalanceCents: 125941, accumulatedBalanceCents: 331357, commitmentPercentage: 71, isHighCommitment: false, breakdown: { fixedExpensesCents: 305565, installmentExpensesCents: 5994, variableExpensesCents: 0, recurringIncomesCents: 437500, variableIncomesCents: 0 } },
        ],
      },
      alerts: {
        commitmentLevel: 'HEALTHY',
        commitmentPercentage: 70,
        totalIncomeCents: 437500,
        totalProjectedExpenseCents: 305565,
        remainingBalanceCents: 131935,
        dailyAvailableBudgetCents: 8246,
        daysRemainingInMonth: 16,
        hasDeficit: false,
        deficitCents: 0,
        reminders: [
          {
            id: 'rem-rendimentos-1',
            transactionId: 'tx-sep-7',
            type: 'UNRECEIVED_INCOME',
            title: 'Rendimentos',
            amountCents: 14000,
            dueDate: `${ym}-15`,
            isCritical: false,
            daysDiff: 1,
          },
          {
            id: 'rem-internet-1',
            transactionId: 'tx-sep-8',
            type: 'UPCOMING_EXPENSE',
            title: 'Internet',
            amountCents: 9990,
            dueDate: `${ym}-15`,
            isCritical: false,
            daysDiff: 1,
          },
          {
            id: 'rem-agua-1',
            transactionId: 'tx-sep-9',
            type: 'UPCOMING_EXPENSE',
            title: 'Água',
            amountCents: 5000,
            dueDate: `${ym}-20`,
            isCritical: false,
            daysDiff: 6,
          },
          {
            id: 'rem-energia-1',
            transactionId: 'tx-sep-10',
            type: 'UPCOMING_EXPENSE',
            title: 'Energia',
            amountCents: 16000,
            dueDate: `${ym}-20`,
            isCritical: false,
            daysDiff: 6,
          },
        ],
        hasCriticalAlert: false,
      },
    };
  }

  async getCalendarData(yearMonth?: string): Promise<CalendarMonthData> {
    if (this.hasElectron) return window.api!.getCalendarData(yearMonth);
    const ym = yearMonth || DateUtils.currentYearMonth();
    return {
      yearMonth: ym,
      year: 2026,
      month: 9,
      firstDayOfWeek: 2,
      daysInMonth: 30,
      days: [],
      totalIncomeMonthCents: 437500,
      totalExpenseMonthCents: 305565,
    };
  }

  async getReports(year?: number): Promise<FinancialReportsResult> {
    if (this.hasElectron) return window.api!.getReports(year);
    const y = year || 2026;
    return {
      period: String(y),
      totalIncomeCents: 5250000,
      totalExpenseCents: 4212727,
      netSavingsCents: 1037273,
      savingsRatePercentage: 20,
      expensesByCategory: [
        { categoryId: 'cat-moradia', categoryName: 'Moradia', categoryColor: '#F97316', totalCents: 2565900, percentage: 61 },
        { categoryId: 'cat-cartao', categoryName: 'Cartão de Crédito', categoryColor: '#8B5CF6', totalCents: 484229, percentage: 12 },
        { categoryId: 'cat-outras', categoryName: 'Outras Despesas', categoryColor: '#6B7280', totalCents: 693000, percentage: 16 },
        { categoryId: 'cat-transporte', categoryName: 'Transporte', categoryColor: '#F59E0B', totalCents: 288000, percentage: 7 },
        { categoryId: 'cat-assinaturas', categoryName: 'Assinaturas', categoryColor: '#EC4899', totalCents: 119880, percentage: 3 },
      ],
      incomesByCategory: [
        { categoryId: 'cat-salario', categoryName: 'Salário', categoryColor: '#10B981', totalCents: 5082000, percentage: 97 },
        { categoryId: 'cat-investimentos', categoryName: 'Investimentos', categoryColor: '#84CC16', totalCents: 168000, percentage: 3 },
      ],
      monthlyCashFlow: [
        { yearMonth: '2026-09', monthName: 'Set/26', incomeCents: 437500, expenseCents: 305565 },
        { yearMonth: '2026-10', monthName: 'Out/26', incomeCents: 437500, expenseCents: 516564 },
        { yearMonth: '2026-11', monthName: 'Nov/26', incomeCents: 437500, expenseCents: 457423 },
        { yearMonth: '2026-12', monthName: 'Dez/26', incomeCents: 437500, expenseCents: 390973 },
      ],
      activeFixedExpenses: [
        { ruleId: 'rec-4', description: 'Dízimo (10% + R$ 60)', amountCents: 49750, frequency: 'MONTHLY', dueDay: 10, categoryName: 'Outras Despesas', paymentMethod: 'PIX' },
        { ruleId: 'rec-5', description: 'Prestação', amountCents: 192825, frequency: 'MONTHLY', dueDay: 10, categoryName: 'Moradia', paymentMethod: 'BOLETO' },
        { ruleId: 'rec-6', description: 'Débito CAP', amountCents: 8000, frequency: 'MONTHLY', dueDay: 10, categoryName: 'Outras Despesas', paymentMethod: 'DEBIT' },
        { ruleId: 'rec-7', description: 'Internet', amountCents: 9990, frequency: 'MONTHLY', dueDay: 15, categoryName: 'Assinaturas', paymentMethod: 'BOLETO' },
        { ruleId: 'rec-8', description: 'Água', amountCents: 5000, frequency: 'MONTHLY', dueDay: 20, categoryName: 'Moradia', paymentMethod: 'BOLETO' },
        { ruleId: 'rec-9', description: 'Energia', amountCents: 16000, frequency: 'MONTHLY', dueDay: 20, categoryName: 'Moradia', paymentMethod: 'BOLETO' },
        { ruleId: 'rec-10', description: 'Combustível', amountCents: 24000, frequency: 'MONTHLY', dueDay: 5, categoryName: 'Transporte', paymentMethod: 'DEBIT' },
      ],
      activeInstallments: [
        { purchaseId: 'inst-p-1', description: 'Cartão Nu PJ', totalAmountCents: 160737, totalInstallments: 3, remainingInstallments: 3, remainingAmountCents: 160737, nextDueDate: '2026-10-10', categoryName: 'Cartão de Crédito' },
        { purchaseId: 'inst-p-2', description: 'Cartão Nu CPF', totalAmountCents: 83532, totalInstallments: 9, remainingInstallments: 9, remainingAmountCents: 83532, nextDueDate: '2026-10-10', categoryName: 'Cartão de Crédito' },
        { purchaseId: 'inst-p-3', description: 'Cartão Mercado Pago', totalAmountCents: 96956, totalInstallments: 2, remainingInstallments: 2, remainingAmountCents: 96956, nextDueDate: '2026-10-15', categoryName: 'Cartão de Crédito' },
        { purchaseId: 'inst-p-4', description: 'Cartão Joyce', totalAmountCents: 143004, totalInstallments: 3, remainingInstallments: 3, remainingAmountCents: 143004, nextDueDate: '2026-10-15', categoryName: 'Cartão de Crédito' },
      ],
      totalFutureInstallmentsCents: 484229,
      forecast: await this.getForecast(),
    };
  }

  async getForecast(startYearMonth?: string, count?: number): Promise<ForecastResult> {
    if (this.hasElectron) return window.api!.getForecast(startYearMonth, count);
    const ym = startYearMonth || DateUtils.currentYearMonth();
    return {
      startYearMonth: ym,
      totalMonths: count || 6,
      initialBalanceCents: 148925,
      months: [
        { yearMonth: '2026-09', monthName: 'Setembro/2026', incomeCents: 437500, expenseCents: 305565, projectedBalanceCents: 131935, accumulatedBalanceCents: 131935, commitmentPercentage: 70, isHighCommitment: false, breakdown: { fixedExpensesCents: 305565, installmentExpensesCents: 0, variableExpensesCents: 0, recurringIncomesCents: 437500, variableIncomesCents: 0 } },
        { yearMonth: '2026-10', monthName: 'Outubro/2026', incomeCents: 437500, expenseCents: 516564, projectedBalanceCents: -79064, accumulatedBalanceCents: 52871, commitmentPercentage: 118, isHighCommitment: true, breakdown: { fixedExpensesCents: 305565, installmentExpensesCents: 210999, variableExpensesCents: 0, recurringIncomesCents: 437500, variableIncomesCents: 0 } },
        { yearMonth: '2026-11', monthName: 'Novembro/2026', incomeCents: 437500, expenseCents: 457423, projectedBalanceCents: -19923, accumulatedBalanceCents: 32948, commitmentPercentage: 105, isHighCommitment: true, breakdown: { fixedExpensesCents: 305565, installmentExpensesCents: 151858, variableExpensesCents: 0, recurringIncomesCents: 437500, variableIncomesCents: 0 } },
        { yearMonth: '2026-12', monthName: 'Dezembro/2026', incomeCents: 437500, expenseCents: 390973, projectedBalanceCents: 46527, accumulatedBalanceCents: 79475, commitmentPercentage: 89, isHighCommitment: true, breakdown: { fixedExpensesCents: 305565, installmentExpensesCents: 85408, variableExpensesCents: 0, recurringIncomesCents: 437500, variableIncomesCents: 0 } },
        { yearMonth: '2027-01', monthName: 'Janeiro/2027', incomeCents: 437500, expenseCents: 311559, projectedBalanceCents: 125941, accumulatedBalanceCents: 205416, commitmentPercentage: 71, isHighCommitment: false, breakdown: { fixedExpensesCents: 305565, installmentExpensesCents: 5994, variableExpensesCents: 0, recurringIncomesCents: 437500, variableIncomesCents: 0 } },
        { yearMonth: '2027-02', monthName: 'Fevereiro/2027', incomeCents: 437500, expenseCents: 311559, projectedBalanceCents: 125941, accumulatedBalanceCents: 331357, commitmentPercentage: 71, isHighCommitment: false, breakdown: { fixedExpensesCents: 305565, installmentExpensesCents: 5994, variableExpensesCents: 0, recurringIncomesCents: 437500, variableIncomesCents: 0 } },
      ],
    };
  }

  async exportBackupJSON(): Promise<string> {
    if (this.hasElectron) return window.api!.exportBackupJSON();
    return JSON.stringify({ version: '1.0.0', backup: 'preview' });
  }

  async importBackupJSON(jsonContent: string): Promise<boolean> {
    if (this.hasElectron) return window.api!.importBackupJSON(jsonContent);
    return true;
  }

  async parseStatement(fileContent: string, fileName?: string): Promise<BankStatementParseResult> {
    if (this.hasElectron) return window.api!.parseStatement(fileContent, fileName);
    const parser = new StatementParserService();
    return parser.parse(fileContent, fileName);
  }

  async reconcilePreview(items: BankStatementItem[]): Promise<ReconciliationPreviewItem[]> {
    if (this.hasElectron) return window.api!.reconcilePreview(items);
    const existingTransactions = await this.listTransactions();
    const categories = await this.listCategories();
    return items.map((item, idx) => {
      const matched = existingTransactions.find(
        (tx) => tx.date === item.date && tx.amountCents === item.amountCents && tx.type === item.type
      );
      const isDuplicate = Boolean(matched);
      let matchedCategory = categories.find(
        (c) => c.type === item.type && c.name.toLowerCase() === (item.suggestedCategory || '').toLowerCase()
      );
      if (!matchedCategory) {
        matchedCategory = categories.find((c) => c.type === item.type) || categories[0];
      }
      return {
        id: `preview-${idx}-${Date.now()}`,
        item,
        isDuplicate,
        duplicateReason: isDuplicate ? `Lançamento idêntico já cadastrado em ${item.date}` : undefined,
        matchedTransactionId: matched?.id,
        categoryId: matchedCategory ? matchedCategory.id : '',
        categoryName: matchedCategory?.name,
        selected: !isDuplicate,
      };
    });
  }

  async reconcileCommit(items: ConfirmedStatementItem[]): Promise<ReconciliationResult> {
    if (this.hasElectron) return window.api!.reconcileCommit(items);
    const txs = await this.listTransactions();
    const created: Transaction[] = [];
    for (const item of items) {
      const newTx: Transaction = {
        id: String(Date.now() + Math.random()),
        description: item.description,
        amountCents: item.amountCents,
        type: item.type,
        categoryId: item.categoryId,
        date: item.date,
        paymentDate: item.date,
        paymentMethod: (item.paymentMethod as any) || 'OTHER',
        status: item.type === 'INCOME' ? 'RECEIVED' : 'PAID',
        notes: item.notes || 'Importado via Extrato Bancário',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      txs.unshift(newTx);
      created.push(newTx);
    }
    localStorage.setItem('fp_transactions', JSON.stringify(txs));
    return {
      importedCount: created.length,
      settledCount: 0,
      skippedCount: 0,
      transactions: created,
    };
  }

  async clearAllData(includeCategories: boolean = false): Promise<boolean> {
    if (this.hasElectron) return window.api!.clearAllData(includeCategories);
    localStorage.removeItem('fp_transactions');
    localStorage.removeItem('fp_recurring');
    localStorage.removeItem('fp_installments');
    if (includeCategories) {
      localStorage.removeItem('fp_categories');
    }
    return true;
  }

  private readInvestments(): Investment[] {
    const stored = localStorage.getItem('fp_investments');
    return stored ? JSON.parse(stored) : [];
  }

  private writeInvestments(list: Investment[]): void {
    localStorage.setItem('fp_investments', JSON.stringify(list));
  }

  async listInvestments(): Promise<Investment[]> {
    if (this.hasElectron) return window.api!.listInvestments();
    return this.readInvestments();
  }

  async createInvestment(dto: CreateInvestmentDTO): Promise<Investment> {
    if (this.hasElectron) return window.api!.createInvestment(dto);
    const now = new Date().toISOString();
    const inv: Investment = {
      id: String(Date.now()),
      name: dto.name.trim(),
      balanceCents: dto.balanceCents,
      monthlyYieldCents: dto.monthlyYieldCents ?? 0,
      monthlyCommitmentCents: dto.monthlyCommitmentCents ?? 0,
      generatesIncome: dto.generatesIncome ?? false,
      incomeDueDay: dto.incomeDueDay ?? 15,
      recurringRuleId: null,
      notes: dto.notes ?? null,
      createdAt: now,
      updatedAt: now,
    };
    this.writeInvestments([...this.readInvestments(), inv]);
    return inv;
  }

  async updateInvestment(id: string, dto: UpdateInvestmentDTO): Promise<Investment> {
    if (this.hasElectron) return window.api!.updateInvestment(id, dto);
    const list = this.readInvestments();
    const idx = list.findIndex((i) => i.id === id);
    if (idx === -1) throw new Error('Investimento não encontrado');
    list[idx] = { ...list[idx], ...dto, updatedAt: new Date().toISOString() } as Investment;
    this.writeInvestments(list);
    return list[idx];
  }

  async deleteInvestment(id: string): Promise<boolean> {
    if (this.hasElectron) return window.api!.deleteInvestment(id);
    this.writeInvestments(this.readInvestments().filter((i) => i.id !== id));
    return true;
  }

  async getReserveSummary(): Promise<ReserveSummary> {
    if (this.hasElectron) return window.api!.getReserveSummary();
    return new GetReserveSummaryUseCase({ list: () => this.readInvestments() } as any).execute();
  }
}

export const api = new ApiClient();
