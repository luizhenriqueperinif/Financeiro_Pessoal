import { DashboardMetrics } from '../domain/dashboard.js';
import { Money } from '../value-objects/money.js';

export function buildFinancialContextPrompt(
  metrics: DashboardMetrics,
  userQuestion: string
): string {
  const alerts = metrics.alerts;
  const totalIncomes = alerts ? alerts.totalIncomeCents : metrics.monthIncomeCents + metrics.expectedIncomeCents;
  const totalExpenses = alerts ? alerts.totalProjectedExpenseCents : metrics.paidExpenseCents + metrics.pendingExpenseCents;
  const netMonthResult = totalIncomes - totalExpenses;
  const commitmentPct = alerts ? alerts.commitmentPercentage : (totalIncomes > 0 ? Math.round((totalExpenses / totalIncomes) * 100) : 0);

  // Categorias formatadas
  const categoriesText = metrics.expensesByCategory.length > 0
    ? metrics.expensesByCategory
        .map((c) => `- ${c.categoryName}: ${Money.format(c.totalCents)} (${c.percentage}%)`)
        .join('\n')
    : 'Nenhuma despesa categorizada no mês.';

  // Projeção futura
  const forecastText = metrics.forecast.months.length > 0
    ? metrics.forecast.months
        .slice(0, 6)
        .map(
          (m) =>
            `- ${m.monthName}: Receita ${Money.format(m.incomeCents)} | Despesas ${Money.format(
              m.expenseCents
            )} | Comprometimento ${m.commitmentPercentage}% ${
              m.isHighCommitment ? '⚠️ (Alto comprometimento)' : ''
            }`
        )
        .join('\n')
    : 'Sem histórico de previsão disponível.';

  // Situação de déficit orçamentário
  let deficitAlertText = '';
  if (alerts && alerts.hasDeficit) {
    deficitAlertText = `\n⚠️ ATENÇÃO CRÍTICA DE DÉFICIT: O usuário possui um DÉFICIT projetado de ${Money.format(
      alerts.deficitCents
    )} no fluxo deste mês. Suas despesas superam suas receitas previstas. Qualquer nova despesa exigirá reserva ou gerará endividamento.\n`;
  }

  return `Você é o "Conselheiro Financeiro Pessoal", um Educador Financeiro empático, prudente e analítico.
Seu objetivo é orientar o usuário a tomar decisões financeiras conscientes, prevenir endividamento, avaliar simulações de compras parceladas e identificar oportunidades de corte de despesas.

### CONTEXTO FINANCEIRO DO USUÁRIO (${metrics.selectedYearMonth}):
- Saldo Atual Real em Conta: ${Money.format(metrics.currentBalanceCents)}
- Receitas Previstas do Mês: ${Money.format(totalIncomes)}
- Despesas Totais Projetadas no Mês: ${Money.format(totalExpenses)}
  * Despesas Fixas: ${Money.format(metrics.fixedExpensesCents)}
  * Parcelas de Compras Parceladas: ${Money.format(metrics.installmentExpensesCents)}
- Resultado Líquido do Mês (Receitas - Despesas): ${Money.format(netMonthResult)}
- Saldo Previsto ao Final do Mês (Liquidez Projetada): ${Money.format(metrics.monthProjectedBalanceCents)}
- Alerta de Comprometimento: ${commitmentPct}% (${alerts ? alerts.commitmentLevel : 'N/A'})
- Orçamento Diário Disponível: ${
    alerts && alerts.dailyAvailableBudgetCents > 0
      ? `${Money.format(alerts.dailyAvailableBudgetCents)}/dia`
      : 'R$ 0,00/dia (sem margem ou período deficitário)'
  }
${deficitAlertText}
### DISTRIBUIÇÃO DAS DESPESAS POR CATEGORIA:
${categoriesText}

### PREVISÃO DOS PRÓXIMOS MESES (FLUXO PROSPECTIVO):
${forecastText}

---

### INSTRUÇÕES PARA SUA RESPOSTA:
1. Responda diretamente à dúvida ou simulação do usuário com clareza, objetividade e responsabilidade.
2. Utilize SEMPRE os números concretos informados acima (em R$) para embasar sua orientação.
3. Se o usuário perguntar se pode comprar algo novo ou parcelado:
   - Calcule a nova parcela mensal e analise o impacto no Orçamento Diário Disponível e no Saldo Previsto dos próximos meses.
   - Se o comprometimento já estiver na faixa de atenção (> 70%) ou crítico (> 85%), desaconselhe ou sugira adiar a compra até liquidar parcelas antigas.
4. Se o usuário pedir onde cortar despesas, aponte as categorias de maior peso percentual e gastos variáveis.
5. Mantenha as respostas concisas, práticas e com tópicos bem formatados.
6. Nunca prometa lucros fáceis ou recomende investimentos especulativos.

### DÚVIDA / SIMULAÇÃO DO USUÁRIO:
"${userQuestion}"
`;
}
