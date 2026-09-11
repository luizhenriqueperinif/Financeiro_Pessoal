import React from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Moon,
  Sun,
  Calendar as CalendarIcon,
} from 'lucide-react';
import { getMonthName } from '../utils/formatters.js';

interface TopBarProps {
  selectedYearMonth: string;
  onYearMonthChange: (ym: string) => void;
  onOpenNewExpense: () => void;
  onOpenNewIncome: () => void;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  selectedYearMonth,
  onYearMonthChange,
  onOpenNewExpense,
  onOpenNewIncome,
  isDarkMode,
  onToggleDarkMode,
}) => {
  const handlePrevMonth = () => {
    const [yStr, mStr] = selectedYearMonth.split('-');
    let y = parseInt(yStr, 10);
    let m = parseInt(mStr, 10) - 1;
    if (m < 1) {
      m = 12;
      y--;
    }
    onYearMonthChange(`${y}-${String(m).padStart(2, '0')}`);
  };

  const handleNextMonth = () => {
    const [yStr, mStr] = selectedYearMonth.split('-');
    let y = parseInt(yStr, 10);
    let m = parseInt(mStr, 10) + 1;
    if (m > 12) {
      m = 1;
      y++;
    }
    onYearMonthChange(`${y}-${String(m).padStart(2, '0')}`);
  };

  const handleCurrentMonth = () => {
    const today = new Date().toISOString().slice(0, 7);
    onYearMonthChange(today);
  };

  return (
    <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 flex items-center justify-between shrink-0 select-none">
      {/* Seletor de Mês e Ano */}
      <div className="flex items-center gap-3">
        <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl p-1 border border-slate-200/60 dark:border-slate-700/60 shadow-sm">
          <button
            onClick={handlePrevMonth}
            className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
            title="Mês anterior"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2 px-3">
            <CalendarIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span className="text-sm font-bold text-slate-800 dark:text-slate-100 capitalize">
              {getMonthName(selectedYearMonth)}
            </span>
          </div>

          <button
            onClick={handleNextMonth}
            className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
            title="Próximo mês"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <button
          onClick={handleCurrentMonth}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
        >
          Mês Atual
        </button>
      </div>

      {/* Botões de Ação Rápida */}
      <div className="flex items-center gap-3">
        {/* Toggle Dark Mode */}
        <button
          onClick={onToggleDarkMode}
          className="p-2 rounded-xl text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title="Alternar tema claro/escuro"
        >
          {isDarkMode ? (
            <Sun className="w-5 h-5 text-amber-400" />
          ) : (
            <Moon className="w-5 h-5 text-slate-600" />
          )}
        </button>

        {/* Nova Receita */}
        <button
          onClick={onOpenNewIncome}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold shadow-sm shadow-emerald-600/30 transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" />
          Nova Receita
        </button>

        {/* Nova Despesa */}
        <button
          onClick={onOpenNewExpense}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold shadow-sm shadow-rose-600/30 transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" />
          Nova Despesa
        </button>
      </div>
    </header>
  );
};
