import DatabaseConstructor, { Database } from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { CREATE_TABLES_SQL, DEFAULT_CATEGORIES } from './schema.js';

export class AppDatabase {
  private db: Database;

  constructor(dbPath: string = ':memory:') {
    this.db = new DatabaseConstructor(dbPath);
    this.init();
  }

  private init(): void {
    // Habilita chaves estrangeiras
    this.db.pragma('foreign_keys = ON');

    // Se não for em memória, ativa WAL mode para máxima performance e consistência
    if (this.db.name !== '' && this.db.name !== ':memory:') {
      this.db.pragma('journal_mode = WAL');
    }

    // Cria as tabelas e índices
    this.db.exec(CREATE_TABLES_SQL);
    this.migrate();

    // Seed inicial de categorias padrão caso a tabela esteja vazia
    this.seedDefaultCategories();
  }

  /** Ajustes em bancos criados antes de colunas novas existirem. */
  private migrate(): void {
    const purchaseColumns = this.db
      .prepare('PRAGMA table_info(installment_purchases)')
      .all() as Array<{ name: string }>;
    if (!purchaseColumns.some((c) => c.name === 'card_name')) {
      this.db.transaction(() => {
        this.db.exec('ALTER TABLE installment_purchases ADD COLUMN card_name TEXT');
        // Compras no crédito já cadastradas usavam o nome do cartão como descrição
        this.db.exec(
          "UPDATE installment_purchases SET card_name = description WHERE payment_method = 'CREDIT'"
        );
      })();
    }
  }

  private seedDefaultCategories(): void {
    const count = this.db
      .prepare('SELECT COUNT(*) as total FROM categories')
      .get() as { total: number };

    if (count.total === 0) {
      const insert = this.db.prepare(`
        INSERT INTO categories (id, name, type, description, color, icon, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const now = new Date().toISOString();
      const insertMany = this.db.transaction((categories) => {
        for (const cat of categories) {
          insert.run(
            randomUUID(),
            cat.name,
            cat.type,
            cat.description,
            cat.color,
            cat.icon,
            now,
            now
          );
        }
      });

      insertMany(DEFAULT_CATEGORIES);
    }
  }

  public getRawDb(): Database {
    return this.db;
  }

  public close(): void {
    this.db.close();
  }

  /**
   * Exporta um backup instantâneo do banco para um arquivo de destino.
   */
  public async backup(destinationPath: string): Promise<void> {
    await this.db.backup(destinationPath);
  }
}
