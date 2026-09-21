import { describe, it, expect, beforeEach } from 'vitest';
import { ReconcileStatementUseCase } from '../../src/core/use-cases/statement/reconcile-statement.js';
import { ITransactionRepository, ICategoryRepository } from '../../src/core/domain/repositories.js';
import { BankStatementItem } from '../../src/core/domain/statement.js';
import { AppDatabase } from '../../src/infra/database/connection.js';
import { SqliteCategoryRepository } from '../../src/infra/repositories/sqlite-category-repository.js';
import { SqliteTransactionRepository } from '../../src/infra/repositories/sqlite-transaction-repository.js';

describe('ReconcileStatementUseCase (Costura 2: Conciliação e Deduplicação)', () => {
  let txRepo: ITransactionRepository;
  let catRepo: ICategoryRepository;
  let useCase: ReconcileStatementUseCase;

  const existingTransactions: any[] = [
    {
      id: 'tx-1',
      description: 'Combustível Posto Shell',
      amountCents: 24000,
      type: 'EXPENSE',
      categoryId: 'cat-transporte',
      date: '2026-09-05',
      status: 'PAID',
    },
  ];

  const categories: any[] = [
    { id: 'cat-transporte', name: 'Transporte', type: 'EXPENSE' },
    { id: 'cat-salario', name: 'Salário', type: 'INCOME' },
    { id: 'cat-outras', name: 'Outras Despesas', type: 'EXPENSE' },
  ];

  beforeEach(() => {
    txRepo = {
      create: (dto: any) => ({ ...dto, id: 'new-' + Math.random(), createdAt: '', updatedAt: '' }),
      findById: () => null,
      list: () => existingTransactions,
      update: () => null,
      delete: () => true,
      findByRecurringInstance: () => null,
    } as unknown as ITransactionRepository;

    catRepo = {
      list: () => categories,
      findById: (id: string) => categories.find((c) => c.id === id) || null,
      findByName: (name: string) => categories.find((c) => c.name.toLowerCase() === name.toLowerCase()) || null,
      create: () => null,
      update: () => null,
      delete: () => true,
    } as unknown as ICategoryRepository;

    useCase = new ReconcileStatementUseCase(txRepo, catRepo);
  });

  it('detecta duplicatas com base em data, valor e tipo', () => {
    const items: BankStatementItem[] = [
      {
        externalId: 'ext-1',
        date: '2026-09-05',
        description: 'Shell Posto Auto',
        amountCents: 24000,
        type: 'EXPENSE',
        suggestedCategory: 'Transporte',
      },
      {
        externalId: 'ext-2',
        date: '2026-09-10',
        description: 'Padaria Doce Pão',
        amountCents: 3500,
        type: 'EXPENSE',
        suggestedCategory: 'Alimentação',
      },
    ];

    const preview = useCase.preview(items);

    expect(preview).toHaveLength(2);

    // O item do posto já existe no banco (2026-09-05, R$ 240,00, EXPENSE)
    expect(preview[0].isDuplicate).toBe(true);
    expect(preview[0].selected).toBe(false);
    expect(preview[0].matchedTransactionId).toBe('tx-1');

    // O item da padaria é novo
    expect(preview[1].isDuplicate).toBe(false);
    expect(preview[1].selected).toBe(true);
  });

  it('salva apenas os itens confirmados no repositório de transações', () => {
    const itemsToCommit = [
      {
        date: '2026-09-10',
        description: 'Padaria Doce Pão',
        amountCents: 3500,
        type: 'EXPENSE' as const,
        categoryId: 'cat-outras',
        paymentMethod: 'DEBIT' as const,
      },
    ];

    const result = useCase.commit(itemsToCommit);

    expect(result.importedCount).toBe(1);
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].description).toBe('Padaria Doce Pão');
    expect(result.transactions[0].amountCents).toBe(3500);
  });
});

describe('ReconcileStatementUseCase com banco SQLite', () => {
  let appDb: AppDatabase;
  let txRepo: SqliteTransactionRepository;
  let catRepo: SqliteCategoryRepository;
  let useCase: ReconcileStatementUseCase;

  beforeEach(() => {
    appDb = new AppDatabase(':memory:');
    const rawDb = appDb.getRawDb();
    txRepo = new SqliteTransactionRepository(rawDb);
    catRepo = new SqliteCategoryRepository(rawDb);
    useCase = new ReconcileStatementUseCase(txRepo, catRepo, (fn) => rawDb.transaction(fn)());
  });

  it('item do extrato que corresponde a uma conta pendente a quita em vez de duplicar', () => {
    const moradia = catRepo.findByName('Moradia')!;
    const pendente = txRepo.create({
      description: 'Conta de Luz',
      amountCents: 18000,
      type: 'EXPENSE',
      categoryId: moradia.id,
      date: '2026-09-08',
      paymentMethod: 'BOLETO',
      status: 'PENDING',
    });

    const [row] = useCase.preview([
      { externalId: 'e1', date: '2026-09-08', description: 'ENEL', amountCents: 18000, type: 'EXPENSE' },
    ]);
    expect(row.isDuplicate).toBe(false);
    expect(row.selected).toBe(true);
    expect(row.settlesTransactionId).toBe(pendente.id);

    const result = useCase.commit([
      { date: '2026-09-08', description: 'ENEL', amountCents: 18000, type: 'EXPENSE', categoryId: moradia.id, settlesTransactionId: pendente.id },
    ]);

    expect(result.settledCount).toBe(1);
    expect(result.importedCount).toBe(0);
    expect(txRepo.list()).toHaveLength(1);
    expect(txRepo.findById(pendente.id)!.status).toBe('PAID');
    expect(txRepo.findById(pendente.id)!.paymentDate).toBe('2026-09-08');
  });

  it('não grava nada se algum item da importação for inválido', () => {
    const moradia = catRepo.findByName('Moradia')!;
    expect(() =>
      useCase.commit([
        { date: '2026-09-01', description: 'Válido', amountCents: 1000, type: 'EXPENSE', categoryId: moradia.id },
        { date: '2026-09-02', description: 'Sem categoria', amountCents: 2000, type: 'EXPENSE', categoryId: '' },
      ])
    ).toThrow();

    expect(txRepo.list()).toHaveLength(0);
  });
});
