import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AppDatabase } from '../../src/infra/database/connection.js';

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
});
