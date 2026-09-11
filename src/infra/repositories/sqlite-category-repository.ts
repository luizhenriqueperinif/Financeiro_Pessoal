import { Database } from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import {
  Category,
  CreateCategoryDTO,
  UpdateCategoryDTO,
} from '../../core/domain/category.js';
import { ICategoryRepository } from '../../core/domain/repositories.js';
import { TransactionType } from '../../core/types/common.js';

interface CategoryRow {
  id: string;
  name: string;
  type: TransactionType;
  description: string | null;
  color: string | null;
  icon: string | null;
  created_at: string;
  updated_at: string;
}

export class SqliteCategoryRepository implements ICategoryRepository {
  constructor(private db: Database) {}

  private mapToDomain(row: CategoryRow): Category {
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      description: row.description,
      color: row.color,
      icon: row.icon,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  create(data: CreateCategoryDTO): Category {
    const id = randomUUID();
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO categories (id, name, type, description, color, icon, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      data.name.trim(),
      data.type,
      data.description?.trim() || null,
      data.color || null,
      data.icon || null,
      now,
      now
    );

    return {
      id,
      name: data.name.trim(),
      type: data.type,
      description: data.description?.trim() || null,
      color: data.color || null,
      icon: data.icon || null,
      createdAt: now,
      updatedAt: now,
    };
  }

  findById(id: string): Category | null {
    const stmt = this.db.prepare('SELECT * FROM categories WHERE id = ?');
    const row = stmt.get(id) as CategoryRow | undefined;
    return row ? this.mapToDomain(row) : null;
  }

  findByName(name: string): Category | null {
    const stmt = this.db.prepare(
      'SELECT * FROM categories WHERE LOWER(name) = LOWER(?)'
    );
    const row = stmt.get(name.trim()) as CategoryRow | undefined;
    return row ? this.mapToDomain(row) : null;
  }

  list(type?: TransactionType): Category[] {
    let query = 'SELECT * FROM categories';
    const params: any[] = [];

    if (type) {
      query += ' WHERE type = ?';
      params.push(type);
    }

    query += ' ORDER BY name ASC';

    const rows = this.db.prepare(query).all(...params) as CategoryRow[];
    return rows.map((r) => this.mapToDomain(r));
  }

  update(id: string, data: UpdateCategoryDTO): Category | null {
    const existing = this.findById(id);
    if (!existing) return null;

    const name = data.name !== undefined ? data.name.trim() : existing.name;
    const type = data.type !== undefined ? data.type : existing.type;
    const description =
      data.description !== undefined
        ? data.description?.trim() || null
        : existing.description;
    const color = data.color !== undefined ? data.color : existing.color;
    const icon = data.icon !== undefined ? data.icon : existing.icon;
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      UPDATE categories
      SET name = ?, type = ?, description = ?, color = ?, icon = ?, updated_at = ?
      WHERE id = ?
    `);

    stmt.run(name, type, description, color, icon, now, id);

    return {
      id,
      name,
      type,
      description,
      color,
      icon,
      createdAt: existing.createdAt,
      updatedAt: now,
    };
  }

  delete(id: string): boolean {
    const count = this.countTransactions(id);
    if (count > 0) {
      throw new Error(
        `Não é possível excluir a categoria: existem ${count} transação(ões) vinculada(s). Reclassifique-as primeiro.`
      );
    }

    const stmt = this.db.prepare('DELETE FROM categories WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  countTransactions(categoryId: string): number {
    const stmt = this.db.prepare(
      'SELECT COUNT(*) as total FROM transactions WHERE category_id = ?'
    );
    const row = stmt.get(categoryId) as { total: number };
    return row?.total || 0;
  }
}
