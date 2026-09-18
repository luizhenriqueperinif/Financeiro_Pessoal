import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

import { AppDatabase } from '../infra/database/connection.js';
import { SqliteCategoryRepository } from '../infra/repositories/sqlite-category-repository.js';
import { SqliteTransactionRepository } from '../infra/repositories/sqlite-transaction-repository.js';
import { SqliteRecurringRuleRepository } from '../infra/repositories/sqlite-recurring-rule-repository.js';
import { SqliteInstallmentPurchaseRepository } from '../infra/repositories/sqlite-installment-purchase-repository.js';

import {
  CreateCategoryUseCase,
  ListCategoriesUseCase,
  UpdateCategoryUseCase,
  DeleteCategoryUseCase,
} from '../core/use-cases/categories/index.js';
import {
  CreateTransactionUseCase,
  ListTransactionsUseCase,
  UpdateTransactionUseCase,
  DeleteTransactionUseCase,
  MarkTransactionPaidUseCase,
  MarkTransactionUnpaidUseCase,
} from '../core/use-cases/transactions/index.js';
import {
  CreateRecurringRuleUseCase,
  ListRecurringRulesUseCase,
  UpdateRecurringRuleUseCase,
  DeleteRecurringRuleUseCase,
  ProcessRecurringInstancesUseCase,
} from '../core/use-cases/recurring/index.js';
import {
  CreateInstallmentPurchaseUseCase,
  ListInstallmentPurchasesUseCase,
  PayInstallmentUseCase,
  UpdateInstallmentUseCase,
  DeleteInstallmentPurchaseUseCase,
} from '../core/use-cases/installments/index.js';
import { GetDashboardMetricsUseCase } from '../core/use-cases/dashboard/index.js';
import { GetCalendarDataUseCase } from '../core/use-cases/calendar/index.js';
import { GetFinancialReportsUseCase } from '../core/use-cases/reports/index.js';
import { CalculateForecastUseCase } from '../core/use-cases/forecast/index.js';
import { BackupService } from '../core/services/backup-service.js';

const currentDir = typeof __dirname !== 'undefined' ? __dirname : process.cwd();

let mainWindow: BrowserWindow | null = null;
let appDb: AppDatabase | null = null;

