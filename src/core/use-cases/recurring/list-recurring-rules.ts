import {
  RecurringRule,
  UpdateRecurringRuleDTO,
} from '../../domain/recurring-rule.js';
import {
  IRecurringRuleRepository,
  ICategoryRepository,
} from '../../domain/repositories.js';

export class ListRecurringRulesUseCase {
  constructor(private recurringRepo: IRecurringRuleRepository) {}

  execute(activeOnly?: boolean): RecurringRule[] {
    return this.recurringRepo.list(activeOnly);
  }
}

export class UpdateRecurringRuleUseCase {
  constructor(
    private recurringRepo: IRecurringRuleRepository,
    private categoryRepo: ICategoryRepository
  ) {}

  execute(id: string, dto: UpdateRecurringRuleDTO): RecurringRule {
    const existing = this.recurringRepo.findById(id);
    if (!existing) {
      throw new Error('Regra recorrente não encontrada');
    }

    if (dto.dueDay !== undefined && (dto.dueDay < 1 || dto.dueDay > 31)) {
      throw new Error('O dia de vencimento deve estar entre 1 e 31');
    }

    if (dto.categoryId !== undefined) {
      const cat = this.categoryRepo.findById(dto.categoryId);
      if (!cat) {
        throw new Error('Categoria informada não existe');
      }
    }

    const updated = this.recurringRepo.update(id, dto);
    if (!updated) {
      throw new Error('Erro ao atualizar regra recorrente');
    }
    return updated;
  }
}

export class DeleteRecurringRuleUseCase {
  constructor(private recurringRepo: IRecurringRuleRepository) {}

  execute(id: string): boolean {
    const existing = this.recurringRepo.findById(id);
    if (!existing) {
      throw new Error('Regra recorrente não encontrada');
    }
    return this.recurringRepo.delete(id);
  }
}
