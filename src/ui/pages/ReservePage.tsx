import React, { useEffect, useState } from 'react';
import { PiggyBank, Plus, Pencil, Trash2, X, Repeat } from 'lucide-react';
import { Investment, ReserveSummary } from '../../core/domain/investment.js';
import { RecurringRule } from '../../core/domain/recurring-rule.js';
import { Money } from '../../core/value-objects/money.js';
import { api } from '../services/api.js';
import { formatMoney } from '../utils/formatters.js';

interface FormState {
  id?: string;
  name: string;
  balance: string;
  yield: string;
  commitment: string;
  notes: string;
  generatesIncome: boolean;
  incomeDueDay: string;
  /** '' = criar uma receita fixa nova; senão, id da receita fixa existente a vincular. */
  linkRuleId: string;
}

const EMPTY_FORM: FormState = {
  name: '',
  balance: '',
  yield: '',
  commitment: '',
  notes: '',
  generatesIncome: true,
  incomeDueDay: '15',
  linkRuleId: '',
};
const toInput = (cents: number) => (cents ? Money.format(cents).replace(/^R\$\s?/, '') : '');
const parseCents = (raw: string) => (raw.trim() ? Money.fromReal(raw) : 0);

const inputClass =
  'w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50';
const labelClass = 'text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1';

