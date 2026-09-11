import { Category, UpdateCategoryDTO } from '../../domain/category.js';
import { ICategoryRepository } from '../../domain/repositories.js';

export class UpdateCategoryUseCase {
  constructor(private categoryRepo: ICategoryRepository) {}

  execute(id: string, dto: UpdateCategoryDTO): Category {
    const existing = this.categoryRepo.findById(id);
    if (!existing) {
      throw new Error('Categoria não encontrada');
    }

    if (dto.name && dto.name.trim().toLowerCase() !== existing.name.toLowerCase()) {
      const conflict = this.categoryRepo.findByName(dto.name);
      if (conflict && conflict.id !== id) {
        throw new Error(`Já existe uma categoria cadastrada com o nome "${dto.name.trim()}"`);
      }
    }

    const updated = this.categoryRepo.update(id, dto);
    if (!updated) {
      throw new Error('Erro ao atualizar categoria');
    }
    return updated;
  }
}
