import { describe, it, expect, vi } from 'vitest';
import { transcribeAudio, extractExpensesFromText } from '../../src/core/services/voice-expense-service.js';

const categories = [
  { id: 'cat-mercado', name: 'Alimentação', type: 'EXPENSE' },
  { id: 'cat-transporte', name: 'Transporte', type: 'EXPENSE' },
  { id: 'cat-outras', name: 'Outras Despesas', type: 'EXPENSE' },
  { id: 'cat-salario', name: 'Salário', type: 'INCOME' },
] as any[];

const cards = [
  { cardName: 'Cartão Nu CPF', dueDay: 10 },
  { cardName: 'Cartão Joyce', dueDay: 15 },
];

const chatReply = (content: string) =>
  vi.fn().mockResolvedValue({ ok: true, json: async () => ({ choices: [{ message: { content } }] }) });

describe('Lançamento de gastos por áudio', () => {
  it('transcreve o áudio pelo Whisper do Groq em português, com os nomes dos cartões como dica', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ text: ' Gastei 45 reais no mercado. ' }) });

    const text = await transcribeAudio('gsk_x', new Blob(['audio']), 'gravacao.webm', ['Cartão Nu CPF'], mockFetch as any);

    expect(text).toBe('Gastei 45 reais no mercado.');
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe('https://api.groq.com/openai/v1/audio/transcriptions');
    expect(init.headers.Authorization).toBe('Bearer gsk_x');
    const form = init.body as FormData;
    expect(form.get('language')).toBe('pt');
    expect(String(form.get('prompt'))).toContain('Cartão Nu CPF');
  });

  it('transforma a fala em gastos com categoria e cartão cadastrados', async () => {
    const mockFetch = chatReply(
      JSON.stringify({
        expenses: [
          { description: 'Mercado', amount: 45, date: '2026-09-21', category: 'alimentação', paymentMethod: 'DEBIT' },
          { description: 'Combustível', amount: '120,50', date: '2026-09-20', category: 'Transporte', paymentMethod: 'CREDIT', card: 'Cartão Nu CPF' },
          { description: 'Tênis', amount: 300, date: '2026-09-21', category: 'Roupas', paymentMethod: 'CREDIT', card: 'cartão joyce', installments: 3 },
        ],
      })
    );

    const result = await extractExpensesFromText(
      { apiKey: 'gsk_x', model: 'qwen/qwen3.8-27b' },
      'Hoje gastei 45 no mercado...',
      { categories, cards, today: '2026-09-21' },
      mockFetch as any
    );

    expect(result).toHaveLength(3);
    expect(result[0]).toMatchObject({ description: 'Mercado', amountCents: 4500, categoryId: 'cat-mercado', paymentMethod: 'DEBIT', installments: 1 });
    // Compra à vista no crédito cai na próxima fatura do cartão (vence dia 10)
    expect(result[1]).toMatchObject({ amountCents: 12050, cardName: 'Cartão Nu CPF', purchaseDate: '2026-09-20', dueDate: '2026-10-10' });
    // Categoria desconhecida vai para "Outras Despesas"; cartão é reconhecido sem diferenciar maiúsculas
    expect(result[2]).toMatchObject({ categoryId: 'cat-outras', cardName: 'Cartão Joyce', installments: 3 });
  });

  it('ignora itens sem valor válido e aceita a resposta dentro de um bloco de código', async () => {
    const mockFetch = chatReply(
      'Aqui está:\n```json\n{"expenses":[{"description":"Farmácia","amount":0},{"description":"Pão","amount":8.5,"paymentMethod":"MONEY"}]}\n```'
    );

    const result = await extractExpensesFromText({ apiKey: 'k', model: 'm' }, 'texto', { categories, cards, today: '2026-09-21' }, mockFetch as any);

    expect(result.map((r) => r.description)).toEqual(['Pão']);
    expect(result[0]).toMatchObject({ amountCents: 850, purchaseDate: '2026-09-21', dueDate: '2026-09-21' });
  });

  it('explica quando a chave do Groq não está configurada', async () => {
    await expect(transcribeAudio('', new Blob(['a']), 'a.webm', [])).rejects.toThrow(/Groq/);
  });
});
