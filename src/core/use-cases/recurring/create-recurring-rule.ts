import {
  RecurringRule,
  CreateRecurringRuleDTO,
} from '../../domain/recurring-rule.js';
import {
  IRecurringRuleRepository,
  ICategoryRepository,
} from '../../domain/repositories.js';

export class CreateRecurringRuleUseCase {
  constructor(
    private recurringRepo: IRecurringRuleRepository,
    private categoryRepo: ICategoryRepository
  ) {}

  execute(dto: CreateRecurringRuleDTO): RecurringRule {
    if (!dto.description || dto.description.trim().length === 0) {
      throw new Error('A descrição da despesa fixa é obrigatória');
    }

    if (!dto.amountCents || dto.amountCents <= 0) {
      throw new Error('O valor deve ser maior que zero');
    }

    if (dto.dueDay < 1 || dto.dueDay > 31) {
      throw new Error('O dia de vencimento deve estar entre 1 e 31');
    }

    if (!dto.startDate || !/^\d{4}-\d{2}-\d{2}$/.test(dto.startDate)) {
      throw new Error('Data de início inválida. Use o formato AAAA-MM-DD');
    }

    if (dto.endDate && !/^\d{4}-\d{2}-\d{2}$/.test(dto.endDate)) {
      throw new Error('Data de término inválida. Use o formato AAAA-MM-DD');
    }

    const category = this.categoryRepo.findById(dto.categoryId);
    if (!category) {
      throw new Error('Categoria informada não existe');
    }

    return this.recurringRepo.create(dto);
  }
}
