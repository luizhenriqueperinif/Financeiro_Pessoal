import { IElectronAPI } from '../types/electron-api.js';
import { Category, CreateCategoryDTO, UpdateCategoryDTO } from '../../core/domain/category.js';
import { Transaction, CreateTransactionDTO, UpdateTransactionDTO, TransactionFilters } from '../../core/domain/transaction.js';
import { RecurringRule, CreateRecurringRuleDTO, UpdateRecurringRuleDTO } from '../../core/domain/recurring-rule.js';
import { InstallmentPurchase, Installment, CreateInstallmentPurchaseDTO, UpdateInstallmentDTO } from '../../core/domain/installment-purchase.js';
import { DashboardMetrics, CategorySummary, MonthlyHistoryItem } from '../../core/domain/dashboard.js';
import { CalendarMonthData, CalendarDay } from '../../core/domain/calendar.js';
import { FinancialReportsResult, CategoryReportSummary } from '../../core/domain/reports.js';
import { ForecastResult, MonthlyForecastItem } from '../../core/domain/forecast.js';
import { TransactionType } from '../../core/types/common.js';
import { DEFAULT_CATEGORIES } from '../../infra/database/schema.js';
import { Money } from '../../core/value-objects/money.js';
import { DateUtils } from '../../core/utils/date-utils.js';

const MONTH_NAMES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

