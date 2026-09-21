import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AppDatabase } from '../../src/infra/database/connection.js';
import DatabaseConstructor from 'better-sqlite3';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

describe('AppDatabase Persistence', () => {
  let appDb: AppDatabase;

  beforeEach(() => {
    appDb = new AppDatabase(':memory:');
  });

  afterEach(() => {
    appDb.close();
  });

  it('inicializa o banco e pré-popula as categorias padrão', () => {
    const db = appDb.getRawDb();
    const categories = db.prepare('SELECT * FROM categories').all() as any[];

    expect(categories.length).toBeGreaterThanOrEqual(13);

    const alimentacao = categories.find((c) => c.name === 'Alimentação');
    expect(alimentacao).toBeDefined();
    expect(alimentacao.type).toBe('EXPENSE');

    const salario = categories.find((c) => c.name === 'Salário');
    expect(salario).toBeDefined();
    expect(salario.type).toBe('INCOME');
  });

  it('assegura restrição de unicidade em nomes de categoria', () => {
    const db = appDb.getRawDb();
    expect(() => {
      db.prepare(`
        INSERT INTO categories (id, name, type, created_at, updated_at)
        VALUES ('1', 'Alimentação', 'EXPENSE', '2026-09-10', '2026-09-10')
      `).run();
    }).toThrow(/UNIQUE constraint failed/);
  });

  it('assegura integridade referencial com foreign keys habilitadas', () => {
    const db = appDb.getRawDb();
    expect(() => {
      db.prepare(`
        INSERT INTO transactions (id, description, amount_cents, type, category_id, date, payment_method, status, created_at, updated_at)
        VALUES ('t1', 'Teste', 5000, 'EXPENSE', 'categoria-inexistente', '2026-09-10', 'PIX', 'PAID', '2026-09-10', '2026-09-10')
      `).run();
    }).toThrow(/FOREIGN KEY constraint failed/);
  });

  it('banco antigo ganha a coluna de cartão, preenchida com o nome das compras no crédito', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fp-migra-'));
    const file = path.join(dir, 'antigo.db');
    const legacy = new DatabaseConstructor(file);
    legacy.exec(`
      CREATE TABLE categories (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, type TEXT NOT NULL, description TEXT,
        color TEXT, icon TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
      INSERT INTO categories VALUES ('c1', 'Cartão de Crédito', 'EXPENSE', '', NULL, NULL, 'x', 'x');
      CREATE TABLE installment_purchases (id TEXT PRIMARY KEY, description TEXT NOT NULL, total_amount_cents INTEGER NOT NULL,
        total_installments INTEGER NOT NULL, first_due_date TEXT NOT NULL, category_id TEXT NOT NULL,
        payment_method TEXT NOT NULL DEFAULT 'CREDIT', notes TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
      INSERT INTO installment_purchases VALUES ('p1', 'Cartão Nu CPF', 83532, 9, '2026-10-10', 'c1', 'CREDIT', NULL, 'x', 'x');
      INSERT INTO installment_purchases VALUES ('p2', 'Carnê Loja', 30000, 3, '2026-10-10', 'c1', 'BOLETO', NULL, 'x', 'x');
    `);
    legacy.close();

    const migrated = new AppDatabase(file);
    const rows = migrated.getRawDb().prepare('SELECT id, card_name FROM installment_purchases ORDER BY id').all();
    migrated.close();
    new AppDatabase(file).close(); // reabrir não deve tentar migrar de novo
    fs.rmSync(dir, { recursive: true, force: true });

    expect(rows).toEqual([
      { id: 'p1', card_name: 'Cartão Nu CPF' },
      { id: 'p2', card_name: null },
    ]);
  });
});
