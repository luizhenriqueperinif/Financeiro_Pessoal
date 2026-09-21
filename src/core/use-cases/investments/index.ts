import {
  Investment,
  CreateInvestmentDTO,
  UpdateInvestmentDTO,
  ReserveSummary,
} from '../../domain/investment.js';
import { IInvestmentRepository } from '../../domain/repositories.js';

function validate(dto: UpdateInvestmentDTO): void {
  if (dto.name !== undefined && dto.name.trim().length === 0) {
    throw new Error('O nome do investimento é obrigatório');
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
  constructor(private repo: IInvestmentRepository) {}

  execute(dto: CreateInvestmentDTO): Investment {
    validate({ ...dto, name: dto.name ?? '' });
    return this.repo.create(dto);
  }
}

export class ListInvestmentsUseCase {
  constructor(private repo: IInvestmentRepository) {}

  execute(): Investment[] {
    return this.repo.list();
  }
}

export class UpdateInvestmentUseCase {
  constructor(private repo: IInvestmentRepository) {}

  execute(id: string, dto: UpdateInvestmentDTO): Investment {
    validate(dto);
    const updated = this.repo.update(id, dto);
    if (!updated) throw new Error('Investimento não encontrado');
    return updated;
  }
}

export class DeleteInvestmentUseCase {
  constructor(private repo: IInvestmentRepository) {}

  execute(id: string): boolean {
    if (!this.repo.findById(id)) throw new Error('Investimento não encontrado');
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
