import {
  Investment,
  CreateInvestmentDTO,
  UpdateInvestmentDTO,
  ReserveSummary,
} from '../../domain/investment.js';
import {
  IInvestmentRepository,
  IRecurringRuleRepository,
  ICategoryRepository,
} from '../../domain/repositories.js';
import { DateUtils } from '../../utils/date-utils.js';

/**
 * Mantém a Receita Fixa do rendimento em sincronia com o investimento:
 * valor = rendimento − compromissos; sem valor líquido ou desligada, a receita é pausada.
 */
function syncIncomeRule(
  inv: Investment,
  repo: IInvestmentRepository,
  recurringRepo?: IRecurringRuleRepository,
  categoryRepo?: ICategoryRepository,
  linkRuleId?: string | null
): Investment {
  if (!recurringRepo) return inv;
  const netCents = inv.monthlyYieldCents - inv.monthlyCommitmentCents;
  const wantsIncome = inv.generatesIncome && netCents > 0;
  const currentRule =
    (linkRuleId && recurringRepo.findById(linkRuleId)) || (inv.recurringRuleId && recurringRepo.findById(inv.recurringRuleId)) || null;

  if (!wantsIncome) {
    if (currentRule?.isActive) recurringRepo.update(currentRule.id, { isActive: false });
    return inv;
  }

  if (currentRule) {
    recurringRepo.update(currentRule.id, { amountCents: netCents, dueDay: inv.incomeDueDay, isActive: true });
    if (currentRule.id !== inv.recurringRuleId) repo.setRecurringRule(inv.id, currentRule.id);
  } else {
    const incomeCategories = categoryRepo?.list('INCOME') ?? [];
    const category = incomeCategories.find((c) => c.name.toLowerCase().includes('invest')) ?? incomeCategories[0];
    if (!category) throw new Error('Cadastre uma categoria de receita para registrar o rendimento');
    const rule = recurringRepo.create({
      description: `Rendimento ${inv.name}`,
      amountCents: netCents,
      type: 'INCOME',
      categoryId: category.id,
      frequency: 'MONTHLY',
      dueDay: inv.incomeDueDay,
      // Começa hoje: não cria uma ocorrência já vencida no mês atual
      startDate: DateUtils.today(),
      paymentMethod: 'PIX',
      notes: `Gerada pela Reserva (${inv.name})`,
    });
    repo.setRecurringRule(inv.id, rule.id);
  }
  return repo.findById(inv.id)!;
}

function validate(dto: UpdateInvestmentDTO): void {
  if (dto.name !== undefined && dto.name.trim().length === 0) {
    throw new Error('O nome do investimento é obrigatório');
  }
  if (dto.incomeDueDay !== undefined && (!Number.isInteger(dto.incomeDueDay) || dto.incomeDueDay < 1 || dto.incomeDueDay > 31)) {
    throw new Error('O dia do rendimento deve estar entre 1 e 31');
  }
  for (const [field, label] of [
    ['balanceCents', 'O valor aplicado'],
    ['monthlyYieldCents', 'O rendimento mensal'],
    ['monthlyCommitmentCents', 'O compromisso mensal'],
  ] as const) {
    const value = dto[field];
    if (value !== undefined && (!Number.isInteger(value) || value < 0)) {
      throw new Error(`${label} não pode ser negativo`);
    }
  }
}

export class CreateInvestmentUseCase {
  constructor(
    private repo: IInvestmentRepository,
    private recurringRepo?: IRecurringRuleRepository,
    private categoryRepo?: ICategoryRepository
  ) {}

  execute(dto: CreateInvestmentDTO): Investment {
    validate({ ...dto, name: dto.name ?? '' });
    const created = this.repo.create(dto);
    return syncIncomeRule(created, this.repo, this.recurringRepo, this.categoryRepo, dto.linkRecurringRuleId);
  }
}

export class ListInvestmentsUseCase {
  constructor(private repo: IInvestmentRepository) {}

  execute(): Investment[] {
    return this.repo.list();
  }
}

export class UpdateInvestmentUseCase {
  constructor(
    private repo: IInvestmentRepository,
    private recurringRepo?: IRecurringRuleRepository,
    private categoryRepo?: ICategoryRepository
  ) {}

  execute(id: string, dto: UpdateInvestmentDTO): Investment {
    validate(dto);
    const updated = this.repo.update(id, dto);
    if (!updated) throw new Error('Investimento não encontrado');
    return syncIncomeRule(updated, this.repo, this.recurringRepo, this.categoryRepo, dto.linkRecurringRuleId);
  }
}

export class DeleteInvestmentUseCase {
  constructor(private repo: IInvestmentRepository, private recurringRepo?: IRecurringRuleRepository) {}

  /** A Receita Fixa vinculada é pausada, não apagada, para manter os meses já lançados. */
  execute(id: string): boolean {
    const existing = this.repo.findById(id);
    if (!existing) throw new Error('Investimento não encontrado');
    if (existing.recurringRuleId && this.recurringRepo?.findById(existing.recurringRuleId)) {
      this.recurringRepo.update(existing.recurringRuleId, { isActive: false });
    }
    return this.repo.delete(id);
  }
}

export class GetReserveSummaryUseCase {
  constructor(private repo: IInvestmentRepository) {}

  execute(): ReserveSummary {
    const investments = this.repo.list();
    const sum = (pick: (i: Investment) => number) => investments.reduce((acc, i) => acc + pick(i), 0);
    const monthlyYieldCents = sum((i) => i.monthlyYieldCents);
    return {
      count: investments.length,
      totalBalanceCents: sum((i) => i.balanceCents),
      monthlyYieldCents,
      monthlyNetYieldCents: monthlyYieldCents - sum((i) => i.monthlyCommitmentCents),
      investments,
    };
  }
}
