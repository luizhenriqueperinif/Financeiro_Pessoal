import React, { useState } from 'react';
import {
  Settings,
  Download,
  Upload,
  ShieldCheck,
  Smartphone,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Key,
  Eye,
  EyeOff,
  ExternalLink,
  Server,
  Cpu,
  RefreshCw,
} from 'lucide-react';
import { api } from '../services/api.js';
import {
  AIConfig,
  AIProvider,
  testAIConnection,
  fetchAvailableGeminiModels,
} from '../../core/services/ai-client.js';
import {
  loadStoredAIConfig,
  saveStoredAIConfig,
} from '../services/ai-config-storage.js';
import { DateUtils } from '../../core/utils/date-utils.js';

export const SettingsPage: React.FC = () => {
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Configurações de IA
  const [aiConfig, setAiConfig] = useState<AIConfig>(() => loadStoredAIConfig());
  const [isTestingAI, setIsTestingAI] = useState(false);
  const [isDetectingModels, setIsDetectingModels] = useState(false);
  const [detectedGeminiModels, setDetectedGeminiModels] = useState<string[]>([]);
  const [detectStatusMsg, setDetectStatusMsg] = useState<string | null>(null);
  const [aiTestResult, setAiTestResult] = useState<{
    success: boolean;
    message: string;
    availableModels?: string[];
    suggestedModel?: string;
  } | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);

  const handleExportJSON = async () => {
    try {
      setErrorMsg(null);
      const jsonStr = await api.exportBackupJSON();
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup-financeiro-pessoal-${DateUtils.today()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setSuccessMsg('Backup exportado com sucesso!');
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao exportar backup');
    }
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        setErrorMsg(null);
        const content = event.target?.result as string;
        await api.importBackupJSON(content);
        setSuccessMsg('Backup restaurado com sucesso! Os dados foram atualizados.');
        setTimeout(() => window.location.reload(), 1500);
      } catch (err: any) {
        setErrorMsg(err.message || 'Erro ao restaurar backup');
      }
    };
    reader.readAsText(file);
  };

  const handleSaveAI = () => {
    saveStoredAIConfig(aiConfig);
    setSuccessMsg('Configurações de Inteligência Artificial salvas com sucesso!');
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  const handleDetectModels = async () => {
    if (!aiConfig.apiKey?.trim()) {
      setErrorMsg('Informe a API Key do Google Gemini antes de consultar os modelos disponíveis.');
      setTimeout(() => setErrorMsg(null), 4000);
      return;
    }
    try {
      setIsDetectingModels(true);
      setErrorMsg(null);
      setDetectStatusMsg(null);
      const models = await fetchAvailableGeminiModels(aiConfig.apiKey);
      if (models.length === 0) {
        setErrorMsg('Nenhum modelo compatível com geração de conteúdo foi retornado para esta chave.');
        setTimeout(() => setErrorMsg(null), 4000);
      } else {
        setDetectedGeminiModels(models);
        // Se o modelo atual não estiver na lista ou for antigo/bloqueado (1.5 / 2.0 / 2.5), seleciona o melhor disponível
        if (
          !models.includes(aiConfig.model) ||
          aiConfig.model.includes('1.5') ||
          aiConfig.model.includes('2.0') ||
          aiConfig.model === 'gemini-2.5-flash'
        ) {
          const best =
            models.find(
              (m) =>
                m === 'gemini-3.6-flash' ||
                m === 'gemini-3.8-flash' ||
                m === 'gemini-3.7-flash' ||
                m === 'gemini-3.1-flash-lite'
            ) ||
            models.find((m) => m.includes('flash') && !m.includes('1.5') && !m.includes('2.0') && !m.includes('2.5')) ||
            models[0];
          setAiConfig((prev) => ({ ...prev, model: best }));
          setDetectStatusMsg(`${models.length} modelos detectados! Modelo "${best}" selecionado automaticamente.`);
        } else {
          setDetectStatusMsg(`${models.length} modelos disponíveis encontrados na sua conta Google!`);
        }
        setTimeout(() => setDetectStatusMsg(null), 5000);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Falha ao buscar modelos disponíveis no Google AI.');
      setTimeout(() => setErrorMsg(null), 5000);
    } finally {
      setIsDetectingModels(false);
    }
  };

  const handleTestAI = async () => {
    try {
      setIsTestingAI(true);
      setAiTestResult(null);
      const res = await testAIConnection(aiConfig);
      setAiTestResult(res);
      if (res.availableModels && res.availableModels.length > 0) {
        setDetectedGeminiModels(res.availableModels);
      }
    } catch (err: any) {
      setAiTestResult({
        success: false,
        message: err.message || 'Falha ao conectar com o serviço de IA.',
      });
    } finally {
      setIsTestingAI(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto animate-in fade-in">
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Settings className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
          Configurações & Inteligência Artificial
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Gerenciamento do Conselheiro IA, cópias de segurança (backups) e integridade dos dados
        </p>
      </div>

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* 1. Card de Configuração da Inteligência Artificial */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Conselheiro IA (Tecnologia Gratuita)
              </h3>
              <p className="text-xs text-slate-400">
                Ative o consultor financeiro com IA gratuita pelo Google Gemini ou modelo local via Ollama
              </p>
            </div>
          </div>
        </div>

        {/* Escolha do Provedor */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
            Provedor de Inteligência Artificial:
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setAiConfig({ ...aiConfig, provider: 'gemini', model: 'gemini-3.6-flash' })}
              className={`p-3.5 rounded-xl border text-left flex items-start gap-3 transition-all cursor-pointer ${
                aiConfig.provider === 'gemini'
                  ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20 ring-1 ring-indigo-500'
                  : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <Cpu className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
              <div>
                <span className="text-xs font-bold text-slate-900 dark:text-white block">
                  Google Gemini (Nuvem Gratuita)
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
                  100% gratuito (15 requisições/min). Rápido, sem necessidade de cartão de crédito.
                </span>
              </div>
            </button>

            <button
              type="button"
              onClick={() =>
                setAiConfig({
                  ...aiConfig,
                  provider: 'ollama',
                  model: 'llama3.2',
                  customEndpoint: 'http://localhost:11434/v1',
                })
              }
              className={`p-3.5 rounded-xl border text-left flex items-start gap-3 transition-all cursor-pointer ${
                aiConfig.provider === 'ollama'
                  ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 ring-1 ring-emerald-500'
                  : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <Server className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <span className="text-xs font-bold text-slate-900 dark:text-white block">
                  Ollama / Local (100% Offline)
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
                  Roda no seu computador via Ollama (Llama 3, Qwen). Privacidade absoluta e sem internet.
                </span>
              </div>
            </button>
          </div>
        </div>

        {/* Campos para Gemini */}
        {aiConfig.provider === 'gemini' && (
          <div className="space-y-4 pt-1">
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Chave de API do Google Gemini (API Key)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Key className="w-4 h-4" />
                </div>
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={aiConfig.apiKey || ''}
                  onChange={(e) => setAiConfig({ ...aiConfig, apiKey: e.target.value })}
                  placeholder="AIzaSy..."
                  className="w-full pl-9 pr-10 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-200"
                >
                  {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                <span>Como obter:</span>
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noreferrer"
                  className="text-indigo-500 hover:underline flex items-center gap-1 font-semibold"
                >
                  Google AI Studio (Gratuito) <ExternalLink className="w-3 h-3" />
                </a>
                <span>— Clique em "Create API Key" e cole aqui.</span>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Modelo do Gemini
                </label>
                <button
                  type="button"
                  onClick={handleDetectModels}
                  disabled={isDetectingModels || !aiConfig.apiKey?.trim()}
                  className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 flex items-center gap-1 disabled:opacity-40 cursor-pointer"
                  title="Consulta os modelos autorizados para a sua chave no Google AI Studio"
                >
                  <RefreshCw className={`w-3 h-3 ${isDetectingModels ? 'animate-spin' : ''}`} />
                  {isDetectingModels ? 'Consultando...' : 'Detectar modelos da minha chave'}
                </button>
              </div>

              {detectStatusMsg && (
                <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mb-1.5 font-medium">
                  {detectStatusMsg}
                </p>
              )}

              <select
                value={aiConfig.model}
                onChange={(e) => setAiConfig({ ...aiConfig, model: e.target.value })}
                className="w-full py-2 px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                <option value="gemini-3.6-flash">gemini-3.6-flash (Recomendado — Oficial do Google)</option>
                <option value="gemini-3.8-flash">gemini-3.8-flash (Mais recente e ultraveloz)</option>
                <option value="gemini-3.7-flash">gemini-3.7-flash (Raciocínio avançado e veloz)</option>
                <option value="gemini-3.1-flash-lite">gemini-3.1-flash-lite (Mais leve e econômico)</option>
                <option value="gemini-3.1-pro-preview">gemini-3.1-pro-preview (Raciocínio complexo / Pro)</option>

                {/* Modelos adicionais detectados na conta Google */}
                {detectedGeminiModels
                  .filter(
                    (m) =>
                      m !== 'gemini-3.6-flash' &&
                      m !== 'gemini-3.8-flash' &&
                      m !== 'gemini-3.7-flash' &&
                      m !== 'gemini-3.1-flash-lite' &&
                      m !== 'gemini-3.1-pro-preview' &&
                      !m.includes('1.5') &&
                      !m.includes('2.0') &&
                      m !== 'gemini-2.5-flash'
                  )
                  .map((m) => (
                    <option key={m} value={m}>
                      {m} (Disponível na sua conta)
                    </option>
                  ))}

                {/* Caso o modelo atual não esteja na lista e seja customizado */}
                {![
                  'gemini-3.6-flash',
                  'gemini-3.8-flash',
                  'gemini-3.7-flash',
                  'gemini-3.1-flash-lite',
                  'gemini-3.1-pro-preview',
                  ...detectedGeminiModels,
                ].includes(aiConfig.model) &&
                  aiConfig.model && (
                    <option value={aiConfig.model}>
                      {aiConfig.model} (Configuração Atual)
                    </option>
                  )}
              </select>
            </div>
          </div>
        )}

        {/* Campos para Ollama / Local */}
        {aiConfig.provider === 'ollama' && (
          <div className="space-y-4 pt-1">
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Endpoint URL Local do Ollama
              </label>
              <input
                type="text"
                value={aiConfig.customEndpoint || 'http://localhost:11434/v1'}
                onChange={(e) => setAiConfig({ ...aiConfig, customEndpoint: e.target.value })}
                placeholder="http://localhost:11434/v1"
                className="w-full py-2 px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                Certifique-se de executar `ollama run llama3.2` ou seu modelo preferido no terminal.
              </span>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Nome do Modelo Instalado no Ollama
              </label>
              <input
                type="text"
                value={aiConfig.model || 'llama3.2'}
                onChange={(e) => setAiConfig({ ...aiConfig, model: e.target.value })}
                placeholder="llama3.2"
                className="w-full py-2 px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>
        )}

        {/* Feedback do Teste de Conexão */}
        {aiTestResult && (
          <div
            className={`p-3.5 rounded-xl border text-xs font-medium flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${
              aiTestResult.success
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400'
            }`}
          >
            <div className="flex items-center gap-2.5">
              {aiTestResult.success ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0" />
              )}
              <span>{aiTestResult.message}</span>
            </div>

            {aiTestResult.suggestedModel && (
              <button
                type="button"
                onClick={() => {
                  const newModel = aiTestResult.suggestedModel!;
                  setAiConfig((prev) => ({ ...prev, model: newModel }));
                  setAiTestResult({
                    success: false,
                    message: `Modelo atualizado para "${newModel}". Clique em "Testar Conexão com IA" novamente para validar!`,
                  });
                }}
                className="text-xs font-bold underline hover:opacity-80 shrink-0 cursor-pointer self-start sm:self-auto"
              >
                Mudar para {aiTestResult.suggestedModel}
              </button>
            )}
          </div>
        )}

        {/* Botões de Ação */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={handleSaveAI}
            className="py-2 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm transition-all cursor-pointer"
          >
            Salvar Configurações de IA
          </button>

          <button
            type="button"
            onClick={handleTestAI}
            disabled={isTestingAI}
            className="py-2 px-4 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
          >
            {isTestingAI ? 'Testando Conexão...' : 'Testar Conexão com IA'}
          </button>
        </div>
      </div>

      {/* 2. Card de Backup e Restauração */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
          <ShieldCheck className="w-5 h-5 text-emerald-600" />
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Cópia de Segurança & Restauração
            </h3>
            <p className="text-xs text-slate-400">
              Seus dados financeiros ficam gravados exclusivamente no seu computador com proteção SQLite
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60 flex flex-col justify-between">
            <div>
              <h4 className="text-xs font-bold text-slate-900 dark:text-white mb-1">
                Exportar Backup Completo
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-4">
                Gera um arquivo seguro `.json` contendo todas as suas receitas, despesas, fixas, compras parceladas e categorias.
              </p>
            </div>
            <button
              onClick={handleExportJSON}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-all cursor-pointer"
            >
              <Download className="w-4 h-4" />
              Baixar Arquivo de Backup
            </button>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60 flex flex-col justify-between">
            <div>
              <h4 className="text-xs font-bold text-slate-900 dark:text-white mb-1">
                Restaurar Dados de um Backup
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-4">
                Selecione um arquivo de backup previamente exportado para recuperar todos os seus registros financeiros.
              </p>
            </div>
            <label className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold cursor-pointer transition-all">
              <Upload className="w-4 h-4" />
              Importar Backup (.json)
              <input
                type="file"
                accept=".json"
                onChange={handleImportJSON}
                className="hidden"
              />
            </label>
          </div>
        </div>
      </div>

      {/* 3. Arquitetura & Portabilidade Mobile */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
          <Smartphone className="w-5 h-5 text-indigo-500" />
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Arquitetura e Futura Versão Mobile
            </h3>
            <p className="text-xs text-slate-400">
              Clean Architecture em camadas desacopladas
            </p>
          </div>
        </div>

        <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
          <p>
            • O núcleo contábil (<strong>@financeiro/core</strong>) contém todas as regras de negócios, cálculos de parcelas e previsões de forma 100% agnóstica de plataforma.
          </p>
          <p>
            • Todos os valores monetários são processados em centavos inteiros (elimina erros clássicos de arredondamento de float).
          </p>
          <p>
            • No futuro, esta mesma base de código pode ser empacotada diretamente para Android e iOS através do Capacitor ou React Native sem refazer a camada de regras contábeis.
          </p>
        </div>
      </div>
    </div>
  );
};
