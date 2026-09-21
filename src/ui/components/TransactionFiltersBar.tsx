import React, { useState } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { Category } from '../../core/domain/category.js';
import { TransactionFilters, TransactionOrigin, TransactionSort } from '../../core/domain/transaction.js';
import { TransactionType } from '../../core/types/common.js';
import { Money } from '../../core/value-objects/money.js';
import { formatDate } from '../utils/formatters.js';

export interface TransactionFilterState {
  search: string;
  categoryId: string;
  status: string;
  sortBy: TransactionSort;
  paymentMethod: string;
  origin: '' | TransactionOrigin;
  minAmount: string;
  maxAmount: string;
  startDate: string;
  endDate: string;
}

export const EMPTY_FILTERS: TransactionFilterState = {
  search: '',
  categoryId: '',
  status: '',
  sortBy: 'DATE_DESC',
  paymentMethod: '',
  origin: '',
  minAmount: '',
  maxAmount: '',
  startDate: '',
  endDate: '',
};

/** Período personalizado ativo substitui o mês selecionado na barra do topo. */
export const hasCustomPeriod = (f: TransactionFilterState) => Boolean(f.startDate || f.endDate);

const parseAmount = (raw: string): number | undefined => {
  if (!raw.trim()) return undefined;
  try {
    return Money.fromReal(raw);
  } catch {
    return undefined;
  }
};

export function buildListFilters(
  f: TransactionFilterState,
  yearMonth: string,
  type: TransactionType
): TransactionFilters & { yearMonth?: string } {
  const custom = hasCustomPeriod(f);
  return {
    type,
    yearMonth: custom ? undefined : yearMonth,
    startDate: f.startDate || undefined,
    endDate: f.endDate || undefined,
    search: f.search || undefined,
    categoryId: f.categoryId || undefined,
    status: (f.status || undefined) as TransactionFilters['status'],
    paymentMethod: (f.paymentMethod || undefined) as TransactionFilters['paymentMethod'],
    origin: f.origin || undefined,
    minAmountCents: parseAmount(f.minAmount),
    maxAmountCents: parseAmount(f.maxAmount),
    sortBy: f.sortBy,
  };
}

const EXTRA_KEYS: Array<keyof TransactionFilterState> = [
  'paymentMethod',
  'origin',
  'minAmount',
  'maxAmount',
  'startDate',
  'endDate',
];

const selectClass =
  'px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300';
const inputClass =
  'w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50';
const labelClass = 'block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1';

interface TransactionFiltersBarProps {
  type: TransactionType;
  categories: Category[];
  value: TransactionFilterState;
  onChange: (next: TransactionFilterState) => void;
}

export const TransactionFiltersBar: React.FC<TransactionFiltersBarProps> = ({
  type,
  categories,
  value,
  onChange,
}) => {
  const [showMore, setShowMore] = useState(false);
  const set = <K extends keyof TransactionFilterState>(key: K, v: TransactionFilterState[K]) =>
    onChange({ ...value, [key]: v });

  const isExpense = type === 'EXPENSE';
  const extraCount = EXTRA_KEYS.filter((k) => value[k] !== EMPTY_FILTERS[k]).length;
  const anyActive = (Object.keys(EMPTY_FILTERS) as Array<keyof TransactionFilterState>).some(
    (k) => value[k] !== EMPTY_FILTERS[k]
  );
  const typeCategories = categories.filter((c) => c.type === type);

  return (
    <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Pesquisar por descrição ou nota..."
            value={value.search}
            onChange={(e) => set('search', e.target.value)}
            className={`${inputClass} pl-9`}
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <select value={value.categoryId} onChange={(e) => set('categoryId', e.target.value)} className={selectClass}>
            <option value="">Todas Categorias</option>
            {typeCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <select value={value.status} onChange={(e) => set('status', e.target.value)} className={selectClass}>
            <option value="">Todos Status</option>
            {isExpense ? (
              <option value="PAID">Paga</option>
            ) : (
              <option value="RECEIVED">Recebida</option>
            )}
            <option value="PENDING">Pendente</option>
            <option value="OVERDUE">Atrasada</option>
            <option value="CANCELLED">Cancelada</option>
          </select>

          <select
            value={value.sortBy}
            onChange={(e) => set('sortBy', e.target.value as TransactionSort)}
            className={selectClass}
            title="Ordenação"
          >
            <option value="DATE_DESC">Data (mais recente)</option>
            <option value="DATE_ASC">Data (mais antiga)</option>
            <option value="AMOUNT_DESC">Valor (maior)</option>
            <option value="AMOUNT_ASC">Valor (menor)</option>
            <option value="DESCRIPTION">Descrição (A–Z)</option>
          </select>

          <button
            type="button"
            onClick={() => setShowMore((s) => !s)}
            className={`${selectClass} flex items-center gap-1.5 ${showMore ? 'ring-2 ring-emerald-500/40' : ''}`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Mais filtros{extraCount > 0 ? ` (${extraCount})` : ''}
          </button>

          {anyActive && (
            <button
              type="button"
              onClick={() => onChange(EMPTY_FILTERS)}
              className="px-3 py-2 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center gap-1"
            >
              <X className="w-3.5 h-3.5" />
              Limpar filtros
            </button>
          )}
        </div>
      </div>

      {hasCustomPeriod(value) && (
        <div className="flex">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-sky-500/10 text-sky-700 dark:text-sky-300">
            Período:{' '}
            {value.startDate && value.endDate
              ? `${formatDate(value.startDate)} – ${formatDate(value.endDate)}`
              : value.startDate
              ? `a partir de ${formatDate(value.startDate)}`
              : `até ${formatDate(value.endDate)}`}
            <button
              type="button"
              onClick={() => onChange({ ...value, startDate: '', endDate: '' })}
              title="Voltar ao mês selecionado"
              className="hover:text-sky-900 dark:hover:text-white"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        </div>
      )}

      {showMore && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <div>
            <label className={labelClass}>Valor mín. (R$)</label>
            <input
              type="text"
              inputMode="decimal"
              placeholder="0,00"
              value={value.minAmount}
              onChange={(e) => set('minAmount', e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Valor máx. (R$)</label>
            <input
              type="text"
              inputMode="decimal"
              placeholder="0,00"
              value={value.maxAmount}
              onChange={(e) => set('maxAmount', e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>De</label>
            <input type="date" value={value.startDate} onChange={(e) => set('startDate', e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Até</label>
            <input type="date" value={value.endDate} onChange={(e) => set('endDate', e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Origem</label>
            <select
              value={value.origin}
              onChange={(e) => set('origin', e.target.value as TransactionFilterState['origin'])}
              className={`${selectClass} w-full`}
            >
              <option value="">Todas</option>
              <option value="MANUAL">Avulsa</option>
              <option value="RECURRING">{isExpense ? 'Despesa Fixa' : 'Receita Fixa'}</option>
              {isExpense && <option value="INSTALLMENT">Parcela</option>}
            </select>
          </div>
          <div>
            <label className={labelClass}>Forma de pagamento</label>
            <select
              value={value.paymentMethod}
              onChange={(e) => set('paymentMethod', e.target.value)}
              className={`${selectClass} w-full`}
            >
              <option value="">Todas</option>
              <option value="CREDIT">Cartão de Crédito</option>
              <option value="PIX">PIX</option>
              <option value="BOLETO">Boleto</option>
              <option value="DEBIT">Débito</option>
              <option value="MONEY">Dinheiro</option>
              <option value="OTHER">Outro</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
};
