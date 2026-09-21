import { IRecurringRuleRepository, ITransactionRepository } from '../../domain/repositories.js';

export class DeleteTransactionUseCase {
  constructor(
    private transactionRepo: ITransactionRepository,
    private recurringRepo?: IRecurringRuleRepository
  ) {}

  execute(id: string): boolean {
    const existing = this.transactionRepo.findById(id);
    if (!existing) {
      throw new Error('Transação não encontrada');
    }
    if (existing.installmentId) {
      throw new Error(
        `"${existing.description}" é uma parcela de compra parcelada. Para excluir, use a tela Parcelamentos.`
      );
    }
    // Ocorrência gerada por regra recorrente: registra a exclusão para que
    // o processamento automático do mês não a recrie.
    if (existing.recurringRuleId && this.recurringRepo) {
      this.recurringRepo.skipOccurrence(existing.recurringRuleId, existing.date);
    }
    return this.transactionRepo.delete(id);
  }
}
