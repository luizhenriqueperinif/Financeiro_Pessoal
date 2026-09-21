export type AIProvider = 'groq' | 'gemini' | 'ollama';

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

export const GROQ_BASE_URL = 'https://api.groq.com/openai/v1';
export const GROQ_DEFAULT_MODEL = 'qwen/qwen3.8-27b';

export function getDefaultAIConfig(): AIConfig {
  return {
    provider: 'groq',
    apiKey: '',
    model: GROQ_DEFAULT_MODEL,
    customEndpoint: 'http://localhost:11434/v1',
  };
}

export async function fetchAvailableGeminiModels(
  apiKey: string,
  fetchFn: typeof fetch = typeof window !== 'undefined' ? window.fetch.bind(window) : fetch
): Promise<string[]> {
  const cleanKey = apiKey.trim();
  if (!cleanKey) return [];

  const url = 'https://generativelanguage.googleapis.com/v1beta/models';
  const res = await fetchFn(url, { headers: { 'x-goog-api-key': cleanKey } });

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

type GeminiContent = { role: 'user' | 'model'; parts: Array<{ text: string }> };

/**
 * Modelos tentados, em ordem, quando o escolhido está sobrecarregado (503/429/500)
 * ou não responde a tempo. A sobrecarga no Google costuma atingir um modelo por vez.
 */
export const GEMINI_FALLBACK_MODELS = [
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.8-flash',
  'gemini-3.1-flash-lite',
];
const GEMINI_MAX_ATTEMPTS = 3;
const GEMINI_TIMEOUT_MS = 30_000;

/** Erro temporário do lado do Google: vale tentar outro modelo ou mais tarde. */
export class GeminiUnavailableError extends Error {
  constructor(message: string, public triedModels: string[] = []) {
    super(message);
    this.name = 'GeminiUnavailableError';
  }
}

async function callGemini(
  apiKey: string,
  model: string,
  contents: GeminiContent[],
  fetchFn: typeof fetch
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const body = {
    contents,
    // Modelos 3.x gastam parte do limite "pensando"; 1000 tokens cortava respostas longas
    generationConfig: { temperature: 0.4, maxOutputTokens: 4096 },
  };

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : undefined;
  const timer = controller ? setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS) : undefined;
  let res: Response;
  try {
    res = await fetchFn(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify(body),
      signal: controller?.signal,
    });
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw new GeminiUnavailableError(`O modelo "${model}" não respondeu em ${GEMINI_TIMEOUT_MS / 1000}s.`);
    }
    throw new Error(`Não foi possível conectar ao Google Gemini. Verifique sua internet. (${err?.message || err})`);
  } finally {
    if (timer) clearTimeout(timer);
  }

  if (!res.ok) {
    const errJson = await res.json().catch(() => ({}));
    const errMsg = errJson?.error?.message || `Erro ${res.status}: ${res.statusText}`;

    if (res.status === 503 || res.status === 429 || res.status === 500) {
      throw new GeminiUnavailableError(`O modelo "${model}" está indisponível no momento (${errMsg}).`);
    }

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

/** Chama o modelo escolhido e, se o Google estiver sobrecarregado, tenta os modelos reservas. */
async function callGeminiWithFallback(
  apiKey: string,
  model: string,
  contents: GeminiContent[],
  fetchFn: typeof fetch
): Promise<{ text: string; model: string }> {
  const candidates = [model, ...GEMINI_FALLBACK_MODELS.filter((m) => m !== model)].slice(0, GEMINI_MAX_ATTEMPTS);
  const tried: string[] = [];

  for (const candidate of candidates) {
    tried.push(candidate);
    try {
      return { text: await callGemini(apiKey, candidate, contents, fetchFn), model: candidate };
    } catch (err) {
      if (!(err instanceof GeminiUnavailableError)) throw err;
    }
  }

  throw new GeminiUnavailableError(
    `Os servidores do Google Gemini estão sobrecarregados no momento (tentamos ${tried.join(', ')}). ` +
      'Isso é temporário e não é problema da sua chave: tente novamente em alguns minutos.',
    tried
  );
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

    // Monta histórico de turnos para o Gemini
    const contents: GeminiContent[] = [];

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

    const { text } = await callGeminiWithFallback(apiKey, model, contents, fetchFn);
    return text;
  }

  const messages: ChatCompletionMessage[] = [];
  const recentHistory = conversationHistory.slice(-4);
  for (const msg of recentHistory) {
    if (msg.role === 'user' || msg.role === 'assistant') {
      messages.push({ role: msg.role, content: msg.content });
    }
  }
  messages.push({ role: 'user', content: prompt });

  if (config.provider === 'groq') {
    const apiKey = config.apiKey?.trim();
    if (!apiKey) {
      throw new Error(
        'Chave de API do Groq não configurada. Crie sua chave gratuita em console.groq.com (menu API Keys) e salve em Configurações.'
      );
    }
    return callChatCompletions({
      baseUrl: GROQ_BASE_URL,
      apiKey,
      model: config.model || GROQ_DEFAULT_MODEL,
      messages,
      providerLabel: 'Groq',
      fetchFn,
    });
  }

  // Provedor Ollama local
  return callChatCompletions({
    baseUrl: (config.customEndpoint?.trim() || 'http://localhost:11434/v1').replace(/\/+$/, ''),
    apiKey: config.apiKey?.trim(),
    model: config.model || 'llama3.2',
    messages,
    providerLabel: 'modelo local Ollama',
    fetchFn,
  });
}

