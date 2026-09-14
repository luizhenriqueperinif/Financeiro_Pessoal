import {
  DashboardMetrics,
  CategorySummary,
  MonthlyHistoryItem,
} from '../../domain/dashboard.js';
import {
  ITransactionRepository,
  IRecurringRuleRepository,
} from '../../domain/repositories.js';
import { ProcessRecurringInstancesUseCase } from '../recurring/process-recurring-instances.js';
import { CalculateForecastUseCase } from '../forecast/calculate-forecast.js';
import { CalculateFinancialAlertsUseCase } from './calculate-financial-alerts.js';
import { DateUtils } from '../../utils/date-utils.js';

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

export class GetDashboardMetricsUseCase {
  private processRecurring: ProcessRecurringInstancesUseCase;
  private calculateForecast: CalculateForecastUseCase;
  private calculateAlerts: CalculateFinancialAlertsUseCase;

  constructor(
    private transactionRepo: ITransactionRepository,
    private recurringRepo: IRecurringRuleRepository
  ) {
    this.processRecurring = new ProcessRecurringInstancesUseCase(
      recurringRepo,
      transactionRepo
    );
    this.calculateForecast = new CalculateForecastUseCase(
      transactionRepo,
      recurringRepo
    );
    this.calculateAlerts = new CalculateFinancialAlertsUseCase();
  }

  execute(selectedYearMonth?: string): DashboardMetrics {
    const today = new Date().toISOString().slice(0, 10);
    const targetYM = selectedYearMonth || DateUtils.getYearMonth(today);

    // 1. Garante que os lançamentos fixos do mês selecionado foram instanciados
    this.processRecurring.execute(targetYM);

    // 2. Saldo Atual Líquido (Histórico global de transações realizadas)
    const allTransactions = this.transactionRepo.list();
    let currentBalanceCents = 0;
    for (const tx of allTransactions) {
      if (tx.status === 'CANCELLED') continue;
      if (tx.type === 'INCOME' && (tx.status === 'RECEIVED' || tx.status === 'PAID')) {
        currentBalanceCents += tx.amountCents;
      } else if (tx.type === 'EXPENSE' && tx.status === 'PAID') {
        currentBalanceCents -= tx.amountCents;
      }
    }

    // 3. Transações do mês selecionado
    const [yearStr, monthStr] = targetYM.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    const lastDayNum = new Date(year, month, 0).getDate();
    const startDate = `${targetYM}-01`;
    const endDate = `${targetYM}-${String(lastDayNum).padStart(2, '0')}`;

    const monthTxs = this.transactionRepo.list({
      startDate,
      endDate,
    }).filter((t) => t.status !== 'CANCELLED');

    let monthIncomeCents = 0;
    let expectedIncomeCents = 0;
    let paidExpenseCents = 0;
    let pendingExpenseCents = 0;
    let fixedExpensesCents = 0;
    let installmentExpensesCents = 0;

    const categoryExpenseMap = new Map<
      string,
      { name: string; color: string; total: number }
    >();

    for (const tx of monthTxs) {
      if (tx.type === 'INCOME') {
        if (tx.status === 'RECEIVED' || tx.status === 'PAID') {
          monthIncomeCents += tx.amountCents;
        } else {
          expectedIncomeCents += tx.amountCents;
        }
      } else if (tx.type === 'EXPENSE') {
        if (tx.status === 'PAID') {
          paidExpenseCents += tx.amountCents;
        } else {
          pendingExpenseCents += tx.amountCents;
        }

        if (tx.recurringRuleId) {
          fixedExpensesCents += tx.amountCents;
        }
        if (tx.installmentId) {
          installmentExpensesCents += tx.amountCents;
        }

        // Agrupa por categoria para o gráfico
        const catKey = tx.categoryId;
        const currentCat = categoryExpenseMap.get(catKey) || {
          name: tx.categoryName || 'Outros',
          color: tx.categoryColor || '#6B7280',
          total: 0,
        };
        currentCat.total += tx.amountCents;
        categoryExpenseMap.set(catKey, currentCat);
      }
    }

    const monthExpenseCents = paidExpenseCents;
    const totalMonthExpensesProjected = paidExpenseCents + pendingExpenseCents;
    const totalMonthIncomesProjected = monthIncomeCents + expectedIncomeCents;
    const monthProjectedBalanceCents =
      totalMonthIncomesProjected - totalMonthExpensesProjected;

    // Constrói resumo por categoria com percentuais
    const expensesByCategory: CategorySummary[] = [];
    categoryExpenseMap.forEach((val, catId) => {
      const percentage =
        totalMonthExpensesProjected > 0
          ? Math.round((val.total / totalMonthExpensesProjected) * 100)
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

    // 4. Histórico dos últimos 6 meses (para gráfico comparativo)
    const monthlyHistory: MonthlyHistoryItem[] = [];
    for (let i = 5; i >= 0; i--) {
      const hDate = new Date(year, month - 1 - i, 1);
      const hYM = `${hDate.getFullYear()}-${String(hDate.getMonth() + 1).padStart(2, '0')}`;
      const hLastDay = new Date(hDate.getFullYear(), hDate.getMonth() + 1, 0).getDate();

      const hTxs = allTransactions.filter(
        (t) =>
          t.status !== 'CANCELLED' &&
          t.date >= `${hYM}-01` &&
          t.date <= `${hYM}-${String(hLastDay).padStart(2, '0')}`
      );

      let hIncome = 0;
      let hExpense = 0;
      for (const t of hTxs) {
        if (t.type === 'INCOME') hIncome += t.amountCents;
        else if (t.type === 'EXPENSE') hExpense += t.amountCents;
      }

      monthlyHistory.push({
        yearMonth: hYM,
        monthName: `${MONTH_NAMES[hDate.getMonth()]}/${String(hDate.getFullYear()).slice(2)}`,
        incomeCents: hIncome,
        expenseCents: hExpense,
      });
    }

    // 5. Previsão para os próximos 6 meses
    const forecast = this.calculateForecast.execute(targetYM, 6);

    // 6. Alertas e Inteligência Financeira
    const alerts = this.calculateAlerts.execute({
      selectedYearMonth: targetYM,
      totalMonthIncomesCents: totalMonthIncomesProjected,
      totalMonthExpensesProjectedCents: totalMonthExpensesProjected,
      transactions: allTransactions,
      todayDate: today,
    });

    return {
      selectedYearMonth: targetYM,
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
      alerts,
    };
  }
}
