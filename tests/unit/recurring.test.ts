import { describe, it, expect, beforeEach } from 'vitest';
import { AppDatabase } from '../../src/infra/database/connection.js';
import { SqliteCategoryRepository } from '../../src/infra/repositories/sqlite-category-repository.js';
import { SqliteTransactionRepository } from '../../src/infra/repositories/sqlite-transaction-repository.js';
import { SqliteRecurringRuleRepository } from '../../src/infra/repositories/sqlite-recurring-rule-repository.js';
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
});
