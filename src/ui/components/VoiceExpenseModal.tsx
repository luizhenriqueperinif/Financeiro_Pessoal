import React, { useEffect, useRef, useState } from 'react';
import { X, Mic, Square, Upload, Sparkles, Loader2, CheckCircle2, Trash2, Keyboard } from 'lucide-react';
import { Category } from '../../core/domain/category.js';
import { PaymentMethod } from '../../core/types/common.js';
import { Money } from '../../core/value-objects/money.js';
import {
  ExtractedExpense,
  KnownCard,
  extractExpensesFromText,
  transcribeAudio,
} from '../../core/services/voice-expense-service.js';
import { loadStoredAIConfig } from '../services/ai-config-storage.js';
import { api } from '../services/api.js';
import { formatDate, formatMoney } from '../utils/formatters.js';

interface VoiceExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
  categories: Category[];
}

type Step = 'capture' | 'transcript' | 'review';
type Row = ExtractedExpense & { key: string; selected: boolean; amountStr: string };

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  PIX: 'PIX',
  DEBIT: 'Débito',
  CREDIT: 'Crédito',
  MONEY: 'Dinheiro',
  BOLETO: 'Boleto',
  OTHER: 'Outro',
};

const inputClass =
  'w-full px-2 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white';

const formatTimer = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

