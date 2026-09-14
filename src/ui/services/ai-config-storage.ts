import { AIConfig, getDefaultAIConfig } from '../../core/services/ai-client.js';

const STORAGE_KEY = 'fp_ai_config';

export function loadStoredAIConfig(): AIConfig {
  if (typeof window === 'undefined' || !window.localStorage) {
    return getDefaultAIConfig();
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultAIConfig();
    const parsed = JSON.parse(raw);
    const config: AIConfig = {
      ...getDefaultAIConfig(),
      ...parsed,
    };

    // Auto-migração transparente para modelos ativos do Gemini
    if (config.provider === 'gemini') {
      if (
        !config.model ||
        config.model === 'gemini-1.5-flash' ||
        config.model === 'gemini-2.0-flash' ||
        config.model === 'gemini-2.5-flash' ||
        config.model.startsWith('gemini-1.5') ||
        config.model.startsWith('gemini-2.0')
      ) {
        config.model = 'gemini-3.6-flash';
        saveStoredAIConfig(config);
      } else if (config.model === 'gemini-1.5-pro' || config.model === 'gemini-2.5-pro') {
        config.model = 'gemini-3.1-pro-preview';
        saveStoredAIConfig(config);
      }
    }

    return config;
  } catch {
    return getDefaultAIConfig();
  }
}

export function saveStoredAIConfig(config: AIConfig): void {
  if (typeof window !== 'undefined' && window.localStorage) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  }
}
