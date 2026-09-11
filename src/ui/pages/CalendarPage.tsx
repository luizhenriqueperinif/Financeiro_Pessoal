import React, { useEffect, useState } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, X } from 'lucide-react';
import { CalendarMonthData, CalendarDay, CalendarEvent } from '../../core/domain/calendar.js';
import { formatMoney, getMonthName } from '../utils/formatters.js';
import { api } from '../services/api.js';

interface CalendarPageProps {
  selectedYearMonth: string;
  onOpenNewExpenseForDate: (date: string) => void;
}

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export const CalendarPage: React.FC<CalendarPageProps> = ({
  selectedYearMonth,
  onOpenNewExpenseForDate,
}) => {
  const [data, setData] = useState<CalendarMonthData | null>(null);
  const [selectedDay, setSelectedDay] = useState<CalendarDay | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await api.getCalendarData(selectedYearMonth);
      setData(res);
      // Se houver um dia selecionado, atualiza ele
      if (selectedDay) {
        const updated = res.days.find((d) => d.date === selectedDay.date);
        setSelectedDay(updated || null);
      }
    } catch (err) {
      console.error('Erro ao carregar calendário', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedYearMonth]);

  if (loading || !data) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  // Preenche dias vazios antes do primeiro dia do mês
  const emptyDaysBefore = Array.from({ length: data.firstDayOfWeek }, (_, i) => i);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <CalendarIcon className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            Calendário Financeiro
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Visualize vencimentos de contas e previsões de recebimento dia a dia
          </p>
        </div>

        <div className="flex items-center gap-4 text-xs font-semibold">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span className="text-slate-600 dark:text-slate-300">Receitas: {formatMoney(data.totalIncomeMonthCents)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
            <span className="text-slate-600 dark:text-slate-300">Despesas: {formatMoney(data.totalExpenseMonthCents)}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Grade do Calendário */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
          {/* Cabeçalho dos dias da semana */}
          <div className="grid grid-cols-7 text-center mb-3">
            {WEEKDAYS.map((wd) => (
              <div key={wd} className="text-xs font-bold text-slate-400 py-1 uppercase tracking-wider">
                {wd}
              </div>
            ))}
          </div>

          {/* Matriz dos dias */}
          <div className="grid grid-cols-7 gap-1.5">
            {emptyDaysBefore.map((idx) => (
              <div key={`empty-${idx}`} className="h-24 rounded-xl bg-slate-50/50 dark:bg-slate-800/20" />
            ))}

            {data.days.map((day) => {
              const isSelected = selectedDay?.date === day.date;
              const hasEvents = day.events.length > 0;
              return (
                <div
                  key={day.date}
                  onClick={() => setSelectedDay(day)}
                  className={`h-24 p-2 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/30 dark:bg-emerald-950/20'
                      : day.isToday
                      ? 'border-emerald-500/60 bg-slate-50 dark:bg-slate-800'
                      : 'border-slate-200/70 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full ${
                        day.isToday
                          ? 'bg-emerald-600 text-white'
                          : 'text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {day.dayNumber}
                    </span>
                    {hasEvents && (
                      <span className="text-[10px] font-bold text-slate-400">
                        {day.events.length}
                      </span>
                    )}
                  </div>

                  {/* Resumo monetário do dia */}
                  <div className="space-y-0.5">
                    {day.totalIncomeCents > 0 && (
                      <div className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 truncate">
                        +{formatMoney(day.totalIncomeCents)}
                      </div>
                    )}
                    {day.totalExpenseCents > 0 && (
                      <div className="text-[10px] font-bold text-rose-600 dark:text-rose-400 truncate">
                        -{formatMoney(day.totalExpenseCents)}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Detalhes do Dia Selecionado */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {selectedDay ? `Lançamentos do Dia ${selectedDay.dayNumber}` : 'Selecione um dia'}
                </h3>
                <span className="text-xs text-slate-400">
                  {selectedDay ? selectedDay.date : 'Clique em qualquer dia no calendário'}
                </span>
              </div>
              {selectedDay && (
                <button
                  onClick={() => onOpenNewExpenseForDate(selectedDay.date)}
                  className="p-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm"
                  title="Novo lançamento neste dia"
                >
                  <Plus className="w-4 h-4" />
                </button>
              )}
            </div>

            {selectedDay ? (
              selectedDay.events.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">
                  Nenhum vencimento ou recebimento previsto para este dia.
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
                  {selectedDay.events.map((ev) => {
                    const isIncome = ev.type === 'INCOME';
                    return (
                      <div
                        key={ev.id}
                        className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/50"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="text-xs font-bold text-slate-900 dark:text-white block">
                              {ev.description}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {ev.categoryName || 'Geral'}
                            </span>
                          </div>
                          <span
                            className={`text-xs font-black shrink-0 ${
                              isIncome ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                            }`}
                          >
                            {isIncome ? '+' : '-'}{formatMoney(ev.amountCents)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            ) : (
              <div className="p-8 text-center text-xs text-slate-400">
                Selecione qualquer dia na grade ao lado para ver os detalhes completos.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
