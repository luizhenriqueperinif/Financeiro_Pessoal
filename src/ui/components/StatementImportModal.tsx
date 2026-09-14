import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Filter,
  Check,
} from 'lucide-react';
import {
  BankStatementParseResult,
  ReconciliationPreviewItem,
} from '../../core/domain/statement.js';
import { PaymentMethod } from '../../core/types/common.js';
import { Category } from '../../core/domain/category.js';
import { api } from '../services/api.js';
import { formatMoney, formatDate } from '../utils/formatters.js';

interface StatementImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const StatementImportModal: React.FC<StatementImportModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [parseResult, setParseResult] = useState<BankStatementParseResult | null>(null);
  const [previewItems, setPreviewItems] = useState<ReconciliationPreviewItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isCommitting, setIsCommitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      api.listCategories().then(setCategories).catch(console.error);
    } else {
      // Reset state ao fechar
      setParseResult(null);
      setPreviewItems([]);
      setLoading(false);
      setIsCommitting(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFileProcess = async (file: File) => {
    try {
      setLoading(true);
      const content = await file.text();
      const parsed = await api.parseStatement(content, file.name);
      setParseResult(parsed);

      const preview = await api.reconcilePreview(parsed.items);
      setPreviewItems(preview);
    } catch (err: any) {
      alert('Erro ao processar arquivo: ' + (err.message || 'Formato inválido'));
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileProcess(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const handleToggleSelect = (id: string) => {
    setPreviewItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, selected: !item.selected } : item))
    );
  };

  const handleToggleSelectAll = () => {
    const allSelected = previewItems.every((i) => i.selected);
    setPreviewItems((prev) => prev.map((i) => ({ ...i, selected: !allSelected })));
  };

  const handleCategoryChange = (id: string, categoryId: string) => {
    const cat = categories.find((c) => c.id === categoryId);
    setPreviewItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              categoryId,
              categoryName: cat?.name,
            }
          : item
      )
    );
  };

  const handleCommit = async () => {
    const selected = previewItems.filter((i) => i.selected);
    if (selected.length === 0) {
      alert('Nenhum lançamento selecionado para importação.');
      return;
    }

    try {
      setIsCommitting(true);
      const itemsToCommit = selected.map((i) => ({
        date: i.item.date,
        description: i.item.description,
        amountCents: i.item.amountCents,
        type: i.item.type,
        categoryId: i.categoryId,
        paymentMethod: (parseResult?.accountType === 'CREDIT_CARD' ? 'CREDIT' : 'PIX') as PaymentMethod,
        notes: `Importado de extrato (${parseResult?.bankName || 'Bancário'})`,
      }));

      await api.reconcileCommit(itemsToCommit);
      alert(`${selected.length} lançamentos importados com sucesso!`);
      onSuccess();
      onClose();
    } catch (err: any) {
      alert('Erro ao salvar transações: ' + err.message);
    } finally {
      setIsCommitting(false);
    }
  };

  const selectedCount = previewItems.filter((i) => i.selected).length;
  const newCount = previewItems.filter((i) => !i.isDuplicate).length;
  const duplicateCount = previewItems.filter((i) => i.isDuplicate).length;
  const totalSelectedCents = previewItems
    .filter((i) => i.selected)
    .reduce((sum, cur) => sum + (cur.item.type === 'INCOME' ? cur.item.amountCents : -cur.item.amountCents), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Cabeçalho */}
        <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Importar Extrato Bancário
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Suporte nativo a arquivos <strong>OFX</strong> e <strong>CSV</strong> do Nubank, Mercado Pago e outros bancos
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corpo */}
        <div className="p-6 flex-1 overflow-y-auto space-y-6">
          {!parseResult ? (
            /* Área de Drag & Drop */
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              className={`border-2 border-dashed rounded-3xl p-12 text-center transition-all flex flex-col items-center justify-center gap-4 cursor-pointer ${
                dragActive
                  ? 'border-purple-500 bg-purple-500/5 dark:bg-purple-500/10'
                  : 'border-slate-300 dark:border-slate-700 hover:border-purple-400 dark:hover:border-purple-500/60 bg-slate-50/50 dark:bg-slate-800/30'
              }`}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".ofx,.csv"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileProcess(e.target.files[0]);
                  }
                }}
              />

              <div className="w-16 h-16 rounded-2xl bg-purple-600 text-white flex items-center justify-center shadow-lg shadow-purple-600/30">
                <UploadCloud className="w-8 h-8" />
              </div>

              <div>
                <h4 className="text-base font-bold text-slate-800 dark:text-slate-100">
                  Arraste seu extrato bancário aqui
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Ou clique para selecionar um arquivo <strong>.OFX</strong> ou <strong>.CSV</strong>
                </p>
              </div>

              <div className="flex items-center gap-2 text-[11px] text-slate-400 dark:text-slate-500 pt-2 border-t border-slate-200 dark:border-slate-700/60">
                <span>Compatível com: Nubank PF/PJ, Mercado Pago, Inter, Itaú, Bradesco</span>
              </div>
            </div>
          ) : (
            /* Pré-visualização e Conciliação */
            <div className="space-y-4">
              {/* Banner Informativo do Extrato */}
              <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="px-3 py-1.5 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 font-bold text-xs uppercase tracking-wider">
                    {parseResult.bankName}
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                      {parseResult.accountType === 'CREDIT_CARD' ? 'Fatura de Cartão de Crédito' : 'Extrato de Conta Corrente'}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Período: {formatDate(parseResult.startDate)} até {formatDate(parseResult.endDate)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-xs font-medium">
                  <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {newCount} novos
                  </span>
                  {duplicateCount > 0 && (
                    <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-lg">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      {duplicateCount} já cadastrados
                    </span>
                  )}
                  <button
                    onClick={() => {
                      setParseResult(null);
                      setPreviewItems([]);
                    }}
                    className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 underline cursor-pointer ml-2"
                  >
                    Trocar arquivo
                  </button>
                </div>
              </div>

              {/* Tabela de Lançamentos */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
                <div className="max-h-[380px] overflow-y-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-100/70 dark:bg-slate-800/70 text-slate-600 dark:text-slate-400 sticky top-0 backdrop-blur z-10 border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th className="p-3 w-10 text-center">
                          <input
                            type="checkbox"
                            checked={previewItems.length > 0 && previewItems.every((i) => i.selected)}
                            onChange={handleToggleSelectAll}
                            className="rounded border-slate-300 dark:border-slate-700 text-purple-600 focus:ring-purple-500 cursor-pointer"
                          />
                        </th>
                        <th className="p-3 font-bold">Situação</th>
                        <th className="p-3 font-bold">Data</th>
                        <th className="p-3 font-bold">Descrição</th>
                        <th className="p-3 font-bold text-right">Valor</th>
                        <th className="p-3 font-bold">Categoria Sugerida</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                      {previewItems.map((row) => (
                        <tr
                          key={row.id}
                          className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors ${
                            row.isDuplicate ? 'opacity-60 bg-amber-500/[0.02]' : ''
                          }`}
                        >
                          <td className="p-3 text-center">
                            <input
                              type="checkbox"
                              checked={row.selected}
                              onChange={() => handleToggleSelect(row.id)}
                              className="rounded border-slate-300 dark:border-slate-700 text-purple-600 focus:ring-purple-500 cursor-pointer"
                            />
                          </td>
                          <td className="p-3 whitespace-nowrap">
                            {row.isDuplicate ? (
                              <span
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400"
                                title={row.duplicateReason}
                              >
                                <AlertTriangle className="w-3 h-3" />
                                Duplicata
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                                <CheckCircle2 className="w-3 h-3" />
                                Novo
                              </span>
                            )}
                          </td>
                          <td className="p-3 whitespace-nowrap font-medium text-slate-700 dark:text-slate-300">
                            {formatDate(row.item.date)}
                          </td>
                          <td className="p-3 font-semibold text-slate-900 dark:text-slate-100 max-w-xs truncate" title={row.item.description}>
                            {row.item.description}
                          </td>
                          <td className="p-3 text-right whitespace-nowrap font-bold">
                            <span
                              className={`flex items-center justify-end gap-1 ${
                                row.item.type === 'INCOME'
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-rose-600 dark:text-rose-400'
                              }`}
                            >
                              {row.item.type === 'INCOME' ? (
                                <ArrowDownLeft className="w-3.5 h-3.5" />
                              ) : (
                                <ArrowUpRight className="w-3.5 h-3.5" />
                              )}
                              {formatMoney(row.item.amountCents)}
                            </span>
                          </td>
                          <td className="p-3">
                            <select
                              value={row.categoryId}
                              onChange={(e) => handleCategoryChange(row.id, e.target.value)}
                              className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-slate-800 dark:text-slate-200 focus:ring-1 focus:ring-purple-500 outline-none w-full max-w-[160px]"
                            >
                              {categories
                                .filter((c) => c.type === row.item.type)
                                .map((c) => (
                                  <option key={c.id} value={c.id}>
                                    {c.name}
                                  </option>
                                ))}
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Rodapé de Ações */}
        {parseResult && (
          <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between shrink-0">
            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium flex items-center gap-2">
              <span>
                Selecionados: <strong className="text-slate-900 dark:text-white">{selectedCount}</strong> de{' '}
                {previewItems.length} lançamentos
              </span>
              {selectedCount > 0 && (
                <span className="px-2 py-0.5 rounded-md bg-slate-200/60 dark:bg-slate-700/60 font-semibold text-slate-800 dark:text-slate-200">
                  Total: {formatMoney(Math.abs(totalSelectedCents))}
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                disabled={isCommitting}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors"
              >
                Cancelar
              </button>

              <button
                onClick={handleCommit}
                disabled={selectedCount === 0 || isCommitting}
                className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-xs font-bold shadow-md shadow-purple-600/30 transition-all flex items-center gap-2 active:scale-95 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                {isCommitting ? 'Importando...' : `Confirmar e Importar (${selectedCount})`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
