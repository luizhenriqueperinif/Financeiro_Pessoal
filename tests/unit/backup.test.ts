import { describe, it, expect, beforeEach } from 'vitest';
import { AppDatabase } from '../../src/infra/database/connection.js';
import { SqliteCategoryRepository } from '../../src/infra/repositories/sqlite-category-repository.js';
import { SqliteTransactionRepository } from '../../src/infra/repositories/sqlite-transaction-repository.js';
import { BackupService } from '../../src/core/services/backup-service.js';

describe('Backup Service (Segurança e Portabilidade de Dados)', () => {
  let appDb: AppDatabase;
  let categoryRepo: SqliteCategoryRepository;
  let transactionRepo: SqliteTransactionRepository;
  let backupService: BackupService;

  beforeEach(() => {
    appDb = new AppDatabase(':memory:');
    const rawDb = appDb.getRawDb();
    categoryRepo = new SqliteCategoryRepository(rawDb);
    transactionRepo = new SqliteTransactionRepository(rawDb);
    backupService = new BackupService(rawDb);
  });

  it('exporta todos os dados para JSON e restaura com integridade total', () => {
    const alimentacao = categoryRepo.findByName('Alimentação')!;

    transactionRepo.create({
      description: 'Restaurante Fim de Semana',
      amountCents: 12500,
      type: 'EXPENSE',
      categoryId: alimentacao.id,
      date: '2026-09-12',
      paymentMethod: 'CREDIT',
      status: 'PAID',
    });

    const payload = backupService.exportToJSON();
    expect(payload.version).toBe('1.0.0');
    expect(payload.transactions.length).toBe(1);
    expect(payload.transactions[0].description).toBe('Restaurante Fim de Semana');

    // Agora simula um novo banco em branco e restaura o backup nele
    const novoAppDb = new AppDatabase(':memory:');
    const novoBackupService = new BackupService(novoAppDb.getRawDb());
    const novoTxRepo = new SqliteTransactionRepository(novoAppDb.getRawDb());

    novoBackupService.importFromJSON(payload);

    const transacoesRestauradas = novoTxRepo.list();
    expect(transacoesRestauradas.length).toBe(1);
    expect(transacoesRestauradas[0].description).toBe('Restaurante Fim de Semana');
    expect(transacoesRestauradas[0].amountCents).toBe(12500);

    novoAppDb.close();
  });
});
