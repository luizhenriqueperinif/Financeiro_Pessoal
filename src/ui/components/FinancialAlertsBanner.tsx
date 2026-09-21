import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  AlertOctagon,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Sparkles,
  Info,
  Check,
  CalendarClock,
} from 'lucide-react';
import { FinancialAlertsSummary, ReminderItem } from '../../core/domain/alerts.js';
import { formatMoney, formatDate } from '../utils/formatters.js';

interface FinancialAlertsBannerProps {
  alerts: FinancialAlertsSummary;
  onQuickPay?: (transactionId: string) => Promise<void>;
}

export const FinancialAlertsBanner: React.FC<FinancialAlertsBannerProps> = ({
  alerts,
  onQuickPay,
}) => {
  const storageKey = 'fp_alert_banner_collapsed';
  const initialCollapsed = localStorage.getItem(storageKey) === 'true';

  const [isCollapsed, setIsCollapsed] = useState(
    alerts.hasCriticalAlert ? false : initialCollapsed
  );
  const [payingId, setPayingId] = useState<string | null>(null);

  // Reabertura reativa obrigatória se surgir um alerta crítico
  useEffect(() => {
    if (alerts.hasCriticalAlert) {
      setIsCollapsed(false);
    }
  }, [alerts.hasCriticalAlert]);

  const toggleCollapse = () => {
    const nextState = !isCollapsed;
    setIsCollapsed(nextState);
    localStorage.setItem(storageKey, String(nextState));
  };

  const handlePay = async (transactionId: string) => {
    if (!onQuickPay) return;
    try {
      setPayingId(transactionId);
      await onQuickPay(transactionId);
    } catch (err) {
      console.error('Falha ao dar baixa rápida:', err);
    } finally {
      setPayingId(null);
    }
  };

  const getTheme = () => {
    switch (alerts.commitmentLevel) {
      case 'CRITICAL':
        return {
          containerBorder: 'border-rose-500/40 dark:border-rose-500/30',
          containerBg: 'bg-rose-50/60 dark:bg-rose-950/20',
          badgeBg: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20',
          iconBg: 'bg-rose-500/15 text-rose-600 dark:text-rose-400',
          Icon: AlertOctagon,
          title: alerts.hasDeficit
            ? 'Déficit Orçamentário Projetado'
            : 'Alerta de Comprometimento Crítico',
          description: alerts.hasDeficit ? (
            <>
              Suas despesas projetadas superam suas receitas em{' '}
              <strong className="text-rose-600 dark:text-rose-400">
                {formatMoney(alerts.deficitCents)}
              </strong>
              . Evite novas despesas sem reserva para prevenir endividamento.
            </>
          ) : (
            <>
              Você já comprometeu <strong>{alerts.commitmentPercentage}%</strong> da sua receita deste mês. Restam{' '}
              <strong className="text-rose-600 dark:text-rose-400">
                {formatMoney(alerts.remainingBalanceCents)}
              </strong>{' '}
              para os próximos {alerts.daysRemainingInMonth} dias.
            </>
          ),
        };
      case 'WARNING':
        return {
          containerBorder: 'border-amber-500/40 dark:border-amber-500/30',
          containerBg: 'bg-amber-50/60 dark:bg-amber-950/20',
          badgeBg: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20',
          iconBg: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
          Icon: AlertTriangle,
          title: 'Atenção ao Comprometimento de Renda',
          description: (
            <>
              Você já comprometeu <strong>{alerts.commitmentPercentage}%</strong> da sua renda. Mantenha apenas as despesas essenciais para fechar o mês com saldo positivo.
            </>
          ),
        };
      case 'HEALTHY':
        return {
          containerBorder: 'border-emerald-500/40 dark:border-emerald-500/30',
          containerBg: 'bg-emerald-50/60 dark:bg-emerald-950/20',
          badgeBg: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20',
          iconBg: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
          Icon: CheckCircle2,
          title: 'Orçamento Saudável e sob Controle',
          description: (
            <>
              Orçamento equilibrado (<strong>{alerts.commitmentPercentage}%</strong> comprometido). Saldo restante projetado de{' '}
              <strong className="text-emerald-600 dark:text-emerald-400">
                {formatMoney(alerts.remainingBalanceCents)}
              </strong>
              .
            </>
          ),
        };
      case 'NO_INCOME':
      default:
        return {
          containerBorder: 'border-sky-500/40 dark:border-sky-500/30',
          containerBg: 'bg-sky-50/60 dark:bg-sky-950/20',
          badgeBg: 'bg-sky-500/10 text-sky-700 dark:text-sky-400 border border-sky-500/20',
          iconBg: 'bg-sky-500/15 text-sky-600 dark:text-sky-400',
          Icon: Info,
          title: 'Planejamento Orçamentário do Mês',
          description: (
            <>Cadastre suas receitas deste mês para ativar o cálculo de comprometimento e do orçamento diário disponível.</>
          ),
        };
    }
  };

  const theme = getTheme();
  const IconComponent = theme.Icon;

  const renderReminderBadge = (reminder: ReminderItem) => {
    if (reminder.type === 'OVERDUE_EXPENSE') {
      const days = Math.abs(reminder.daysDiff);
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/30 animate-pulse">
          <Clock className="w-3 h-3" />
          {days === 0 ? 'Venceu hoje' : `Atrasada há ${days} ${days === 1 ? 'dia' : 'dias'}`}
        </span>
      );
    }
    if (reminder.type === 'UPCOMING_EXPENSE') {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/20">
          <CalendarClock className="w-3 h-3" />
          {reminder.daysDiff === 0 ? 'Vence hoje' : reminder.daysDiff === 1 ? 'Vence amanhã' : `Vence em ${reminder.daysDiff} dias`}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-700 dark:text-sky-400 border border-sky-500/20">
        <Info className="w-3 h-3" />
        {reminder.daysDiff === 0 ? 'Receita prevista hoje' : 'Receita esperada pendente'}
      </span>
    );
  };

  return (
    <div
      className={`rounded-2xl border ${theme.containerBorder} ${theme.containerBg} p-5 shadow-sm transition-all duration-200 backdrop-blur-sm`}
    >
      {/* Cabeçalho do Banner */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3.5 flex-1 min-w-0">
          <div className={`p-2.5 rounded-xl ${theme.iconBg} shrink-0`}>
            <IconComponent className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                {theme.title}
              </h3>
              {alerts.commitmentLevel !== 'NO_INCOME' && (
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${theme.badgeBg}`}>
                  {alerts.commitmentPercentage}% comprometido
                </span>
              )}
              {alerts.reminders.length > 0 && (
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  {alerts.reminders.length}{' '}
                  {alerts.reminders.length === 1 ? 'lembrete' : 'lembretes'}
                </span>
              )}
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
              {theme.description}
            </p>
          </div>
        </div>

        {/* Botão de Recolher / Expandir */}
        <button
          onClick={toggleCollapse}
          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors shrink-0 cursor-pointer"
          title={isCollapsed ? 'Expandir detalhes e lembretes' : 'Recolher detalhes'}
          aria-label={isCollapsed ? 'Expandir' : 'Recolher'}
        >
          {isCollapsed ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
        </button>
      </div>

      {/* Conteúdo Expandido */}
      {!isCollapsed && (
        <div className="mt-5 pt-4 border-t border-slate-200/60 dark:border-slate-800/60 space-y-4 animate-in fade-in duration-200">
          {/* Card de Orçamento Diário Disponível */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="p-3.5 rounded-xl bg-white/80 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                  Orçamento Diário Disponível
                </span>
                <div className="text-lg font-black text-slate-900 dark:text-white mt-0.5">
                  {alerts.commitmentLevel === 'NO_INCOME'
                    ? 'Aguardando receitas'
                    : alerts.hasDeficit
                    ? 'R$ 0,00 / dia'
                    : `${formatMoney(alerts.dailyAvailableBudgetCents)} / dia`}
                </div>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  {alerts.commitmentLevel === 'NO_INCOME'
                    ? 'Cadastre receitas para calcular'
                    : alerts.hasDeficit
                    ? 'Mês deficitário: pause novas despesas'
                    : alerts.daysRemainingInMonth === 0
                    ? 'Mês encerrado'
                    : `Ritmo seguro para os próximos ${alerts.daysRemainingInMonth} dias`}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <Sparkles className="w-4 h-4" />
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-white/80 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                  {alerts.hasDeficit ? 'Déficit Previsto' : 'Saldo Restante Previsto'}
                </span>
                <div
                  className={`text-lg font-black mt-0.5 ${
                    alerts.hasDeficit
                      ? 'text-rose-600 dark:text-rose-400'
                      : 'text-emerald-600 dark:text-emerald-400'
                  }`}
                >
                  {alerts.hasDeficit
                    ? `-${formatMoney(alerts.deficitCents)}`
                    : formatMoney(alerts.remainingBalanceCents)}
                </div>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  Receitas ({formatMoney(alerts.totalIncomeCents)}) vs Despesas (
                  {formatMoney(alerts.totalProjectedExpenseCents)})
                </span>
              </div>
              <div
                className={`p-2.5 rounded-lg ${
                  alerts.hasDeficit
                    ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                    : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                }`}
              >
                <IconComponent className="w-4 h-4" />
              </div>
            </div>
          </div>

          {/* Lista de Lembretes de Vencimento Imediato */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                Lembretes de Obrigações Imediatas
              </span>
              <span className="text-[11px] text-slate-400">
                {alerts.reminders.length === 0
                  ? 'Nenhuma pendência urgente'
                  : `${alerts.reminders.length} item(ns) requerem atenção`}
              </span>
            </div>

            {alerts.reminders.length === 0 ? (
              <div className="p-3 rounded-xl bg-white/40 dark:bg-slate-900/40 border border-slate-200/50 dark:border-slate-800/50 text-center text-xs text-slate-500 dark:text-slate-400">
                Tudo em dia! Nenhuma despesa pendente ou com vencimento nos próximos 5 dias.
              </div>
            ) : (
              <div className="space-y-2">
                {alerts.reminders.map((reminder) => (
                  <div
                    key={reminder.id}
                    className="p-3 rounded-xl bg-white/90 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between gap-3 shadow-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                            {reminder.title}
                          </span>
                          {renderReminderBadge(reminder)}
                        </div>
                        <span className="text-xs text-slate-500 dark:text-slate-400 block mt-0.5">
                          Vencimento: {formatDate(reminder.dueDate)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-sm font-bold text-slate-900 dark:text-white">
                        {formatMoney(reminder.amountCents)}
                      </span>
                      {onQuickPay && (
                        <button
                          onClick={() => handlePay(reminder.transactionId)}
                          disabled={payingId === reminder.transactionId}
                          className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1 transition-all disabled:opacity-50 cursor-pointer shadow-xs"
                          title={
                            reminder.type === 'UNRECEIVED_INCOME'
                              ? 'Marcar receita como recebida'
                              : 'Dar baixa e marcar como pago'
                          }
                        >
                          <Check className="w-3 h-3" />
                          {payingId === reminder.transactionId
                            ? 'Salvando...'
                            : reminder.type === 'UNRECEIVED_INCOME'
                            ? 'Receber'
                            : 'Pagar'}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
