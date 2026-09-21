export function formatMoney(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format((cents || 0) / 100);
}

export function formatDate(dateStr: string): string {
  if (!dateStr || dateStr.length < 10) return '';
  const [y, m, d] = dateStr.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

export function getMonthName(yearMonth: string): string {
  const [yearStr, monthStr] = yearMonth.split('-');
  const monthIdx = parseInt(monthStr, 10) - 1;
  const months = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  return `${months[monthIdx]} de ${yearStr}`;
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  PIX: 'PIX',
  CREDIT: 'Crédito',
  DEBIT: 'Débito',
  BOLETO: 'Boleto',
  MONEY: 'Dinheiro',
  OTHER: 'Outro',
};

/** Nome da forma de pagamento para exibir (o banco guarda o código, ex.: "DEBIT"). */
export function paymentMethodLabel(method: string): string {
  return PAYMENT_METHOD_LABELS[method] ?? method;
}

/** Valor em reais (número) no padrão brasileiro, para gráficos: 1234.5 → "R$ 1.234,50". */
export function formatReais(value: number | string): string {
  return formatMoney(Math.round(Number(value) * 100));
}

/** Rótulo curto do eixo dos gráficos: 2500 → "R$ 2,5 mil". */
export function formatAxisReais(value: number): string {
  if (Math.abs(value) >= 1000) {
    return `R$ ${(value / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`;
  }
  return `R$ ${value.toLocaleString('pt-BR')}`;
}

