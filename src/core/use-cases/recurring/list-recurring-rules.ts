import {
  RecurringRule,
  UpdateRecurringRuleDTO,
} from '../../domain/recurring-rule.js';
import {
  IRecurringRuleRepository,
  ICategoryRepository,
  ITransactionRepository,
} from '../../domain/repositories.js';
import { DateUtils } from '../../utils/date-utils.js';
import { removeOpenOccurrences, syncOpenOccurrences } from './rule-occurrences.js';

export class ListRecurringRulesUseCase {
  constructor(private recurringRepo: IRecurringRuleRepository) {}

  execute(activeOnly?: boolean): RecurringRule[] {
    return this.recurringRepo.list(activeOnly);
  }
}

export class UpdateRecurringRuleUseCase {
  constructor(
    private recurringRepo: IRecurringRuleRepository,
    private categoryRepo: ICategoryRepository,
    private transactionRepo?: ITransactionRepository
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

    // Lançamentos já gerados e ainda em aberto acompanham a regra
    if (!updated.isActive) {
      removeOpenOccurrences(id, DateUtils.today(), this.transactionRepo);
    } else {
      syncOpenOccurrences(updated, this.transactionRepo);
      if (updated.endDate) {
        removeOpenOccurrences(id, nextDay(updated.endDate), this.transactionRepo);
      }
    }
    return updated;
  }
}

function nextDay(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const next = new Date(y, m - 1, d + 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`;
}

export class DeleteRecurringRuleUseCase {
  constructor(
    private recurringRepo: IRecurringRuleRepository,
    private transactionRepo?: ITransactionRepository
  ) {}

  /** Remove também os lançamentos futuros em aberto; os já pagos ficam como histórico. */
  execute(id: string): boolean {
    const existing = this.recurringRepo.findById(id);
    if (!existing) {
      throw new Error('Regra recorrente não encontrada');
    }
    removeOpenOccurrences(id, DateUtils.today(), this.transactionRepo);
    return this.recurringRepo.delete(id);
  }
}
