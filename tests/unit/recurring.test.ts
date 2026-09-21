import { describe, it, expect, beforeEach } from 'vitest';
import { AppDatabase } from '../../src/infra/database/connection.js';
import { SqliteCategoryRepository } from '../../src/infra/repositories/sqlite-category-repository.js';
import { SqliteTransactionRepository } from '../../src/infra/repositories/sqlite-transaction-repository.js';
import { SqliteRecurringRuleRepository } from '../../src/infra/repositories/sqlite-recurring-rule-repository.js';
import { DeleteTransactionUseCase } from '../../src/core/use-cases/transactions/index.js';
import {
  CreateRecurringRuleUseCase,
  ListRecurringRulesUseCase,
  UpdateRecurringRuleUseCase,
  ProcessRecurringInstancesUseCase,
} from '../../src/core/use-cases/recurring/index.js';

describe('Recurring Rules Use Cases (Despesas Fixas)', () => {
  let appDb: AppDatabase;
  let categoryRepo: SqliteCategoryRepository;
  let transactionRepo: SqliteTransactionRepository;
  let recurringRepo: SqliteRecurringRuleRepository;
  let createRule: CreateRecurringRuleUseCase;
  let listRules: ListRecurringRulesUseCase;
  let updateRule: UpdateRecurringRuleUseCase;
  let processInstances: ProcessRecurringInstancesUseCase;

  beforeEach(() => {
    appDb = new AppDatabase(':memory:');
    const rawDb = appDb.getRawDb();
    categoryRepo = new SqliteCategoryRepository(rawDb);
    transactionRepo = new SqliteTransactionRepository(rawDb);
    recurringRepo = new SqliteRecurringRuleRepository(rawDb);
    createRule = new CreateRecurringRuleUseCase(recurringRepo, categoryRepo);
    listRules = new ListRecurringRulesUseCase(recurringRepo);
    updateRule = new UpdateRecurringRuleUseCase(recurringRepo, categoryRepo);
    processInstances = new ProcessRecurringInstancesUseCase(
      recurringRepo,
      transactionRepo
    );
  });

  it('cria regras de despesa fixa com sucesso', () => {
    const moradia = categoryRepo.findByName('Moradia')!;
    const regra = createRule.execute({
      description: 'Aluguel do Ap',
      amountCents: 120000,
      type: 'EXPENSE',
      categoryId: moradia.id,
      frequency: 'MONTHLY',
      dueDay: 10,
      startDate: '2026-01-01',
      paymentMethod: 'PIX',
    });

    expect(regra.id).toBeDefined();
    expect(regra.dueDay).toBe(10);
    expect(regra.isActive).toBe(true);
  });

  it('processa e instancia lançamentos no mês desejado sem duplicação', () => {
    const assinaturas = categoryRepo.findByName('Assinaturas')!;
    const moradia = categoryRepo.findByName('Moradia')!;

    createRule.execute({
      description: 'Netflix',
      amountCents: 5590,
      type: 'EXPENSE',
      categoryId: assinaturas.id,
      frequency: 'MONTHLY',
      dueDay: 15,
      startDate: '2026-05-01',
      paymentMethod: 'CREDIT',
    });

    createRule.execute({
      description: 'Internet Fibra',
      amountCents: 12000,
      type: 'EXPENSE',
      categoryId: assinaturas.id,
      frequency: 'MONTHLY',
      dueDay: 20,
      startDate: '2026-05-01',
      endDate: '2026-08-31', // Encerrou em agosto!
      paymentMethod: 'BOLETO',
    });

    // Processa Setembro/2026: Netflix deve ser criada, mas Internet Fibra não (já encerrou em agosto)
    const geradasSetembro = processInstances.execute('2026-09');
    expect(geradasSetembro.length).toBe(1);
    expect(geradasSetembro[0].description).toBe('Netflix');
    expect(geradasSetembro[0].date).toBe('2026-09-15');
    expect(geradasSetembro[0].status).toBe('PENDING');

    // Se processar Setembro novamente, nada deve ser duplicado!
    const segundaVez = processInstances.execute('2026-09');
    expect(segundaVez.length).toBe(0);

    // O repositório de transações deve conter apenas 1 lançamento
    const lista = transactionRepo.list({ startDate: '2026-09-01', endDate: '2026-09-30' });
    expect(lista.length).toBe(1);
  });

  it('não gera ocorrência com vencimento antes do início ou depois do fim da regra', () => {
    const moradia = categoryRepo.findByName('Moradia')!;
    const base = { amountCents: 10000, type: 'EXPENSE' as const, categoryId: moradia.id, frequency: 'MONTHLY' as const, dueDay: 5, paymentMethod: 'PIX' as const };
    createRule.execute({ ...base, description: 'Começa dia 20', startDate: '2026-09-20' });
    createRule.execute({ ...base, description: 'Termina dia 3', startDate: '2026-01-01', endDate: '2026-09-03' });

    expect(processInstances.execute('2026-09')).toHaveLength(0);
    expect(processInstances.execute('2026-10').map((t) => t.description)).toEqual(['Começa dia 20']);
  });

  it('regra anual gera lançamento apenas no mês de aniversário', () => {
    const outras = categoryRepo.findByName('Outras Despesas')!;
    createRule.execute({
      description: 'IPVA',
      amountCents: 150000,
      type: 'EXPENSE',
      categoryId: outras.id,
      frequency: 'YEARLY',
      dueDay: 15,
      startDate: '2026-03-01',
      paymentMethod: 'BOLETO',
    });

    expect(processInstances.execute('2026-09')).toHaveLength(0);
    expect(processInstances.execute('2027-03').map((t) => t.date)).toEqual(['2027-03-15']);
  });

  it('regra semanal gera um lançamento a cada 7 dias a partir do início', () => {
    const outras = categoryRepo.findByName('Outras Despesas')!;
    createRule.execute({
      description: 'Diarista',
      amountCents: 15000,
      type: 'EXPENSE',
      categoryId: outras.id,
      frequency: 'WEEKLY',
      dueDay: 1,
      startDate: '2026-08-28',
      paymentMethod: 'PIX',
    });

    const geradas = processInstances.execute('2026-09');
    expect(geradas.map((t) => t.date)).toEqual(['2026-09-04', '2026-09-11', '2026-09-18', '2026-09-25']);
    expect(processInstances.execute('2026-09')).toHaveLength(0);
  });

  it('ocorrência excluída pelo usuário não é recriada no reprocessamento do mês', () => {
    const assinaturas = categoryRepo.findByName('Assinaturas')!;
    const deleteTx = new DeleteTransactionUseCase(transactionRepo, recurringRepo);
    createRule.execute({
      description: 'Internet',
      amountCents: 9990,
      type: 'EXPENSE',
      categoryId: assinaturas.id,
      frequency: 'MONTHLY',
      dueDay: 10,
      startDate: '2026-01-01',
      paymentMethod: 'PIX',
    });

    const [outubro] = processInstances.execute('2026-10');
    deleteTx.execute(outubro.id);

    expect(processInstances.execute('2026-10')).toHaveLength(0);
    expect(processInstances.execute('2026-11')).toHaveLength(1);
  });
});