function initializeDatabase() {
  const userDataDir = app.getPath('userData');
  if (!fs.existsSync(userDataDir)) {
    fs.mkdirSync(userDataDir, { recursive: true });
  }
  const dbPath = path.join(userDataDir, 'financeiro.db');
  appDb = new AppDatabase(dbPath);

  const rawDb = appDb.getRawDb();
  const categoryRepo = new SqliteCategoryRepository(rawDb);
  const transactionRepo = new SqliteTransactionRepository(rawDb);
  const recurringRepo = new SqliteRecurringRuleRepository(rawDb);
  const installmentRepo = new SqliteInstallmentPurchaseRepository(rawDb);

  // Casos de uso
  const createCategory = new CreateCategoryUseCase(categoryRepo);
  const listCategories = new ListCategoriesUseCase(categoryRepo);
  const updateCategory = new UpdateCategoryUseCase(categoryRepo);
  const deleteCategory = new DeleteCategoryUseCase(categoryRepo);

  const createTransaction = new CreateTransactionUseCase(transactionRepo, categoryRepo);
  const listTransactions = new ListTransactionsUseCase(transactionRepo);
  const updateTransaction = new UpdateTransactionUseCase(transactionRepo, categoryRepo);
  const deleteTransaction = new DeleteTransactionUseCase(transactionRepo);
  const markTransactionPaid = new MarkTransactionPaidUseCase(transactionRepo);
  const markTransactionUnpaid = new MarkTransactionUnpaidUseCase(transactionRepo);

  const createRecurring = new CreateRecurringRuleUseCase(recurringRepo, categoryRepo);
  const listRecurring = new ListRecurringRulesUseCase(recurringRepo);
  const updateRecurring = new UpdateRecurringRuleUseCase(recurringRepo, categoryRepo);
  const deleteRecurring = new DeleteRecurringRuleUseCase(recurringRepo);
  const processRecurring = new ProcessRecurringInstancesUseCase(recurringRepo, transactionRepo);

  const createInstallmentPurchase = new CreateInstallmentPurchaseUseCase(installmentRepo, categoryRepo);
  const listInstallments = new ListInstallmentPurchasesUseCase(installmentRepo);
  const payInstallment = new PayInstallmentUseCase(installmentRepo);
  const updateInstallment = new UpdateInstallmentUseCase(installmentRepo);
  const deleteInstallmentPurchase = new DeleteInstallmentPurchaseUseCase(installmentRepo);

  const getDashboard = new GetDashboardMetricsUseCase(transactionRepo, recurringRepo);
  const getCalendar = new GetCalendarDataUseCase(transactionRepo, recurringRepo);
  const getReports = new GetFinancialReportsUseCase(transactionRepo, recurringRepo, installmentRepo, categoryRepo);
  const calculateForecast = new CalculateForecastUseCase(transactionRepo, recurringRepo);
  const backupService = new BackupService(rawDb);

  // Registro dos IPC Handlers
  ipcMain.handle('categories:list', (_, type) => listCategories.execute(type));
  ipcMain.handle('categories:create', (_, dto) => createCategory.execute(dto));
  ipcMain.handle('categories:update', (_, id, dto) => updateCategory.execute(id, dto));
  ipcMain.handle('categories:delete', (_, id) => deleteCategory.execute(id));

  ipcMain.handle('transactions:list', (_, filters) => listTransactions.execute(filters));
  ipcMain.handle('transactions:create', (_, dto) => createTransaction.execute(dto));
  ipcMain.handle('transactions:update', (_, id, dto) => updateTransaction.execute(id, dto));
  ipcMain.handle('transactions:delete', (_, id) => deleteTransaction.execute(id));
  ipcMain.handle('transactions:markPaid', (_, id, paymentDate) => markTransactionPaid.execute(id, paymentDate));
  ipcMain.handle('transactions:markUnpaid', (_, id) => markTransactionUnpaid.execute(id));

  ipcMain.handle('recurring:list', (_, activeOnly) => listRecurring.execute(activeOnly));
  ipcMain.handle('recurring:create', (_, dto) => createRecurring.execute(dto));
  ipcMain.handle('recurring:update', (_, id, dto) => updateRecurring.execute(id, dto));
  ipcMain.handle('recurring:delete', (_, id) => deleteRecurring.execute(id));

  ipcMain.handle('installments:list', () => listInstallments.execute());
  ipcMain.handle('installments:create', (_, dto) => createInstallmentPurchase.execute(dto));
  ipcMain.handle('installments:pay', (_, id, date) => payInstallment.execute(id, date));
  ipcMain.handle('installments:update', (_, id, dto) => updateInstallment.execute(id, dto));
  ipcMain.handle('installments:delete', (_, id) => deleteInstallmentPurchase.execute(id));

  ipcMain.handle('dashboard:getMetrics', (_, ym) => getDashboard.execute(ym));
  ipcMain.handle('calendar:getData', (_, ym) => getCalendar.execute(ym));
  ipcMain.handle('reports:getReports', (_, y) => getReports.execute(y));
  ipcMain.handle('forecast:getForecast', (_, ym, count) => calculateForecast.execute(ym, count));

  ipcMain.handle('backup:exportJSON', () => JSON.stringify(backupService.exportToJSON(), null, 2));
  ipcMain.handle('backup:importJSON', (_, jsonStr) => {
    const parsed = JSON.parse(jsonStr);
    backupService.importFromJSON(parsed);
    return true;
  });

  ipcMain.handle('data:clearAll', (_, includeCategories?: boolean) => {
    const rawDb = appDb!.getRawDb();
    rawDb.transaction(() => {
      rawDb.prepare('DELETE FROM transactions').run();
      rawDb.prepare('DELETE FROM installments').run();
      rawDb.prepare('DELETE FROM installment_purchases').run();
      rawDb.prepare('DELETE FROM recurring_rules').run();
      if (includeCategories) {
        rawDb.prepare('DELETE FROM categories').run();
      }
    })();
    return true;
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 1024,
    minHeight: 720,
    title: 'Financeiro Pessoal',
    backgroundColor: '#090d16',
    autoHideMenuBar: true,
    icon: fs.existsSync(path.join(currentDir, '../renderer/icon.png'))
      ? path.join(currentDir, '../renderer/icon.png')
      : path.join(process.cwd(), 'build/icon.png'),
    webPreferences: {
      preload: path.join(currentDir, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    mainWindow.loadURL(devServerUrl);
  } else {
    mainWindow.loadFile(path.join(currentDir, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  initializeDatabase();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    if (appDb) {
      appDb.close();
    }
    app.quit();
  }
});
