import { Category } from '../domain/category.js';
import { PaymentMethod } from '../types/common.js';
import { Money } from '../value-objects/money.js';
import { DateUtils } from '../utils/date-utils.js';
import { GROQ_BASE_URL, GROQ_DEFAULT_MODEL, callChatCompletions } from './ai-client.js';

const WHISPER_MODEL = 'whisper-large-v3';
const PAYMENT_METHODS: PaymentMethod[] = ['MONEY', 'PIX', 'DEBIT', 'CREDIT', 'BOLETO', 'OTHER'];
/** Compras feitas a menos de ~8 dias do vencimento costumam cair na fatura seguinte. */
const DAYS_BEFORE_DUE_TO_CLOSE = 8;
const DEFAULT_CARD_DUE_DAY = 10;

export interface KnownCard {
  cardName: string;
  dueDay: number;
}

/** Gasto identificado na fala, pronto para revisão antes de ser salvo. */
export interface ExtractedExpense {
  description: string;
  amountCents: number;
  categoryId: string;
  categoryName: string;
  paymentMethod: PaymentMethod;
  cardName?: string;
  installments: number;
  /** Dia em que a compra foi feita. */
  purchaseDate: string;
  /** Quando o dinheiro sai: a própria data, ou o vencimento da fatura no crédito. */
  dueDate: string;
}

function requireKey(apiKey: string): string {
  const key = apiKey?.trim();
  if (!key) {
    throw new Error('Para lançar gastos por áudio, configure a chave gratuita do Groq em Configurações → IA.');
  }
  return key;
}

