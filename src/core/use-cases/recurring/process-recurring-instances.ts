import { Transaction } from '../../domain/transaction.js';
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

    const [yearStr, monthStr] = targetMonth.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);

    const firstDayStr = `${targetMonth}-01`;
    const lastDayNum = new Date(year, month, 0).getDate();
    const lastDayStr = `${targetMonth}-${String(lastDayNum).padStart(2, '0')}`;

    const activeRules = this.recurringRepo.list(true);
    const createdTransactions: Transaction[] = [];

    for (const rule of activeRules) {
      // Regra começou depois do final do mês analisado?
      if (rule.startDate > lastDayStr) {
        continue;
      }

      // Regra encerrou antes do início do mês analisado?
      if (rule.endDate && rule.endDate < firstDayStr) {
        continue;
      }

      // Verifica se já foi instanciada neste mês
      const existingTx = this.transactionRepo.findByRecurringInstance(
        rule.id,
        targetMonth
      );
      if (existingTx) {
        continue;
      }

      // Calcula o dia de vencimento seguro (ex: 31 de fevereiro -> 28 ou 29)
      const safeDay = Math.min(rule.dueDay, lastDayNum);
      const dueDate = `${targetMonth}-${String(safeDay).padStart(2, '0')}`;

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

    return createdTransactions;
  }
}
