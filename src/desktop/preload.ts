import { contextBridge, ipcRenderer } from 'electron';
import { IElectronAPI } from '../ui/types/electron-api.js';

const api: IElectronAPI = {
  // Categorias
  listCategories: (type) => ipcRenderer.invoke('categories:list', type),
  createCategory: (dto) => ipcRenderer.invoke('categories:create', dto),
  updateCategory: (id, dto) => ipcRenderer.invoke('categories:update', id, dto),
  deleteCategory: (id) => ipcRenderer.invoke('categories:delete', id),

  // Transações
  listTransactions: (filters) => ipcRenderer.invoke('transactions:list', filters),
  createTransaction: (dto) => ipcRenderer.invoke('transactions:create', dto),
  updateTransaction: (id, dto) => ipcRenderer.invoke('transactions:update', id, dto),
  deleteTransaction: (id) => ipcRenderer.invoke('transactions:delete', id),
  markTransactionPaid: (id, paymentDate) => ipcRenderer.invoke('transactions:markPaid', id, paymentDate),
  markTransactionUnpaid: (id) => ipcRenderer.invoke('transactions:markUnpaid', id),

  // Despesas Fixas
  listRecurringRules: (activeOnly) => ipcRenderer.invoke('recurring:list', activeOnly),
  createRecurringRule: (dto) => ipcRenderer.invoke('recurring:create', dto),
  updateRecurringRule: (id, dto) => ipcRenderer.invoke('recurring:update', id, dto),
  deleteRecurringRule: (id) => ipcRenderer.invoke('recurring:delete', id),

  // Compras Parceladas
  listInstallmentPurchases: () => ipcRenderer.invoke('installments:list'),
  createInstallmentPurchase: (dto) => ipcRenderer.invoke('installments:create', dto),
  payInstallment: (id, paymentDate) => ipcRenderer.invoke('installments:pay', id, paymentDate),
  updateInstallment: (id, dto) => ipcRenderer.invoke('installments:update', id, dto),
  deleteInstallmentPurchase: (id) => ipcRenderer.invoke('installments:delete', id),

  // Visões Consolidadas
  getDashboardMetrics: (yearMonth) => ipcRenderer.invoke('dashboard:getMetrics', yearMonth),
  getCalendarData: (yearMonth) => ipcRenderer.invoke('calendar:getData', yearMonth),
  getReports: (year) => ipcRenderer.invoke('reports:getReports', year),
  getForecast: (startYearMonth, count) => ipcRenderer.invoke('forecast:getForecast', startYearMonth, count),

  // Backup e Restauração
  exportBackupJSON: () => ipcRenderer.invoke('backup:exportJSON'),
  importBackupJSON: (jsonContent) => ipcRenderer.invoke('backup:importJSON', jsonContent),

  // Extratos e Conciliação Bancária
  parseStatement: (fileContent, fileName) => ipcRenderer.invoke('statement:parse', fileContent, fileName),
  reconcilePreview: (items) => ipcRenderer.invoke('statement:preview', items),
  reconcileCommit: (items) => ipcRenderer.invoke('statement:commit', items),
  // Limpeza de Dados
  clearAllData: (includeCategories) => ipcRenderer.invoke('data:clearAll', includeCategories),
};

contextBridge.exposeInMainWorld('api', api);
