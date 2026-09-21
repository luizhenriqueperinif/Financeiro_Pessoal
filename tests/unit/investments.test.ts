import { describe, it, expect, beforeEach } from 'vitest';
import { AppDatabase } from '../../src/infra/database/connection.js';
import { SqliteInvestmentRepository } from '../../src/infra/repositories/sqlite-investment-repository.js';
import {
  CreateInvestmentUseCase,
  ListInvestmentsUseCase,
  UpdateInvestmentUseCase,
  DeleteInvestmentUseCase,
  GetReserveSummaryUseCase,
} from '../../src/core/use-cases/investments/index.js';

describe('Reserva e Investimentos', () => {
  let repo: SqliteInvestmentRepository;

  beforeEach(() => {
    repo = new SqliteInvestmentRepository(new AppDatabase(':memory:').getRawDb());
  });

  it('cadastra, edita, lista e exclui investimentos', () => {
    const create = new CreateInvestmentUseCase(repo);
    const cdb = create.execute({
      name: 'CDB Liquidez Diária',
      balanceCents: 2000000,
      monthlyYieldCents: 60000,
      monthlyCommitmentCents: 46000,
      notes: 'Parte do rendimento vai para meu pai',
    });

    new UpdateInvestmentUseCase(repo).execute(cdb.id, { balanceCents: 2100000 });

    const [listado] = new ListInvestmentsUseCase(repo).execute();
    expect(listado.name).toBe('CDB Liquidez Diária');
    expect(listado.balanceCents).toBe(2100000);
    expect(listado.monthlyCommitmentCents).toBe(46000);

    expect(new DeleteInvestmentUseCase(repo).execute(cdb.id)).toBe(true);
    expect(new ListInvestmentsUseCase(repo).execute()).toHaveLength(0);
  });

  it('recusa investimento sem nome ou com valor negativo', () => {
    const create = new CreateInvestmentUseCase(repo);
    expect(() => create.execute({ name: '  ', balanceCents: 100 })).toThrow(/nome/i);
    expect(() => create.execute({ name: 'Poupança', balanceCents: -1 })).toThrow(/negativo/i);
  });

  it('resume a reserva com o rendimento líquido que sobra para o usuário', () => {
    const create = new CreateInvestmentUseCase(repo);
    create.execute({ name: 'CDB', balanceCents: 2000000, monthlyYieldCents: 60000, monthlyCommitmentCents: 46000 });
    create.execute({ name: 'Poupança', balanceCents: 50000, monthlyYieldCents: 300 });

    const resumo = new GetReserveSummaryUseCase(repo).execute();

    expect(resumo.totalBalanceCents).toBe(2050000);
    expect(resumo.monthlyYieldCents).toBe(60300);
    expect(resumo.monthlyNetYieldCents).toBe(14300);
    expect(resumo.count).toBe(2);
  });
});
