import { Database } from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { Investment, CreateInvestmentDTO, UpdateInvestmentDTO } from '../../core/domain/investment.js';
import { IInvestmentRepository } from '../../core/domain/repositories.js';

interface InvestmentRow {
  id: string;
  name: string;
  balance_cents: number;
  monthly_yield_cents: number;
  monthly_commitment_cents: number;
  generates_income: number;
  income_due_day: number;
  recurring_rule_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export class SqliteInvestmentRepository implements IInvestmentRepository {
  constructor(private db: Database) {}

  private mapToDomain(row: InvestmentRow): Investment {
    return {
      id: row.id,
      name: row.name,
      balanceCents: row.balance_cents,
      monthlyYieldCents: row.monthly_yield_cents,
      monthlyCommitmentCents: row.monthly_commitment_cents,
      generatesIncome: row.generates_income === 1,
      incomeDueDay: row.income_due_day,
      recurringRuleId: row.recurring_rule_id,
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  create(data: CreateInvestmentDTO): Investment {
    const id = randomUUID();
    const now = new Date().toISOString();
    this.db
      .prepare(`
        INSERT INTO investments (id, name, balance_cents, monthly_yield_cents, monthly_commitment_cents,
          generates_income, income_due_day, recurring_rule_id, notes, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        id,
        data.name.trim(),
        data.balanceCents,
        data.monthlyYieldCents ?? 0,
        data.monthlyCommitmentCents ?? 0,
        data.generatesIncome ? 1 : 0,
        data.incomeDueDay ?? 15,
        null,
        data.notes?.trim() || null,
        now,
        now
      );
    return this.findById(id)!;
  }

  findById(id: string): Investment | null {
    const row = this.db.prepare('SELECT * FROM investments WHERE id = ?').get(id) as InvestmentRow | undefined;
    return row ? this.mapToDomain(row) : null;
  }

  list(): Investment[] {
    const rows = this.db.prepare('SELECT * FROM investments ORDER BY balance_cents DESC').all() as InvestmentRow[];
    return rows.map((r) => this.mapToDomain(r));
  }

  update(id: string, data: UpdateInvestmentDTO): Investment | null {
    const existing = this.findById(id);
    if (!existing) return null;
    this.db
      .prepare(`
        UPDATE investments
        SET name = ?, balance_cents = ?, monthly_yield_cents = ?, monthly_commitment_cents = ?,
            generates_income = ?, income_due_day = ?, notes = ?, updated_at = ?
        WHERE id = ?
      `)
      .run(
        data.name !== undefined ? data.name.trim() : existing.name,
        data.balanceCents ?? existing.balanceCents,
        data.monthlyYieldCents ?? existing.monthlyYieldCents,
        data.monthlyCommitmentCents ?? existing.monthlyCommitmentCents,
        (data.generatesIncome ?? existing.generatesIncome) ? 1 : 0,
        data.incomeDueDay ?? existing.incomeDueDay,
        data.notes !== undefined ? data.notes?.trim() || null : existing.notes ?? null,
        new Date().toISOString(),
        id
      );
    return this.findById(id);
  }

  setRecurringRule(id: string, ruleId: string | null): void {
    this.db.prepare('UPDATE investments SET recurring_rule_id = ? WHERE id = ?').run(ruleId, id);
  }

  delete(id: string): boolean {
    return this.db.prepare('DELETE FROM investments WHERE id = ?').run(id).changes > 0;
  }
}
