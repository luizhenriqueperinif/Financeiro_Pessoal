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
    return {
      ...getDefaultAIConfig(),
      ...parsed,
    };
  } catch {
    return getDefaultAIConfig();
  }
}

export function saveStoredAIConfig(config: AIConfig): void {
  if (typeof window !== 'undefined' && window.localStorage) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  }
}
