import { describe, it, expect, beforeEach } from 'vitest';
import { AppDatabase } from '../../src/infra/database/connection.js';
import { SqliteCategoryRepository } from '../../src/infra/repositories/sqlite-category-repository.js';
import { SqliteTransactionRepository } from '../../src/infra/repositories/sqlite-transaction-repository.js';
import { SqliteRecurringRuleRepository } from '../../src/infra/repositories/sqlite-recurring-rule-repository.js';
import { SqliteInstallmentPurchaseRepository } from '../../src/infra/repositories/sqlite-installment-purchase-repository.js';
import { CalculateForecastUseCase } from '../../src/core/use-cases/forecast/index.js';
import { CreateInstallmentPurchaseUseCase } from '../../src/core/use-cases/installments/index.js';

describe('Financial Forecast Use Case (Previsão Financeira)', () => {
  let appDb: AppDatabase;
  let categoryRepo: SqliteCategoryRepository;
  let transactionRepo: SqliteTransactionRepository;
  let recurringRepo: SqliteRecurringRuleRepository;
  let installmentRepo: SqliteInstallmentPurchaseRepository;
  let calculateForecast: CalculateForecastUseCase;
  let createInstallmentPurchase: CreateInstallmentPurchaseUseCase;

  beforeEach(() => {
    appDb = new AppDatabase(':memory:');
    const rawDb = appDb.getRawDb();
    categoryRepo = new SqliteCategoryRepository(rawDb);
    transactionRepo = new SqliteTransactionRepository(rawDb);
    recurringRepo = new SqliteRecurringRuleRepository(rawDb);
    installmentRepo = new SqliteInstallmentPurchaseRepository(rawDb);

    calculateForecast = new CalculateForecastUseCase(
      transactionRepo,
      recurringRepo
    );
    createInstallmentPurchase = new CreateInstallmentPurchaseUseCase(
      installmentRepo,
      categoryRepo
    );
  });

  it('calcula a previsão financeira prospectiva dos próximos 6 meses com fixas, parcelas e receitas', () => {
    const salarioCat = categoryRepo.findByName('Salário')!;
    const moradiaCat = categoryRepo.findByName('Moradia')!;
    const outrasCat = categoryRepo.findByName('Outras Despesas')!;

    // 1. Receita Fixa Recorrente: Salário de R$ 5.000,00 todo mês
    recurringRepo.create({
      description: 'Salário Fixo',
      amountCents: 500000, // R$ 5.000,00
      type: 'INCOME',
      categoryId: salarioCat.id,
      frequency: 'MONTHLY',
      dueDay: 5,
      startDate: '2026-09-01',
      paymentMethod: 'PIX',
    });

    // 2. Despesa Fixa Recorrente: Aluguel de R$ 1.200,00 todo mês
    recurringRepo.create({
      description: 'Aluguel',
      amountCents: 120000, // R$ 1.200,00
      type: 'EXPENSE',
      categoryId: moradiaCat.id,
      frequency: 'MONTHLY',
      dueDay: 10,
      startDate: '2026-09-01',
      paymentMethod: 'PIX',
    });

    // 3. Compra parcelada: R$ 3.600 em 12x de R$ 300 a partir de 2026-09-10
    createInstallmentPurchase.execute({
      description: 'Notebook',
      totalAmountCents: 360000,
      totalInstallments: 12,
      firstDueDate: '2026-09-10',
      categoryId: outrasCat.id,
      paymentMethod: 'CREDIT',
    });

    // 4. Despesa avulsa apenas no mês 2026-10 (R$ 500,00)
    transactionRepo.create({
      description: 'Manutenção Carro',
      amountCents: 50000,
      type: 'EXPENSE',
      categoryId: outrasCat.id,
      date: '2026-10-15',
      paymentMethod: 'DEBIT',
      status: 'PENDING',
    });

    // Executa previsão a partir de Setembro/2026 por 6 meses
    const forecast = calculateForecast.execute('2026-09', 6);

    expect(forecast.totalMonths).toBe(6);
    expect(forecast.months.length).toBe(6);

    // Mês 1: Setembro/2026
    // Receitas: 5.000
    // Despesas: 1.200 (Aluguel) + 300 (Notebook 1/12) = 1.500
    // Saldo Previsto: 3.500
    const m1 = forecast.months[0];
    expect(m1.yearMonth).toBe('2026-09');
    expect(m1.incomeCents).toBe(500000);
    expect(m1.expenseCents).toBe(150000);
    expect(m1.projectedBalanceCents).toBe(350000);
    expect(m1.accumulatedBalanceCents).toBe(350000);

    // Mês 2: Outubro/2026
    // Receitas: 5.000
    // Despesas: 1.200 (Aluguel) + 300 (Notebook 2/12) + 500 (Manutenção Carro) = 2.000
    // Saldo Previsto: 3.000
    // Saldo Acumulado: 3.500 + 3.000 = 6.500
    const m2 = forecast.months[1];
    expect(m2.yearMonth).toBe('2026-10');
    expect(m2.incomeCents).toBe(500000);
    expect(m2.expenseCents).toBe(200000);
    expect(m2.projectedBalanceCents).toBe(300000);
    expect(m2.accumulatedBalanceCents).toBe(650000);
  });

  it('não soma de novo no acumulado o que já foi recebido ou pago', () => {
    const salarioCat = categoryRepo.findByName('Salário')!;
    const moradiaCat = categoryRepo.findByName('Moradia')!;
    transactionRepo.create({
      description: 'Salário Setembro',
      amountCents: 500000,
      type: 'INCOME',
      categoryId: salarioCat.id,
      date: '2026-09-05',
      paymentMethod: 'PIX',
      status: 'RECEIVED',
    });
    transactionRepo.create({
      description: 'Aluguel Setembro',
      amountCents: 120000,
      type: 'EXPENSE',
      categoryId: moradiaCat.id,
      date: '2026-09-10',
      paymentMethod: 'PIX',
      status: 'PENDING',
    });

    const forecast = calculateForecast.execute('2026-09', 2);

    expect(forecast.initialBalanceCents).toBe(500000);
    // Saldo atual (5.000) − aluguel ainda pendente (1.200)
    expect(forecast.months[0].projectedBalanceCents).toBe(380000);
    expect(forecast.months[0].accumulatedBalanceCents).toBe(380000);
    expect(forecast.months[1].accumulatedBalanceCents).toBe(380000);
  });

  it('desconta no acumulado as contas atrasadas de meses anteriores ainda não pagas', () => {
    const moradiaCat = categoryRepo.findByName('Moradia')!;
    transactionRepo.create({
      description: 'Condomínio Agosto',
      amountCents: 40000,
      type: 'EXPENSE',
      categoryId: moradiaCat.id,
      date: '2026-08-10',
      paymentMethod: 'PIX',
      status: 'PENDING',
    });

    const forecast = calculateForecast.execute('2026-09', 1);

    expect(forecast.months[0].accumulatedBalanceCents).toBe(-40000);
  });

  it('projeta regras anuais só no mês de aniversário e semanais por ocorrência', () => {
    const outrasCat = categoryRepo.findByName('Outras Despesas')!;
    const base = { type: 'EXPENSE' as const, categoryId: outrasCat.id, paymentMethod: 'PIX' as const };
    recurringRepo.create({ ...base, description: 'IPVA', amountCents: 150000, frequency: 'YEARLY', dueDay: 15, startDate: '2026-10-01' });
    recurringRepo.create({ ...base, description: 'Diarista', amountCents: 10000, frequency: 'WEEKLY', dueDay: 1, startDate: '2026-09-04' });

    const forecast = calculateForecast.execute('2026-09', 2);

    // Setembro: diarista em 04, 11, 18 e 25
    expect(forecast.months[0].expenseCents).toBe(40000);
    // Outubro: IPVA + diarista em 02, 09, 16, 23 e 30
    expect(forecast.months[1].expenseCents).toBe(150000 + 50000);
  });
});
