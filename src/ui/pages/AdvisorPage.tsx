import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Send,
  Bot,
  User,
  Trash2,
  Settings,
  ShieldAlert,
} from 'lucide-react';
import { api } from '../services/api.js';
import { DashboardMetrics } from '../../core/domain/dashboard.js';
import {
  ChatMessage,
  generateAdvisorAdvice,
} from '../../core/services/ai-client.js';
import { loadStoredAIConfig } from '../services/ai-config-storage.js';
import { buildFinancialContextPrompt } from '../../core/services/ai-advisor-prompt.js';
import { formatMoney } from '../utils/formatters.js';

interface AdvisorPageProps {
  selectedYearMonth: string;
  onNavigateToSettings: () => void;
}

const STORAGE_CHAT_KEY = 'fp_advisor_chat_history';

const formatTimestamp = () =>
  new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export const AdvisorPage: React.FC<AdvisorPageProps> = ({
  selectedYearMonth,
  onNavigateToSettings,
}) => {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loadingMetrics, setLoadingMetrics] = useState(true);
  const [inputQuery, setInputQuery] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Carrega histórico de conversa salvo
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_CHAT_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      {
        id: 'welcome-1',
        role: 'assistant',
        content:
          'Olá! Eu sou o seu **Conselheiro Financeiro Pessoal**.\n\nAnalisei o seu orçamento atual e estou pronto para orientar suas decisões, avaliar se uma compra parcelada cabe no seu bolso, sugerir cortes de despesas ou ajudar você a planejar sua reserva de emergência.\n\nComo posso te ajudar hoje?',
        timestamp: formatTimestamp(),
      },
    ];
  });

  const aiConfig = loadStoredAIConfig();
  const isConfigured =
    aiConfig.provider === 'ollama' || Boolean(aiConfig.apiKey?.trim());

  useEffect(() => {
    const loadMetrics = async () => {
      try {
        setLoadingMetrics(true);
        const data = await api.getDashboardMetrics(selectedYearMonth);
        setMetrics(data);
      } catch (err) {
        console.error('Erro ao carregar contexto financeiro para o assistente', err);
      } finally {
        setLoadingMetrics(false);
      }
    };
    loadMetrics();
  }, [selectedYearMonth]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_CHAT_KEY, JSON.stringify(messages));
    } catch {}
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending]);

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || inputQuery).trim();
    if (!query || isSending) return;

    if (!isConfigured) {
      setErrorMsg('Configure sua chave de IA gratuita em Configurações para poder conversar.');
      return;
    }

    setErrorMsg(null);
    setInputQuery('');

    const userMsg: ChatMessage = {
      id: String(Date.now()),
      role: 'user',
      content: query,
      timestamp: formatTimestamp(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsSending(true);

    try {
      if (!metrics) {
        throw new Error('Carregando métricas financeiras. Aguarde um instante...');
      }

      // Monta o prompt com dados do domínio e histórico recente para continuidade de conversa
      const fullPrompt = buildFinancialContextPrompt(metrics, query);
      const advice = await generateAdvisorAdvice(aiConfig, fullPrompt, undefined, messages);

      const assistantMsg: ChatMessage = {
        id: String(Date.now() + 1),
        role: 'assistant',
        content: advice,
        timestamp: formatTimestamp(),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      console.error('Erro ao consultar IA:', err);
      setErrorMsg(err.message || 'Erro ao processar sua pergunta.');
      const errMsg: ChatMessage = {
        id: String(Date.now() + 2),
        role: 'assistant',
        content: `⚠️ Não consegui responder agora: ${err.message || 'Erro de comunicação.'}`,
        timestamp: formatTimestamp(),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setIsSending(false);
    }
  };

  const handleClearHistory = () => {
    const initial: ChatMessage[] = [
      {
        id: 'welcome-reset',
        role: 'assistant',
        content:
          'Conversa reiniciada! Estou à disposição para orientar seus próximos passos orçamentários.',
        timestamp: formatTimestamp(),
      },
    ];
    setMessages(initial);
    localStorage.setItem(STORAGE_CHAT_KEY, JSON.stringify(initial));
  };

  const quickPrompts = [
    '💡 Onde posso economizar despesas este mês?',
    '🛍️ Quero comprar algo parcelado, como avaliar o impacto?',
    '🎯 Como planejar minha reserva de emergência?',
    '📊 Faça um diagnóstico do meu comprometimento de receita atual',
  ];

  // Renderização segura de texto sem dangerouslySetInnerHTML (elimina risco XSS)
  const renderInlineBold = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={i} className="font-bold text-slate-900 dark:text-white">
            {part.slice(2, -2)}
          </strong>
        );
      }
      return part;
    });
  };

  const renderFormattedMessage = (content: string) => {
    const lines = content.split('\n');
    return (
      <div className="space-y-1.5 text-xs sm:text-sm leading-relaxed">
        {lines.map((line, idx) => {
          const trimmed = line.trim();
          if (!trimmed) {
            return <div key={idx} className="h-1" />;
          }
          if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
            return (
              <div key={idx} className="flex items-start gap-2 pl-2">
                <span className="text-emerald-500 font-bold">•</span>
                <span>{renderInlineBold(trimmed.slice(2))}</span>
              </div>
            );
          }
          if (trimmed.startsWith('### ')) {
            return (
              <h4 key={idx} className="font-bold text-slate-900 dark:text-white pt-2 text-sm tracking-tight">
                {renderInlineBold(trimmed.slice(4))}
              </h4>
            );
          }
          return <p key={idx}>{renderInlineBold(line)}</p>;
        })}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full max-w-6xl mx-auto p-4 sm:p-6 gap-4 animate-in fade-in">
      {/* 1. Cabeçalho da Página */}
      <div className="flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                Conselheiro Financeiro IA
              </h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 uppercase tracking-wider">
                {aiConfig.provider === 'groq' ? 'Groq Free' : aiConfig.provider === 'gemini' ? 'Gemini Free' : 'Ollama Local'}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Consultoria e simulações com inteligência artificial baseadas nos seus números reais
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleClearHistory}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
            title="Limpar conversa"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button
            onClick={onNavigateToSettings}
            className="flex items-center gap-1.5 py-1.5 px-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-all cursor-pointer"
          >
            <Settings className="w-3.5 h-3.5" />
            Configurar IA
          </button>
        </div>
      </div>

      {/* Alerta caso a IA não esteja configurada */}
      {!isConfigured && (
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-500/30 flex items-center justify-between gap-4 text-xs shrink-0">
          <div className="flex items-center gap-2.5 text-amber-800 dark:text-amber-300">
            <ShieldAlert className="w-5 h-5 text-amber-500 shrink-0" />
            <span>
              Para começar a pedir conselhos, configure sua chave gratuita do Groq (ou Gemini) em Configurações. É rápido e sem custos!
            </span>
          </div>
          <button
            onClick={onNavigateToSettings}
            className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shrink-0 transition-all cursor-pointer"
          >
            Configurar Agora
          </button>
        </div>
      )}

      {/* 2. Resumo Financeiro do Período */}
      {metrics && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 shadow-xs shrink-0 text-xs">
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-semibold block">Receitas Previstas</span>
            <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
              {formatMoney(metrics.monthIncomeCents + metrics.expectedIncomeCents)}
            </span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-semibold block">Despesas Projetadas</span>
            <span className="text-sm font-black text-slate-900 dark:text-white">
              {formatMoney(metrics.paidExpenseCents + metrics.pendingExpenseCents)}
            </span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-semibold block">Comprometimento</span>
            <span
              className={`text-sm font-black ${
                metrics.alerts?.commitmentLevel === 'CRITICAL'
                  ? 'text-rose-600'
                  : metrics.alerts?.commitmentLevel === 'WARNING'
                  ? 'text-amber-600'
                  : 'text-emerald-600'
              }`}
            >
              {metrics.alerts?.commitmentPercentage || 0}%
            </span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-semibold block">Orçamento Diário Disponível</span>
            <span className="text-sm font-black text-indigo-600 dark:text-indigo-400">
              {metrics.alerts?.dailyAvailableBudgetCents
                ? `${formatMoney(metrics.alerts.dailyAvailableBudgetCents)}/dia`
                : 'R$ 0,00'}
            </span>
          </div>
        </div>
      )}

      {/* 3. Área de Mensagens do Chat */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1 min-h-[260px] rounded-2xl bg-slate-50/50 dark:bg-slate-900/30 p-4 border border-slate-200/60 dark:border-slate-800/60">
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          return (
            <div
              key={msg.id}
              className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'} items-start`}
            >
              {/* Avatar */}
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-white shadow-xs ${
                  isUser
                    ? 'bg-emerald-600'
                    : 'bg-gradient-to-tr from-indigo-600 to-purple-600'
                }`}
              >
                {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>

              {/* Balão de Mensagem */}
              <div
                className={`max-w-[85%] sm:max-w-[75%] rounded-2xl p-4 shadow-xs ${
                  isUser
                    ? 'bg-emerald-600 text-white rounded-tr-none'
                    : 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 border border-slate-200/80 dark:border-slate-800 rounded-tl-none'
                }`}
              >
                {isUser ? (
                  <p className="text-xs sm:text-sm whitespace-pre-wrap">{msg.content}</p>
                ) : (
                  renderFormattedMessage(msg.content)
                )}
                <div
                  className={`text-[10px] mt-2 text-right ${
                    isUser ? 'text-emerald-100' : 'text-slate-400'
                  }`}
                >
                  {msg.timestamp}
                </div>
              </div>
            </div>
          );
        })}

        {isSending && (
          <div className="flex gap-3 items-start animate-pulse">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white shrink-0">
              <Bot className="w-4 h-4" />
            </div>
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl rounded-tl-none p-3.5 text-xs text-slate-500 flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-indigo-500 animate-spin" />
              <span>Analisando suas receitas, fixas e parcelas...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 4. Sugestões Rápidas de Perguntas */}
      <div className="flex gap-2 overflow-x-auto pb-1 shrink-0 scrollbar-none">
        {quickPrompts.map((prompt, i) => (
          <button
            key={i}
            onClick={() => handleSendMessage(prompt)}
            disabled={isSending || !isConfigured}
            className="text-[11px] font-medium py-1.5 px-3 rounded-full bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 whitespace-nowrap transition-all disabled:opacity-50 cursor-pointer shadow-2xs"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* 5. Campo de Entrada de Mensagem */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage();
        }}
        className="flex items-center gap-2 shrink-0"
      >
        <input
          type="text"
          value={inputQuery}
          onChange={(e) => setInputQuery(e.target.value)}
          placeholder={
            isConfigured
              ? 'Ex: Tenho 5 mil de receita e quero comprar um notebook de 3 mil em 10x, o que você acha?'
              : 'Configure sua chave de IA em Configurações para enviar mensagens...'
          }
          disabled={isSending || !isConfigured}
          className="flex-1 py-3 px-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500 shadow-xs disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!inputQuery.trim() || isSending || !isConfigured}
          className="p-3 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white transition-all disabled:opacity-50 cursor-pointer shadow-md shadow-indigo-500/20"
          title="Enviar pergunta"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
