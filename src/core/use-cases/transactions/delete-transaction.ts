import { ITransactionRepository } from '../../domain/repositories.js';

export class DeleteTransactionUseCase {
  constructor(private transactionRepo: ITransactionRepository) {}

  execute(id: string): boolean {
    const existing = this.transactionRepo.findById(id);
    if (!existing) {
      throw new Error('Transação não encontrada');
    }
    return this.transactionRepo.delete(id);
  }
}
