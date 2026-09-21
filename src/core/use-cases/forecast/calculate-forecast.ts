import {
  ForecastResult,
  MonthlyForecastItem,
} from '../../domain/forecast.js';
import {
  ITransactionRepository,
  IRecurringRuleRepository,
} from '../../domain/repositories.js';
import { DateUtils } from '../../utils/date-utils.js';
import { recurringOccurrencesInMonth } from '../../domain/recurring-rule.js';

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

export class CalculateForecastUseCase {
  constructor(
    private transactionRepo: ITransactionRepository,
    private recurringRepo: IRecurringRuleRepository
  ) {}

  execute(startYearMonth?: string, monthsCount: number = 6): ForecastResult {
    const today = DateUtils.today();
    const initialYM = startYearMonth || DateUtils.getYearMonth(today);
    // Começando num mês futuro, projeta também os meses entre hoje e o início para o acumulado
    // ficar certo; esses meses intermediários não aparecem no resultado.
    const currentYM = DateUtils.getYearMonth(today);
    const projectionStart = initialYM > currentYM ? currentYM : initialYM;
    const monthsBetween = DateUtils.getNextMonths(projectionStart, 240).indexOf(initialYM);
    const monthsList = DateUtils.getNextMonths(projectionStart, Math.max(0, monthsBetween) + Math.max(1, monthsCount));

    // 1. Calcula o Saldo Real Atual (liquidez acumulada até o momento)
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

    // O acumulado parte do saldo atual (já liquidado) e soma apenas o que ainda
    // vai acontecer: lançamentos não liquidados e projeções de regras recorrentes.
    // Pendências de meses anteriores ao início (ex.: contas atrasadas) entram já no ponto de partida.
    const isSettled = (status: string) => status === 'PAID' || status === 'RECEIVED';
    const signed = (tx: { type: string; amountCents: number }) =>
      tx.type === 'INCOME' ? tx.amountCents : -tx.amountCents;
    const firstForecastDay = `${monthsList[0]}-01`;
    let runningBalance = currentBalanceCents;
    for (const tx of allTransactions) {
      if (tx.status === 'CANCELLED' || isSettled(tx.status)) continue;
      if (tx.date < firstForecastDay) runningBalance += signed(tx);
    }

    const activeRules = this.recurringRepo.list(true);
    const forecastItems: MonthlyForecastItem[] = [];

    for (const ym of monthsList) {
      const [yearStr, monthStr] = ym.split('-');
      const year = parseInt(yearStr, 10);
      const monthIdx = parseInt(monthStr, 10) - 1;
      const monthName = `${MONTH_NAMES[monthIdx]}/${year}`;

      const firstDay = `${ym}-01`;
      const lastDayNum = new Date(year, monthIdx + 1, 0).getDate();
      const lastDay = `${ym}-${String(lastDayNum).padStart(2, '0')}`;

      // Transações concretas cadastradas para este mês
      const monthTransactions = this.transactionRepo.list({
        startDate: firstDay,
        endDate: lastDay,
      }).filter((t) => t.status !== 'CANCELLED');

      let fixedExpensesCents = 0;
      let installmentExpensesCents = 0;
      let variableExpensesCents = 0;
      let recurringIncomesCents = 0;
      let variableIncomesCents = 0;
      let pendingNetCents = 0;

      // Conjunto de IDs de regras recorrentes que já possuem transação concreta neste mês
      const instantiatedRuleIds = new Set<string>();
      const instantiatedRuleDates = new Set<string>();

      for (const tx of monthTransactions) {
        if (tx.recurringRuleId) {
          instantiatedRuleIds.add(tx.recurringRuleId);
          instantiatedRuleDates.add(`${tx.recurringRuleId}|${tx.date}`);
        }
        if (!isSettled(tx.status)) {
          pendingNetCents += signed(tx);
        }

        if (tx.type === 'EXPENSE') {
          if (tx.installmentId) {
            installmentExpensesCents += tx.amountCents;
          } else if (tx.recurringRuleId) {
            fixedExpensesCents += tx.amountCents;
          } else {
            variableExpensesCents += tx.amountCents;
          }
        } else if (tx.type === 'INCOME') {
          if (tx.recurringRuleId) {
            recurringIncomesCents += tx.amountCents;
          } else {
            variableIncomesCents += tx.amountCents;
          }
        }
      }

      // Projeção virtual de regras recorrentes ativas que ainda NÃO foram instanciadas neste mês
      for (const rule of activeRules) {
        const perDate = rule.frequency === 'WEEKLY';
        if (!perDate && instantiatedRuleIds.has(rule.id)) continue; // Já somado nas concretas!

        for (const date of recurringOccurrencesInMonth(rule, ym)) {
          if (perDate && instantiatedRuleDates.has(`${rule.id}|${date}`)) continue;
          if (this.recurringRepo.isOccurrenceSkipped(rule.id, perDate ? date : ym)) continue;

          if (rule.type === 'EXPENSE') {
            fixedExpensesCents += rule.amountCents;
          } else {
            recurringIncomesCents += rule.amountCents;
          }
          pendingNetCents += signed(rule);
        }
      }

      const totalIncome = recurringIncomesCents + variableIncomesCents;
      const totalExpense =
        fixedExpensesCents + installmentExpensesCents + variableExpensesCents;
      const projectedBalance = totalIncome - totalExpense;
      runningBalance += pendingNetCents;

      const commitmentPercentage =
        totalIncome > 0
          ? Math.round((totalExpense / totalIncome) * 100)
          : totalExpense > 0
          ? 100
          : 0;

      forecastItems.push({
        yearMonth: ym,
        monthName,
        incomeCents: totalIncome,
        expenseCents: totalExpense,
        projectedBalanceCents: projectedBalance,
        accumulatedBalanceCents: runningBalance,
        commitmentPercentage,
        isHighCommitment: commitmentPercentage >= 80,
        breakdown: {
          fixedExpensesCents,
          installmentExpensesCents,
          variableExpensesCents,
          recurringIncomesCents,
          variableIncomesCents,
        },
      });
    }

    const visibleMonths = forecastItems.filter((m) => m.yearMonth >= initialYM);

    return {
      startYearMonth: initialYM,
      totalMonths: visibleMonths.length,
      initialBalanceCents: currentBalanceCents,
      months: visibleMonths,
    };
  }
}
