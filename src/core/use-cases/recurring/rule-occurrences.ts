import { RecurringRule } from '../../domain/recurring-rule.js';
import { ITransactionRepository } from '../../domain/repositories.js';
import { DateUtils } from '../../utils/date-utils.js';

const isOpen = (status: string) => status === 'PENDING' || status === 'OVERDUE';

/**
 * Remove os lançamentos ainda não pagos/recebidos de uma regra a partir de uma data
 * (ex.: regra excluída ou pausada). Os já liquidados ficam como histórico.
 */
export function removeOpenOccurrences(
  ruleId: string,
  fromDate: string,
  transactionRepo?: ITransactionRepository
): void {
  if (!transactionRepo) return;
  for (const tx of transactionRepo.list({ startDate: fromDate })) {
    if (tx.recurringRuleId === ruleId && isOpen(tx.status)) {
      transactionRepo.delete(tx.id);
    }
  }
}

/**
 * Aplica a regra atual (valor, dia, descrição, categoria, forma de pagamento) aos lançamentos
 * ainda em aberto do mês atual em diante.
 */
export function syncOpenOccurrences(rule: RecurringRule, transactionRepo?: ITransactionRepository): void {
  if (!transactionRepo) return;
  const monthStart = `${DateUtils.currentYearMonth()}-01`;
  for (const tx of transactionRepo.list({ startDate: monthStart })) {
    if (tx.recurringRuleId !== rule.id || !isOpen(tx.status)) continue;
    let date = tx.date;
    if (rule.frequency !== 'WEEKLY') {
      const ym = tx.date.slice(0, 7);
      const safeDay = Math.min(rule.dueDay, DateUtils.getDaysInMonth(ym));
      date = `${ym}-${String(safeDay).padStart(2, '0')}`;
    }
    transactionRepo.update(tx.id, {
      amountCents: rule.amountCents,
      date,
      description: rule.description,
      categoryId: rule.categoryId,
      paymentMethod: rule.paymentMethod,
    });
  }
}
