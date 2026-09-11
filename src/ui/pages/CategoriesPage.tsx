import React, { useState } from 'react';
import { Tag, Plus, Trash2, ArrowUpCircle, ArrowDownCircle, AlertCircle } from 'lucide-react';
import { Category } from '../../core/domain/category.js';
import { api } from '../services/api.js';

interface CategoriesPageProps {
  categories: Category[];
  onRefresh: () => void;
  onOpenNewCategory: () => void;
}

export const CategoriesPage: React.FC<CategoriesPageProps> = ({
  categories,
  onRefresh,
  onOpenNewCategory,
}) => {
  const [error, setError] = useState<string | null>(null);

  const expenseCategories = categories.filter((c) => c.type === 'EXPENSE');
  const incomeCategories = categories.filter((c) => c.type === 'INCOME');

  const handleDelete = async (id: string, name: string) => {
    setError(null);
    if (confirm(`Deseja excluir a categoria "${name}"?`)) {
      try {
        await api.deleteCategory(id);
        onRefresh();
      } catch (err: any) {
        setError(err.message || 'Erro ao excluir categoria');
      }
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Tag className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            Gerenciador de Categorias
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Categorize receitas e despesas para manter seus relatórios e previsões organizados
          </p>
        </div>

        <button
          onClick={onOpenNewCategory}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/30 transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" />
          Nova Categoria
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Categorias de Despesas */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <ArrowDownCircle className="w-5 h-5 text-rose-500" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Categorias de Despesa ({expenseCategories.length})
            </h3>
          </div>

          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
            {expenseCategories.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/50 hover:border-slate-300 dark:hover:border-slate-600 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span
                    className="w-3.5 h-3.5 rounded-full shrink-0 shadow-sm"
                    style={{ backgroundColor: c.color || '#EF4444' }}
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-900 dark:text-white block">
                      {c.name}
                    </span>
                    {c.description && (
                      <span className="text-[11px] text-slate-400 block truncate max-w-[280px]">
                        {c.description}
                      </span>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => handleDelete(c.id, c.name)}
                  className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                  title="Excluir categoria"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Categorias de Receitas */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <ArrowUpCircle className="w-5 h-5 text-emerald-500" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Categorias de Receita ({incomeCategories.length})
            </h3>
          </div>

          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
            {incomeCategories.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/50 hover:border-slate-300 dark:hover:border-slate-600 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span
                    className="w-3.5 h-3.5 rounded-full shrink-0 shadow-sm"
                    style={{ backgroundColor: c.color || '#10B981' }}
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-900 dark:text-white block">
                      {c.name}
                    </span>
                    {c.description && (
                      <span className="text-[11px] text-slate-400 block truncate max-w-[280px]">
                        {c.description}
                      </span>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => handleDelete(c.id, c.name)}
                  className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                  title="Excluir categoria"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
