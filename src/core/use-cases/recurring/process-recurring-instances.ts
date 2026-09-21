import { Transaction } from '../../domain/transaction.js';
import { recurringOccurrencesInMonth } from '../../domain/recurring-rule.js';
import {
  IRecurringRuleRepository,
  ITransactionRepository,
} from '../../domain/repositories.js';

export class ProcessRecurringInstancesUseCase {
  constructor(
    private recurringRepo: IRecurringRuleRepository,
    private transactionRepo: ITransactionRepository
  ) {}

  /**
   * Processa regras recorrentes ativas e instancia transações concretas no mês indicado (YYYY-MM).
   * Se a transação para aquela regra já existir no mês, ela é ignorada para evitar duplicações.
   */
  execute(targetMonth: string): Transaction[] {
    if (!/^\d{4}-\d{2}$/.test(targetMonth)) {
      throw new Error('Mês alvo inválido. Use o formato AAAA-MM');
    }

    const activeRules = this.recurringRepo.list(true);
    const createdTransactions: Transaction[] = [];

    for (const rule of activeRules) {
      const dueDates = recurringOccurrencesInMonth(rule, targetMonth);
      if (dueDates.length === 0) continue;

      // Mensal/anual: uma ocorrência por mês, mesmo que o usuário tenha mudado o dia.
      // Semanal: cada data é uma ocorrência distinta.
      const perDate = rule.frequency === 'WEEKLY';
      if (!perDate && this.transactionRepo.findByRecurringInstance(rule.id, targetMonth)) {
        continue;
      }

      for (const dueDate of dueDates) {
        if (perDate && this.transactionRepo.findByRecurringInstance(rule.id, dueDate)) continue;
        if (this.recurringRepo.isOccurrenceSkipped(rule.id, perDate ? dueDate : targetMonth)) continue;

        const newTx = this.transactionRepo.create({
          description: rule.description,
          amountCents: rule.amountCents,
          type: rule.type,
          categoryId: rule.categoryId,
          date: dueDate,
          paymentMethod: rule.paymentMethod,
          status: 'PENDING',
          recurringRuleId: rule.id,
          notes: `Lançamento automático de despesa fixa (${targetMonth})`,
        });

        createdTransactions.push(newTx);
      }
    }

    return createdTransactions;
  }
}
