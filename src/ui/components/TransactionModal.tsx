import React, { useState, useEffect } from 'react';
import { X, CheckCircle2, AlertCircle } from 'lucide-react';
import { Category } from '../../core/domain/category.js';
import { PaymentMethod, TransactionType } from '../../core/types/common.js';
import { Money } from '../../core/value-objects/money.js';
import { api } from '../services/api.js';
import { DateUtils } from '../../core/utils/date-utils.js';

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** created: lançamento avulso criado, para a lista destacar e mostrar o mês dele. */
  onSuccess: (message?: string, created?: { id: string; date: string; type: TransactionType }) => void;
  initialType: TransactionType;
  categories: Category[];
  defaultDate?: string;
}

export const TransactionModal: React.FC<TransactionModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialType,
  categories,
  defaultDate,
}) => {
  const [type, setType] = useState<TransactionType>(initialType);
  const [description, setDescription] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [date, setDate] = useState(defaultDate || DateUtils.today());
  const [categoryId, setCategoryId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('PIX');
  const [status, setStatus] = useState<'PAID' | 'PENDING' | 'RECEIVED'>('PAID');
  const [notes, setNotes] = useState('');

  // Estados específicos para Compra Parcelada
  const [isInstallment, setIsInstallment] = useState(false);
  const [totalInstallments, setTotalInstallments] = useState(3);
  const [cardName, setCardName] = useState('');
  const [knownCards, setKnownCards] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setType(initialType);
      setDescription('');
      setAmountStr('');
      setDate(defaultDate || DateUtils.today());
      setCategoryId('');
      setPaymentMethod('PIX');
      setStatus(initialType === 'INCOME' ? 'RECEIVED' : 'PAID');
      setNotes('');
      setIsInstallment(false);
      setTotalInstallments(3);
      setCardName('');
      setError(null);
      setIsLoading(false);
      api
        .getCardSummaries()
        .then((cards) => setKnownCards(cards.map((c) => c.cardName)))
        .catch(() => setKnownCards([]));
    }
  }, [initialType, isOpen, defaultDate]);

  // Filtra categorias apropriadas para o tipo
  const availableCategories = categories.filter((c) => c.type === type);

  useEffect(() => {
    if (availableCategories.length > 0 && !categoryId) {
      setCategoryId(availableCategories[0].id);
    }
  }, [availableCategories, categoryId]);

  if (!isOpen) return null;

  // Valor digitado ainda pode estar incompleto/inválido; não deve derrubar o render
  let previewAmountCents = 0;
  try {
    previewAmountCents = amountStr ? Money.fromReal(amountStr) : 0;
  } catch {
    previewAmountCents = 0;
  }
  const installmentPreview = (n: number) =>
    previewAmountCents > 0 ? `(${Money.format(Money.splitInstallments(previewAmountCents, n)[0])})` : '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const amountCents = Money.fromReal(amountStr);
      if (amountCents <= 0) {
        throw new Error('O valor deve ser maior que zero');
      }

      if (!description.trim()) {
        throw new Error('A descrição é obrigatória');
      }

      if (!categoryId) {
        throw new Error('Selecione uma categoria');
      }

      // Se for despesa parcelada
      if (type === 'EXPENSE' && isInstallment) {
        await api.createInstallmentPurchase({
          description: description.trim(),
          totalAmountCents: amountCents,
          totalInstallments: Number(totalInstallments),
          firstDueDate: date,
          categoryId,
          paymentMethod: 'CREDIT',
          cardName: cardName.trim() || null,
          notes: notes.trim() || null,
        });

        const installmentValCents = Math.round(amountCents / totalInstallments);
        const feedbackMsg = `Compra parcelada com sucesso! ${totalInstallments} parcelas de ${Money.format(installmentValCents)} foram geradas.`;
        onSuccess(feedbackMsg, { id: '', date, type: 'EXPENSE' });
      } else {
        // Transação avulsa comum
        const created = await api.createTransaction({
          description: description.trim(),
          amountCents,
          type,
          categoryId,
          date,
          paymentMethod,
          status: status,
          paymentDate: status === 'PAID' || status === 'RECEIVED' ? date : null,
          notes: notes.trim() || null,
        });

        onSuccess(`${type === 'INCOME' ? 'Receita' : 'Despesa'} cadastrada com sucesso!`, {
          id: created.id,
          date: created.date,
          type,
        });
      }

      onClose();
    } catch (err: any) {
      setError(err.message || 'Erro ao cadastrar transação');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
        {/* Header do Modal */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setType('EXPENSE');
                setStatus('PAID');
              }}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                type === 'EXPENSE'
                  ? 'bg-rose-500 text-white shadow-sm'
                  : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              Despesa
            </button>
            <button
              type="button"
              onClick={() => {
                setType('INCOME');
                setStatus('RECEIVED');
                setIsInstallment(false);
              }}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                type === 'INCOME'
                  ? 'bg-emerald-500 text-white shadow-sm'
                  : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              Receita
            </button>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Valor */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              {type === 'EXPENSE' && isInstallment ? 'Valor Total da Compra (R$)' : 'Valor (R$)'}
            </label>
            <input
              type="text"
              required
              placeholder="0,00"
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-2xl font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
          </div>

          {/* Descrição */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              Descrição
            </label>
            <input
              type="text"
              required
              placeholder={type === 'EXPENSE' ? 'Ex: Supermercado, Aluguel, Notebook' : 'Ex: Salário, Freelance'}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Categoria */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Categoria
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              >
                {availableCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Data */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                {type === 'EXPENSE' && isInstallment ? '1ª Parcela' : 'Data'}
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              />
            </div>
          </div>

          {/* Forma de Pagamento */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              Forma de Pagamento
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['PIX', 'CREDIT', 'DEBIT', 'BOLETO', 'MONEY', 'OTHER'] as PaymentMethod[]).map(
                (m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      setPaymentMethod(m);
                      if (m !== 'CREDIT') setIsInstallment(false);
                    }}
                    className={`py-1.5 px-2 rounded-lg text-xs font-semibold border transition-all ${
                      paymentMethod === m
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    {m === 'MONEY'
                      ? 'Dinheiro'
                      : m === 'CREDIT'
                      ? 'Crédito'
                      : m === 'DEBIT'
                      ? 'Débito'
                      : m}
                  </button>
                )
              )}
            </div>
          </div>

          {/* Pergunta Inteligente de Compra Parcelada (Exibida quando Crédito é selecionado) */}
          {type === 'EXPENSE' && paymentMethod === 'CREDIT' && (
            <div className="p-3.5 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/60 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-900 dark:text-indigo-200">
                  Essa compra é parcelada?
                </span>
                <div className="flex items-center gap-1 bg-white dark:bg-slate-800 p-0.5 rounded-lg border border-indigo-200 dark:border-indigo-800">
                  <button
                    type="button"
                    onClick={() => setIsInstallment(false)}
                    className={`px-2.5 py-0.5 text-xs font-bold rounded ${
                      !isInstallment
                        ? 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-white'
                        : 'text-slate-500'
                    }`}
                  >
                    Não
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsInstallment(true)}
                    className={`px-2.5 py-0.5 text-xs font-bold rounded ${
                      isInstallment
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-500'
                    }`}
                  >
                    Sim
                  </button>
                </div>
              </div>

              {isInstallment && (
                <div className="pt-2 border-t border-indigo-200/50 dark:border-indigo-800/50 flex items-center justify-between">
                  <span className="text-xs font-medium text-indigo-800 dark:text-indigo-300">
                    Número de parcelas:
                  </span>
                  <select
                    value={totalInstallments}
                    onChange={(e) => setTotalInstallments(Number(e.target.value))}
                    className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-800 text-xs font-bold text-indigo-900 dark:text-indigo-200"
                  >
                    {[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 18, 24, 36, 48].map((n) => (
                      <option key={n} value={n}>
                        {n}x {installmentPreview(n)}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {isInstallment && (
                <div className="pt-2 flex items-center justify-between gap-3">
                  <span className="text-xs font-medium text-indigo-800 dark:text-indigo-300 shrink-0">
                    Cartão:
                  </span>
                  <input
                    type="text"
                    list="known-cards"
                    value={cardName}
                    onChange={(e) => setCardName(e.target.value)}
                    placeholder="Ex.: Nu CPF"
                    className="w-full max-w-[220px] px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-800 text-xs font-semibold text-indigo-900 dark:text-indigo-200"
                  />
                  <datalist id="known-cards">
                    {knownCards.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>
              )}
            </div>
          )}

          {/* Status (quando não é parcelada) */}
          {!isInstallment && (
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {type === 'INCOME' ? 'Já foi recebida?' : 'Já foi paga?'}
              </span>
              <button
                type="button"
                onClick={() =>
                  setStatus(
                    status === 'PAID' || status === 'RECEIVED'
                      ? 'PENDING'
                      : type === 'INCOME'
                      ? 'RECEIVED'
                      : 'PAID'
                  )
                }
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  status === 'PAID' || status === 'RECEIVED'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                {status === 'PAID' || status === 'RECEIVED'
                  ? 'Sim, Liquidada'
                  : 'Não, Pendente'}
              </button>
            </div>
          )}

          {/* Observações */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              Observação (Opcional)
            </label>
            <input
              type="text"
              placeholder="Anotações extras..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
          </div>

          {/* Botões de Ação */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold shadow-md shadow-emerald-600/30 transition-all active:scale-95"
            >
              {isLoading ? 'Salvando...' : 'Salvar Lançamento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
