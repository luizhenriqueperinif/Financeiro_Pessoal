import {
  Category,
  CreateCategoryDTO,
} from '../../domain/category.js';
import { ICategoryRepository } from '../../domain/repositories.js';

export class CreateCategoryUseCase {
  constructor(private categoryRepo: ICategoryRepository) {}

  execute(dto: CreateCategoryDTO): Category {
    if (!dto.name || dto.name.trim().length === 0) {
      throw new Error('O nome da categoria é obrigatório');
    }

    const existing = this.categoryRepo.findByName(dto.name);
    if (existing) {
      throw new Error(`Já existe uma categoria cadastrada com o nome "${dto.name.trim()}"`);
    }

    return this.categoryRepo.create(dto);
  }
}
