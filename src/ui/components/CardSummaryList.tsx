import React from 'react';
import { CreditCard } from 'lucide-react';
import { CardMonthTotal, CardSummary } from '../../core/domain/installment-purchase.js';
import { formatMoney } from '../utils/formatters.js';

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const monthLabel = (ym: string) => `${MONTHS[Number(ym.slice(5, 7)) - 1]}/${ym.slice(2, 4)}`;

const isNextMonth = (a: string, b: string) => {
  const [ya, ma] = a.split('-').map(Number);
  const [yb, mb] = b.split('-').map(Number);
  return yb * 12 + mb === ya * 12 + ma + 1;
};

interface MonthRange {
  from: string;
  to: string;
  amountCents: number;
  remainingCents: number;
  count: number;
}

/** Junta meses seguidos com o mesmo valor: "dez/26 – fev/27: R$ 54,00 por mês". */
function groupEqualMonths(months: CardMonthTotal[]): MonthRange[] {
  const ranges: MonthRange[] = [];
  for (const m of months) {
    const last = ranges[ranges.length - 1];
    if (
      last &&
      last.amountCents === m.amountCents &&
      isNextMonth(last.to, m.yearMonth) &&
      (last.remainingCents === 0) === (m.remainingCents === 0)
    ) {
      last.to = m.yearMonth;
      last.count++;
    } else {
      ranges.push({ from: m.yearMonth, to: m.yearMonth, amountCents: m.amountCents, remainingCents: m.remainingCents, count: 1 });
    }
  }
  return ranges;
}

interface CardSummaryListProps {
  cards: CardSummary[];
}

export const CardSummaryList: React.FC<CardSummaryListProps> = ({ cards }) => {
  if (cards.length === 0) {
    return (
      <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
        <CreditCard className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
        <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">Nenhuma compra parcelada com cartão informado</p>
        <p className="text-xs text-slate-400 mt-1">Ao cadastrar uma compra parcelada, preencha o campo "Cartão".</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {cards.map((card) => {
        const paidCents = card.totalCents - card.remainingCents;
        const paidPercent = card.totalCents > 0 ? Math.round((paidCents / card.totalCents) * 100) : 0;
        return (
          <div
            key={card.cardName}
            className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 space-y-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">{card.cardName}</h3>
                  <span className="text-[11px] text-slate-500">
                    {card.purchaseCount} {card.purchaseCount === 1 ? 'compra parcelada' : 'compras parceladas'}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Falta pagar</span>
                <span className="text-xl font-black text-purple-600 dark:text-purple-400">{formatMoney(card.remainingCents)}</span>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-[11px] text-slate-500 mb-1">
                <span>
                  Total de todas as parcelas: <strong className="text-slate-700 dark:text-slate-300">{formatMoney(card.totalCents)}</strong>
                </span>
                <span>{paidPercent}% pago</span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div className="h-full bg-purple-600 rounded-full" style={{ width: `${paidPercent}%` }} />
              </div>
            </div>

            <table className="w-full text-xs">
              <thead className="text-[10px] uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="text-left font-bold pb-1.5">Mês</th>
                  <th className="text-right font-bold pb-1.5">Valor da fatura</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {groupEqualMonths(card.months).map((r) => {
                  const paid = r.remainingCents === 0;
                  return (
                    <tr key={r.from} className={paid ? 'text-slate-400 line-through decoration-slate-300' : 'text-slate-700 dark:text-slate-300'}>
                      <td className="py-1.5 font-medium">
                        {r.count === 1 ? monthLabel(r.from) : `${monthLabel(r.from)} a ${monthLabel(r.to)}`}
                        {paid && <span className="ml-1.5 no-underline text-[10px] font-bold text-emerald-600">paga</span>}
                      </td>
                      <td className="py-1.5 text-right font-bold">
                        {formatMoney(r.amountCents)}
                        {r.count > 1 && <span className="font-normal text-slate-400"> por mês</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
};
