import { describe, it, expect, beforeEach } from 'vitest';
import { AppDatabase } from '../../src/infra/database/connection.js';
import { SqliteCategoryRepository } from '../../src/infra/repositories/sqlite-category-repository.js';
import {
  CreateCategoryUseCase,
  ListCategoriesUseCase,
  UpdateCategoryUseCase,
  DeleteCategoryUseCase,
} from '../../src/core/use-cases/categories/index.js';

describe('Category Use Cases', () => {
  let appDb: AppDatabase;
  let categoryRepo: SqliteCategoryRepository;
  let createCategory: CreateCategoryUseCase;
  let listCategories: ListCategoriesUseCase;
  let updateCategory: UpdateCategoryUseCase;
  let deleteCategory: DeleteCategoryUseCase;

  beforeEach(() => {
    appDb = new AppDatabase(':memory:');
    categoryRepo = new SqliteCategoryRepository(appDb.getRawDb());
    createCategory = new CreateCategoryUseCase(categoryRepo);
    listCategories = new ListCategoriesUseCase(categoryRepo);
    updateCategory = new UpdateCategoryUseCase(categoryRepo);
    deleteCategory = new DeleteCategoryUseCase(categoryRepo);
  });

  it('impede criação de categoria sem nome ou com nome duplicado', () => {
    expect(() =>
      createCategory.execute({ name: '', type: 'EXPENSE' })
    ).toThrow(/O nome da categoria é obrigatório/);

    expect(() =>
      createCategory.execute({ name: 'alimentação', type: 'EXPENSE' })
    ).toThrow(/Já existe uma categoria cadastrada/);
  });

  it('cria e lista categorias por tipo', () => {
    const nova = createCategory.execute({
      name: 'Consultorias',
      type: 'INCOME',
      description: 'Consultorias técnicas',
    });

    expect(nova.id).toBeDefined();

    const receitas = listCategories.execute('INCOME');
    expect(receitas.some((c) => c.name === 'Consultorias')).toBe(true);

    const despesas = listCategories.execute('EXPENSE');
    expect(despesas.some((c) => c.name === 'Consultorias')).toBe(false);
  });

  it('atualiza categoria e impede colisão de nome com outra existente', () => {
    const cat = createCategory.execute({ name: 'Assinatura Software', type: 'EXPENSE' });

    const atualizada = updateCategory.execute(cat.id, {
      name: 'Softwares & Ferramentas',
      color: '#123456',
    });

    expect(atualizada.name).toBe('Softwares & Ferramentas');
    expect(atualizada.color).toBe('#123456');

    expect(() =>
      updateCategory.execute(cat.id, { name: 'Moradia' })
    ).toThrow(/Já existe uma categoria cadastrada/);
  });

  it('exclui categoria com sucesso se não tiver transações', () => {
    const cat = createCategory.execute({ name: 'Excluir Teste', type: 'EXPENSE' });
    const res = deleteCategory.execute(cat.id);
    expect(res).toBe(true);
    expect(categoryRepo.findById(cat.id)).toBeNull();
  });
});
