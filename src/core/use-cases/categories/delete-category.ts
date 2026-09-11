import { ICategoryRepository } from '../../domain/repositories.js';

export class DeleteCategoryUseCase {
  constructor(private categoryRepo: ICategoryRepository) {}

  execute(id: string): boolean {
    const existing = this.categoryRepo.findById(id);
    if (!existing) {
      throw new Error('Categoria não encontrada');
    }

    const txCount = this.categoryRepo.countTransactions(id);
    if (txCount > 0) {
      throw new Error(
        `Não é possível excluir a categoria "${existing.name}": existem ${txCount} transação(ões) vinculada(s). Reclassifique os lançamentos antes de excluir.`
      );
    }

    return this.categoryRepo.delete(id);
  }
}
