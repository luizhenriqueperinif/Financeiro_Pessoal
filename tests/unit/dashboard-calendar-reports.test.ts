import { describe, it, expect, beforeEach } from 'vitest';
import { AppDatabase } from '../../src/infra/database/connection.js';
import { SqliteCategoryRepository } from '../../src/infra/repositories/sqlite-category-repository.js';
import { SqliteTransactionRepository } from '../../src/infra/repositories/sqlite-transaction-repository.js';
import { SqliteRecurringRuleRepository } from '../../src/infra/repositories/sqlite-recurring-rule-repository.js';
import { SqliteInstallmentPurchaseRepository } from '../../src/infra/repositories/sqlite-installment-purchase-repository.js';
import { GetDashboardMetricsUseCase } from '../../src/core/use-cases/dashboard/index.js';
import { GetCalendarDataUseCase } from '../../src/core/use-cases/calendar/index.js';
import { GetFinancialReportsUseCase } from '../../src/core/use-cases/reports/index.js';
import { CreateInstallmentPurchaseUseCase } from '../../src/core/use-cases/installments/index.js';

describe('Dashboard, Calendar and Reports Use Cases', () => {
  let appDb: AppDatabase;
  let categoryRepo: SqliteCategoryRepository;
  let transactionRepo: SqliteTransactionRepository;
  let recurringRepo: SqliteRecurringRuleRepository;
  let installmentRepo: SqliteInstallmentPurchaseRepository;

  let getDashboard: GetDashboardMetricsUseCase;
  let getCalendar: GetCalendarDataUseCase;
  let getReports: GetFinancialReportsUseCase;
  let createInstallmentPurchase: CreateInstallmentPurchaseUseCase;

  beforeEach(() => {
    appDb = new AppDatabase(':memory:');
    const rawDb = appDb.getRawDb();
    categoryRepo = new SqliteCategoryRepository(rawDb);
    transactionRepo = new SqliteTransactionRepository(rawDb);
    recurringRepo = new SqliteRecurringRuleRepository(rawDb);
    installmentRepo = new SqliteInstallmentPurchaseRepository(rawDb);

    getDashboard = new GetDashboardMetricsUseCase(
      transactionRepo,
      recurringRepo
    );
    getCalendar = new GetCalendarDataUseCase(
      transactionRepo,
      recurringRepo
    );
    getReports = new GetFinancialReportsUseCase(
      transactionRepo,
      recurringRepo,
      installmentRepo,
      categoryRepo
    );
    createInstallmentPurchase = new CreateInstallmentPurchaseUseCase(
      installmentRepo,
      categoryRepo
    );
  });

  it('calcula métricas consolidadas do Dashboard para um determinado mês', () => {
    const salarioCat = categoryRepo.findByName('Salário')!;
    const alimentacaoCat = categoryRepo.findByName('Alimentação')!;
    const moradiaCat = categoryRepo.findByName('Moradia')!;

    // Receita recebida
    transactionRepo.create({
      description: 'Salário Setembro',
      amountCents: 500000,
      type: 'INCOME',
      categoryId: salarioCat.id,
      date: '2026-09-05',
      paymentMethod: 'PIX',
      status: 'RECEIVED',
    });

    // Despesa paga
    transactionRepo.create({
      description: 'Mercado',
      amountCents: 80000,
      type: 'EXPENSE',
      categoryId: alimentacaoCat.id,
      date: '2026-09-08',
      paymentMethod: 'DEBIT',
      status: 'PAID',
    });

    // Despesa pendente
    transactionRepo.create({
      description: 'Internet',
      amountCents: 15000,
      type: 'EXPENSE',
      categoryId: moradiaCat.id,
      date: '2026-09-25',
      paymentMethod: 'BOLETO',
      status: 'PENDING',
    });

    const metrics = getDashboard.execute('2026-09');

    expect(metrics.selectedYearMonth).toBe('2026-09');
    expect(metrics.currentBalanceCents).toBe(420000); // 5000 - 800
    expect(metrics.monthIncomeCents).toBe(500000);
    expect(metrics.monthExpenseCents).toBe(80000);
    expect(metrics.paidExpenseCents).toBe(80000);
    expect(metrics.pendingExpenseCents).toBe(15000);
    expect(metrics.monthProjectedBalanceCents).toBe(405000); // 5000 - (800 + 150)
    expect(metrics.expensesByCategory.length).toBeGreaterThan(0);
    expect(metrics.monthlyHistory.length).toBe(6);
    expect(metrics.forecast.months.length).toBe(6);
  });

  it('constrói dados estruturados do Calendário com agregação diária', () => {
    const alimentacaoCat = categoryRepo.findByName('Alimentação')!;

    transactionRepo.create({
      description: 'Almoço',
      amountCents: 5000,
      type: 'EXPENSE',
      categoryId: alimentacaoCat.id,
      date: '2026-09-15',
      paymentMethod: 'PIX',
      status: 'PAID',
    });

    transactionRepo.create({
      description: 'Jantar',
      amountCents: 8000,
      type: 'EXPENSE',
      categoryId: alimentacaoCat.id,
      date: '2026-09-15',
      paymentMethod: 'CREDIT',
      status: 'PAID',
    });

    const cal = getCalendar.execute('2026-09');
    expect(cal.yearMonth).toBe('2026-09');
    expect(cal.daysInMonth).toBe(30);

    const dia15 = cal.days.find((d) => d.dayNumber === 15);
    expect(dia15).toBeDefined();
    expect(dia15?.events.length).toBe(2);
    expect(dia15?.totalExpenseCents).toBe(13000);
  });

  it('gera Relatórios Anuais consolidados de fluxo de caixa e comprometimento com parcelas', () => {
    const outrasCat = categoryRepo.findByName('Outras Despesas')!;

    createInstallmentPurchase.execute({
      description: 'Geladeira',
      totalAmountCents: 240000,
      totalInstallments: 4,
      firstDueDate: '2026-09-10',
      categoryId: outrasCat.id,
      paymentMethod: 'CREDIT',
    });

    const report = getReports.execute(2026);
    expect(report.period).toBe('2026');
    expect(report.activeInstallments.length).toBe(1);
    expect(report.activeInstallments[0].remainingInstallments).toBe(4);
    expect(report.activeInstallments[0].remainingAmountCents).toBe(240000);
    expect(report.monthlyCashFlow.length).toBe(12);
  });
});