export const ReservePage: React.FC = () => {
  const [summary, setSummary] = useState<ReserveSummary | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [incomeRules, setIncomeRules] = useState<RecurringRule[]>([]);

  const load = async () => {
    const [reserve, rules] = await Promise.all([api.getReserveSummary(), api.listRecurringRules()]);
    setSummary(reserve);
    setIncomeRules(rules.filter((r) => r.type === 'INCOME'));
  };

  const linkedRuleIds = new Set((summary?.investments ?? []).map((i) => i.recurringRuleId).filter(Boolean));
  const ruleName = (id?: string | null) => incomeRules.find((r) => r.id === id)?.description;

  /** Novo investimento: sugere uma receita fixa de rendimento já existente e ainda não vinculada. */
  const openNew = () => {
    const suggestion = incomeRules.find(
      (r) => !linkedRuleIds.has(r.id) && /rend|invest|juros/i.test(`${r.description} ${r.categoryName ?? ''}`)
    );
    setForm({
      ...EMPTY_FORM,
      linkRuleId: suggestion?.id ?? '',
      incomeDueDay: String(suggestion?.dueDay ?? 15),
    });
  };

  useEffect(() => {
    load();
  }, []);

  const edit = (inv: Investment) =>
    setForm({
      id: inv.id,
      name: inv.name,
      balance: toInput(inv.balanceCents),
      yield: toInput(inv.monthlyYieldCents),
      commitment: toInput(inv.monthlyCommitmentCents),
      notes: inv.notes ?? '',
      generatesIncome: inv.generatesIncome,
      incomeDueDay: String(inv.incomeDueDay),
      linkRuleId: inv.recurringRuleId ?? '',
    });

  const save = async () => {
    if (!form) return;
    setError(null);
    try {
      const dto = {
        name: form.name,
        balanceCents: parseCents(form.balance),
        monthlyYieldCents: parseCents(form.yield),
        monthlyCommitmentCents: parseCents(form.commitment),
        notes: form.notes || null,
        generatesIncome: form.generatesIncome,
        incomeDueDay: Number(form.incomeDueDay) || 15,
        linkRecurringRuleId: form.generatesIncome && form.linkRuleId ? form.linkRuleId : null,
      };
      if (form.id) await api.updateInvestment(form.id, dto);
      else await api.createInvestment(dto);
      setForm(null);
      load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const remove = async (inv: Investment) => {
    if (!confirm(`Excluir "${inv.name}" da sua reserva?`)) return;
    await api.deleteInvestment(inv.id);
    load();
  };

  const investments = summary?.investments ?? [];

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto animate-in fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <PiggyBank className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            Reserva e Investimentos
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            O dinheiro guardado fora da conta. O Conselheiro IA considera esses valores nas análises.
          </p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/30"
        >
          <Plus className="w-4 h-4" />
          Adicionar investimento
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
          <span className="text-xs text-slate-500 block font-medium">Total guardado</span>
          <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">{formatMoney(summary?.totalBalanceCents ?? 0)}</span>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
          <span className="text-xs text-slate-500 block font-medium">Rende por mês</span>
          <span className="text-xl font-black text-slate-900 dark:text-white">{formatMoney(summary?.monthlyYieldCents ?? 0)}</span>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
          <span className="text-xs text-slate-500 block font-medium">Sobra para você por mês</span>
          <span className="text-xl font-black text-slate-900 dark:text-white">{formatMoney(summary?.monthlyNetYieldCents ?? 0)}</span>
          <span className="text-[10px] text-slate-400 block">rendimento − compromissos mensais</span>
        </div>
      </div>

      {form && (
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-emerald-500/40 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">{form.id ? 'Editar investimento' : 'Novo investimento'}</h3>
            <button onClick={() => setForm(null)} className="text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          </div>
          {error && <div className="text-xs text-rose-600">{error}</div>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Nome</label>
              <input className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex.: CDB liquidez diária" />
            </div>
            <div>
              <label className={labelClass}>Valor aplicado (R$)</label>
              <input className={inputClass} value={form.balance} onChange={(e) => setForm({ ...form, balance: e.target.value })} placeholder="20.000,00" />
            </div>
            <div>
              <label className={labelClass}>Rendimento por mês (R$)</label>
              <input className={inputClass} value={form.yield} onChange={(e) => setForm({ ...form, yield: e.target.value })} placeholder="600,00" />
            </div>
            <div>
              <label className={labelClass}>Parte do rendimento já comprometida por mês (R$)</label>
              <input className={inputClass} value={form.commitment} onChange={(e) => setForm({ ...form, commitment: e.target.value })} placeholder="Ex.: 460,00 repassados todo mês" />
            </div>
            <div className="md:col-span-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-3">
              <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.generatesIncome}
                  onChange={(e) => setForm({ ...form, generatesIncome: e.target.checked })}
                />
                O rendimento cai na minha conta todo mês (lançar como Receita Fixa)
              </label>
              {form.generatesIncome && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className={labelClass}>Dia em que cai</label>
                    <input
                      type="number"
                      min={1}
                      max={31}
                      className={inputClass}
                      value={form.incomeDueDay}
                      onChange={(e) => setForm({ ...form, incomeDueDay: e.target.value })}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className={labelClass}>Receita fixa</label>
                    <select
                      className={inputClass}
                      value={form.linkRuleId}
                      onChange={(e) => setForm({ ...form, linkRuleId: e.target.value })}
                    >
                      <option value="">Criar uma nova receita fixa</option>
                      {incomeRules
                        .filter((r) => !linkedRuleIds.has(r.id) || r.id === form.linkRuleId)
                        .map((r) => (
                          <option key={r.id} value={r.id}>
                            Usar a existente: {r.description} ({formatMoney(r.amountCents)}/mês)
                          </option>
                        ))}
                    </select>
                  </div>
                  <p className="md:col-span-3 text-[11px] text-slate-500">
                    Valor lançado todo mês: rendimento − parte comprometida ={' '}
                    <strong>
                      {(() => {
                        try {
                          return formatMoney(Math.max(0, parseCents(form.yield) - parseCents(form.commitment)));
                        } catch {
                          return '—';
                        }
                      })()}
                    </strong>
                    . Ao editar o investimento, a receita fixa é atualizada junto.
                  </p>
                </div>
              )}
            </div>
            <div className="md:col-span-2">
              <label className={labelClass}>Observações</label>
              <input className={inputClass} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Ex.: parte do rendimento vai para meu pai; resgate em 1 dia útil" />
            </div>
          </div>
          <div className="flex justify-end">
            <button onClick={save} className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold">
              Salvar
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {investments.length === 0 && !form ? (
          <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
            <PiggyBank className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">Nenhum investimento cadastrado</p>
            <button onClick={openNew} className="mt-3 text-xs text-emerald-600 font-bold hover:underline">
              + Cadastrar minha reserva
            </button>
          </div>
        ) : (
          investments.map((inv) => (
            <div key={inv.id} className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">{inv.name}</h3>
                <p className="text-xs text-slate-500">
                  Rende {formatMoney(inv.monthlyYieldCents)}/mês
                  {inv.monthlyCommitmentCents > 0 && ` • ${formatMoney(inv.monthlyCommitmentCents)} comprometidos • sobra ${formatMoney(inv.monthlyYieldCents - inv.monthlyCommitmentCents)}`}
                </p>
                {inv.notes && <p className="text-[11px] text-slate-400 mt-0.5">{inv.notes}</p>}
                {inv.generatesIncome && inv.recurringRuleId && (
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1">
                    <Repeat className="w-3 h-3" />
                    Lançado como Receita Fixa{ruleName(inv.recurringRuleId) ? ` "${ruleName(inv.recurringRuleId)}"` : ''} todo dia {inv.incomeDueDay}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">{formatMoney(inv.balanceCents)}</span>
                <button onClick={() => edit(inv)} className="p-1.5 text-slate-400 hover:text-indigo-500" title="Editar">
                  <Pencil className="w-4 h-4" />
                </button>
                <button onClick={() => remove(inv)} className="p-1.5 text-slate-400 hover:text-rose-500" title="Excluir">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
