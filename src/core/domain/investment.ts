/** Dinheiro guardado ou aplicado que forma a reserva do usuário. */
export interface Investment {
  id: string;
  name: string;
  balanceCents: number;
  /** Rendimento bruto aproximado por mês. */
  monthlyYieldCents: number;
  /** Parte do rendimento já comprometida todo mês (ex.: repasse a um familiar). */
  monthlyCommitmentCents: number;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateInvestmentDTO {
  name: string;
  balanceCents: number;
  monthlyYieldCents?: number;
  monthlyCommitmentCents?: number;
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