/**
 * Cliente de API da Interface.
 * Se estiver rodando dentro do Electron, delega para `window.api` (IPC seguro).
 * Se estiver rodando no navegador ou web preview, calcula dinamicamente a partir dos dados locais.
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
      const now = new Date().toISOString();
      cats = DEFAULT_CATEGORIES.map((c, index) => ({
        id: String(index + 1),
        name: c.name,
        type: c.type as TransactionType,
        description: c.description,
        color: c.color,
        icon: c.icon,
        createdAt: now,
        updatedAt: now,
      }));
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

    const today = new Date().toISOString().slice(0, 10);
    // Atualiza status pendente para vencido se aplicável
    txs = txs.map((t) => {
      if (t.status === 'PENDING' && t.date < today) {
        return { ...t, status: 'OVERDUE' as const };
      }
      return t;
    });

    if (filters?.type) txs = txs.filter((t) => t.type === filters.type);
    if (filters?.categoryId) txs = txs.filter((t) => t.categoryId === filters.categoryId);
    if (filters?.status) txs = txs.filter((t) => t.status === filters.status);
    if (filters?.paymentMethod) txs = txs.filter((t) => t.paymentMethod === filters.paymentMethod);
    if (filters?.yearMonth) txs = txs.filter((t) => t.date.startsWith(filters.yearMonth!));
    if (filters?.startDate) txs = txs.filter((t) => t.date >= filters.startDate!);
    if (filters?.endDate) txs = txs.filter((t) => t.date <= filters.endDate!);
    if (filters?.search) {
      const q = filters.search.toLowerCase();
      txs = txs.filter((t) => t.description.toLowerCase().includes(q) || (t.notes && t.notes.toLowerCase().includes(q)));
    }

    return txs.sort((a, b) => b.date.localeCompare(a.date));
  }

  async createTransaction(dto: CreateTransactionDTO): Promise<Transaction> {
    if (this.hasElectron) return window.api!.createTransaction(dto);
    const stored = localStorage.getItem('fp_transactions');
    const txs: Transaction[] = stored ? JSON.parse(stored) : [];
    const cats = await this.listCategories();
    const category = cats.find((c) => c.id === dto.categoryId);

    const today = new Date().toISOString().slice(0, 10);
    let initialStatus = dto.status || (dto.type === 'INCOME' ? 'RECEIVED' : 'PAID');
    if (initialStatus === 'PENDING' && dto.date < today) {
      initialStatus = 'OVERDUE';
    }

    const newTx: Transaction = {
      id: String(Date.now()),
      description: dto.description,
      amountCents: dto.amountCents,
      type: dto.type,
      categoryId: dto.categoryId,
      categoryName: category ? category.name : undefined,
      categoryColor: category ? category.color || undefined : undefined,
      categoryIcon: category ? category.icon || undefined : undefined,
      date: dto.date,
      paymentDate: dto.paymentDate,
      paymentMethod: dto.paymentMethod,
      status: initialStatus,
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

    const cats = await this.listCategories();
    const catId = dto.categoryId || txs[idx].categoryId;
    const category = cats.find((c) => c.id === catId);

    txs[idx] = {
      ...txs[idx],
      ...dto,
      categoryName: category ? category.name : txs[idx].categoryName,
      categoryColor: category ? category.color || undefined : txs[idx].categoryColor,
      categoryIcon: category ? category.icon || undefined : txs[idx].categoryIcon,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem('fp_transactions', JSON.stringify(txs));
    return txs[idx];
  }

  async deleteTransaction(id: string): Promise<boolean> {
    if (this.hasElectron) return window.api!.deleteTransaction(id);
    const stored = localStorage.getItem('fp_transactions');
    const txs: Transaction[] = stored ? JSON.parse(stored) : [];
    const filtered = txs.filter((t) => t.id !== id);
    localStorage.setItem('fp_transactions', JSON.stringify(filtered));
    return true;
  }

  async markTransactionPaid(id: string, paymentDate?: string): Promise<Transaction> {
    if (this.hasElectron) return window.api!.markTransactionPaid(id, paymentDate);
    const stored = localStorage.getItem('fp_transactions');
    const txs: Transaction[] = stored ? JSON.parse(stored) : [];
    const target = txs.find((t) => t.id === id);
    if (!target) throw new Error('Transação não encontrada');
    target.status = target.type === 'INCOME' ? 'RECEIVED' : 'PAID';
    target.paymentDate = paymentDate || new Date().toISOString().slice(0, 10);
    target.updatedAt = new Date().toISOString();
    localStorage.setItem('fp_transactions', JSON.stringify(txs));
    return target;
  }

  async markTransactionUnpaid(id: string): Promise<Transaction> {
    if (this.hasElectron) return window.api!.markTransactionUnpaid(id);
    const stored = localStorage.getItem('fp_transactions');
    const txs: Transaction[] = stored ? JSON.parse(stored) : [];
    const target = txs.find((t) => t.id === id);
    if (!target) throw new Error('Transação não encontrada');
    const today = new Date().toISOString().slice(0, 10);
    target.status = target.date < today ? 'OVERDUE' : 'PENDING';
    target.paymentDate = null as any;
    target.updatedAt = new Date().toISOString();
    localStorage.setItem('fp_transactions', JSON.stringify(txs));
    return target;
  }

  async listRecurringRules(activeOnly?: boolean): Promise<RecurringRule[]> {
    if (this.hasElectron) return window.api!.listRecurringRules(activeOnly);
    const stored = localStorage.getItem('fp_recurring');
    const rules: RecurringRule[] = stored ? JSON.parse(stored) : [];
    const cats = await this.listCategories();
    const enriched = rules.map((r) => {
      const cat = cats.find((c) => c.id === r.categoryId);
      return {
        ...r,
        categoryName: cat ? cat.name : undefined,
        categoryColor: cat ? cat.color || undefined : undefined,
        categoryIcon: cat ? cat.icon || undefined : undefined,
      };
    });
    return activeOnly ? enriched.filter((r) => r.isActive) : enriched;
  }

  async createRecurringRule(dto: CreateRecurringRuleDTO): Promise<RecurringRule> {
    if (this.hasElectron) return window.api!.createRecurringRule(dto);
    const rules = await this.listRecurringRules();
    const cats = await this.listCategories();
    const cat = cats.find((c) => c.id === dto.categoryId);

    const newRule: RecurringRule = {
      id: String(Date.now()),
      description: dto.description,
      amountCents: dto.amountCents,
      type: dto.type,
      categoryId: dto.categoryId,
      categoryName: cat ? cat.name : undefined,
      categoryColor: cat ? cat.color || undefined : undefined,
      categoryIcon: cat ? cat.icon || undefined : undefined,
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
    const stored = localStorage.getItem('fp_recurring');
    const rules: RecurringRule[] = stored ? JSON.parse(stored) : [];
    const filtered = rules.filter((r) => r.id !== id);
    localStorage.setItem('fp_recurring', JSON.stringify(filtered));
    return true;
  }

  async listInstallmentPurchases(): Promise<InstallmentPurchase[]> {
    if (this.hasElectron) return window.api!.listInstallmentPurchases();
    const stored = localStorage.getItem('fp_installments');
    const purchases: InstallmentPurchase[] = stored ? JSON.parse(stored) : [];
    const cats = await this.listCategories();
    return purchases.map((p) => {
      const cat = cats.find((c) => c.id === p.categoryId);
      return {
        ...p,
        categoryName: cat ? cat.name : undefined,
        categoryColor: cat ? cat.color || undefined : undefined,
      };
    });
  }

  async createInstallmentPurchase(dto: CreateInstallmentPurchaseDTO): Promise<InstallmentPurchase> {
    if (this.hasElectron) return window.api!.createInstallmentPurchase(dto);
    const purchases = await this.listInstallmentPurchases();
    const purchaseId = String(Date.now());
    const cats = await this.listCategories();
    const cat = cats.find((c) => c.id === dto.categoryId);

    const parts = Money.splitInstallments(dto.totalAmountCents, dto.totalInstallments);
    const installments: Installment[] = parts.map((amountCents, index) => {
      const installmentNumber = index + 1;
      const dueDate = DateUtils.addMonthsPreservingDay(dto.firstDueDate, index);
      const today = new Date().toISOString().slice(0, 10);
      return {
        id: `${purchaseId}-${installmentNumber}`,
        purchaseId,
        installmentNumber,
        totalInstallments: dto.totalInstallments,
        amountCents,
        dueDate,
        status: dueDate < today ? 'OVERDUE' : 'PENDING',
        transactionId: `${purchaseId}-tx-${installmentNumber}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    });

    const newPurchase: InstallmentPurchase = {
      id: purchaseId,
      description: dto.description,
      totalAmountCents: dto.totalAmountCents,
      totalInstallments: dto.totalInstallments,
      firstDueDate: dto.firstDueDate,
      categoryId: dto.categoryId,
      categoryName: cat ? cat.name : undefined,
      categoryColor: cat ? cat.color || undefined : undefined,
      paymentMethod: dto.paymentMethod || 'CREDIT',
      notes: dto.notes,
      installments,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    purchases.unshift(newPurchase);
    localStorage.setItem('fp_installments', JSON.stringify(purchases));

    // Salva transações correspondentes às parcelas
    const txStored = localStorage.getItem('fp_transactions');
    const txs: Transaction[] = txStored ? JSON.parse(txStored) : [];
    for (const inst of installments) {
      txs.push({
        id: inst.transactionId!,
        description: `${dto.description} (${inst.installmentNumber}/${inst.totalInstallments})`,
        amountCents: inst.amountCents,
        type: 'EXPENSE',
        categoryId: dto.categoryId,
        categoryName: cat ? cat.name : undefined,
        categoryColor: cat ? cat.color || undefined : undefined,
        categoryIcon: cat ? cat.icon || undefined : undefined,
        date: inst.dueDate,
        paymentMethod: (dto.paymentMethod as any) || 'CREDIT',
        status: inst.status,
        installmentId: inst.id,
        installmentNumber: inst.installmentNumber,
        totalInstallments: inst.totalInstallments,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
    localStorage.setItem('fp_transactions', JSON.stringify(txs));

    return newPurchase;
  }

  async payInstallment(id: string, paymentDate?: string): Promise<Installment> {
    if (this.hasElectron) return window.api!.payInstallment(id, paymentDate);
    const purchases = await this.listInstallmentPurchases();
    let foundInstallment: Installment | null = null;
    const actualPaymentDate = paymentDate || new Date().toISOString().slice(0, 10);

    for (const p of purchases) {
      const inst = p.installments?.find((i) => i.id === id);
      if (inst) {
        inst.status = 'PAID';
        inst.paymentDate = actualPaymentDate;
        inst.updatedAt = new Date().toISOString();
        foundInstallment = inst;
        break;
      }
    }

    if (!foundInstallment) throw new Error('Parcela não encontrada');
    localStorage.setItem('fp_installments', JSON.stringify(purchases));

    // Atualiza transação vinculada se existir
    if (foundInstallment.transactionId) {
      await this.markTransactionPaid(foundInstallment.transactionId, actualPaymentDate);
    }

    return foundInstallment;
  }

  async updateInstallment(id: string, dto: UpdateInstallmentDTO): Promise<Installment> {
    if (this.hasElectron) return window.api!.updateInstallment(id, dto);
    const purchases = await this.listInstallmentPurchases();
    let foundInstallment: Installment | null = null;

    for (const p of purchases) {
      const inst = p.installments?.find((i) => i.id === id);
      if (inst) {
        Object.assign(inst, dto, { updatedAt: new Date().toISOString() });
        foundInstallment = inst;
        break;
      }
    }

    if (!foundInstallment) throw new Error('Parcela não encontrada');
    localStorage.setItem('fp_installments', JSON.stringify(purchases));
    return foundInstallment;
  }

  async deleteInstallmentPurchase(id: string): Promise<boolean> {
    if (this.hasElectron) return window.api!.deleteInstallmentPurchase(id);
    const purchases = await this.listInstallmentPurchases();
    const target = purchases.find((p) => p.id === id);
    const filtered = purchases.filter((p) => p.id !== id);
    localStorage.setItem('fp_installments', JSON.stringify(filtered));

    if (target?.installments) {
      const txIds = new Set(target.installments.map((i) => i.transactionId).filter(Boolean));
      const txStored = localStorage.getItem('fp_transactions');
      const txs: Transaction[] = txStored ? JSON.parse(txStored) : [];
      const remainingTxs = txs.filter((t) => !txIds.has(t.id));
      localStorage.setItem('fp_transactions', JSON.stringify(remainingTxs));
    }
    return true;
  }

  async getDashboardMetrics(yearMonth?: string): Promise<DashboardMetrics> {
    if (this.hasElectron) return window.api!.getDashboardMetrics(yearMonth);
    const ym = yearMonth || new Date().toISOString().slice(0, 7);
    const txs = await this.listTransactions();

    // 1. Saldo Real Atual
    let currentBalanceCents = 0;
    for (const t of txs) {
      if (t.status === 'CANCELLED') continue;
      if (t.type === 'INCOME' && (t.status === 'RECEIVED' || t.status === 'PAID')) {
        currentBalanceCents += t.amountCents;
      } else if (t.type === 'EXPENSE' && t.status === 'PAID') {
        currentBalanceCents -= t.amountCents;
      }
    }

    // 2. Transações do mês selecionado
    const monthTxs = txs.filter((t) => t.status !== 'CANCELLED' && t.date.startsWith(ym));
    let monthIncomeCents = 0;
    let expectedIncomeCents = 0;
    let paidExpenseCents = 0;
    let pendingExpenseCents = 0;
    let fixedExpensesCents = 0;
    let installmentExpensesCents = 0;

    const categoryMap = new Map<string, { name: string; color: string; total: number }>();

    for (const t of monthTxs) {
      if (t.type === 'INCOME') {
        if (t.status === 'RECEIVED' || t.status === 'PAID') {
          monthIncomeCents += t.amountCents;
        } else {
          expectedIncomeCents += t.amountCents;
        }
      } else if (t.type === 'EXPENSE') {
        if (t.status === 'PAID') {
          paidExpenseCents += t.amountCents;
        } else {
          pendingExpenseCents += t.amountCents;
        }
        if (t.recurringRuleId) fixedExpensesCents += t.amountCents;
        if (t.installmentId) installmentExpensesCents += t.amountCents;

        const catKey = t.categoryId;
        const current = categoryMap.get(catKey) || {
          name: t.categoryName || 'Outros',
          color: t.categoryColor || '#6B7280',
          total: 0,
        };
        current.total += t.amountCents;
        categoryMap.set(catKey, current);
      }
    }

    const monthExpenseCents = paidExpenseCents;
    const totalMonthExpensesProjected = paidExpenseCents + pendingExpenseCents;
    const totalMonthIncomesProjected = monthIncomeCents + expectedIncomeCents;
    const monthProjectedBalanceCents = totalMonthIncomesProjected - totalMonthExpensesProjected;

    const expensesByCategory: CategorySummary[] = [];
    categoryMap.forEach((val, catId) => {
      const percentage = totalMonthExpensesProjected > 0 ? Math.round((val.total / totalMonthExpensesProjected) * 100) : 0;
      expensesByCategory.push({
        categoryId: catId,
        categoryName: val.name,
        categoryColor: val.color,
        totalCents: val.total,
        percentage,
      });
    });
    expensesByCategory.sort((a, b) => b.totalCents - a.totalCents);

    // 3. Histórico dos últimos 6 meses
    const [yearStr, monthStr] = ym.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    const monthlyHistory: MonthlyHistoryItem[] = [];

    for (let i = 5; i >= 0; i--) {
      const hDate = new Date(year, month - 1 - i, 1);
      const hYM = `${hDate.getFullYear()}-${String(hDate.getMonth() + 1).padStart(2, '0')}`;
      const hTxs = txs.filter((t) => t.status !== 'CANCELLED' && t.date.startsWith(hYM));
      let hIncome = 0;
      let hExpense = 0;
      for (const t of hTxs) {
        if (t.type === 'INCOME' && (t.status === 'RECEIVED' || t.status === 'PAID')) hIncome += t.amountCents;
        else if (t.type === 'EXPENSE' && t.status === 'PAID') hExpense += t.amountCents;
      }
      monthlyHistory.push({
        yearMonth: hYM,
        monthName: `${MONTH_NAMES[hDate.getMonth()].slice(0, 3)}/${String(hDate.getFullYear()).slice(2)}`,
        incomeCents: hIncome,
        expenseCents: hExpense,
      });
    }

    // 4. Previsão
    const forecast = await this.getForecast(ym, 6);

    return {
      selectedYearMonth: ym,
      currentBalanceCents,
      monthIncomeCents,
      monthExpenseCents,
      expectedIncomeCents,
      pendingExpenseCents,
      paidExpenseCents,
      monthProjectedBalanceCents,
      fixedExpensesCents,
      installmentExpensesCents,
      expensesByCategory,
      monthlyHistory,
      forecast,
    };
  }

  async getCalendarData(yearMonth?: string): Promise<CalendarMonthData> {
    if (this.hasElectron) return window.api!.getCalendarData(yearMonth);
    const ym = yearMonth || new Date().toISOString().slice(0, 7);
    const [yearStr, monthStr] = ym.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    const daysInMonth = new Date(year, month, 0).getDate();
    const firstDayOfWeek = new Date(year, month - 1, 1).getDay();

    const txs = await this.listTransactions({ yearMonth: ym });
    const dayMap = new Map<string, Transaction[]>();
    for (const t of txs) {
      if (t.status === 'CANCELLED') continue;
      const list = dayMap.get(t.date) || [];
      list.push(t);
      dayMap.set(t.date, list);
    }

    let totalIncomeMonthCents = 0;
    let totalExpenseMonthCents = 0;
    const days: CalendarDay[] = [];

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${ym}-${String(d).padStart(2, '0')}`;
      const dayTxs = dayMap.get(dateStr) || [];
      let dayIncome = 0;
      let dayExpense = 0;
      for (const t of dayTxs) {
        if (t.type === 'INCOME') dayIncome += t.amountCents;
        else if (t.type === 'EXPENSE') dayExpense += t.amountCents;
      }
      totalIncomeMonthCents += dayIncome;
      totalExpenseMonthCents += dayExpense;

      days.push({
        date: dateStr,
        dayNumber: d,
        isCurrentMonth: true,
        transactions: dayTxs,
        totalIncomeCents: dayIncome,
        totalExpenseCents: dayExpense,
        hasOverdue: dayTxs.some((t) => t.status === 'OVERDUE'),
      });
    }

    return {
      yearMonth: ym,
      year,
      month,
      firstDayOfWeek,
      daysInMonth,
      days,
      totalIncomeMonthCents,
      totalExpenseMonthCents,
    };
  }

  async getReports(year?: number): Promise<FinancialReportsResult> {
    if (this.hasElectron) return window.api!.getReports(year);
    const y = year || new Date().getFullYear();
    const yStr = String(y);
    const txs = await this.listTransactions();
    const yearTxs = txs.filter((t) => t.status !== 'CANCELLED' && t.date.startsWith(yStr));

    let totalIncomeCents = 0;
    let totalExpenseCents = 0;
    const categoryExpMap = new Map<string, { name: string; color: string; total: number }>();
    const categoryIncMap = new Map<string, { name: string; color: string; total: number }>();

    for (const t of yearTxs) {
      if (t.type === 'INCOME') {
        totalIncomeCents += t.amountCents;
        const current = categoryIncMap.get(t.categoryId) || { name: t.categoryName || 'Outros', color: t.categoryColor || '#10B981', total: 0 };
        current.total += t.amountCents;
        categoryIncMap.set(t.categoryId, current);
      } else if (t.type === 'EXPENSE') {
        totalExpenseCents += t.amountCents;
        const current = categoryExpMap.get(t.categoryId) || { name: t.categoryName || 'Outros', color: t.categoryColor || '#EF4444', total: 0 };
        current.total += t.amountCents;
        categoryExpMap.set(t.categoryId, current);
      }
    }

    const netSavingsCents = totalIncomeCents - totalExpenseCents;
    const savingsRatePercentage = totalIncomeCents > 0 ? Math.max(0, Math.round((netSavingsCents / totalIncomeCents) * 100)) : 0;

    const expensesByCategory: CategoryReportSummary[] = [];
    categoryExpMap.forEach((val, id) => {
      expensesByCategory.push({
        categoryId: id,
        categoryName: val.name,
        categoryColor: val.color,
        totalCents: val.total,
        percentage: totalExpenseCents > 0 ? Math.round((val.total / totalExpenseCents) * 100) : 0,
      });
    });

    const incomesByCategory: CategoryReportSummary[] = [];
    categoryIncMap.forEach((val, id) => {
      incomesByCategory.push({
        categoryId: id,
        categoryName: val.name,
        categoryColor: val.color,
        totalCents: val.total,
        percentage: totalIncomeCents > 0 ? Math.round((val.total / totalIncomeCents) * 100) : 0,
      });
    });

    const monthlyCashFlow: any[] = [];
    for (let m = 1; m <= 12; m++) {
      const ym = `${yStr}-${String(m).padStart(2, '0')}`;
      const mTxs = yearTxs.filter((t) => t.date.startsWith(ym));
      let mInc = 0;
      let mExp = 0;
      for (const t of mTxs) {
        if (t.type === 'INCOME') mInc += t.amountCents;
        else if (t.type === 'EXPENSE') mExp += t.amountCents;
      }
      monthlyCashFlow.push({
        yearMonth: ym,
        monthName: MONTH_NAMES[m - 1].slice(0, 3),
        incomeCents: mInc,
        expenseCents: mExp,
        netCents: mInc - mExp,
      });
    }

    const recurring = await this.listRecurringRules(true);
    const installments = await this.listInstallmentPurchases();
    const today = new Date().toISOString().slice(0, 10);
    let totalFutureInstallmentsCents = 0;
    for (const p of installments) {
      for (const i of p.installments || []) {
        if (i.status !== 'PAID' && i.status !== 'CANCELLED' && i.dueDate >= today) {
          totalFutureInstallmentsCents += i.amountCents;
        }
      }
    }

    return {
      period: yStr,
      totalIncomeCents,
      totalExpenseCents,
      netSavingsCents,
      savingsRatePercentage,
      expensesByCategory,
      incomesByCategory,
      monthlyCashFlow,
      activeFixedExpenses: recurring,
      activeInstallments: installments,
      totalFutureInstallmentsCents,
      forecast: await this.getForecast(),
    };
  }

  async getForecast(startYearMonth?: string, count: number = 6): Promise<ForecastResult> {
    if (this.hasElectron) return window.api!.getForecast(startYearMonth, count);
    const ym = startYearMonth || new Date().toISOString().slice(0, 7);
    const monthsList = DateUtils.getNextMonths(ym, Math.max(1, count));
    const txs = await this.listTransactions();
    const recurring = await this.listRecurringRules(true);
    const installments = await this.listInstallmentPurchases();

    let runningBalance = 0;
    for (const t of txs) {
      if (t.status === 'CANCELLED') continue;
      if (t.type === 'INCOME' && (t.status === 'RECEIVED' || t.status === 'PAID')) runningBalance += t.amountCents;
      else if (t.type === 'EXPENSE' && t.status === 'PAID') runningBalance -= t.amountCents;
    }

    const months: MonthlyForecastItem[] = [];
    for (const curYM of monthsList) {
      const [yearStr, monthStr] = curYM.split('-');
      const year = parseInt(yearStr, 10);
      const monthIdx = parseInt(monthStr, 10) - 1;
      const monthName = `${MONTH_NAMES[monthIdx]}/${year}`;

      let fixedExp = 0;
      let recInc = 0;
      for (const r of recurring) {
        if (r.type === 'EXPENSE') fixedExp += r.amountCents;
        else if (r.type === 'INCOME') recInc += r.amountCents;
      }

      let instExp = 0;
      for (const p of installments) {
        for (const i of p.installments || []) {
          if (i.dueDate.startsWith(curYM)) {
            instExp += i.amountCents;
          }
        }
      }

      const totalInc = recInc;
      const totalExp = fixedExp + instExp;
      const projectedBal = totalInc - totalExp;
      runningBalance += projectedBal;
      const commitmentPercentage = totalInc > 0 ? Math.round((totalExp / totalInc) * 100) : totalExp > 0 ? 100 : 0;

      months.push({
        yearMonth: curYM,
        monthName,
        incomeCents: totalInc,
        expenseCents: totalExp,
        projectedBalanceCents: projectedBal,
        accumulatedBalanceCents: runningBalance,
        commitmentPercentage,
        isHighCommitment: commitmentPercentage > 70,
        breakdown: {
          fixedExpensesCents: fixedExp,
          installmentExpensesCents: instExp,
          variableExpensesCents: 0,
          recurringIncomesCents: recInc,
          variableIncomesCents: 0,
        },
      });
    }

    return {
      startYearMonth: ym,
      totalMonths: count,
      initialBalanceCents: runningBalance,
      months,
    };
  }

  async exportBackupJSON(): Promise<string> {
    if (this.hasElectron) return window.api!.exportBackupJSON();
    const backup = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      categories: JSON.parse(localStorage.getItem('fp_categories') || '[]'),
      recurringRules: JSON.parse(localStorage.getItem('fp_recurring') || '[]'),
      installmentPurchases: JSON.parse(localStorage.getItem('fp_installments') || '[]'),
      transactions: JSON.parse(localStorage.getItem('fp_transactions') || '[]'),
    };
    return JSON.stringify(backup, null, 2);
  }

  async importBackupJSON(jsonContent: string): Promise<boolean> {
    if (this.hasElectron) return window.api!.importBackupJSON(jsonContent);
    const parsed = JSON.parse(jsonContent);
    if (parsed.categories) localStorage.setItem('fp_categories', JSON.stringify(parsed.categories));
    if (parsed.recurringRules) localStorage.setItem('fp_recurring', JSON.stringify(parsed.recurringRules));
    if (parsed.installmentPurchases) localStorage.setItem('fp_installments', JSON.stringify(parsed.installmentPurchases));
    if (parsed.transactions) localStorage.setItem('fp_transactions', JSON.stringify(parsed.transactions));
    return true;
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
}

export const api = new ApiClient();
