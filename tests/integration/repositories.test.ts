import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AppDatabase } from '../../src/infra/database/connection.js';
import { SqliteCategoryRepository } from '../../src/infra/repositories/sqlite-category-repository.js';
import { SqliteTransactionRepository } from '../../src/infra/repositories/sqlite-transaction-repository.js';
import { SqliteRecurringRuleRepository } from '../../src/infra/repositories/sqlite-recurring-rule-repository.js';
import { SqliteInstallmentPurchaseRepository } from '../../src/infra/repositories/sqlite-installment-purchase-repository.js';
import { Money } from '../../src/core/value-objects/money.js';

describe('SQLite Repositories Integration', () => {
  let appDb: AppDatabase;
  let categoryRepo: SqliteCategoryRepository;
  let transactionRepo: SqliteTransactionRepository;
  let recurringRepo: SqliteRecurringRuleRepository;
  let installmentRepo: SqliteInstallmentPurchaseRepository;

  beforeEach(() => {
    appDb = new AppDatabase(':memory:');
    const rawDb = appDb.getRawDb();
    categoryRepo = new SqliteCategoryRepository(rawDb);
    transactionRepo = new SqliteTransactionRepository(rawDb);
    recurringRepo = new SqliteRecurringRuleRepository(rawDb);
    installmentRepo = new SqliteInstallmentPurchaseRepository(rawDb);
  });

  afterEach(() => {
    appDb.close();
  });

  describe('Category Repository', () => {
    it('cria, busca por nome e lista categorias', () => {
      const nova = categoryRepo.create({
        name: 'Pets',
        type: 'EXPENSE',
        description: 'Veterinário e ração',
        color: '#ff9900',
        icon: 'Dog',
      });

      expect(nova.id).toBeDefined();
      expect(nova.name).toBe('Pets');

      const encontrada = categoryRepo.findByName('pets');
      expect(encontrada?.id).toBe(nova.id);

      const despesas = categoryRepo.list('EXPENSE');
      expect(despesas.some((c) => c.name === 'Pets')).toBe(true);
    });

    it('impede exclusão de categoria quando há transações vinculadas', () => {
      const alimentacao = categoryRepo.findByName('Alimentação')!;

      transactionRepo.create({
        description: 'Supermercado',
        amountCents: 15000,
        type: 'EXPENSE',
        categoryId: alimentacao.id,
        date: '2026-09-10',
        paymentMethod: 'DEBIT',
      });

      expect(() => categoryRepo.delete(alimentacao.id)).toThrow(
        /Não é possível excluir a categoria/
      );
    });
  });

  describe('Transaction Repository', () => {
    it('cria transação de receita e despesa e permite filtros', () => {
      const salarioCat = categoryRepo.findByName('Salário')!;
      const alimentacaoCat = categoryRepo.findByName('Alimentação')!;

      transactionRepo.create({
        description: 'Salário Mensal',
        amountCents: 500000, // R$ 5.000,00
        type: 'INCOME',
        categoryId: salarioCat.id,
        date: '2026-09-05',
        paymentMethod: 'PIX',
        status: 'RECEIVED',
      });

      transactionRepo.create({
        description: 'Almoço Restaurante',
        amountCents: 4500, // R$ 45,00
        type: 'EXPENSE',
        categoryId: alimentacaoCat.id,
        date: '2026-09-08',
        paymentMethod: 'CREDIT',
        status: 'PAID',
      });

      const todas = transactionRepo.list();
      expect(todas.length).toBe(2);

      const receitas = transactionRepo.list({ type: 'INCOME' });
      expect(receitas.length).toBe(1);
      expect(receitas[0].description).toBe('Salário Mensal');
      expect(receitas[0].categoryName).toBe('Salário');

      const busca = transactionRepo.list({ search: 'restaurante' });
      expect(busca.length).toBe(1);
      expect(busca[0].amountCents).toBe(4500);
    });

    it('marca transação como paga e atualiza data de liquidação', () => {
      const moradiaCat = categoryRepo.findByName('Moradia')!;

      const t = transactionRepo.create({
        description: 'Condomínio',
        amountCents: 65000,
        type: 'EXPENSE',
        categoryId: moradiaCat.id,
        date: '2026-09-15',
        paymentMethod: 'BOLETO',
        status: 'PENDING',
      });

      expect(t.status).toBe('PENDING');

      const paga = transactionRepo.markAsPaid(t.id, '2026-09-14');
      expect(paga?.status).toBe('PAID');
      expect(paga?.paymentDate).toBe('2026-09-14');
    });
  });

  describe('Recurring Rule Repository', () => {
    it('cria regra de despesa fixa e permite pausar/reativar', () => {
      const moradiaCat = categoryRepo.findByName('Moradia')!;

      const regra = recurringRepo.create({
        description: 'Aluguel Apartamento',
        amountCents: 120000,
        type: 'EXPENSE',
        categoryId: moradiaCat.id,
        frequency: 'MONTHLY',
        dueDay: 10,
        startDate: '2026-01-01',
        paymentMethod: 'PIX',
      });

      expect(regra.id).toBeDefined();
      expect(regra.isActive).toBe(true);

      const pausada = recurringRepo.update(regra.id, { isActive: false });
      expect(pausada?.isActive).toBe(false);

      const ativas = recurringRepo.list(true);
      expect(ativas.some((r) => r.id === regra.id)).toBe(false);
    });
  });

  describe('Installment Purchase Repository', () => {
    it('cria compra parcelada com parcelas e transações geradas automaticamente', () => {
      const outrasCat = categoryRepo.findByName('Outras Despesas')!;
      const totalCents = 360000; // R$ 3.600,00
      const parcelasParts = Money.splitInstallments(totalCents, 3); // 3x de 1.200,00

      const installmentsData = [
        {
          purchaseId: '',
          installmentNumber: 1,
          totalInstallments: 3,
          amountCents: parcelasParts[0],
          dueDate: '2026-09-10',
          status: 'PENDING' as const,
        },
        {
          purchaseId: '',
          installmentNumber: 2,
          totalInstallments: 3,
          amountCents: parcelasParts[1],
          dueDate: '2026-10-10',
          status: 'PENDING' as const,
        },
        {
          purchaseId: '',
          installmentNumber: 3,
          totalInstallments: 3,
          amountCents: parcelasParts[2],
          dueDate: '2026-11-10',
          status: 'PENDING' as const,
        },
      ];

      const compra = installmentRepo.create(
        {
          description: 'Notebook Dell',
          totalAmountCents: totalCents,
          totalInstallments: 3,
          firstDueDate: '2026-09-10',
          categoryId: outrasCat.id,
          paymentMethod: 'CREDIT',
        },
        installmentsData
      );

      expect(compra.id).toBeDefined();
      expect(compra.installments?.length).toBe(3);
      expect(compra.installments?.[0].amountCents).toBe(120000);

      // Verifica se as transações de cada parcela foram criadas no repositório de transações
      const transacoes = transactionRepo.list();
      expect(transacoes.length).toBe(3);
      expect(transacoes[0].description).toContain('Notebook Dell (3/3)');

      // Testa atualização individual de parcela (ex: pagar parcela 1)
      const p1 = compra.installments![0];
      const p1Atualizada = installmentRepo.updateInstallment(p1.id, {
        status: 'PAID',
        paymentDate: '2026-09-10',
      });
      expect(p1Atualizada?.status).toBe('PAID');

      // Verifica se a transação correspondente também foi atualizada para PAID
      const txP1 = transactionRepo.findById(p1.transactionId!);
      expect(txP1?.status).toBe('PAID');
    });
  });
});
