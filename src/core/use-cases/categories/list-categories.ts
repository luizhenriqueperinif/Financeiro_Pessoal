import { Category } from '../../domain/category.js';
import { ICategoryRepository } from '../../domain/repositories.js';
import { TransactionType } from '../../types/common.js';

export class ListCategoriesUseCase {
  constructor(private categoryRepo: ICategoryRepository) {}

  execute(type?: TransactionType): Category[] {
    return this.categoryRepo.list(type);
  }
}
