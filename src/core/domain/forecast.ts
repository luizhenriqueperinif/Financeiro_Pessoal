export interface MonthlyForecastItem {
  yearMonth: string; // "2026-09"
  monthName: string; // "Setembro/2026"
  incomeCents: number;
  expenseCents: number;
  projectedBalanceCents: number; // incomeCents - expenseCents deste mês
  accumulatedBalanceCents: number; // Saldo acumulado ao final do mês
  commitmentPercentage: number; // Percentual de comprometimento da renda (0 a 100+)
  isHighCommitment: boolean; // Flag indicando se o mês tem comprometimento elevado (> 80%)
  breakdown: {
    fixedExpensesCents: number;
    installmentExpensesCents: number;
    variableExpensesCents: number;
    recurringIncomesCents: number;
    variableIncomesCents: number;
  };
}

export interface ForecastResult {
  startYearMonth: string;
  totalMonths: number;
  initialBalanceCents: number; // Saldo atual real antes do início da previsão
  months: MonthlyForecastItem[];
}
