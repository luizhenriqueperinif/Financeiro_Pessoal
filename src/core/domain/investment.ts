/** Dinheiro guardado ou aplicado que forma a reserva do usuário. */
export interface Investment {
  id: string;
  name: string;
  balanceCents: number;
  /** Rendimento bruto aproximado por mês. */
  monthlyYieldCents: number;
  /** Parte do rendimento já comprometida todo mês (ex.: repasse a um familiar). */
  monthlyCommitmentCents: number;
  /** Se o rendimento líquido entra na conta todo mês como Receita Fixa. */
  generatesIncome: boolean;
  /** Dia do mês em que o rendimento cai na conta. */
  incomeDueDay: number;
  /** Receita Fixa mantida em sincronia com este investimento. */
  recurringRuleId?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateInvestmentDTO {
  name: string;
  balanceCents: number;
  monthlyYieldCents?: number;
  monthlyCommitmentCents?: number;
  generatesIncome?: boolean;
  incomeDueDay?: number;
  /** Receita Fixa já existente a ser vinculada, em vez de criar outra. */
  linkRecurringRuleId?: string | null;
  notes?: string | null;
}

export type UpdateInvestmentDTO = Partial<CreateInvestmentDTO>;

export interface ReserveSummary {
  count: number;
  totalBalanceCents: number;
  monthlyYieldCents: number;
  /** Rendimento que sobra para o usuário depois dos compromissos mensais. */
  monthlyNetYieldCents: number;
  investments: Investment[];
}
