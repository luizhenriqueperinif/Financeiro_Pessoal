import { Transaction, UpdateTransactionDTO } from '../../domain/transaction.js';
import { ITransactionRepository, ICategoryRepository } from '../../domain/repositories.js';

export class UpdateTransactionUseCase {
  constructor(
    private transactionRepo: ITransactionRepository,
    private categoryRepo: ICategoryRepository
  ) {}

  execute(id: string, dto: UpdateTransactionDTO): Transaction {
    const existing = this.transactionRepo.findById(id);
    if (!existing) {
      throw new Error('Transação não encontrada');
    }

    if (dto.description !== undefined && dto.description.trim().length === 0) {
      throw new Error('A descrição não pode ser vazia');
    }

    if (dto.amountCents !== undefined && dto.amountCents <= 0) {
      throw new Error('O valor deve ser maior que zero');
    }

    if (dto.date !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(dto.date)) {
      throw new Error('Data inválida. Use o formato AAAA-MM-DD');
    }

    if (dto.categoryId !== undefined) {
      const cat = this.categoryRepo.findById(dto.categoryId);
      if (!cat) {
        throw new Error('Categoria informada não existe');
      }
      const effectiveType = dto.type || existing.type;
      if (cat.type !== effectiveType) {
        throw new Error('A categoria informada é incompatível com o tipo da transação');
      }
    }

    const updated = this.transactionRepo.update(id, dto);
    if (!updated) {
      throw new Error('Erro ao atualizar transação');
    }
    return updated;
  }
}
