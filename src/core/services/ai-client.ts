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
    model: 'gemini-3.6-flash',
    customEndpoint: 'http://localhost:11434/v1',
  };
}

export async function fetchAvailableGeminiModels(
  apiKey: string,
  fetchFn: typeof fetch = typeof window !== 'undefined' ? window.fetch.bind(window) : fetch
): Promise<string[]> {
  const cleanKey = apiKey.trim();
  if (!cleanKey) return [];

  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${cleanKey}`;
  const res = await fetchFn(url);

  if (!res.ok) {
    const errJson = await res.json().catch(() => ({}));
    const errMsg = errJson?.error?.message || `Erro ${res.status}: ${res.statusText}`;
    throw new Error(`Falha ao consultar modelos disponíveis no Google AI: ${errMsg}`);
  }

  const data = await res.json();
  const models: Array<{ name: string; supportedGenerationMethods?: string[] }> = data.models || [];

  const available = models
    .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
    .map((m) => m.name.replace(/^models\//, ''));

  // Ordena para que os modelos modernos recomendados pelo Google apareçam no topo
  return available.sort((a, b) => {
    const getPriority = (name: string) => {
      if (name === 'gemini-3.6-flash') return 0;
      if (name === 'gemini-3.8-flash') return 1;
      if (name === 'gemini-3.7-flash') return 2;
      if (name === 'gemini-3.1-flash-lite') return 3;
      if (name.startsWith('gemini-3.')) return 4;
      if (name.includes('flash')) return 5;
      return 10;
    };
    return getPriority(a) - getPriority(b);
  });
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

    let model = (config.model || 'gemini-3.6-flash').replace(/^models\//, '').trim();

    // Migração automática de modelos descontinuados ou bloqueados para novas contas
    if (
      model === 'gemini-1.5-flash' ||
      model === 'gemini-2.0-flash' ||
      model === 'gemini-2.5-flash' ||
      model.startsWith('gemini-1.5') ||
      model.startsWith('gemini-2.0')
    ) {
      model = 'gemini-3.6-flash';
    } else if (model === 'gemini-1.5-pro' || model === 'gemini-2.5-pro') {
      model = 'gemini-3.1-pro-preview';
    }

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

      if (
        res.status === 404 ||
        errMsg.includes('is not found for API version') ||
        errMsg.includes('is no longer available') ||
        errMsg.includes('is not supported for generateContent')
      ) {
        throw new Error(
          `O modelo "${model}" não está acessível nesta chave Google (${errMsg}). Selecione "gemini-3.6-flash" ou clique em "Detectar modelos da minha chave" em Configurações.`
        );
      }

      throw new Error(`Falha na API do Google Gemini: ${errMsg}`);
    }

    const data = await res.json();
    const candidate = data.candidates?.[0];
    const textPart = candidate?.content?.parts?.find((p: any) => Boolean(p.text));
    const text = textPart?.text;

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
): Promise<{
  success: boolean;
  message: string;
  availableModels?: string[];
  suggestedModel?: string;
}> {
  try {
    const testPrompt = 'Responda apenas com a palavra OK.';
    const reply = await generateAdvisorAdvice(config, testPrompt, fetchFn);
    return {
      success: true,
      message: `Conexão bem-sucedida! Resposta recebida da IA: "${reply.slice(0, 50)}"`,
    };
  } catch (err: any) {
    // Diagnóstico inteligente se a requisição do Gemini falhar por modelo inexistente/descontinuado
    if (config.provider === 'gemini' && config.apiKey?.trim()) {
      try {
        const available = await fetchAvailableGeminiModels(config.apiKey, fetchFn);
        if (available.length > 0) {
          const suggested =
            available.find(
              (m) =>
                m === 'gemini-3.6-flash' ||
                m === 'gemini-3.8-flash' ||
                m === 'gemini-3.7-flash' ||
                m === 'gemini-3.1-flash-lite'
            ) ||
            available.find(
              (m) =>
                m.includes('flash') &&
                !m.includes('1.5') &&
                !m.includes('2.0') &&
                !m.includes('2.5')
            ) ||
            available[0];

          return {
            success: false,
            message: `O modelo "${config.model}" não pôde ser acessado. Encontramos ${available.length} modelos na sua conta Google! Recomendamos usar "${suggested}".`,
            availableModels: available,
            suggestedModel: suggested,
          };
        }
      } catch {
        // Se a busca de modelos também falhar, exibe o erro original
      }
    }

    return {
      success: false,
      message: err.message || 'Falha ao testar conexão com a IA.',
    };
  }
}
