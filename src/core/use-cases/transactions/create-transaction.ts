import { Transaction, CreateTransactionDTO } from '../../domain/transaction.js';
import { ITransactionRepository, ICategoryRepository } from '../../domain/repositories.js';

export class CreateTransactionUseCase {
  constructor(
    private transactionRepo: ITransactionRepository,
    private categoryRepo: ICategoryRepository
  ) {}

  execute(dto: CreateTransactionDTO): Transaction {
    if (!dto.description || dto.description.trim().length === 0) {
      throw new Error('A descrição da transação é obrigatória');
    }

    if (!dto.amountCents || dto.amountCents <= 0) {
      throw new Error('O valor da transação deve ser maior que zero');
    }

    if (!dto.date || !/^\d{4}-\d{2}-\d{2}$/.test(dto.date)) {
      throw new Error('Data inválida. Use o formato AAAA-MM-DD');
    }

    const category = this.categoryRepo.findById(dto.categoryId);
    if (!category) {
      throw new Error('Categoria informada não existe');
    }

    if (category.type !== dto.type) {
      throw new Error(
        `A categoria "${category.name}" é do tipo ${category.type === 'INCOME' ? 'Receita' : 'Despesa'}, incompatível com esta transação.`
      );
    }

    return this.transactionRepo.create(dto);
  }
}
