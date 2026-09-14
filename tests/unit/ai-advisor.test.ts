import { describe, it, expect } from 'vitest';
import { buildFinancialContextPrompt } from '../../src/core/services/ai-advisor-prompt.js';
import { DashboardMetrics } from '../../src/core/domain/dashboard.js';
import { Money } from '../../src/core/value-objects/money.js';

describe('AI Advisor Prompt Builder (Construção do Contexto Financeiro para IA)', () => {
  const mockMetrics: DashboardMetrics = {
    selectedYearMonth: '2026-09',
    currentBalanceCents: 500000, // R$ 5.000,00
    monthIncomeCents: 600000, // R$ 6.000,00
    monthExpenseCents: 300000, // R$ 3.000,00
    expectedIncomeCents: 0,
    pendingExpenseCents: 150000, // R$ 1.500,00
    paidExpenseCents: 300000,
    monthProjectedBalanceCents: 150000, // R$ 1.500,00
    fixedExpensesCents: 180000, // R$ 1.800,00
    installmentExpensesCents: 120000, // R$ 1.200,00
    expensesByCategory: [
      { categoryId: '1', categoryName: 'Moradia', categoryColor: '#F97316', totalCents: 200000, percentage: 44 },
      { categoryId: '2', categoryName: 'Alimentação', categoryColor: '#EF4444', totalCents: 150000, percentage: 33 },
    ],
    monthlyHistory: [],
    forecast: {
      startYearMonth: '2026-09',
      totalMonths: 3,
      initialBalanceCents: 500000,
      months: [
        {
          yearMonth: '2026-09',
          monthName: 'Setembro/2026',
          incomeCents: 600000,
          expenseCents: 450000,
          projectedBalanceCents: 150000,
          accumulatedBalanceCents: 650000,
          commitmentPercentage: 75,
          isHighCommitment: false,
          breakdown: {
            fixedExpensesCents: 180000,
            installmentExpensesCents: 120000,
            variableExpensesCents: 150000,
            recurringIncomesCents: 600000,
            variableIncomesCents: 0,
          },
        },
        {
          yearMonth: '2026-10',
          monthName: 'Outubro/2026',
          incomeCents: 600000,
          expenseCents: 520000,
          projectedBalanceCents: 80000,
          accumulatedBalanceCents: 730000,
          commitmentPercentage: 87,
          isHighCommitment: true,
          breakdown: {
            fixedExpensesCents: 180000,
            installmentExpensesCents: 200000,
            variableExpensesCents: 140000,
            recurringIncomesCents: 600000,
            variableIncomesCents: 0,
          },
        },
      ],
    },
    alerts: {
      commitmentLevel: 'WARNING',
      commitmentPercentage: 75,
      totalIncomeCents: 600000,
      totalProjectedExpenseCents: 450000,
      remainingBalanceCents: 150000,
      dailyAvailableBudgetCents: 8823,
      daysRemainingInMonth: 17,
      hasDeficit: false,
      deficitCents: 0,
      reminders: [],
      hasCriticalAlert: false,
    },
  };

  it('constrói prompt estruturado contendo métricas em Reais (BRL) e diretrizes financeiras', () => {
    const question = 'Posso comprar um fone de R$ 600 em 3x de R$ 200?';
    const prompt = buildFinancialContextPrompt(mockMetrics, question);

    expect(prompt).toContain('6.000,00'); // Renda
    expect(prompt).toContain('4.500,00'); // Despesas totais projetadas
    expect(prompt).toContain('75%'); // Comprometimento
    expect(prompt).toContain(`Moradia: ${Money.format(200000)} (44%)`);
    expect(prompt).toContain(`Alimentação: ${Money.format(150000)} (33%)`);
    expect(prompt).toContain('Outubro/2026'); // Projeção futura
    expect(prompt).toContain(question);
    expect(prompt).toContain('Educador Financeiro');
  });

  it('inclui alerta enfático de déficit quando o mês ou a previsão projeta saldo negativo', () => {
    const deficitMetrics: DashboardMetrics = {
      ...mockMetrics,
      alerts: {
        ...mockMetrics.alerts,
        commitmentLevel: 'CRITICAL',
        commitmentPercentage: 110,
        hasDeficit: true,
        deficitCents: 50000, // R$ 500,00 de déficit
        dailyAvailableBudgetCents: 0,
      },
    };

    const prompt = buildFinancialContextPrompt(deficitMetrics, 'Devo viajar este fim de semana?');

    expect(prompt).toContain('DÉFICIT');
    expect(prompt).toContain('500,00');
  });
});
