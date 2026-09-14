import React from 'react';
import {
  LayoutDashboard,
  ArrowUpCircle,
  ArrowDownCircle,
  Tag,
  Repeat,
  CreditCard,
  Calendar,
  BarChart3,
  Settings,
  Wallet,
  Sparkles,
} from 'lucide-react';

export type PageId =
  | 'dashboard'
  | 'incomes'
  | 'expenses'
  | 'categories'
  | 'recurring'
  | 'installments'
  | 'calendar'
  | 'reports'
  | 'advisor'
  | 'settings';

interface SidebarProps {
  currentPage: PageId;
  onNavigate: (page: PageId) => void;
  currentBalanceCents: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentPage,
  onNavigate,
  currentBalanceCents,
}) => {
  const menuItems = [
    { id: 'dashboard' as PageId, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'incomes' as PageId, label: 'Receitas', icon: ArrowUpCircle },
    { id: 'expenses' as PageId, label: 'Despesas', icon: ArrowDownCircle },
    { id: 'categories' as PageId, label: 'Categorias', icon: Tag },
    { id: 'recurring' as PageId, label: 'Despesas Fixas', icon: Repeat },
    { id: 'installments' as PageId, label: 'Parcelamentos', icon: CreditCard },
    { id: 'calendar' as PageId, label: 'Calendário', icon: Calendar },
    { id: 'reports' as PageId, label: 'Relatórios', icon: BarChart3 },
    { id: 'advisor' as PageId, label: 'Conselheiro IA', icon: Sparkles },
    { id: 'settings' as PageId, label: 'Configurações', icon: Settings },
  ];

  return (
    <aside className="w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col justify-between select-none shrink-0 h-full">
      <div>
        {/* Logo & Título */}
        <div className="p-6 flex items-center gap-3 border-b border-slate-100 dark:border-slate-800/60">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-white shadow-md shadow-emerald-500/20">
            <Wallet className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold text-base tracking-tight text-slate-900 dark:text-white leading-none">
              Financeiro
            </h1>
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
              Pessoal
            </span>
          </div>
        </div>

        {/* Menu de Navegação */}
        <nav className="p-3 space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-sm transition-all duration-150 ${
                  isActive
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800/60'
                }`}
              >
                <Icon
                  className={`w-5 h-5 transition-colors ${
                    isActive
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-slate-400 dark:text-slate-500'
                  }`}
                />
                {item.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Saldo Atual no Rodapé do Menu */}
      <div className="p-4 border-t border-slate-100 dark:border-slate-800/60">
        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 border border-slate-200/60 dark:border-slate-700/50">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-1">
            Saldo Atual Real
          </span>
          <span
            className={`text-base font-bold tracking-tight block ${
              currentBalanceCents >= 0
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            {new Intl.NumberFormat('pt-BR', {
              style: 'currency',
              currency: 'BRL',
            }).format(currentBalanceCents / 100)}
          </span>
        </div>
      </div>
    </aside>
  );
};
