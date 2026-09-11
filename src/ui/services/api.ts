import { IElectronAPI } from '../types/electron-api.js';
import { Category, CreateCategoryDTO, UpdateCategoryDTO } from '../../core/domain/category.js';
import { Transaction, CreateTransactionDTO, UpdateTransactionDTO, TransactionFilters } from '../../core/domain/transaction.js';
import { RecurringRule, CreateRecurringRuleDTO, UpdateRecurringRuleDTO } from '../../core/domain/recurring-rule.js';
import { InstallmentPurchase, Installment, CreateInstallmentPurchaseDTO, UpdateInstallmentDTO } from '../../core/domain/installment-purchase.js';
import { DashboardMetrics } from '../../core/domain/dashboard.js';
import { CalendarMonthData } from '../../core/domain/calendar.js';
import { FinancialReportsResult } from '../../core/domain/reports.js';
import { ForecastResult } from '../../core/domain/forecast.js';
import { TransactionType } from '../../core/types/common.js';

/**
 * Cliente de API da Interface.
 * Se estiver rodando dentro do Electron, delega para `window.api` (IPC seguro).
 * Se estiver rodando no navegador ou web preview, utiliza adaptador local com mock persistente.
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
      // Seed inicial para preview web
      cats = [
        { id: '1', name: 'Alimentação', type: 'EXPENSE', description: 'Mercado e restaurantes', color: '#EF4444', icon: 'Utensils', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        { id: '2', name: 'Moradia', type: 'EXPENSE', description: 'Aluguel e contas', color: '#F97316', icon: 'Home', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        { id: '3', name: 'Transporte', type: 'EXPENSE', description: 'Uber e combustível', color: '#F59E0B', icon: 'Car', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        { id: '4', name: 'Salário', type: 'INCOME', description: 'Remuneração mensal', color: '#10B981', icon: 'Briefcase', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        { id: '5', name: 'Investimentos', type: 'INCOME', description: 'Dividendos e rendimentos', color: '#84CC16', icon: 'TrendingUp', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      ];
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
    if (filters?.type) txs = txs.filter((t) => t.type === filters.type);
    if (filters?.yearMonth) txs = txs.filter((t) => t.date.startsWith(filters.yearMonth!));
    return txs;
  }

  async createTransaction(dto: CreateTransactionDTO): Promise<Transaction> {
    if (this.hasElectron) return window.api!.createTransaction(dto);
    const stored = localStorage.getItem('fp_transactions');
    const txs: Transaction[] = stored ? JSON.parse(stored) : [];
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
    target.paymentDate = paymentDate || new Date().toISOString().slice(0, 10);
    localStorage.setItem('fp_transactions', JSON.stringify(txs));
    return target;
  }

  async listRecurringRules(activeOnly?: boolean): Promise<RecurringRule[]> {
    if (this.hasElectron) return window.api!.listRecurringRules(activeOnly);
    const stored = localStorage.getItem('fp_recurring');
    const rules: RecurringRule[] = stored ? JSON.parse(stored) : [];
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
    return stored ? JSON.parse(stored) : [];
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
    throw new Error('Disponível no ambiente Desktop');
  }

  async updateInstallment(id: string, dto: UpdateInstallmentDTO): Promise<Installment> {
    if (this.hasElectron) return window.api!.updateInstallment(id, dto);
    throw new Error('Disponível no ambiente Desktop');
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
    const ym = yearMonth || new Date().toISOString().slice(0, 7);
    return {
      selectedYearMonth: ym,
      currentBalanceCents: 540000,
      monthIncomeCents: 600000,
      monthExpenseCents: 210000,
      expectedIncomeCents: 0,
      pendingExpenseCents: 90000,
      paidExpenseCents: 210000,
      monthProjectedBalanceCents: 300000,
      fixedExpensesCents: 150000,
      installmentExpensesCents: 60000,
      expensesByCategory: [
        { categoryId: '1', categoryName: 'Moradia', categoryColor: '#F97316', totalCents: 120000, percentage: 40 },
        { categoryId: '2', categoryName: 'Alimentação', categoryColor: '#EF4444', totalCents: 90000, percentage: 30 },
        { categoryId: '3', categoryName: 'Transporte', categoryColor: '#F59E0B', totalCents: 60000, percentage: 20 },
      ],
      monthlyHistory: [
        { yearMonth: '2026-04', monthName: 'Abr/26', incomeCents: 500000, expenseCents: 320000 },
        { yearMonth: '2026-05', monthName: 'Mai/26', incomeCents: 520000, expenseCents: 310000 },
        { yearMonth: '2026-06', monthName: 'Jun/26', incomeCents: 500000, expenseCents: 340000 },
        { yearMonth: '2026-07', monthName: 'Jul/26', incomeCents: 550000, expenseCents: 300000 },
        { yearMonth: '2026-08', monthName: 'Ago/26', incomeCents: 500000, expenseCents: 290000 },
        { yearMonth: '2026-09', monthName: 'Set/26', incomeCents: 600000, expenseCents: 300000 },
      ],
      forecast: {
        startYearMonth: ym,
        totalMonths: 6,
        initialBalanceCents: 540000,
        months: [
          { yearMonth: '2026-09', monthName: 'Setembro/2026', incomeCents: 600000, expenseCents: 300000, projectedBalanceCents: 300000, accumulatedBalanceCents: 840000, commitmentPercentage: 50, isHighCommitment: false, breakdown: { fixedExpensesCents: 150000, installmentExpensesCents: 60000, variableExpensesCents: 90000, recurringIncomesCents: 500000, variableIncomesCents: 100000 } },
          { yearMonth: '2026-10', monthName: 'Outubro/2026', incomeCents: 500000, expenseCents: 280000, projectedBalanceCents: 220000, accumulatedBalanceCents: 1060000, commitmentPercentage: 56, isHighCommitment: false, breakdown: { fixedExpensesCents: 150000, installmentExpensesCents: 60000, variableExpensesCents: 70000, recurringIncomesCents: 500000, variableIncomesCents: 0 } },
          { yearMonth: '2026-11', monthName: 'Novembro/2026', incomeCents: 500000, expenseCents: 270000, projectedBalanceCents: 230000, accumulatedBalanceCents: 1290000, commitmentPercentage: 54, isHighCommitment: false, breakdown: { fixedExpensesCents: 150000, installmentExpensesCents: 60000, variableExpensesCents: 60000, recurringIncomesCents: 500000, variableIncomesCents: 0 } },
        ],
      },
    };
  }

  async getCalendarData(yearMonth?: string): Promise<CalendarMonthData> {
    if (this.hasElectron) return window.api!.getCalendarData(yearMonth);
    const ym = yearMonth || new Date().toISOString().slice(0, 7);
    return {
      yearMonth: ym,
      year: 2026,
      month: 9,
      firstDayOfWeek: 2,
      daysInMonth: 30,
      days: [],
      totalIncomeMonthCents: 600000,
      totalExpenseMonthCents: 300000,
    };
  }

  async getReports(year?: number): Promise<FinancialReportsResult> {
    if (this.hasElectron) return window.api!.getReports(year);
    const y = year || 2026;
    return {
      period: String(y),
      totalIncomeCents: 6000000,
      totalExpenseCents: 3600000,
      netSavingsCents: 2400000,
      savingsRatePercentage: 40,
      expensesByCategory: [],
      incomesByCategory: [],
      monthlyCashFlow: [],
      activeFixedExpenses: [],
      activeInstallments: [],
      totalFutureInstallmentsCents: 180000,
      forecast: await this.getForecast(),
    };
  }

  async getForecast(startYearMonth?: string, count?: number): Promise<ForecastResult> {
    if (this.hasElectron) return window.api!.getForecast(startYearMonth, count);
    const ym = startYearMonth || new Date().toISOString().slice(0, 7);
    return {
      startYearMonth: ym,
      totalMonths: count || 6,
      initialBalanceCents: 540000,
      months: [],
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
}

export const api = new ApiClient();
