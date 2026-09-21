import { DashboardMetrics } from '../domain/dashboard.js';
import { Transaction } from '../domain/transaction.js';
import { CardSummary } from '../domain/installment-purchase.js';
import { Money } from '../value-objects/money.js';
import { DateUtils } from '../utils/date-utils.js';

/** Dados concretos que evitam que a IA invente gastos a partir de totais por categoria. */
export interface AdvisorDetails {
  transactions?: Transaction[];
  cards?: CardSummary[];
  today?: string;
}

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const monthLabel = (ym: string) => `${MONTHS[Number(ym.slice(5, 7)) - 1]}/${ym.slice(2, 4)}`;
const dayLabel = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

const STATUS_LABEL: Record<string, string> = {
  PAID: 'paga',
  RECEIVED: 'recebida',
  PENDING: 'a vencer',
  OVERDUE: 'atrasada',
  CANCELLED: 'cancelada',
};

function originLabel(t: Transaction): string {
  if (t.installmentId) return `, parcela ${t.installmentNumber}/${t.totalInstallments}`;
  if (t.recurringRuleId) return ', fixa';
  return '';
}

function transactionsSection(transactions: Transaction[], today: string): string {
  const active = transactions.filter((t) => t.status !== 'CANCELLED');
  const line = (t: Transaction) =>
    `- ${t.description}: ${Money.format(t.amountCents)} — ${STATUS_LABEL[t.status] ?? t.status}` +
    ` (vence ${dayLabel(t.date)}${originLabel(t)}; ${t.categoryName ?? 'sem categoria'})`;
  const incomes = active.filter((t) => t.type === 'INCOME');
  const expenses = active.filter((t) => t.type === 'EXPENSE').sort((a, b) => b.amountCents - a.amountCents);
  return `### LANÇAMENTOS DO MÊS (hoje é ${dayLabel(today)}):
Receitas:
${incomes.length ? incomes.map(line).join('\n') : '- nenhuma'}
Despesas (da maior para a menor):
${expenses.length ? expenses.map(line).join('\n') : '- nenhuma'}`;
}

function cardsSection(cards: CardSummary[]): string {
  const open = cards.filter((c) => c.remainingCents > 0);
  if (open.length === 0) return '';
  const lines = open.map((c) => {
    const months = c.months
      .filter((m) => m.remainingCents > 0)
      .map((m) => `${monthLabel(m.yearMonth)} ${Money.format(m.remainingCents)}`)
      .join(', ');
    return `- ${c.cardName}: falta pagar ${Money.format(c.remainingCents)} → ${months}`;
  });
  return `### FATURAS DE CARTÃO A PAGAR (parcelas já assumidas):
${lines.join('\n')}`;
}

export function buildFinancialContextPrompt(
  metrics: DashboardMetrics,
  userQuestion: string,
  details: AdvisorDetails = {}
): string {
  const today = details.today ?? DateUtils.today();
  const detailSections = [
    details.transactions ? transactionsSection(details.transactions, today) : '',
    details.cards ? cardsSection(details.cards) : '',
  ]
    .filter(Boolean)
    .join('\n\n');
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
Seu objetivo é orientar o usuário a tomar decisões financeiras conscientes, prevenir endividamento, avaliar simulações de compras parceladas e identificar oportunidades de corte de despesas, sempre com base nos números reais dele.

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

${detailSections ? detailSections + '\n\n' : ''}### PREVISÃO DOS PRÓXIMOS MESES (FLUXO PROSPECTIVO):
${forecastText}

---

### REGRAS PARA SUA RESPOSTA:
1. Responda primeiro, em uma ou duas frases, exatamente o que foi perguntado. Depois justifique.
2. Use somente os dados acima. Não invente gastos, contas, assinaturas ou valores que não aparecem na lista; cite cada gasto pelo nome exato (ex.: "Prestação", não "aluguel").
3. Se faltar informação para responder, diga o que falta em vez de supor.
4. Faça as contas passo a passo e confira antes de responder. Para compras parceladas: parcela = valor ÷ número de parcelas; some a parcela à despesa de CADA mês afetado na previsão e diga em quais meses o saldo fica negativo.
5. Sugestões de corte devem apontar lançamentos concretos da lista (maiores e variáveis primeiro). Não sugira cortar despesas de cunho pessoal ou religioso (ex.: dízimo) — apenas mencione o peso delas se for relevante.
6. Se o comprometimento de algum mês afetado passar de 85% ou houver déficit, desaconselhe novas parcelas e diga a partir de quando seria viável.
7. Seja breve: até 200 palavras, em português do Brasil, com no máximo 5 tópicos curtos. Não use tabelas nem fórmulas LaTeX.
8. Nunca prometa lucros fáceis nem recomende investimentos especulativos.

### PERGUNTA DO USUÁRIO:
"${userQuestion}"
`;
}
