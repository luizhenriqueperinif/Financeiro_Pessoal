import { Database } from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import {
  RecurringRule,
  CreateRecurringRuleDTO,
  UpdateRecurringRuleDTO,
} from '../../core/domain/recurring-rule.js';
import { IRecurringRuleRepository } from '../../core/domain/repositories.js';
import {
  PaymentMethod,
  RecurringFrequency,
  TransactionType,
} from '../../core/types/common.js';

interface RecurringRuleRow {
  id: string;
  description: string;
  amount_cents: number;
  type: TransactionType;
  category_id: string;
  category_name: string;
  category_color: string | null;
  category_icon: string | null;
  frequency: RecurringFrequency;
  due_day: number;
  start_date: string;
  end_date: string | null;
  payment_method: PaymentMethod;
  is_active: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export class SqliteRecurringRuleRepository implements IRecurringRuleRepository {
  constructor(private db: Database) {}

  private mapToDomain(row: RecurringRuleRow): RecurringRule {
    return {
      id: row.id,
      description: row.description,
      amountCents: row.amount_cents,
      type: row.type,
      categoryId: row.category_id,
      categoryName: row.category_name,
      categoryColor: row.category_color || undefined,
      categoryIcon: row.category_icon || undefined,
      frequency: row.frequency,
      dueDay: row.due_day,
      startDate: row.start_date,
      endDate: row.end_date,
      paymentMethod: row.payment_method,
      isActive: row.is_active === 1,
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  create(data: CreateRecurringRuleDTO): RecurringRule {
    const id = randomUUID();
    const now = new Date().toISOString();
    const isActive = data.isActive !== undefined ? (data.isActive ? 1 : 0) : 1;

    const stmt = this.db.prepare(`
      INSERT INTO recurring_rules (
        id, description, amount_cents, type, category_id, frequency, due_day,
        start_date, end_date, payment_method, is_active, notes, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      data.description.trim(),
      data.amountCents,
      data.type,
      data.categoryId,
      data.frequency,
      data.dueDay,
      data.startDate,
      data.endDate || null,
      data.paymentMethod,
      isActive,
      data.notes?.trim() || null,
      now,
      now
    );

    return this.findById(id)!;
  }

  findById(id: string): RecurringRule | null {
    const stmt = this.db.prepare(`
      SELECT 
        r.*,
        c.name as category_name,
        c.color as category_color,
        c.icon as category_icon
      FROM recurring_rules r
      JOIN categories c ON r.category_id = c.id
      WHERE r.id = ?
    `);

    const row = stmt.get(id) as RecurringRuleRow | undefined;
    return row ? this.mapToDomain(row) : null;
  }

  list(activeOnly?: boolean): RecurringRule[] {
    let query = `
      SELECT 
        r.*,
        c.name as category_name,
        c.color as category_color,
        c.icon as category_icon
      FROM recurring_rules r
      JOIN categories c ON r.category_id = c.id
    `;

    if (activeOnly) {
      query += ' WHERE r.is_active = 1';
    }

    query += ' ORDER BY r.due_day ASC, r.description ASC';

    const rows = this.db.prepare(query).all() as RecurringRuleRow[];
    return rows.map((r) => this.mapToDomain(r));
  }

  update(id: string, data: UpdateRecurringRuleDTO): RecurringRule | null {
    const existing = this.findById(id);
    if (!existing) return null;

    const description =
      data.description !== undefined
        ? data.description.trim()
        : existing.description;
    const amountCents =
      data.amountCents !== undefined ? data.amountCents : existing.amountCents;
    const type = data.type !== undefined ? data.type : existing.type;
    const categoryId =
      data.categoryId !== undefined ? data.categoryId : existing.categoryId;
    const frequency =
      data.frequency !== undefined ? data.frequency : existing.frequency;
    const dueDay = data.dueDay !== undefined ? data.dueDay : existing.dueDay;
    const startDate =
      data.startDate !== undefined ? data.startDate : existing.startDate;
    const endDate =
      data.endDate !== undefined ? data.endDate : existing.endDate;
    const paymentMethod =
      data.paymentMethod !== undefined
        ? data.paymentMethod
        : existing.paymentMethod;
    const isActive =
      data.isActive !== undefined
        ? data.isActive
          ? 1
          : 0
        : existing.isActive
        ? 1
        : 0;
    const notes =
      data.notes !== undefined
        ? data.notes?.trim() || null
        : existing.notes;
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      UPDATE recurring_rules
      SET description = ?, amount_cents = ?, type = ?, category_id = ?, frequency = ?,
          due_day = ?, start_date = ?, end_date = ?, payment_method = ?, is_active = ?,
          notes = ?, updated_at = ?
      WHERE id = ?
    `);

    stmt.run(
      description,
      amountCents,
      type,
      categoryId,
      frequency,
      dueDay,
      startDate,
      endDate,
      paymentMethod,
      isActive,
      notes,
      now,
      id
    );

    return this.findById(id);
  }

  delete(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM recurring_rules WHERE id = ?');
    const res = stmt.run(id);
    return res.changes > 0;
  }
}
