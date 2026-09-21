import { describe, it, expect, beforeEach } from 'vitest';
import { AppDatabase } from '../../src/infra/database/connection.js';
import { SqliteCategoryRepository } from '../../src/infra/repositories/sqlite-category-repository.js';
import { SqliteTransactionRepository } from '../../src/infra/repositories/sqlite-transaction-repository.js';
import {
  CreateTransactionUseCase,
  ListTransactionsUseCase,
  UpdateTransactionUseCase,
  DeleteTransactionUseCase,
  MarkTransactionPaidUseCase,
  MarkTransactionUnpaidUseCase,
} from '../../src/core/use-cases/transactions/index.js';

describe('Transaction Use Cases (Receitas e Despesas)', () => {
  let appDb: AppDatabase;
  let categoryRepo: SqliteCategoryRepository;
  let transactionRepo: SqliteTransactionRepository;
  let createTx: CreateTransactionUseCase;
  let listTx: ListTransactionsUseCase;
  let updateTx: UpdateTransactionUseCase;
  let deleteTx: DeleteTransactionUseCase;
  let markPaid: MarkTransactionPaidUseCase;

  beforeEach(() => {
    appDb = new AppDatabase(':memory:');
    const rawDb = appDb.getRawDb();
    categoryRepo = new SqliteCategoryRepository(rawDb);
    transactionRepo = new SqliteTransactionRepository(rawDb);
    createTx = new CreateTransactionUseCase(transactionRepo, categoryRepo);
    listTx = new ListTransactionsUseCase(transactionRepo);
    updateTx = new UpdateTransactionUseCase(transactionRepo, categoryRepo);
    deleteTx = new DeleteTransactionUseCase(transactionRepo);
    markPaid = new MarkTransactionPaidUseCase(transactionRepo);
  });

  it('impede criação de despesa com categoria de receita', () => {
    const salario = categoryRepo.findByName('Salário')!;
    expect(() =>
      createTx.execute({
        description: 'Despesa errada',
        amountCents: 5000,
        type: 'EXPENSE',
        categoryId: salario.id,
        date: '2026-09-10',
        paymentMethod: 'PIX',
      })
    ).toThrow(/incompatível com esta transação/);
  });

  it('cria despesa e receita com sucesso e calcula filtros por mês', () => {
    const alimentacao = categoryRepo.findByName('Alimentação')!;
    const salario = categoryRepo.findByName('Salário')!;

    createTx.execute({
      description: 'Supermercado Mensal',
      amountCents: 85000,
      type: 'EXPENSE',
      categoryId: alimentacao.id,
      date: '2026-09-02',
      paymentMethod: 'DEBIT',
      status: 'PAID',
    });

    createTx.execute({
      description: 'Salário Setembro',
      amountCents: 500000,
      type: 'INCOME',
      categoryId: salario.id,
      date: '2026-09-05',
      paymentMethod: 'PIX',
      status: 'RECEIVED',
    });

    createTx.execute({
      description: 'Conta Outubro',
      amountCents: 10000,
      type: 'EXPENSE',
      categoryId: alimentacao.id,
      date: '2026-10-01',
      paymentMethod: 'PIX',
      status: 'PENDING',
    });

    const setembro = listTx.execute({ yearMonth: '2026-09' });
    expect(setembro.length).toBe(2);

    const outubro = listTx.execute({ yearMonth: '2026-10' });
    expect(outubro.length).toBe(1);
    expect(outubro[0].description).toBe('Conta Outubro');
  });

  it('marca despesa pendente como paga', () => {
    const moradia = categoryRepo.findByName('Moradia')!;
    const tx = createTx.execute({
      description: 'Luz',
      amountCents: 15000,
      type: 'EXPENSE',
      categoryId: moradia.id,
      date: '2026-09-20',
      paymentMethod: 'PIX',
      status: 'PENDING',
    });

    expect(tx.status).toBe('PENDING');

    const paga = markPaid.execute(tx.id, '2026-09-18');
    expect(paga.status).toBe('PAID');
    expect(paga.paymentDate).toBe('2026-09-18');
  });

  it('atualiza transação e exclui com sucesso', () => {
    const alimentacao = categoryRepo.findByName('Alimentação')!;
    const tx = createTx.execute({
      description: 'Padaria',
      amountCents: 2000,
      type: 'EXPENSE',
      categoryId: alimentacao.id,
      date: '2026-09-10',
      paymentMethod: 'MONEY',
      status: 'PAID',
    });

    const atualizada = updateTx.execute(tx.id, {
      description: 'Padaria Especial',
      amountCents: 2500,
    });
    expect(atualizada.description).toBe('Padaria Especial');
    expect(atualizada.amountCents).toBe(2500);

    const excluida = deleteTx.execute(tx.id);
    expect(excluida).toBe(true);
    expect(transactionRepo.findById(tx.id)).toBeNull();
  });

  it('conta atrasada volta a ficar pendente quando o vencimento é adiado', () => {
    const moradia = categoryRepo.findByName('Moradia')!;
    const tx = createTx.execute({
      description: 'Internet',
      amountCents: 9990,
      type: 'EXPENSE',
      categoryId: moradia.id,
      date: '2026-08-25',
      paymentMethod: 'PIX',
      status: 'PENDING',
    });
    expect(listTx.execute({ yearMonth: '2026-08' })[0].status).toBe('OVERDUE');

    updateTx.execute(tx.id, { description: 'Internet Fibra' });
    const adiada = updateTx.execute(tx.id, { date: '2026-09-15' });

    expect(adiada.status).toBe('PENDING');
  });

  it('filtra por atrasadas e por pendentes a vencer separadamente', () => {
    const moradia = categoryRepo.findByName('Moradia')!;
    const base = { amountCents: 1000, type: 'EXPENSE' as const, categoryId: moradia.id, paymentMethod: 'PIX' as const, status: 'PENDING' as const };
    createTx.execute({ ...base, description: 'Vencida', date: '2026-08-20' });
    createTx.execute({ ...base, description: 'A vencer', date: '2026-09-10' });

    expect(listTx.execute({ status: 'OVERDUE' }).map((t) => t.description)).toEqual(['Vencida']);
    expect(listTx.execute({ status: 'PENDING' }).map((t) => t.description)).toEqual(['A vencer']);
  });

  it('desmarcar como paga volta a pendente e, se vencida, aparece como atrasada', () => {
    const moradia = categoryRepo.findByName('Moradia')!;
    const markUnpaid = new MarkTransactionUnpaidUseCase(transactionRepo);
    const tx = createTx.execute({
      description: 'Gás',
      amountCents: 12000,
      type: 'EXPENSE',
      categoryId: moradia.id,
      date: '2026-08-28',
      paymentMethod: 'PIX',
      status: 'PAID',
    });

    const desmarcada = markUnpaid.execute(tx.id);
    expect(desmarcada.status).toBe('OVERDUE');
    expect(desmarcada.paymentDate).toBeNull();

    const adiada = updateTx.execute(tx.id, { date: '2026-09-30' });
    expect(adiada.status).toBe('PENDING');
  });
});
