import { Transaction } from '../../domain/transaction.js';
import { ITransactionRepository } from '../../domain/repositories.js';

export class MarkTransactionUnpaidUseCase {
  constructor(private transactionRepo: ITransactionRepository) {}

  execute(id: string): Transaction {
    const existing = this.transactionRepo.findById(id);
    if (!existing) {
      throw new Error('Transação não encontrada');
    }

    const updated = this.transactionRepo.markAsUnpaid(id);
    if (!updated) {
      throw new Error('Erro ao desmarcar transação como paga');
    }
    return updated;
  }
}