export const VoiceExpenseModal: React.FC<VoiceExpenseModalProps> = ({ isOpen, onClose, onSuccess, categories }) => {
  const [step, setStep] = useState<Step>('capture');
  const [transcript, setTranscript] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [cards, setCards] = useState<KnownCard[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const aiConfig = loadStoredAIConfig();
  const groqKey = aiConfig.provider === 'groq' ? aiConfig.apiKey?.trim() || '' : '';
  const expenseCategories = categories.filter((c) => c.type === 'EXPENSE');

  useEffect(() => {
    if (!isOpen) return;
    setStep('capture');
    setTranscript('');
    setRows([]);
    setError(null);
    setBusy(null);
    setSeconds(0);
    // Dia de vencimento de cada cartão, a partir das parcelas já cadastradas
    api
      .listInstallmentPurchases()
      .then((purchases) => {
        const byCard = new Map<string, number>();
        for (const p of purchases) {
          const name = p.cardName?.trim();
          const lastDue = p.installments?.[p.installments.length - 1]?.dueDate ?? p.firstDueDate;
          if (name && !byCard.has(name)) byCard.set(name, Number(lastDue.slice(8, 10)));
        }
        setCards([...byCard.entries()].map(([cardName, dueDay]) => ({ cardName, dueDay })));
      })
      .catch(() => setCards([]));
    return () => stopTracks();
  }, [isOpen]);

  if (!isOpen) return null;

  function stopTracks() {
    if (timerRef.current) window.clearInterval(timerRef.current);
    recorderRef.current?.stream.getTracks().forEach((t) => t.stop());
  }

  const vocabulary = () => [...cards.map((c) => c.cardName), ...expenseCategories.map((c) => c.name)];

  const handleTranscribe = async (audio: Blob, fileName: string) => {
    setError(null);
    setBusy('Transcrevendo o áudio...');
    try {
      const text = await transcribeAudio(groqKey, audio, fileName, vocabulary());
      setTranscript(text);
      setStep('transcript');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  };

  const startRecording = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Opus a 32 kbps: ~15 MB por hora, dentro do limite de envio do Groq
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 32000 });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      recorder.onstop = () => {
        stopTracks();
        handleTranscribe(new Blob(chunksRef.current, { type: 'audio/webm' }), 'gravacao.webm');
      };
      recorder.start(1000);
      recorderRef.current = recorder;
      setRecording(true);
      setSeconds(0);
      timerRef.current = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch {
      setError(
        'Não consegui acessar o microfone. Verifique se ele está conectado e liberado em Configurações do Windows → Privacidade → Microfone.'
      );
    }
  };

  const stopRecording = () => {
    setRecording(false);
    recorderRef.current?.stop();
  };

  const handleExtract = async () => {
    setError(null);
    setBusy('Identificando os gastos...');
    try {
      const found = await extractExpensesFromText({ apiKey: groqKey, model: aiConfig.model }, transcript, {
        categories,
        cards,
      });
      if (found.length === 0) {
        setError('Não encontrei nenhum gasto com valor nesse relato. Confira o texto e tente de novo.');
        return;
      }
      setRows(
        found.map((f, i) => ({ ...f, key: `${i}-${f.description}`, selected: true, amountStr: Money.format(f.amountCents).replace(/^R\$\s?/, '') }))
      );
      setStep('review');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  };

  const updateRow = (key: string, patch: Partial<Row>) =>
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const handleSave = async () => {
    const selected = rows.filter((r) => r.selected);
    if (selected.length === 0) return;
    setError(null);
    setBusy('Salvando...');
    try {
      for (const r of selected) {
        const amountCents = Money.fromReal(r.amountStr);
        if (amountCents <= 0) throw new Error(`Valor inválido em "${r.description}"`);
        const isCredit = r.paymentMethod === 'CREDIT';
        const origin = `Compra em ${formatDate(r.purchaseDate)}${r.cardName ? ` no ${r.cardName}` : ''} (lançada por áudio)`;
        if (isCredit && r.installments >= 2) {
          await api.createInstallmentPurchase({
            description: r.description,
            totalAmountCents: amountCents,
            totalInstallments: r.installments,
            firstDueDate: r.dueDate,
            categoryId: r.categoryId,
            paymentMethod: 'CREDIT',
            cardName: r.cardName || null,
            notes: origin,
          });
        } else {
          await api.createTransaction({
            description: r.description,
            amountCents,
            type: 'EXPENSE',
            categoryId: r.categoryId,
            date: r.dueDate,
            paymentMethod: r.paymentMethod,
            // No crédito o dinheiro só sai quando a fatura for paga
            status: isCredit ? 'PENDING' : 'PAID',
            paymentDate: isCredit ? null : r.purchaseDate,
            notes: origin,
          });
        }
      }
      onSuccess(`${selected.length} ${selected.length === 1 ? 'gasto lançado' : 'gastos lançados'} por áudio!`);
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  };

  const selectedTotal = rows
    .filter((r) => r.selected)
    .reduce((acc, r) => {
      try {
        return acc + Money.fromReal(r.amountStr);
      } catch {
        return acc;
      }
    }, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-5xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
              <Mic className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Lançar gastos por áudio</h3>
              <p className="text-xs text-slate-500">Conte o que gastou; a IA separa cada gasto e você confere antes de salvar</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4">
          {!groqKey && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-700 dark:text-amber-300">
              Para usar o áudio, escolha o <strong>Groq</strong> em Configurações → IA e salve a sua chave gratuita.
            </div>
          )}

          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-600 dark:text-rose-400">{error}</div>
          )}

          {busy && (
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
              <Loader2 className="w-4 h-4 animate-spin" /> {busy}
            </div>
          )}

          {step === 'capture' && !busy && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <button
                type="button"
                disabled={!groqKey}
                onClick={recording ? stopRecording : startRecording}
                className={`p-5 rounded-2xl border text-left transition-all disabled:opacity-50 ${
                  recording
                    ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/30 ring-2 ring-rose-500/40'
                    : 'border-slate-200 dark:border-slate-800 hover:border-rose-400'
                }`}
              >
                {recording ? <Square className="w-6 h-6 text-rose-600 mb-2" /> : <Mic className="w-6 h-6 text-rose-600 mb-2" />}
                <span className="text-sm font-bold text-slate-900 dark:text-white block">
                  {recording ? `Gravando ${formatTimer(seconds)} — clique para parar` : 'Gravar áudio'}
                </span>
                <span className="text-[11px] text-slate-500">
                  Fale à vontade, pode ser longo. Ex.: "ontem gastei 45 no mercado no débito, 120 de gasolina no Nu CPF..."
                </span>
              </button>

              <button
                type="button"
                disabled={!groqKey || recording}
                onClick={() => fileRef.current?.click()}
                className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-indigo-400 text-left disabled:opacity-50"
              >
                <Upload className="w-6 h-6 text-indigo-600 mb-2" />
                <span className="text-sm font-bold text-slate-900 dark:text-white block">Enviar arquivo de áudio</span>
                <span className="text-[11px] text-slate-500">Áudios do WhatsApp (.ogg/.opus), .mp3, .m4a ou .wav</span>
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="audio/*,.ogg,.opus,.m4a,.mp3,.wav,.webm"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (file) handleTranscribe(file, file.name);
                }}
              />

              <button
                type="button"
                disabled={!groqKey || recording}
                onClick={() => setStep('transcript')}
                className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-emerald-400 text-left disabled:opacity-50"
              >
                <Keyboard className="w-6 h-6 text-emerald-600 mb-2" />
                <span className="text-sm font-bold text-slate-900 dark:text-white block">Digitar</span>
                <span className="text-[11px] text-slate-500">Escreva ou cole a lista de gastos, do jeito que falaria</span>
              </button>
            </div>
          )}

          {step === 'transcript' && !busy && (
            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                O que você disse (pode corrigir antes de continuar):
              </label>
              <textarea
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                rows={7}
                placeholder="Ex.: Hoje gastei 45 reais no mercado no débito. Ontem abasteci, 120 reais no cartão Nu CPF..."
                className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
              />
            </div>
          )}

          {step === 'review' && !busy && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-[10px] uppercase tracking-wider text-slate-500 bg-slate-50 dark:bg-slate-800/60">
                  <tr>
                    <th className="p-2" />
                    <th className="p-2 text-left">Descrição</th>
                    <th className="p-2 text-left w-24">Valor (R$)</th>
                    <th className="p-2 text-left">Categoria</th>
                    <th className="p-2 text-left w-24">Forma</th>
                    <th className="p-2 text-left">Cartão</th>
                    <th className="p-2 text-left w-16">Parc.</th>
                    <th className="p-2 text-left w-32">Compra</th>
                    <th className="p-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {rows.map((r) => (
                    <tr key={r.key} className={r.selected ? '' : 'opacity-50'}>
                      <td className="p-2">
                        <input type="checkbox" checked={r.selected} onChange={() => updateRow(r.key, { selected: !r.selected })} />
                      </td>
                      <td className="p-2">
                        <input className={inputClass} value={r.description} onChange={(e) => updateRow(r.key, { description: e.target.value })} />
                      </td>
                      <td className="p-2">
                        <input className={inputClass} value={r.amountStr} onChange={(e) => updateRow(r.key, { amountStr: e.target.value })} />
                      </td>
                      <td className="p-2">
                        <select className={inputClass} value={r.categoryId} onChange={(e) => updateRow(r.key, { categoryId: e.target.value })}>
                          {expenseCategories.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="p-2">
                        <select
                          className={inputClass}
                          value={r.paymentMethod}
                          onChange={(e) => {
                            const paymentMethod = e.target.value as PaymentMethod;
                            updateRow(r.key, {
                              paymentMethod,
                              installments: paymentMethod === 'CREDIT' ? r.installments : 1,
                              dueDate: paymentMethod === 'CREDIT' ? r.dueDate : r.purchaseDate,
                            });
                          }}
                        >
                          {(Object.keys(PAYMENT_LABELS) as PaymentMethod[]).map((m) => (
                            <option key={m} value={m}>
                              {PAYMENT_LABELS[m]}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="p-2">
                        {r.paymentMethod === 'CREDIT' ? (
                          <>
                            <input
                              className={inputClass}
                              list="voice-known-cards"
                              value={r.cardName ?? ''}
                              onChange={(e) => updateRow(r.key, { cardName: e.target.value })}
                              placeholder="Qual cartão?"
                            />
                            <span className="text-[10px] text-slate-400">fatura de {formatDate(r.dueDate)}</span>
                          </>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          min={1}
                          max={48}
                          disabled={r.paymentMethod !== 'CREDIT'}
                          className={inputClass}
                          value={r.installments}
                          onChange={(e) => updateRow(r.key, { installments: Math.max(1, Number(e.target.value) || 1) })}
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="date"
                          className={inputClass}
                          value={r.purchaseDate}
                          onChange={(e) =>
                            updateRow(r.key, {
                              purchaseDate: e.target.value,
                              dueDate: r.paymentMethod === 'CREDIT' ? r.dueDate : e.target.value,
                            })
                          }
                        />
                      </td>
                      <td className="p-2">
                        <button
                          onClick={() => setRows((prev) => prev.filter((x) => x.key !== r.key))}
                          className="p-1 text-slate-400 hover:text-rose-500"
                          title="Remover"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <datalist id="voice-known-cards">
                {cards.map((c) => (
                  <option key={c.cardName} value={c.cardName} />
                ))}
              </datalist>
              <p className="text-[11px] text-slate-500 mt-2">
                Compras no crédito entram como pendentes na data da fatura (ajuste o cartão se precisar); as demais entram como pagas.
              </p>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
          <span className="text-xs text-slate-500">
            {step === 'review' && `${rows.filter((r) => r.selected).length} gastos • ${formatMoney(selectedTotal)}`}
          </span>
          <div className="flex gap-2">
            {step !== 'capture' && !busy && (
              <button
                onClick={() => setStep(step === 'review' ? 'transcript' : 'capture')}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Voltar
              </button>
            )}
            {step === 'transcript' && (
              <button
                disabled={!transcript.trim() || Boolean(busy)}
                onClick={handleExtract}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4" /> Identificar gastos
              </button>
            )}
            {step === 'review' && (
              <button
                disabled={Boolean(busy) || rows.every((r) => !r.selected)}
                onClick={handleSave}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" /> Salvar gastos
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
