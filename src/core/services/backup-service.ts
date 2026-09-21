import { Database } from 'better-sqlite3';

export interface FinancialBackupData {
  version: string;
  exportedAt: string;
  categories: any[];
  recurringRules: any[];
  installmentPurchases: any[];
  installments: any[];
  transactions: any[];
}

export class BackupService {
  constructor(private db: Database) {}

  /**
   * Exporta todo o banco de dados em um payload JSON portátil.
   */
  exportToJSON(): FinancialBackupData {
    const categories = this.db.prepare('SELECT * FROM categories').all();
    const recurringRules = this.db.prepare('SELECT * FROM recurring_rules').all();
    const installmentPurchases = this.db.prepare('SELECT * FROM installment_purchases').all();
    const installments = this.db.prepare('SELECT * FROM installments').all();
    const transactions = this.db.prepare('SELECT * FROM transactions').all();

    return {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      categories,
      recurringRules,
      installmentPurchases,
      installments,
      transactions,
    };
  }

  /**
   * Restaura um payload JSON substituindo atomicamente os dados atuais.
   */
  importFromJSON(data: FinancialBackupData): void {
    if (!data.version || !Array.isArray(data.categories)) {
      throw new Error('Formato de arquivo de backup JSON inválido');
    }

    const restoreTx = this.db.transaction(() => {
      // Limpa dados atuais respeitando integridade referencial
      this.db.prepare('DELETE FROM transactions').run();
      this.db.prepare('DELETE FROM installments').run();
      this.db.prepare('DELETE FROM installment_purchases').run();
      this.db.prepare('DELETE FROM recurring_rules').run();
      this.db.prepare('DELETE FROM categories').run();

      // Restaura categorias
      const insertCat = this.db.prepare(`
        INSERT INTO categories (id, name, type, description, color, icon, created_at, updated_at)
        VALUES (@id, @name, @type, @description, @color, @icon, @created_at, @updated_at)
      `);
      for (const cat of data.categories) {
        insertCat.run(cat);
      }

      // Restaura regras recorrentes
      const insertRec = this.db.prepare(`
        INSERT INTO recurring_rules (id, description, amount_cents, type, category_id, frequency, due_day, start_date, end_date, payment_method, is_active, notes, created_at, updated_at)
        VALUES (@id, @description, @amount_cents, @type, @category_id, @frequency, @due_day, @start_date, @end_date, @payment_method, @is_active, @notes, @created_at, @updated_at)
      `);
      for (const rec of data.recurringRules || []) {
        insertRec.run(rec);
      }

      // Restaura compras parceladas
      const insertPur = this.db.prepare(`
        INSERT INTO installment_purchases (id, description, total_amount_cents, total_installments, first_due_date, category_id, payment_method, card_name, notes, created_at, updated_at)
        VALUES (@id, @description, @total_amount_cents, @total_installments, @first_due_date, @category_id, @payment_method, @card_name, @notes, @created_at, @updated_at)
      `);
      for (const pur of data.installmentPurchases || []) {
        // Backups antigos não têm card_name
        insertPur.run({ card_name: null, ...pur });
      }

      // Restaura parcelas
      const insertInst = this.db.prepare(`
        INSERT INTO installments (id, purchase_id, installment_number, total_installments, amount_cents, due_date, payment_date, status, transaction_id, created_at, updated_at)
        VALUES (@id, @purchase_id, @installment_number, @total_installments, @amount_cents, @due_date, @payment_date, @status, @transaction_id, @created_at, @updated_at)
      `);
      for (const inst of data.installments || []) {
        insertInst.run(inst);
      }

      // Restaura transações
      const insertTx = this.db.prepare(`
        INSERT INTO transactions (id, description, amount_cents, type, category_id, date, payment_date, payment_method, status, notes, installment_id, recurring_rule_id, created_at, updated_at)
        VALUES (@id, @description, @amount_cents, @type, @category_id, @date, @payment_date, @payment_method, @status, @notes, @installment_id, @recurring_rule_id, @created_at, @updated_at)
      `);
      for (const tx of data.transactions || []) {
        insertTx.run(tx);
      }
    });

    restoreTx();
  }

  /**
   * Cria cópia binária do banco de dados SQLite no caminho especificado.
   */
  async exportSqliteFile(targetPath: string): Promise<void> {
    await this.db.backup(targetPath);
  }
}