export async function transcribeAudio(
  apiKey: string,
  audio: Blob,
  fileName: string,
  vocabulary: string[],
  fetchFn: typeof fetch = typeof window !== 'undefined' ? window.fetch.bind(window) : fetch
): Promise<string> {
  const key = requireKey(apiKey);
  const form = new FormData();
  form.append('file', audio, fileName);
  form.append('model', WHISPER_MODEL);
  form.append('language', 'pt');
  form.append('response_format', 'json');
  // Dica de vocabulário: evita que "Nu CPF" vire "no CPF"
  if (vocabulary.length > 0) {
    form.append('prompt', `Gastos do mês. Cartões e categorias: ${vocabulary.join(', ')}.`);
  }

  const res = await fetchFn(`${GROQ_BASE_URL}/audio/transcriptions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  });

  if (!res.ok) {
    const errJson = await res.json().catch(() => ({}));
    const errMsg = errJson?.error?.message || `Erro ${res.status}`;
    if (res.status === 413) {
      throw new Error('O áudio ficou grande demais para enviar de uma vez. Grave em partes de até uns 20 minutos.');
    }
    throw new Error(`Não foi possível transcrever o áudio: ${errMsg}`);
  }

  const data = await res.json();
  const text = String(data.text ?? '').trim();
  if (!text) throw new Error('Não entendi nada no áudio. Tente gravar mais perto do microfone.');
  return text;
}

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();

function nextCardDueDate(purchaseDate: string, dueDay: number): string {
  const [y, m, d] = purchaseDate.split('-').map(Number);
  const limit = new Date(y, m - 1, d + DAYS_BEFORE_DUE_TO_CLOSE);
  for (let offset = 0; offset < 3; offset++) {
    const candidate = new Date(y, m - 1 + offset, 1);
    const lastDay = new Date(candidate.getFullYear(), candidate.getMonth() + 1, 0).getDate();
    candidate.setDate(Math.min(dueDay, lastDay));
    if (candidate >= limit) {
      const mm = String(candidate.getMonth() + 1).padStart(2, '0');
      const dd = String(candidate.getDate()).padStart(2, '0');
      return `${candidate.getFullYear()}-${mm}-${dd}`;
    }
  }
  return purchaseDate;
}

function parseJsonReply(reply: string): any {
  const fenced = reply.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : reply;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('A IA não devolveu a lista de gastos. Tente de novo.');
  return JSON.parse(candidate.slice(start, end + 1));
}

function toCents(amount: unknown): number {
  if (typeof amount === 'number') return Math.round(amount * 100);
  if (typeof amount === 'string' && amount.trim()) {
    try {
      return Money.fromReal(amount);
    } catch {
      return 0;
    }
  }
  return 0;
}

export async function extractExpensesFromText(
  ai: { apiKey: string; model?: string },
  transcript: string,
  context: { categories: Category[]; cards: KnownCard[]; today?: string },
  fetchFn: typeof fetch = typeof window !== 'undefined' ? window.fetch.bind(window) : fetch
): Promise<ExtractedExpense[]> {
  const key = requireKey(ai.apiKey);
  const today = context.today ?? DateUtils.today();
  const expenseCategories = context.categories.filter((c) => c.type === 'EXPENSE');
  const fallbackCategory =
    expenseCategories.find((c) => normalize(c.name).includes('outras')) ?? expenseCategories[0];

  const system = `Você extrai gastos de um relato falado em português do Brasil e responde SOMENTE com JSON.
Hoje é ${today}. Converta datas relativas ("hoje", "ontem", "segunda") para AAAA-MM-DD; sem data, use hoje.
Formato: {"expenses":[{"description":"curta, ex.: Mercado","amount":45.9,"date":"AAAA-MM-DD","category":"uma das categorias","paymentMethod":"MONEY|PIX|DEBIT|CREDIT|BOLETO|OTHER","card":"nome do cartão ou null","installments":1}]}
Categorias válidas: ${expenseCategories.map((c) => c.name).join(', ')}.
Cartões do usuário: ${context.cards.map((c) => c.cardName).join(', ') || 'nenhum cadastrado'}. A transcrição pode errar nomes (ex.: "no CPF" = "Nu CPF"); associe ao cartão mais parecido.
Regras: um item por gasto; "amount" é o valor total da compra em reais (número); "installments" só é maior que 1 se a pessoa disser que parcelou; cartão de crédito = CREDIT; não invente gastos que não foram ditos; ignore receitas.`;

  const reply = await callChatCompletions({
    baseUrl: GROQ_BASE_URL,
    apiKey: key,
    model: ai.model || GROQ_DEFAULT_MODEL,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: transcript },
    ],
    providerLabel: 'Groq',
    fetchFn,
    temperature: 0,
  });

  const parsed = parseJsonReply(reply);
  const items: any[] = Array.isArray(parsed?.expenses) ? parsed.expenses : [];

  return items.flatMap((item): ExtractedExpense[] => {
    const amountCents = toCents(item?.amount);
    const description = String(item?.description ?? '').trim();
    if (amountCents <= 0 || !description) return [];

    const category =
      expenseCategories.find((c) => normalize(c.name) === normalize(String(item.category ?? ''))) ?? fallbackCategory;
    const method = String(item.paymentMethod ?? '').toUpperCase() as PaymentMethod;
    const paymentMethod: PaymentMethod = PAYMENT_METHODS.includes(method) ? method : 'PIX';
    const purchaseDate = /^\d{4}-\d{2}-\d{2}$/.test(String(item.date)) ? String(item.date) : today;
    const installments = Math.max(1, Math.min(48, Math.round(Number(item.installments) || 1)));

    const spokenCard = item.card ? normalize(String(item.card)) : '';
    const card = spokenCard
      ? context.cards.find((c) => normalize(c.cardName) === spokenCard) ??
        context.cards.find((c) => normalize(c.cardName).includes(spokenCard) || spokenCard.includes(normalize(c.cardName)))
      : undefined;
    const cardName = paymentMethod === 'CREDIT' ? card?.cardName ?? (item.card ? String(item.card).trim() : undefined) : undefined;

    const dueDate =
      paymentMethod === 'CREDIT' ? nextCardDueDate(purchaseDate, card?.dueDay ?? DEFAULT_CARD_DUE_DAY) : purchaseDate;

    return [
      {
        description,
        amountCents,
        categoryId: category?.id ?? '',
        categoryName: category?.name ?? '',
        paymentMethod,
        cardName,
        installments: paymentMethod === 'CREDIT' ? installments : 1,
        purchaseDate,
        dueDate,
      },
    ];
  });
}
