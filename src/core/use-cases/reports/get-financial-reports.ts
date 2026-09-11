import {
  FinancialReportsResult,
  InstallmentOverviewItem,
  FixedExpenseOverviewItem,
} from '../../domain/reports.js';
import {
  CategorySummary,
  MonthlyHistoryItem,
} from '../../domain/dashboard.js';
import {
  ITransactionRepository,
  IRecurringRuleRepository,
  IInstallmentPurchaseRepository,
  ICategoryRepository,
} from '../../domain/repositories.js';
import { CalculateForecastUseCase } from '../forecast/calculate-forecast.js';

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

export class GetFinancialReportsUseCase {
  private calculateForecast: CalculateForecastUseCase;

  constructor(
    private transactionRepo: ITransactionRepository,
    private recurringRepo: IRecurringRuleRepository,
    private installmentRepo: IInstallmentPurchaseRepository,
    private categoryRepo: ICategoryRepository
  ) {
    this.calculateForecast = new CalculateForecastUseCase(
      transactionRepo,
      recurringRepo
    );
  }

  execute(year: number = new Date().getFullYear()): FinancialReportsResult {
    const yearStr = String(year);
    const startDate = `${yearStr}-01-01`;
    const endDate = `${yearStr}-12-31`;

    const yearTransactions = this.transactionRepo
      .list({ startDate, endDate })
      .filter((t) => t.status !== 'CANCELLED');

    let totalIncomeCents = 0;
    let totalExpenseCents = 0;

    const expenseCategoryMap = new Map<
      string,
      { name: string; color: string; total: number }
    >();
    const incomeCategoryMap = new Map<
      string,
      { name: string; color: string; total: number }
    >();

    // Mapeamento mensal de receitas e despesas
    const monthlyDataMap = new Map<
      string,
      { income: number; expense: number }
    >();
    for (let m = 1; m <= 12; m++) {
      const ym = `${yearStr}-${String(m).padStart(2, '0')}`;
      monthlyDataMap.set(ym, { income: 0, expense: 0 });
    }

    for (const tx of yearTransactions) {
      const txYM = tx.date.slice(0, 7);
      const mItem = monthlyDataMap.get(txYM) || { income: 0, expense: 0 };

      if (tx.type === 'INCOME') {
        totalIncomeCents += tx.amountCents;
        mItem.income += tx.amountCents;

        const cat = incomeCategoryMap.get(tx.categoryId) || {
          name: tx.categoryName || 'Receitas',
          color: tx.categoryColor || '#10B981',
          total: 0,
        };
        cat.total += tx.amountCents;
        incomeCategoryMap.set(tx.categoryId, cat);
      } else {
        totalExpenseCents += tx.amountCents;
        mItem.expense += tx.amountCents;

        const cat = expenseCategoryMap.get(tx.categoryId) || {
          name: tx.categoryName || 'Despesas',
          color: tx.categoryColor || '#EF4444',
          total: 0,
        };
        cat.total += tx.amountCents;
        expenseCategoryMap.set(tx.categoryId, cat);
      }
      monthlyDataMap.set(txYM, mItem);
    }

    const netSavingsCents = totalIncomeCents - totalExpenseCents;
    const savingsRatePercentage =
      totalIncomeCents > 0
        ? Math.round((netSavingsCents / totalIncomeCents) * 100)
        : 0;

    // Constrói resumos de categorias
    const expensesByCategory: CategorySummary[] = [];
    expenseCategoryMap.forEach((val, catId) => {
      const percentage =
        totalExpenseCents > 0
          ? Math.round((val.total / totalExpenseCents) * 100)
          : 0;
      expensesByCategory.push({
        categoryId: catId,
        categoryName: val.name,
        categoryColor: val.color,
        totalCents: val.total,
        percentage,
      });
    });
    expensesByCategory.sort((a, b) => b.totalCents - a.totalCents);

    const incomesByCategory: CategorySummary[] = [];
    incomeCategoryMap.forEach((val, catId) => {
      const percentage =
        totalIncomeCents > 0
          ? Math.round((val.total / totalIncomeCents) * 100)
          : 0;
      incomesByCategory.push({
        categoryId: catId,
        categoryName: val.name,
        categoryColor: val.color,
        totalCents: val.total,
        percentage,
      });
    });
    incomesByCategory.sort((a, b) => b.totalCents - a.totalCents);

    // Fluxo de caixa mensal do ano
    const monthlyCashFlow: MonthlyHistoryItem[] = [];
    for (let m = 1; m <= 12; m++) {
      const ym = `${yearStr}-${String(m).padStart(2, '0')}`;
      const data = monthlyDataMap.get(ym)!;
      monthlyCashFlow.push({
        yearMonth: ym,
        monthName: MONTH_NAMES[m - 1],
        incomeCents: data.income,
        expenseCents: data.expense,
      });
    }

    // Regras recorrentes ativas
    const activeFixedExpenses: FixedExpenseOverviewItem[] = this.recurringRepo
      .list(true)
      .filter((r) => r.type === 'EXPENSE')
      .map((r) => ({
        ruleId: r.id,
        description: r.description,
        amountCents: r.amountCents,
        frequency: r.frequency,
        dueDay: r.dueDay,
        categoryName: r.categoryName,
        paymentMethod: r.paymentMethod,
      }));

    // Compras parceladas ativas (com parcelas pendentes)
    const allPurchases = this.installmentRepo.list();
    const activeInstallments: InstallmentOverviewItem[] = [];
    let totalFutureInstallmentsCents = 0;

    for (const p of allPurchases) {
      const pendingInst = (p.installments || []).filter(
        (i) => i.status === 'PENDING' || i.status === 'OVERDUE'
      );

      if (pendingInst.length > 0) {
        const remainingAmount = pendingInst.reduce(
          (acc, cur) => acc + cur.amountCents,
          0
        );
        totalFutureInstallmentsCents += remainingAmount;

        activeInstallments.push({
          purchaseId: p.id,
          description: p.description,
          totalAmountCents: p.totalAmountCents,
          totalInstallments: p.totalInstallments,
          remainingInstallments: pendingInst.length,
          remainingAmountCents: remainingAmount,
          nextDueDate: pendingInst[0].dueDate,
          categoryName: p.categoryName,
        });
      }
    }

    const forecast = this.calculateForecast.execute(undefined, 6);

    return {
      period: yearStr,
      totalIncomeCents,
      totalExpenseCents,
      netSavingsCents,
      savingsRatePercentage,
      expensesByCategory,
      incomesByCategory,
      monthlyCashFlow,
      activeFixedExpenses,
      activeInstallments,
      totalFutureInstallmentsCents,
      forecast,
    };
  }
}
