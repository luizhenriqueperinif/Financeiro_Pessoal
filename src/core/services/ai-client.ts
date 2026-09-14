export type AIProvider = 'gemini' | 'ollama';

export interface AIConfig {
  provider: AIProvider;
  apiKey?: string;
  model: string;
  customEndpoint?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
}

export function getDefaultAIConfig(): AIConfig {
  return {
    provider: 'gemini',
    apiKey: '',
    model: 'gemini-1.5-flash',
    customEndpoint: 'http://localhost:11434/v1',
  };
}

export async function generateAdvisorAdvice(
  config: AIConfig,
  prompt: string,
  fetchFn: typeof fetch = typeof window !== 'undefined' ? window.fetch.bind(window) : fetch,
  conversationHistory: ChatMessage[] = []
): Promise<string> {
  if (config.provider === 'gemini') {
    const apiKey = config.apiKey?.trim();
    if (!apiKey) {
      throw new Error(
        'Chave de API do Google Gemini não configurada. Obtenha sua chave gratuita no Google AI Studio (aistudio.google.com) e salve em Configurações.'
      );
    }

    const model = config.model || 'gemini-1.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    // Monta histórico de turnos para o Gemini
    const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

    // Inclui últimas 4 mensagens de histórico prévio para manter continuidade
    const recentHistory = conversationHistory.slice(-4);
    for (const msg of recentHistory) {
      if (msg.role === 'user') {
        contents.push({ role: 'user', parts: [{ text: msg.content }] });
      } else if (msg.role === 'assistant') {
        contents.push({ role: 'model', parts: [{ text: msg.content }] });
      }
    }

    // Adiciona o prompt contextual atual
    contents.push({ role: 'user', parts: [{ text: prompt }] });

    const body = {
      contents,
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 1000,
      },
    };

    const res = await fetchFn(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      const errMsg = errJson?.error?.message || `Erro ${res.status}: ${res.statusText}`;
      throw new Error(`Falha na API do Google Gemini: ${errMsg}`);
    }

    const data = await res.json();
    const candidate = data.candidates?.[0];
    const text = candidate?.content?.parts?.[0]?.text;

    if (!text) {
      throw new Error('A IA não retornou nenhuma resposta textual.');
    }

    return text.trim();
  }

  // Provedor Ollama local
  const baseUrl = (config.customEndpoint?.trim() || 'http://localhost:11434/v1').replace(/\/+$/, '');
  const url = `${baseUrl}/chat/completions`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (config.apiKey?.trim()) {
    headers['Authorization'] = `Bearer ${config.apiKey.trim()}`;
  }

  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  const recentHistory = conversationHistory.slice(-4);
  for (const msg of recentHistory) {
    if (msg.role === 'user' || msg.role === 'assistant') {
      messages.push({ role: msg.role, content: msg.content });
    }
  }
  messages.push({ role: 'user', content: prompt });

  const body = {
    model: config.model || 'llama3.2',
    messages,
    temperature: 0.4,
    max_tokens: 1000,
  };

  const res = await fetchFn(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errJson = await res.json().catch(() => ({}));
    const errMsg = errJson?.error?.message || `Erro ${res.status}: ${res.statusText}`;
    throw new Error(`Falha ao conectar com o modelo local Ollama: ${errMsg}`);
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content;

  if (!text) {
    throw new Error('O modelo local Ollama não retornou nenhuma resposta.');
  }

  return text.trim();
}

export async function testAIConnection(
  config: AIConfig,
  fetchFn?: typeof fetch
): Promise<{ success: boolean; message: string }> {
  try {
    const testPrompt = 'Responda apenas com a palavra OK.';
    const reply = await generateAdvisorAdvice(config, testPrompt, fetchFn);
    return {
      success: true,
      message: `Conexão bem-sucedida! Resposta recebida: "${reply.slice(0, 50)}"`,
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || 'Falha ao testar conexão com a IA.',
    };
  }
}
