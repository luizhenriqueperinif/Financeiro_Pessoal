import { describe, it, expect, vi } from 'vitest';
import {
  getDefaultAIConfig,
  generateAdvisorAdvice,
  AIConfig,
} from '../../src/core/services/ai-client.js';

describe('AIClient (Integração com Provedores Gratuitos de IA)', () => {
  it('retorna configuração padrão segura apontando para Gemini Free Tier', () => {
    const config = getDefaultAIConfig();
    expect(config.provider).toBe('gemini');
    expect(config.model).toContain('gemini');
  });

  it('lança erro amigável se a chave de API do Gemini não estiver configurada', async () => {
    const config: AIConfig = {
      provider: 'gemini',
      apiKey: '',
      model: 'gemini-1.5-flash',
    };

    await expect(generateAdvisorAdvice(config, 'Olá')).rejects.toThrow(
      /Chave de API do Google Gemini não configurada/
    );
  });

  it('processa resposta da API do Google Gemini com sucesso', async () => {
    const config: AIConfig = {
      provider: 'gemini',
      apiKey: 'test-key-123',
      model: 'gemini-1.5-flash',
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [{ text: 'Recomendo economizar 10% da sua renda.' }],
            },
          },
        ],
      }),
    });

    const response = await generateAdvisorAdvice(config, 'Pergunta de teste', mockFetch as any);
    expect(response).toBe('Recomendo economizar 10% da sua renda.');
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('generativelanguage.googleapis.com'),
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('processa resposta de endpoint OpenAI/Ollama compatível', async () => {
    const config: AIConfig = {
      provider: 'ollama',
      model: 'llama3.2',
      customEndpoint: 'http://localhost:11434/v1',
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: { content: 'Resposta do modelo local Ollama.' },
          },
        ],
      }),
    });

    const response = await generateAdvisorAdvice(config, 'Pergunta teste Ollama', mockFetch as any);
    expect(response).toBe('Resposta do modelo local Ollama.');
  });

  it('envia histórico conversacional anterior para manter continuidade de diálogo', async () => {
    const config: AIConfig = {
      provider: 'gemini',
      apiKey: 'key-123',
      model: 'gemini-1.5-flash',
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: 'Vale a pena sim.' }] } }],
      }),
    });

    const history = [
      { id: '1', role: 'user' as const, content: 'Tenho R$ 5.000 de salário', timestamp: '10:00' },
      { id: '2', role: 'assistant' as const, content: 'Ótimo, seu orçamento permite planejar.', timestamp: '10:01' },
    ];

    const response = await generateAdvisorAdvice(config, 'E se eu comprar um celular?', mockFetch as any, history);
    expect(response).toBe('Vale a pena sim.');

    const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(sentBody.contents.length).toBe(3); // 2 history + 1 current
    expect(sentBody.contents[0].parts[0].text).toBe('Tenho R$ 5.000 de salário');
    expect(sentBody.contents[1].parts[0].text).toBe('Ótimo, seu orçamento permite planejar.');
  });

  it('migra automaticamente modelo legado gemini-1.5-flash para gemini-3.6-flash', async () => {
    const config: AIConfig = {
      provider: 'gemini',
      apiKey: 'key-test',
      model: 'gemini-1.5-flash',
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: 'Resposta após migração.' }] } }],
      }),
    });

    const response = await generateAdvisorAdvice(config, 'Teste migração', mockFetch as any);
    expect(response).toBe('Resposta após migração.');
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('gemini-3.6-flash:generateContent'),
      expect.anything()
    );
  });

  it('migra modelo restrito gemini-2.5-flash para gemini-3.6-flash', async () => {
    const config: AIConfig = {
      provider: 'gemini',
      apiKey: 'key-test',
      model: 'gemini-2.5-flash',
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: 'Resposta após migração 2.5.' }] } }],
      }),
    });

    const response = await generateAdvisorAdvice(config, 'Teste migração 2.5', mockFetch as any);
    expect(response).toBe('Resposta após migração 2.5.');
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('gemini-3.6-flash:generateContent'),
      expect.anything()
    );
  });

  it('consulta e filtra modelos disponíveis do Google AI via fetchAvailableGeminiModels priorizando Gemini 3', async () => {
    const { fetchAvailableGeminiModels } = await import('../../src/core/services/ai-client.js');

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        models: [
          {
            name: 'models/gemini-2.5-flash',
            supportedGenerationMethods: ['generateContent', 'countTokens'],
          },
          {
            name: 'models/text-embedding-004',
            supportedGenerationMethods: ['embedContent'],
          },
          {
            name: 'models/gemini-3.6-flash',
            supportedGenerationMethods: ['generateContent'],
          },
        ],
      }),
    });

    const models = await fetchAvailableGeminiModels('test-key', mockFetch as any);
    expect(models[0]).toBe('gemini-3.6-flash');
    expect(models).toContain('gemini-2.5-flash');
  });

  it('envia a chave do Gemini no header, sem expô-la na URL', async () => {
    const { fetchAvailableGeminiModels } = await import('../../src/core/services/ai-client.js');
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ models: [] }) });

    await fetchAvailableGeminiModels('segredo-123', mockFetch as any);

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).not.toContain('segredo-123');
    expect(init.headers['x-goog-api-key']).toBe('segredo-123');
  });

  it('testAIConnection diagnostica modelo não encontrado e sugere alternativa Gemini 3 da conta', async () => {
    const { testAIConnection } = await import('../../src/core/services/ai-client.js');

    const config: AIConfig = {
      provider: 'gemini',
      apiKey: 'test-key',
      model: 'modelo-antigo-inexistente',
    };

    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({
          error: {
            code: 404,
            message: 'models/modelo-antigo-inexistente is not found for API version v1beta',
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          models: [
            {
              name: 'models/gemini-3.6-flash',
              supportedGenerationMethods: ['generateContent'],
            },
          ],
        }),
      });

    const result = await testAIConnection(config, mockFetch as any);
    expect(result.success).toBe(false);
    expect(result.suggestedModel).toBe('gemini-3.6-flash');
    expect(result.availableModels).toContain('gemini-3.6-flash');
  });

  describe('quando o Google está sobrecarregado', () => {
    const overloaded = () => ({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
      json: async () => ({ error: { code: 503, status: 'UNAVAILABLE', message: 'This model is currently experiencing high demand.' } }),
    });
    const answer = (text: string) => ({
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] }),
    });
    const config: AIConfig = { provider: 'gemini', apiKey: 'k', model: 'gemini-3.6-flash' };

    it('tenta automaticamente outro modelo e devolve a resposta dele', async () => {
      const mockFetch = vi.fn().mockResolvedValueOnce(overloaded()).mockResolvedValueOnce(answer('Resposta do reserva'));

      const reply = await generateAdvisorAdvice(config, 'Oi', mockFetch as any);

      expect(reply).toBe('Resposta do reserva');
      expect(mockFetch.mock.calls[0][0]).toContain('/models/gemini-3.6-flash:');
      expect(mockFetch.mock.calls[1][0]).not.toContain('/models/gemini-3.6-flash:');
    });

    it('explica que o serviço está sobrecarregado quando todas as tentativas falham', async () => {
      const mockFetch = vi.fn().mockImplementation(async () => overloaded());

      await expect(generateAdvisorAdvice(config, 'Oi', mockFetch as any)).rejects.toThrow(/sobrecarregad/i);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('testAIConnection informa sobrecarga em vez de dizer que o modelo é inacessível', async () => {
      const { testAIConnection } = await import('../../src/core/services/ai-client.js');
      const mockFetch = vi.fn().mockImplementation(async (url: string) =>
        url.includes(':generateContent') ? overloaded() : { ok: true, json: async () => ({ models: [] }) }
      );

      const result = await testAIConnection(config, mockFetch as any);

      expect(result.success).toBe(false);
      expect(result.message).toMatch(/sobrecarregad/i);
      expect(result.message).not.toMatch(/não pôde ser acessado/);
    });

    it('testAIConnection bem-sucedido por outro modelo diz qual respondeu', async () => {
      const { testAIConnection } = await import('../../src/core/services/ai-client.js');
      const mockFetch = vi.fn().mockResolvedValueOnce(overloaded()).mockResolvedValueOnce(answer('OK'));

      const result = await testAIConnection(config, mockFetch as any);

      expect(result.success).toBe(true);
      expect(result.message).toContain('gemini-3.6-flash');
      expect(result.suggestedModel).toBeDefined();
      expect(result.suggestedModel).not.toBe('gemini-3.6-flash');
    });
  });
});
