import { Transaction, TransactionFilters } from '../../domain/transaction.js';
import { ITransactionRepository } from '../../domain/repositories.js';

/** Gera os lançamentos das regras fixas de um mês (ProcessRecurringInstancesUseCase). */
interface RecurringMonthProcessor {
  execute(yearMonth: string): unknown;
}

export class ListTransactionsUseCase {
  constructor(
    private transactionRepo: ITransactionRepository,
    private recurringProcessor?: RecurringMonthProcessor
  ) {}

  execute(filters?: TransactionFilters & { yearMonth?: string }): Transaction[] {
    const finalFilters: TransactionFilters = { ...filters };

    // Receitas e Despesas mostram as fixas do mês mesmo sem passar pelo Dashboard
    if (this.recurringProcessor && filters?.yearMonth && /^\d{4}-\d{2}$/.test(filters.yearMonth)) {
      this.recurringProcessor.execute(filters.yearMonth);
    }

    // Se o usuário passar apenas "yearMonth" no formato "2026-09", deriva startDate e endDate automaticamente
    if (filters?.yearMonth && /^\d{4}-\d{2}$/.test(filters.yearMonth)) {
      const [yearStr, monthStr] = filters.yearMonth.split('-');
      const year = parseInt(yearStr, 10);
      const month = parseInt(monthStr, 10);

      const startDate = `${filters.yearMonth}-01`;
      // Último dia do mês
      const lastDay = new Date(year, month, 0).getDate();
      const endDate = `${filters.yearMonth}-${String(lastDay).padStart(2, '0')}`;

      finalFilters.startDate = finalFilters.startDate || startDate;
      finalFilters.endDate = finalFilters.endDate || endDate;
    }

    return this.transactionRepo.list(finalFilters);
  }
}
