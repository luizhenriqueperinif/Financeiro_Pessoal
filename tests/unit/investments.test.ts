import { describe, it, expect, beforeEach } from 'vitest';
import { AppDatabase } from '../../src/infra/database/connection.js';
import { SqliteInvestmentRepository } from '../../src/infra/repositories/sqlite-investment-repository.js';
import { SqliteRecurringRuleRepository } from '../../src/infra/repositories/sqlite-recurring-rule-repository.js';
import { SqliteCategoryRepository } from '../../src/infra/repositories/sqlite-category-repository.js';
import { SqliteTransactionRepository } from '../../src/infra/repositories/sqlite-transaction-repository.js';
import { ListTransactionsUseCase } from '../../src/core/use-cases/transactions/index.js';
import { ProcessRecurringInstancesUseCase } from '../../src/core/use-cases/recurring/index.js';
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

describe('Rendimento do investimento como Receita Fixa', () => {
  let repo: SqliteInvestmentRepository;
  let recurringRepo: SqliteRecurringRuleRepository;
  let categoryRepo: SqliteCategoryRepository;
  let create: CreateInvestmentUseCase;
  let update: UpdateInvestmentUseCase;
  let remove: DeleteInvestmentUseCase;

  beforeEach(() => {
    const raw = new AppDatabase(':memory:').getRawDb();
    repo = new SqliteInvestmentRepository(raw);
    recurringRepo = new SqliteRecurringRuleRepository(raw);
    categoryRepo = new SqliteCategoryRepository(raw);
    create = new CreateInvestmentUseCase(repo, recurringRepo, categoryRepo);
    update = new UpdateInvestmentUseCase(repo, recurringRepo, categoryRepo);
    remove = new DeleteInvestmentUseCase(repo, recurringRepo);
  });

  it('gera uma receita fixa com o rendimento líquido, no dia escolhido', () => {
    const inv = create.execute({
      name: 'CDB', balanceCents: 2000000, monthlyYieldCents: 60000, monthlyCommitmentCents: 46000,
      generatesIncome: true, incomeDueDay: 15,
    });

    const rule = recurringRepo.findById(inv.recurringRuleId!)!;
    expect(rule.type).toBe('INCOME');
    expect(rule.amountCents).toBe(14000);
    expect(rule.dueDay).toBe(15);
    expect(rule.isActive).toBe(true);
    expect(rule.categoryName).toBe('Investimentos');
  });

  it('usa uma receita fixa já existente em vez de duplicar', () => {
    const investimentos = categoryRepo.findByName('Investimentos')!;
    const existente = recurringRepo.create({
      description: 'Rendimentos', amountCents: 13000, type: 'INCOME', categoryId: investimentos.id,
      frequency: 'MONTHLY', dueDay: 15, startDate: '2026-01-01', paymentMethod: 'PIX',
    });

    const inv = create.execute({
      name: 'CDB', balanceCents: 2000000, monthlyYieldCents: 60000, monthlyCommitmentCents: 46000,
      generatesIncome: true, incomeDueDay: 15, linkRecurringRuleId: existente.id,
    });

    expect(inv.recurringRuleId).toBe(existente.id);
    expect(recurringRepo.list()).toHaveLength(1);
    expect(recurringRepo.findById(existente.id)!.amountCents).toBe(14000);
    expect(recurringRepo.findById(existente.id)!.description).toBe('Rendimentos');
  });

  it('atualiza a receita ao editar o investimento e a pausa ao desligar ou excluir', () => {
    const inv = create.execute({ name: 'CDB', balanceCents: 2000000, monthlyYieldCents: 60000, generatesIncome: true, incomeDueDay: 10 });

    update.execute(inv.id, { monthlyYieldCents: 65000, incomeDueDay: 12 });
    let rule = recurringRepo.findById(inv.recurringRuleId!)!;
    expect(rule.amountCents).toBe(65000);
    expect(rule.dueDay).toBe(12);

    update.execute(inv.id, { generatesIncome: false });
    expect(recurringRepo.findById(inv.recurringRuleId!)!.isActive).toBe(false);

    update.execute(inv.id, { generatesIncome: true });
    expect(recurringRepo.findById(inv.recurringRuleId!)!.isActive).toBe(true);

    remove.execute(inv.id);
    rule = recurringRepo.findById(inv.recurringRuleId!)!;
    expect(rule.isActive).toBe(false); // mantém o histórico dos meses já lançados
  });

  it('não gera receita quando o rendimento inteiro já está comprometido', () => {
    const inv = create.execute({ name: 'CDB', balanceCents: 100000, monthlyYieldCents: 3000, monthlyCommitmentCents: 3000, generatesIncome: true });
    expect(inv.recurringRuleId ?? null).toBeNull();
    expect(recurringRepo.list()).toHaveLength(0);
  });

  it('o rendimento aparece nas Receitas do mês atual e acompanha a edição do investimento', () => {
    // Relógio dos testes: 01/09/2026
    const raw = (repo as any).db;
    const txRepo = new SqliteTransactionRepository(raw);
    const process = new ProcessRecurringInstancesUseCase(recurringRepo, txRepo);
    const listIncomes = () =>
      new ListTransactionsUseCase(txRepo, process).execute({ yearMonth: '2026-09', type: 'INCOME' });
    create = new CreateInvestmentUseCase(repo, recurringRepo, categoryRepo, txRepo);
    update = new UpdateInvestmentUseCase(repo, recurringRepo, categoryRepo, txRepo);

    const inv = create.execute({ name: 'CDB', balanceCents: 2000000, monthlyYieldCents: 60000, monthlyCommitmentCents: 46000, generatesIncome: true, incomeDueDay: 15 });

    let receitas = listIncomes();
    expect(receitas).toHaveLength(1);
    expect(receitas[0]).toMatchObject({ description: 'Rendimento CDB', amountCents: 14000, date: '2026-09-15', status: 'PENDING' });

    update.execute(inv.id, { monthlyYieldCents: 62000, incomeDueDay: 20 });

    receitas = listIncomes();
    expect(receitas).toHaveLength(1);
    expect(receitas[0]).toMatchObject({ amountCents: 16000, date: '2026-09-20' });
  });

  describe('trocar ou desligar a receita do investimento', () => {
    const setup = () => {
      const raw = (repo as any).db;
      const txRepo = new SqliteTransactionRepository(raw);
      const process = new ProcessRecurringInstancesUseCase(recurringRepo, txRepo);
      const incomes = (ym: string) => new ListTransactionsUseCase(txRepo, process).execute({ yearMonth: ym, type: 'INCOME' });
      create = new CreateInvestmentUseCase(repo, recurringRepo, categoryRepo, txRepo);
      update = new UpdateInvestmentUseCase(repo, recurringRepo, categoryRepo, txRepo);
      remove = new DeleteInvestmentUseCase(repo, recurringRepo, txRepo);
      return { incomes };
    };

    it('ao vincular outra receita fixa, a antiga é pausada e sai das Receitas', () => {
      const { incomes } = setup();
      const inv = create.execute({ name: 'CDB', balanceCents: 100000, monthlyYieldCents: 8000, generatesIncome: true, incomeDueDay: 15 });
      incomes('2026-10');
      const investimentos = categoryRepo.findByName('Investimentos')!;
      const outra = recurringRepo.create({
        description: 'Juros', amountCents: 1000, type: 'INCOME', categoryId: investimentos.id,
        frequency: 'MONTHLY', dueDay: 20, startDate: '2026-09-01', paymentMethod: 'PIX',
      });

      update.execute(inv.id, { linkRecurringRuleId: outra.id });

      expect(recurringRepo.findById(inv.recurringRuleId!)!.isActive).toBe(false);
      expect(incomes('2026-10').map((t) => [t.description, t.amountCents])).toEqual([['Juros', 8000]]);
    });

    it('pedir uma receita nova ao editar pausa a antiga e cria outra', () => {
      setup();
      const inv = create.execute({ name: 'CDB', balanceCents: 100000, monthlyYieldCents: 8000, generatesIncome: true });
      const antiga = inv.recurringRuleId!;

      const editado = update.execute(inv.id, { createNewIncomeRule: true });

      expect(editado.recurringRuleId).not.toBe(antiga);
      expect(recurringRepo.findById(antiga)!.isActive).toBe(false);
      expect(recurringRepo.findById(editado.recurringRuleId!)!.isActive).toBe(true);
    });

    it('desligar a receita ou excluir o investimento tira os rendimentos futuros das Receitas', () => {
      const { incomes } = setup();
      const inv = create.execute({ name: 'CDB', balanceCents: 100000, monthlyYieldCents: 8000, generatesIncome: true, incomeDueDay: 15 });
      expect(incomes('2026-10')).toHaveLength(1);

      update.execute(inv.id, { generatesIncome: false });
      expect(incomes('2026-10')).toHaveLength(0);

      update.execute(inv.id, { generatesIncome: true });
      expect(incomes('2026-10')).toHaveLength(1);
      remove.execute(inv.id);
      expect(incomes('2026-10')).toHaveLength(0);
    });
  });
});
