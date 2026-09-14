import { describe, it, expect } from 'vitest';
import { CalculateFinancialAlertsUseCase } from '../../src/core/use-cases/dashboard/calculate-financial-alerts.js';
import { Transaction } from '../../src/core/domain/transaction.js';

describe('CalculateFinancialAlertsUseCase (Motor de Alertas e Lembretes)', () => {
  const alertsUseCase = new CalculateFinancialAlertsUseCase();

  it('calcula alerta crítico quando despesas atingem 90% (ex: R$ 5.000 de receita e R$ 4.500 de despesas)', () => {
    // 2026-09-14: Em um mês de 30 dias (Setembro), no dia 14 faltam 17 dias (dia 14 até dia 30, inclusive)
    const result = alertsUseCase.execute({
      selectedYearMonth: '2026-09',
      totalMonthIncomesCents: 500000, // R$ 5.000,00
      totalMonthExpensesProjectedCents: 450000, // R$ 4.500,00
      transactions: [],
      todayDate: '2026-09-14',
    });

    expect(result.commitmentLevel).toBe('CRITICAL');
    expect(result.commitmentPercentage).toBe(90);
    expect(result.remainingBalanceCents).toBe(50000); // R$ 500,00
    expect(result.hasDeficit).toBe(false);
    expect(result.deficitCents).toBe(0);
    expect(result.daysRemainingInMonth).toBe(17); // 30 - 14 + 1
    // R$ 500,00 / 17 dias = 50000 / 17 = 2941 centavos (~R$ 29,41/dia)
    expect(result.dailyAvailableBudgetCents).toBe(Math.floor(50000 / 17));
    expect(result.hasCriticalAlert).toBe(true);
  });

  it('calcula alerta de atenção quando despesas estão entre 70% e 85%', () => {
    const result = alertsUseCase.execute({
      selectedYearMonth: '2026-09',
      totalMonthIncomesCents: 500000, // R$ 5.000,00
      totalMonthExpensesProjectedCents: 375000, // R$ 3.750,00 (75%)
      transactions: [],
      todayDate: '2026-09-14',
    });

    expect(result.commitmentLevel).toBe('WARNING');
    expect(result.commitmentPercentage).toBe(75);
    expect(result.remainingBalanceCents).toBe(125000); // R$ 1.250,00
    expect(result.hasDeficit).toBe(false);
    expect(result.hasCriticalAlert).toBe(false);
  });

  it('calcula status saudável quando despesas são inferiores a 70%', () => {
    const result = alertsUseCase.execute({
      selectedYearMonth: '2026-09',
      totalMonthIncomesCents: 600000, // R$ 6.000,00
      totalMonthExpensesProjectedCents: 300000, // R$ 3.000,00 (50%)
      transactions: [],
      todayDate: '2026-09-14',
    });

    expect(result.commitmentLevel).toBe('HEALTHY');
    expect(result.commitmentPercentage).toBe(50);
    expect(result.remainingBalanceCents).toBe(300000);
    expect(result.hasDeficit).toBe(false);
    expect(result.hasCriticalAlert).toBe(false);
  });

  it('classifica exatamente 70% de comprometimento como status Saudável (limite da faixa)', () => {
    const result = alertsUseCase.execute({
      selectedYearMonth: '2026-09',
      totalMonthIncomesCents: 500000, // R$ 5.000,00
      totalMonthExpensesProjectedCents: 350000, // R$ 3.500,00 (exatamente 70%)
      transactions: [],
      todayDate: '2026-09-14',
    });

    expect(result.commitmentLevel).toBe('HEALTHY');
    expect(result.commitmentPercentage).toBe(70);
  });

  it('detecta déficit projetado quando despesas superam receitas e zera o orçamento diário', () => {
    const result = alertsUseCase.execute({
      selectedYearMonth: '2026-09',
      totalMonthIncomesCents: 500000, // R$ 5.000,00
      totalMonthExpensesProjectedCents: 520000, // R$ 5.200,00
      transactions: [],
      todayDate: '2026-09-14',
    });

    expect(result.commitmentLevel).toBe('CRITICAL');
    expect(result.commitmentPercentage).toBe(104);
    expect(result.remainingBalanceCents).toBe(-20000); // -R$ 200,00
    expect(result.hasDeficit).toBe(true);
    expect(result.deficitCents).toBe(20000);
    expect(result.dailyAvailableBudgetCents).toBe(0);
    expect(result.hasCriticalAlert).toBe(true);
  });

  it('trata mês sem receita cadastrada com status NO_INCOME de forma segura e sem falso déficit', () => {
    const result = alertsUseCase.execute({
      selectedYearMonth: '2026-09',
      totalMonthIncomesCents: 0,
      totalMonthExpensesProjectedCents: 150000,
      transactions: [],
      todayDate: '2026-09-14',
    });

    expect(result.commitmentLevel).toBe('NO_INCOME');
    expect(result.commitmentPercentage).toBe(0);
    expect(result.hasDeficit).toBe(false);
    expect(result.deficitCents).toBe(0);
    expect(result.dailyAvailableBudgetCents).toBe(0);
  });

  it('retorna zero dias restantes e orçamento diário zerado para meses passados já encerrados', () => {
    const result = alertsUseCase.execute({
      selectedYearMonth: '2026-08',
      totalMonthIncomesCents: 500000,
      totalMonthExpensesProjectedCents: 200000,
      transactions: [],
      todayDate: '2026-09-14',
    });

    expect(result.daysRemainingInMonth).toBe(0);
    expect(result.dailyAvailableBudgetCents).toBe(0);
  });

  it('identifica lembretes de despesas atrasadas, a vencer e receitas não recebidas', () => {
    const today = '2026-09-14';

    const transactions: Transaction[] = [
      // 1. Despesa atrasada (venceu ontem e está pendente)
      {
        id: 'tx-1',
        description: 'Conta de Energia',
        amountCents: 18000,
        type: 'EXPENSE',
        categoryId: 'cat-1',
        date: '2026-09-13',
        paymentMethod: 'BOLETO',
        status: 'PENDING',
        createdAt: '2026-09-01T00:00:00Z',
        updatedAt: '2026-09-01T00:00:00Z',
      },
      // 2. Despesa a vencer nos próximos dias (vence em 3 dias)
      {
        id: 'tx-2',
        description: 'Internet Fibra',
        amountCents: 12000,
        type: 'EXPENSE',
        categoryId: 'cat-1',
        date: '2026-09-17',
        paymentMethod: 'BOLETO',
        status: 'PENDING',
        createdAt: '2026-09-01T00:00:00Z',
        updatedAt: '2026-09-01T00:00:00Z',
      },
      // 3. Receita esperada atrasada (era para cair dia 10)
      {
        id: 'tx-3',
        description: 'Freela Consultoria',
        amountCents: 150000,
        type: 'INCOME',
        categoryId: 'cat-2',
        date: '2026-09-10',
        paymentMethod: 'PIX',
        status: 'PENDING',
        createdAt: '2026-09-01T00:00:00Z',
        updatedAt: '2026-09-01T00:00:00Z',
      },
      // 4. Despesa já paga (NÃO deve gerar lembrete)
      {
        id: 'tx-4',
        description: 'Aluguel',
        amountCents: 200000,
        type: 'EXPENSE',
        categoryId: 'cat-1',
        date: '2026-09-05',
        paymentMethod: 'PIX',
        status: 'PAID',
        createdAt: '2026-09-01T00:00:00Z',
        updatedAt: '2026-09-05T00:00:00Z',
      },
      // 5. Despesa cancelada (NÃO deve gerar lembrete)
      {
        id: 'tx-5',
        description: 'Compra cancelada',
        amountCents: 5000,
        type: 'EXPENSE',
        categoryId: 'cat-1',
        date: '2026-09-15',
        paymentMethod: 'CREDIT',
        status: 'CANCELLED',
        createdAt: '2026-09-01T00:00:00Z',
        updatedAt: '2026-09-01T00:00:00Z',
      },
    ];

    const result = alertsUseCase.execute({
      selectedYearMonth: '2026-09',
      totalMonthIncomesCents: 500000,
      totalMonthExpensesProjectedCents: 250000,
      transactions,
      todayDate: today,
    });

    expect(result.reminders).toHaveLength(3);

    const overdueExpense = result.reminders.find((r) => r.type === 'OVERDUE_EXPENSE');
    expect(overdueExpense).toBeDefined();
    expect(overdueExpense?.transactionId).toBe('tx-1');
    expect(overdueExpense?.isCritical).toBe(true);
    expect(overdueExpense?.daysDiff).toBe(-1);

    const upcomingExpense = result.reminders.find((r) => r.type === 'UPCOMING_EXPENSE');
    expect(upcomingExpense).toBeDefined();
    expect(upcomingExpense?.transactionId).toBe('tx-2');
    expect(upcomingExpense?.isCritical).toBe(false);
    expect(upcomingExpense?.daysDiff).toBe(3);

    const unreceivedIncome = result.reminders.find((r) => r.type === 'UNRECEIVED_INCOME');
    expect(unreceivedIncome).toBeDefined();
    expect(unreceivedIncome?.transactionId).toBe('tx-3');
    expect(unreceivedIncome?.daysDiff).toBe(-4);

    // Como tem despesa atrasada, hasCriticalAlert deve ser true mesmo com comprometimento saudável (50%)
    expect(result.hasCriticalAlert).toBe(true);
  });

  it('identifica receitas previstas para o próprio dia de hoje que ainda não foram recebidas', () => {
    const today = '2026-09-14';
    const transactions: Transaction[] = [
      {
        id: 'tx-today-income',
        description: 'Pix Salário Hoje',
        amountCents: 400000,
        type: 'INCOME',
        categoryId: 'cat-salario',
        date: today,
        paymentMethod: 'PIX',
        status: 'PENDING',
        createdAt: '2026-09-01T00:00:00Z',
        updatedAt: '2026-09-01T00:00:00Z',
      },
    ];

    const result = alertsUseCase.execute({
      selectedYearMonth: '2026-09',
      totalMonthIncomesCents: 400000,
      totalMonthExpensesProjectedCents: 100000,
      transactions,
      todayDate: today,
    });

    expect(result.reminders).toHaveLength(1);
    expect(result.reminders[0].type).toBe('UNRECEIVED_INCOME');
    expect(result.reminders[0].daysDiff).toBe(0);
  });
});
