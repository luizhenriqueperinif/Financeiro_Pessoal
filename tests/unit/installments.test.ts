import { describe, it, expect, beforeEach } from 'vitest';
import { AppDatabase } from '../../src/infra/database/connection.js';
import { SqliteCategoryRepository } from '../../src/infra/repositories/sqlite-category-repository.js';
import { SqliteTransactionRepository } from '../../src/infra/repositories/sqlite-transaction-repository.js';
import { SqliteInstallmentPurchaseRepository } from '../../src/infra/repositories/sqlite-installment-purchase-repository.js';
import { DeleteTransactionUseCase } from '../../src/core/use-cases/transactions/index.js';
import {
  CreateInstallmentPurchaseUseCase,
  ListInstallmentPurchasesUseCase,
  PayInstallmentUseCase,
  UpdateInstallmentUseCase,
  UnpayInstallmentUseCase,
  GetCardSummariesUseCase,
  DeleteInstallmentPurchaseUseCase,
} from '../../src/core/use-cases/installments/index.js';

describe('Installment Purchases Use Cases (Compras Parceladas)', () => {
  let appDb: AppDatabase;
  let categoryRepo: SqliteCategoryRepository;
  let transactionRepo: SqliteTransactionRepository;
  let installmentRepo: SqliteInstallmentPurchaseRepository;
  let createPurchase: CreateInstallmentPurchaseUseCase;
  let listPurchases: ListInstallmentPurchasesUseCase;
  let payInstallment: PayInstallmentUseCase;
  let deletePurchase: DeleteInstallmentPurchaseUseCase;

  beforeEach(() => {
    appDb = new AppDatabase(':memory:');
    const rawDb = appDb.getRawDb();
    categoryRepo = new SqliteCategoryRepository(rawDb);
    transactionRepo = new SqliteTransactionRepository(rawDb);
    installmentRepo = new SqliteInstallmentPurchaseRepository(rawDb);

    createPurchase = new CreateInstallmentPurchaseUseCase(
      installmentRepo,
      categoryRepo
    );
    listPurchases = new ListInstallmentPurchasesUseCase(installmentRepo);
    payInstallment = new PayInstallmentUseCase(installmentRepo);
    deletePurchase = new DeleteInstallmentPurchaseUseCase(installmentRepo);
  });

  it('cadastra compra parcelada (Ex: Notebook R$ 3.600 em 12x) e gera 12 parcelas de R$ 300 mensais', () => {
    const outras = categoryRepo.findByName('Outras Despesas')!;

    const compra = createPurchase.execute({
      description: 'Notebook',
      totalAmountCents: 360000, // R$ 3.600,00
      totalInstallments: 12,
      firstDueDate: '2026-09-10',
      categoryId: outras.id,
      paymentMethod: 'CREDIT',
    });

    expect(compra.id).toBeDefined();
    expect(compra.installments?.length).toBe(12);

    // Valida as 3 primeiras parcelas
    expect(compra.installments![0].amountCents).toBe(30000);
    expect(compra.installments![0].dueDate).toBe('2026-09-10');
    expect(compra.installments![0].installmentNumber).toBe(1);

    expect(compra.installments![1].amountCents).toBe(30000);
    expect(compra.installments![1].dueDate).toBe('2026-10-10');
    expect(compra.installments![1].installmentNumber).toBe(2);

    expect(compra.installments![2].amountCents).toBe(30000);
    expect(compra.installments![2].dueDate).toBe('2026-11-10');
    expect(compra.installments![2].installmentNumber).toBe(3);

    // Valida a última parcela (12/12)
    expect(compra.installments![11].amountCents).toBe(30000);
    expect(compra.installments![11].dueDate).toBe('2027-08-10');
    expect(compra.installments![11].installmentNumber).toBe(12);

    // Garante que no mês de Setembro de 2026 o sistema considera SOMENTE R$ 300, e não R$ 3.600!
    const transacoesSetembro = transactionRepo.list({
      startDate: '2026-09-01',
      endDate: '2026-09-30',
    });
    expect(transacoesSetembro.length).toBe(1);
    expect(transacoesSetembro[0].amountCents).toBe(30000);
    expect(transacoesSetembro[0].description).toBe('Notebook (1/12)');
  });

  it('permite pagar ou adiantar uma parcela específica', () => {
    const outras = categoryRepo.findByName('Outras Despesas')!;
    const compra = createPurchase.execute({
      description: 'Smartphone',
      totalAmountCents: 120000,
      totalInstallments: 3,
      firstDueDate: '2026-09-15',
      categoryId: outras.id,
      paymentMethod: 'CREDIT',
    });

    const parcela1 = compra.installments![0];
    expect(parcela1.status).toBe('PENDING');

    const paga = payInstallment.execute(parcela1.id, '2026-09-14');
    expect(paga.status).toBe('PAID');
    expect(paga.paymentDate).toBe('2026-09-14');

    // Transação vinculada também é marcada como paga
    const tx = transactionRepo.findById(parcela1.transactionId!);
    expect(tx?.status).toBe('PAID');
  });

  it('exclui compra parcelada e remove todas as parcelas e transações vinculadas', () => {
    const outras = categoryRepo.findByName('Outras Despesas')!;
    const compra = createPurchase.execute({
      description: 'Mesa de Escritório',
      totalAmountCents: 60000,
      totalInstallments: 2,
      firstDueDate: '2026-09-20',
      categoryId: outras.id,
      paymentMethod: 'CREDIT',
    });

    expect(transactionRepo.list().length).toBe(2);

    const excluida = deletePurchase.execute(compra.id);
    expect(excluida).toBe(true);

    expect(installmentRepo.findById(compra.id)).toBeNull();
    expect(transactionRepo.list().length).toBe(0);
  });

  it('parcela atrasada volta a ficar pendente quando o vencimento é adiado', () => {
    const outras = categoryRepo.findByName('Outras Despesas')!;
    const updateInstallment = new UpdateInstallmentUseCase(installmentRepo);
    const compra = createPurchase.execute({
      description: 'Geladeira',
      totalAmountCents: 200000,
      totalInstallments: 2,
      firstDueDate: '2026-08-10',
      categoryId: outras.id,
      paymentMethod: 'CREDIT',
    });
    const parcela1 = compra.installments![0];
    expect(parcela1.status).toBe('OVERDUE');

    updateInstallment.execute(parcela1.id, { amountCents: 100500 });
    const adiada = updateInstallment.execute(parcela1.id, { dueDate: '2026-09-20' });

    expect(adiada.status).toBe('PENDING');
  });

  it('desfaz o pagamento de uma parcela e do lançamento vinculado', () => {
    const outras = categoryRepo.findByName('Outras Despesas')!;
    const unpayInstallment = new UnpayInstallmentUseCase(installmentRepo);
    const compra = createPurchase.execute({
      description: 'Sofá',
      totalAmountCents: 300000,
      totalInstallments: 3,
      firstDueDate: '2026-08-20',
      categoryId: outras.id,
      paymentMethod: 'CREDIT',
    });
    const [vencida, futura] = compra.installments!;
    payInstallment.execute(vencida.id, '2026-08-20');
    payInstallment.execute(futura.id, '2026-09-01');

    const desfeitaVencida = unpayInstallment.execute(vencida.id);
    const desfeitaFutura = unpayInstallment.execute(futura.id);

    expect(desfeitaVencida.status).toBe('OVERDUE');
    expect(desfeitaVencida.paymentDate).toBeNull();
    expect(desfeitaFutura.status).toBe('PENDING');
    const lancamento = transactionRepo.findById(futura.transactionId!)!;
    expect(lancamento.status).toBe('PENDING');
    expect(lancamento.paymentDate).toBeNull();
  });

  it('resume o total de cada cartão somando as parcelas de todas as compras, mês a mês', () => {
    const outras = categoryRepo.findByName('Outras Despesas')!;
    const cardSummaries = new GetCardSummariesUseCase(installmentRepo);
    const base = { categoryId: outras.id, paymentMethod: 'CREDIT' as const };
    // Nu CPF: 60 + 60 em out/nov (compra A) e 30 x 3 de out a dez (compra B)
    createPurchase.execute({ ...base, description: 'Fone', cardName: 'Nu CPF', totalAmountCents: 12000, totalInstallments: 2, firstDueDate: '2026-10-10' });
    createPurchase.execute({ ...base, description: 'Tênis', cardName: 'nu cpf ', totalAmountCents: 9000, totalInstallments: 3, firstDueDate: '2026-10-10' });
    createPurchase.execute({ ...base, description: 'Mercado', cardName: 'Joyce', totalAmountCents: 20000, totalInstallments: 2, firstDueDate: '2026-10-15' });
    createPurchase.execute({ ...base, description: 'Sem cartão', totalAmountCents: 5000, totalInstallments: 2, firstDueDate: '2026-10-01' });

    const compraFone = listPurchases.execute().find((p) => p.description === 'Fone')!;
    payInstallment.execute(compraFone.installments![0].id, '2026-10-10');

    const resumo = cardSummaries.execute();

    // Ordenado pelo que ainda falta pagar (maior primeiro)
    expect(resumo.map((c) => c.cardName)).toEqual(['Joyce', 'Nu CPF']);
    const nuCpf = resumo[1];
    expect(nuCpf.purchaseCount).toBe(2);
    expect(nuCpf.totalCents).toBe(21000);
    expect(nuCpf.remainingCents).toBe(15000);
    expect(nuCpf.months).toEqual([
      { yearMonth: '2026-10', amountCents: 9000, remainingCents: 3000 },
      { yearMonth: '2026-11', amountCents: 9000, remainingCents: 9000 },
      { yearMonth: '2026-12', amountCents: 3000, remainingCents: 3000 },
    ]);
    expect(resumo[0].totalCents).toBe(20000);
  });

  it('não deixa excluir pela lista de despesas o lançamento de uma parcela', () => {
    const outras = categoryRepo.findByName('Outras Despesas')!;
    const compra = createPurchase.execute({
      description: 'TV', totalAmountCents: 300000, totalInstallments: 3, firstDueDate: '2026-10-10',
      categoryId: outras.id, paymentMethod: 'CREDIT',
    });
    const txId = compra.installments![0].transactionId!;

    expect(() => new DeleteTransactionUseCase(transactionRepo).execute(txId)).toThrow(/Parcelamentos/);
    expect(transactionRepo.findById(txId)).not.toBeNull();
  });
});
