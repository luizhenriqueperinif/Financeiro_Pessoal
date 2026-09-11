import React, { useState } from 'react';
import {
  Settings,
  Download,
  Upload,
  ShieldCheck,
  Smartphone,
  HardDrive,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { api } from '../services/api.js';

export const SettingsPage: React.FC = () => {
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleExportJSON = async () => {
    try {
      setErrorMsg(null);
      const jsonStr = await api.exportBackupJSON();
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup-financeiro-pessoal-${new Date().toISOString().slice(0, 10)}.json`;
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

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto animate-in fade-in">
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Settings className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
          Configurações & Segurança dos Dados
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Gerenciamento de cópias de segurança (backups), integridade contábil e portabilidade
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

      {/* Backup e Restauração */}
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
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-all"
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

      {/* Arquitetura & Portabilidade Mobile */}
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