type ChatCompletionMessage = { role: 'user' | 'assistant'; content: string };

/** Cliente para APIs no formato OpenAI /chat/completions (Groq, Ollama). */
async function callChatCompletions(opts: {
  baseUrl: string;
  apiKey?: string;
  model: string;
  messages: ChatCompletionMessage[];
  providerLabel: string;
  fetchFn: typeof fetch;
}): Promise<string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts.apiKey) {
    headers['Authorization'] = `Bearer ${opts.apiKey}`;
  }

  const body = {
    model: opts.model,
    messages: opts.messages,
    temperature: 0.4,
    // Modelos de raciocínio (ex.: GPT-OSS) gastam parte do limite pensando
    max_tokens: 4096,
  };

  const res = await opts.fetchFn(`${opts.baseUrl}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errJson = await res.json().catch(() => ({}));
    const errMsg = errJson?.error?.message || `Erro ${res.status}: ${res.statusText}`;
    if (res.status === 401) {
      throw new Error(`A chave do ${opts.providerLabel} foi recusada. Confira se copiou a chave inteira em Configurações.`);
    }
    if (res.status === 429) {
      throw new Error(
        `Você atingiu o limite gratuito de uso do ${opts.providerLabel} por agora. Aguarde um minuto e tente novamente. (${errMsg})`
      );
    }
    throw new Error(`Falha ao conectar com o ${opts.providerLabel}: ${errMsg}`);
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content;

  if (!text) {
    throw new Error(`O ${opts.providerLabel} não retornou nenhuma resposta.`);
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
    const apiKey = config.apiKey?.trim();
    if (config.provider === 'gemini' && apiKey) {
      const requested = (config.model || 'gemini-3.6-flash').replace(/^models\//, '').trim();
      const { text, model } = await callGeminiWithFallback(
        apiKey,
        requested,
        [{ role: 'user', parts: [{ text: testPrompt }] }],
        fetchFn || (typeof window !== 'undefined' ? window.fetch.bind(window) : fetch)
      );
      if (model !== requested) {
        return {
          success: true,
          message: `Sua chave funciona! O modelo "${requested}" está sobrecarregado agora, e a resposta veio do "${model}". O app usa modelos reservas automaticamente quando isso acontece.`,
          suggestedModel: model,
        };
      }
      return { success: true, message: `Conexão bem-sucedida! Resposta recebida da IA: "${text.slice(0, 50)}"` };
    }

    const reply = await generateAdvisorAdvice(config, testPrompt, fetchFn);
    return {
      success: true,
      message: `Conexão bem-sucedida! Resposta recebida da IA: "${reply.slice(0, 50)}"`,
    };
  } catch (err: any) {
    // Sobrecarga temporária do Google: a chave e o modelo estão certos
    if (err instanceof GeminiUnavailableError) {
      return { success: false, message: err.message };
    }

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
