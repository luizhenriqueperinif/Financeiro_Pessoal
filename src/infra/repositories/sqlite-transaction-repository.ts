import { Database } from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import {
  Transaction,
  CreateTransactionDTO,
  UpdateTransactionDTO,
  TransactionFilters,
} from '../../core/domain/transaction.js';
import { ITransactionRepository } from '../../core/domain/repositories.js';
import {
  PaymentMethod,
  TransactionStatus,
  TransactionType,
} from '../../core/types/common.js';

interface TransactionRow {
  id: string;
  description: string;
  amount_cents: number;
  type: TransactionType;
  category_id: string;
  category_name: string;
  category_color: string | null;
  category_icon: string | null;
  date: string;
  payment_date: string | null;
  payment_method: PaymentMethod;
  status: TransactionStatus;
  notes: string | null;
  installment_id: string | null;
  installment_number: number | null;
  total_installments: number | null;
  recurring_rule_id: string | null;
  created_at: string;
  updated_at: string;
}

export class SqliteTransactionRepository implements ITransactionRepository {
  constructor(private db: Database) {}

  private mapToDomain(row: TransactionRow): Transaction {
    // Se o status for PENDING e a data de vencimento for menor que a data atual (YYYY-MM-DD),
    // computa visualmente como OVERDUE conforme alinhado
    const today = new Date().toISOString().slice(0, 10);
    let effectiveStatus = row.status;
    if (row.status === 'PENDING' && row.date < today) {
      effectiveStatus = 'OVERDUE';
    }

    return {
      id: row.id,
      description: row.description,
      amountCents: row.amount_cents,
      type: row.type,
      categoryId: row.category_id,
      categoryName: row.category_name,
      categoryColor: row.category_color || undefined,
      categoryIcon: row.category_icon || undefined,
      date: row.date,
      paymentDate: row.payment_date,
      paymentMethod: row.payment_method,
      status: effectiveStatus,
      notes: row.notes,
      installmentId: row.installment_id,
      installmentNumber: row.installment_number,
      totalInstallments: row.total_installments,
      recurringRuleId: row.recurring_rule_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  create(data: CreateTransactionDTO): Transaction {
    const id = randomUUID();
    const now = new Date().toISOString();
    const status = data.status || (data.type === 'INCOME' ? 'RECEIVED' : 'PAID');

    const stmt = this.db.prepare(`
      INSERT INTO transactions (
        id, description, amount_cents, type, category_id, date, payment_date,
        payment_method, status, notes, installment_id, recurring_rule_id, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      data.description.trim(),
      data.amountCents,
      data.type,
      data.categoryId,
      data.date,
      data.paymentDate || null,
      data.paymentMethod,
      status,
      data.notes?.trim() || null,
      data.installmentId || null,
      data.recurringRuleId || null,
      now,
      now
    );

    return this.findById(id)!;
  }

  findById(id: string): Transaction | null {
    const stmt = this.db.prepare(`
      SELECT 
        t.*,
        c.name as category_name,
        c.color as category_color,
        c.icon as category_icon,
        i.installment_number,
        i.total_installments
      FROM transactions t
      JOIN categories c ON t.category_id = c.id
      LEFT JOIN installments i ON t.installment_id = i.id
      WHERE t.id = ?
    `);

    const row = stmt.get(id) as TransactionRow | undefined;
    return row ? this.mapToDomain(row) : null;
  }

  list(filters?: TransactionFilters): Transaction[] {
    let query = `
      SELECT 
        t.*,
        c.name as category_name,
        c.color as category_color,
        c.icon as category_icon,
        i.installment_number,
        i.total_installments
      FROM transactions t
      JOIN categories c ON t.category_id = c.id
      LEFT JOIN installments i ON t.installment_id = i.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (filters?.startDate) {
      query += ' AND t.date >= ?';
      params.push(filters.startDate);
    }
    if (filters?.endDate) {
      query += ' AND t.date <= ?';
      params.push(filters.endDate);
    }
    if (filters?.type) {
      query += ' AND t.type = ?';
      params.push(filters.type);
    }
    if (filters?.categoryId) {
      query += ' AND t.category_id = ?';
      params.push(filters.categoryId);
    }
    if (filters?.paymentMethod) {
      query += ' AND t.payment_method = ?';
      params.push(filters.paymentMethod);
    }
    if (filters?.status) {
      query += ' AND t.status = ?';
      params.push(filters.status);
    }
    if (filters?.search && filters.search.trim()) {
      query += " AND (LOWER(t.description) LIKE ? OR LOWER(COALESCE(t.notes, '')) LIKE ?)";
      const term = `%${filters.search.trim().toLowerCase()}%`;
      params.push(term, term);
    }

    query += ' ORDER BY t.date DESC, t.created_at DESC';

    const rows = this.db.prepare(query).all(...params) as TransactionRow[];
    return rows.map((r) => this.mapToDomain(r));
  }

  update(id: string, data: UpdateTransactionDTO): Transaction | null {
    const existing = this.findById(id);
    if (!existing) return null;

    const description = data.description !== undefined ? data.description.trim() : existing.description;
    const amountCents = data.amountCents !== undefined ? data.amountCents : existing.amountCents;
    const type = data.type !== undefined ? data.type : existing.type;
    const categoryId = data.categoryId !== undefined ? data.categoryId : existing.categoryId;
    const date = data.date !== undefined ? data.date : existing.date;
    const paymentDate = data.paymentDate !== undefined ? data.paymentDate : existing.paymentDate;
    const paymentMethod = data.paymentMethod !== undefined ? data.paymentMethod : existing.paymentMethod;
    const status = data.status !== undefined ? data.status : existing.status;
    const notes = data.notes !== undefined ? (data.notes?.trim() || null) : existing.notes;
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      UPDATE transactions
      SET description = ?, amount_cents = ?, type = ?, category_id = ?, date = ?,
          payment_date = ?, payment_method = ?, status = ?, notes = ?, updated_at = ?
      WHERE id = ?
    `);

    stmt.run(
      description,
      amountCents,
      type,
      categoryId,
      date,
      paymentDate,
      paymentMethod,
      status,
      notes,
      now,
      id
    );

    return this.findById(id);
  }

  delete(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM transactions WHERE id = ?');
    const res = stmt.run(id);
    return res.changes > 0;
  }

  markAsPaid(id: string, paymentDate?: string): Transaction | null {
    const existing = this.findById(id);
    if (!existing) return null;

    const targetDate = paymentDate || new Date().toISOString().slice(0, 10);
    const newStatus: TransactionStatus = existing.type === 'INCOME' ? 'RECEIVED' : 'PAID';
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      UPDATE transactions
      SET status = ?, payment_date = ?, updated_at = ?
      WHERE id = ?
    `);

    stmt.run(newStatus, targetDate, now, id);

    // Se estiver vinculada a uma parcela, atualiza também o status da parcela
    if (existing.installmentId) {
      this.db.prepare(`
        UPDATE installments
        SET status = 'PAID', payment_date = ?, updated_at = ?
        WHERE id = ?
      `).run(targetDate, now, existing.installmentId);
    }

    return this.findById(id);
  }

  findByRecurringInstance(ruleId: string, month: string): Transaction | null {
    // month no formato YYYY-MM
    const stmt = this.db.prepare(`
      SELECT 
        t.*,
        c.name as category_name,
        c.color as category_color,
        c.icon as category_icon,
        i.installment_number,
        i.total_installments
      FROM transactions t
      JOIN categories c ON t.category_id = c.id
      LEFT JOIN installments i ON t.installment_id = i.id
      WHERE t.recurring_rule_id = ? AND strftime('%Y-%m', t.date) = ?
    `);

    const row = stmt.get(ruleId, month) as TransactionRow | undefined;
    return row ? this.mapToDomain(row) : null;
  }
}
