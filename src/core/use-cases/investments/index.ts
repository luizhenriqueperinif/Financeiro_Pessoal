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
  ITransactionRepository,
} from '../../domain/repositories.js';
import { DateUtils } from '../../utils/date-utils.js';
import { removeOpenOccurrences, syncOpenOccurrences } from '../recurring/rule-occurrences.js';

/** Pausa a receita e tira das Receitas os rendimentos futuros ainda não recebidos. */
function stopIncomeRule(ruleId: string, recurringRepo: IRecurringRuleRepository, transactionRepo?: ITransactionRepository): void {
  const rule = recurringRepo.findById(ruleId);
  if (!rule) return;
  if (rule.isActive) recurringRepo.update(ruleId, { isActive: false });
  removeOpenOccurrences(ruleId, DateUtils.today(), transactionRepo);
}

/**
 * Mantém a Receita Fixa do rendimento em sincronia com o investimento:
 * valor = rendimento − compromissos; sem valor líquido ou desligada, a receita é pausada.
 */
function syncIncomeRule(
  inv: Investment,
  repo: IInvestmentRepository,
  recurringRepo?: IRecurringRuleRepository,
  categoryRepo?: ICategoryRepository,
  options: { linkRuleId?: string | null; createNew?: boolean } = {},
  transactionRepo?: ITransactionRepository
): Investment {
  if (!recurringRepo) return inv;
  const netCents = inv.monthlyYieldCents - inv.monthlyCommitmentCents;
  const wantsIncome = inv.generatesIncome && netCents > 0;
  const previous = inv.recurringRuleId ? recurringRepo.findById(inv.recurringRuleId) : null;

  if (!wantsIncome) {
    if (previous) stopIncomeRule(previous.id, recurringRepo, transactionRepo);
    return inv;
  }

  // Qual receita fica vinculada: a escolhida, uma nova, ou a atual
  const linked = options.linkRuleId ? recurringRepo.findById(options.linkRuleId) : null;
  const target = options.createNew ? null : linked ?? previous;
  if (previous && previous.id !== target?.id) {
    stopIncomeRule(previous.id, recurringRepo, transactionRepo);
  }

  if (target) {
    const updated = recurringRepo.update(target.id, { amountCents: netCents, dueDay: inv.incomeDueDay, isActive: true })!;
    if (target.id !== inv.recurringRuleId) repo.setRecurringRule(inv.id, target.id);
    syncOpenOccurrences(updated, transactionRepo);
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
      // Começa no mês atual para o rendimento deste mês já aparecer em Receitas
      startDate: `${DateUtils.currentYearMonth()}-01`,
      paymentMethod: 'PIX',
      notes: `Gerada pelo investimento ${inv.name}`,
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
    private categoryRepo?: ICategoryRepository,
    private transactionRepo?: ITransactionRepository
  ) {}

  execute(dto: CreateInvestmentDTO): Investment {
    validate({ ...dto, name: dto.name ?? '' });
    const created = this.repo.create(dto);
    return syncIncomeRule(created, this.repo, this.recurringRepo, this.categoryRepo, { linkRuleId: dto.linkRecurringRuleId }, this.transactionRepo);
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
    private categoryRepo?: ICategoryRepository,
    private transactionRepo?: ITransactionRepository
  ) {}

  execute(id: string, dto: UpdateInvestmentDTO): Investment {
    validate(dto);
    const updated = this.repo.update(id, dto);
    if (!updated) throw new Error('Investimento não encontrado');
    return syncIncomeRule(
      updated,
      this.repo,
      this.recurringRepo,
      this.categoryRepo,
      { linkRuleId: dto.linkRecurringRuleId, createNew: dto.createNewIncomeRule },
      this.transactionRepo
    );
  }
}

export class DeleteInvestmentUseCase {
  constructor(
    private repo: IInvestmentRepository,
    private recurringRepo?: IRecurringRuleRepository,
    private transactionRepo?: ITransactionRepository
  ) {}

  /** A Receita Fixa vinculada é pausada, não apagada, para manter os meses já recebidos. */
  execute(id: string): boolean {
    const existing = this.repo.findById(id);
    if (!existing) throw new Error('Investimento não encontrado');
    if (existing.recurringRuleId && this.recurringRepo) {
      stopIncomeRule(existing.recurringRuleId, this.recurringRepo, this.transactionRepo);
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
