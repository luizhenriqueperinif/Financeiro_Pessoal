import React, { useState, useEffect } from 'react';
import { Sidebar, PageId } from './components/Sidebar.js';
import { TopBar } from './components/TopBar.js';
import { TransactionModal } from './components/TransactionModal.js';
import { CategoryModal } from './components/CategoryModal.js';
import { RecurringModal } from './components/RecurringModal.js';
import { StatementImportModal } from './components/StatementImportModal.js';
import { DashboardPage } from './pages/DashboardPage.js';
import { IncomesPage } from './pages/IncomesPage.js';
import { ExpensesPage } from './pages/ExpensesPage.js';
import { CategoriesPage } from './pages/CategoriesPage.js';
import { RecurringPage } from './pages/RecurringPage.js';
import { InstallmentsPage } from './pages/InstallmentsPage.js';
import { CalendarPage } from './pages/CalendarPage.js';
import { ReportsPage } from './pages/ReportsPage.js';
import { SettingsPage } from './pages/SettingsPage.js';
import { AdvisorPage } from './pages/AdvisorPage.js';
import { Category } from '../core/domain/category.js';
import { TransactionType } from '../core/types/common.js';
import { api } from './services/api.js';
import { DateUtils } from '../core/utils/date-utils.js';

export const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<PageId>('dashboard');
  const [selectedYearMonth, setSelectedYearMonth] = useState<string>(
    DateUtils.currentYearMonth()
  );
  const [categories, setCategories] = useState<Category[]>([]);
  const [currentBalanceCents, setCurrentBalanceCents] = useState<number>(0);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(true);

  // Estados dos Modais
  const [isTxModalOpen, setIsTxModalOpen] = useState<boolean>(false);
  const [txModalType, setTxModalType] = useState<TransactionType>('EXPENSE');
  const [txModalDate, setTxModalDate] = useState<string | undefined>(undefined);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState<boolean>(false);
  const [isRecurringModalOpen, setIsRecurringModalOpen] = useState<boolean>(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);

  // Feedback / Toast Banner
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const loadCategories = async () => {
    try {
      const cats = await api.listCategories();
      setCategories(cats);
    } catch (err) {
      console.error('Erro ao carregar categorias', err);
    }
  };

  const loadGlobalBalance = async () => {
    try {
      const metrics = await api.getDashboardMetrics(selectedYearMonth);
      setCurrentBalanceCents(metrics.currentBalanceCents);
    } catch (err) {
      console.error('Erro ao carregar saldo global', err);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    loadGlobalBalance();
  }, [selectedYearMonth]);

  useEffect(() => {
    const root = document.documentElement;
    if (isDarkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [isDarkMode]);

  const handleOpenNewIncome = () => {
    setTxModalType('INCOME');
    setTxModalDate(undefined);
    setIsTxModalOpen(true);
  };

  const handleOpenNewExpense = () => {
    setTxModalType('EXPENSE');
    setTxModalDate(undefined);
    setIsTxModalOpen(true);
  };

  const handleOpenNewExpenseForDate = (date: string) => {
    setTxModalType('EXPENSE');
    setTxModalDate(date);
    setIsTxModalOpen(true);
  };

  const handleTxSuccess = (message?: string) => {
    loadGlobalBalance();
    if (message) {
      showToast(message);
    }
  };

  return (
    <div className="flex h-screen bg-slate-100 dark:bg-slate-950 overflow-hidden font-sans">
      {/* Barra Lateral */}
      <Sidebar
        currentPage={currentPage}
        onNavigate={setCurrentPage}
        currentBalanceCents={currentBalanceCents}
      />

      {/* Área Principal */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Barra Superior */}
        <TopBar
          selectedYearMonth={selectedYearMonth}
          onYearMonthChange={setSelectedYearMonth}
          onOpenNewExpense={handleOpenNewExpense}
          onOpenNewIncome={handleOpenNewIncome}
          onOpenImportStatement={() => setIsImportModalOpen(true)}
          isDarkMode={isDarkMode}
          onToggleDarkMode={() => setIsDarkMode(!isDarkMode)}
        />

        {/* Notificação Toast */}
        {toastMessage && (
          <div className="mx-6 mt-4 p-3.5 rounded-xl bg-emerald-600 text-white text-xs font-bold shadow-lg shadow-emerald-600/30 flex items-center justify-between animate-in slide-in-from-top-2 duration-200">
            <span>{toastMessage}</span>
            <button
              onClick={() => setToastMessage(null)}
              className="text-white/80 hover:text-white ml-2 text-sm"
            >
              ✕
            </button>
          </div>
        )}

        {/* Conteúdo da Página Ativa */}
        <main className="flex-1 overflow-y-auto">
          {currentPage === 'dashboard' && (
            <DashboardPage
              selectedYearMonth={selectedYearMonth}
              onNavigateToIncomes={() => setCurrentPage('incomes')}
              onNavigateToExpenses={() => setCurrentPage('expenses')}
              onNavigateToInstallments={() => setCurrentPage('installments')}
              onNavigateToRecurring={() => setCurrentPage('recurring')}
            />
          )}

          {currentPage === 'incomes' && (
            <IncomesPage
              selectedYearMonth={selectedYearMonth}
              onOpenNewIncome={handleOpenNewIncome}
              categories={categories}
            />
          )}

          {currentPage === 'expenses' && (
            <ExpensesPage
              selectedYearMonth={selectedYearMonth}
              onOpenNewExpense={handleOpenNewExpense}
              categories={categories}
            />
          )}

          {currentPage === 'categories' && (
            <CategoriesPage
              categories={categories}
              onRefresh={loadCategories}
              onOpenNewCategory={() => setIsCategoryModalOpen(true)}
            />
          )}

          {currentPage === 'recurring' && (
            <RecurringPage
              onOpenNewRecurring={() => setIsRecurringModalOpen(true)}
            />
          )}

          {currentPage === 'installments' && (
            <InstallmentsPage
              onOpenNewExpense={handleOpenNewExpense}
            />
          )}

          {currentPage === 'calendar' && (
            <CalendarPage
              selectedYearMonth={selectedYearMonth}
              onOpenNewExpenseForDate={handleOpenNewExpenseForDate}
            />
          )}

          {currentPage === 'reports' && <ReportsPage />}

          {currentPage === 'advisor' && (
            <AdvisorPage
              selectedYearMonth={selectedYearMonth}
              onNavigateToSettings={() => setCurrentPage('settings')}
            />
          )}

          {currentPage === 'settings' && <SettingsPage />}
        </main>
      </div>

      {/* Modais Globais */}
      <TransactionModal
        isOpen={isTxModalOpen}
        onClose={() => setIsTxModalOpen(false)}
        onSuccess={handleTxSuccess}
        initialType={txModalType}
        categories={categories}
        defaultDate={txModalDate}
      />

      <CategoryModal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        onSuccess={loadCategories}
      />

      <RecurringModal
        isOpen={isRecurringModalOpen}
        onClose={() => setIsRecurringModalOpen(false)}
        onSuccess={loadGlobalBalance}
        categories={categories}
      />

      <StatementImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={() => handleTxSuccess('Extrato bancário importado com sucesso!')}
      />
    </div>
  );
};
