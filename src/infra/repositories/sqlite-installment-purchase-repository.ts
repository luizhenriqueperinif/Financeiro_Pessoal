import { Database } from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import {
  Installment,
  InstallmentPurchase,
  CreateInstallmentPurchaseDTO,
  UpdateInstallmentDTO,
} from '../../core/domain/installment-purchase.js';
import { IInstallmentPurchaseRepository } from '../../core/domain/repositories.js';
import { InstallmentStatus, PaymentMethod } from '../../core/types/common.js';

interface PurchaseRow {
  id: string;
  description: string;
  total_amount_cents: number;
  total_installments: number;
  first_due_date: string;
  category_id: string;
  category_name: string;
  category_color: string | null;
  category_icon: string | null;
  payment_method: PaymentMethod;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface InstallmentRow {
  id: string;
  purchase_id: string;
  installment_number: number;
  total_installments: number;
  amount_cents: number;
  due_date: string;
  payment_date: string | null;
  status: InstallmentStatus;
  transaction_id: string | null;
  created_at: string;
  updated_at: string;
}

export class SqliteInstallmentPurchaseRepository
  implements IInstallmentPurchaseRepository
{
  constructor(private db: Database) {}

  private mapPurchaseToDomain(
    row: PurchaseRow,
    installments: Installment[] = []
  ): InstallmentPurchase {
    return {
      id: row.id,
      description: row.description,
      totalAmountCents: row.total_amount_cents,
      totalInstallments: row.total_installments,
      firstDueDate: row.first_due_date,
      categoryId: row.category_id,
      categoryName: row.category_name,
      categoryColor: row.category_color || undefined,
      categoryIcon: row.category_icon || undefined,
      paymentMethod: row.payment_method,
      notes: row.notes,
      installments,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapInstallmentToDomain(row: InstallmentRow): Installment {
    const today = new Date().toISOString().slice(0, 10);
    let effectiveStatus = row.status;
    if (row.status === 'PENDING' && row.due_date < today) {
      effectiveStatus = 'OVERDUE';
    }

    return {
      id: row.id,
      purchaseId: row.purchase_id,
      installmentNumber: row.installment_number,
      totalInstallments: row.total_installments,
      amountCents: row.amount_cents,
      dueDate: row.due_date,
      paymentDate: row.payment_date,
      status: effectiveStatus,
      transactionId: row.transaction_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  create(
    data: CreateInstallmentPurchaseDTO,
    installments: Array<Omit<Installment, 'id' | 'createdAt' | 'updatedAt'>>
  ): InstallmentPurchase {
    const purchaseId = randomUUID();
    const now = new Date().toISOString();

    const insertPurchase = this.db.prepare(`
      INSERT INTO installment_purchases (
        id, description, total_amount_cents, total_installments,
        first_due_date, category_id, payment_method, notes, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertInstallment = this.db.prepare(`
      INSERT INTO installments (
        id, purchase_id, installment_number, total_installments,
        amount_cents, due_date, payment_date, status, transaction_id, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertTransaction = this.db.prepare(`
      INSERT INTO transactions (
        id, description, amount_cents, type, category_id,
        date, payment_date, payment_method, status, notes,
        installment_id, recurring_rule_id, created_at, updated_at
      )
      VALUES (?, ?, ?, 'EXPENSE', ?, ?, ?, 'CREDIT', ?, ?, ?, NULL, ?, ?)
    `);

    const createdInstallments: Installment[] = [];

    // Executa atomicamente em uma única transação SQLite
    const executeInTransaction = this.db.transaction(() => {
      insertPurchase.run(
        purchaseId,
        data.description.trim(),
        data.totalAmountCents,
        data.totalInstallments,
        data.firstDueDate,
        data.categoryId,
        data.paymentMethod || 'CREDIT',
        data.notes?.trim() || null,
        now,
        now
      );

      for (const inst of installments) {
        const instId = randomUUID();
        const txId = randomUUID();
        const txDescription = `${data.description.trim()} (${inst.installmentNumber}/${inst.totalInstallments})`;

        // 1. Cria a parcela primeiro para satisfazer a FK de transactions.installment_id
        insertInstallment.run(
          instId,
          purchaseId,
          inst.installmentNumber,
          inst.totalInstallments,
          inst.amountCents,
          inst.dueDate,
          inst.paymentDate || null,
          inst.status,
          txId,
          now,
          now
        );

        // 2. Cria a transação correspondente referenciando a parcela
        insertTransaction.run(
          txId,
          txDescription,
          inst.amountCents,
          data.categoryId,
          inst.dueDate,
          inst.paymentDate || null,
          inst.status,
          `Parcela ${inst.installmentNumber} de ${inst.totalInstallments} de "${data.description.trim()}"`,
          instId,
          now,
          now
        );

        createdInstallments.push({
          id: instId,
          purchaseId,
          installmentNumber: inst.installmentNumber,
          totalInstallments: inst.totalInstallments,
          amountCents: inst.amountCents,
          dueDate: inst.dueDate,
          paymentDate: inst.paymentDate || null,
          status: inst.status,
          transactionId: txId,
          createdAt: now,
          updatedAt: now,
        });
      }
    });

    executeInTransaction();

    return this.findById(purchaseId)!;
  }

  findById(id: string): InstallmentPurchase | null {
    const stmt = this.db.prepare(`
      SELECT 
        p.*,
        c.name as category_name,
        c.color as category_color,
        c.icon as category_icon
      FROM installment_purchases p
      JOIN categories c ON p.category_id = c.id
      WHERE p.id = ?
    `);

    const row = stmt.get(id) as PurchaseRow | undefined;
    if (!row) return null;

    const instStmt = this.db.prepare(`
      SELECT * FROM installments
      WHERE purchase_id = ?
      ORDER BY installment_number ASC
    `);

    const instRows = instStmt.all(id) as InstallmentRow[];
    const installments = instRows.map((r) => this.mapInstallmentToDomain(r));

    return this.mapPurchaseToDomain(row, installments);
  }

  list(): InstallmentPurchase[] {
    const stmt = this.db.prepare(`
      SELECT 
        p.*,
        c.name as category_name,
        c.color as category_color,
        c.icon as category_icon
      FROM installment_purchases p
      JOIN categories c ON p.category_id = c.id
      ORDER BY p.first_due_date DESC
    `);

    const rows = stmt.all() as PurchaseRow[];
    return rows.map((r) => {
      const instStmt = this.db.prepare(`
        SELECT * FROM installments
        WHERE purchase_id = ?
        ORDER BY installment_number ASC
      `);
      const instRows = instStmt.all(r.id) as InstallmentRow[];
      const installments = instRows.map((i) => this.mapInstallmentToDomain(i));
      return this.mapPurchaseToDomain(r, installments);
    });
  }

  delete(id: string): boolean {
    const deleteTx = this.db.transaction(() => {
      // Exclui transações vinculadas às parcelas desta compra
      this.db.prepare(`
        DELETE FROM transactions 
        WHERE installment_id IN (SELECT id FROM installments WHERE purchase_id = ?)
      `).run(id);

      // Exclui as parcelas (ON DELETE CASCADE também cuidaria)
      this.db.prepare('DELETE FROM installments WHERE purchase_id = ?').run(id);

      // Exclui o registro pai
      this.db.prepare('DELETE FROM installment_purchases WHERE id = ?').run(id);
    });

    deleteTx();
    return true;
  }

  findInstallmentById(installmentId: string): Installment | null {
    const stmt = this.db.prepare('SELECT * FROM installments WHERE id = ?');
    const row = stmt.get(installmentId) as InstallmentRow | undefined;
    return row ? this.mapInstallmentToDomain(row) : null;
  }

  updateInstallment(
    installmentId: string,
    data: UpdateInstallmentDTO
  ): Installment | null {
    const existing = this.findInstallmentById(installmentId);
    if (!existing) return null;

    const amountCents =
      data.amountCents !== undefined ? data.amountCents : existing.amountCents;
    const dueDate = data.dueDate !== undefined ? data.dueDate : existing.dueDate;
    const paymentDate =
      data.paymentDate !== undefined
        ? data.paymentDate
        : existing.paymentDate;
    const status = data.status !== undefined ? data.status : existing.status;
    const now = new Date().toISOString();

    const updateTx = this.db.transaction(() => {
      this.db.prepare(`
        UPDATE installments
        SET amount_cents = ?, due_date = ?, payment_date = ?, status = ?, updated_at = ?
        WHERE id = ?
      `).run(amountCents, dueDate, paymentDate, status, now, installmentId);

      // Atualiza também a transação vinculada à parcela
      if (existing.transactionId) {
        const txStatus = status === 'PAID' ? 'PAID' : (status === 'CANCELLED' ? 'CANCELLED' : 'PENDING');
        this.db.prepare(`
          UPDATE transactions
          SET amount_cents = ?, date = ?, payment_date = ?, status = ?, updated_at = ?
          WHERE id = ?
        `).run(amountCents, dueDate, paymentDate, txStatus, now, existing.transactionId);
      }
    });

    updateTx();
    return this.findInstallmentById(installmentId);
  }

  listInstallmentsByMonth(yearMonth: string): Installment[] {
    const stmt = this.db.prepare(`
      SELECT * FROM installments
      WHERE strftime('%Y-%m', due_date) = ?
      ORDER BY due_date ASC
    `);
    const rows = stmt.all(yearMonth) as InstallmentRow[];
    return rows.map((r) => this.mapInstallmentToDomain(r));
  }
}
