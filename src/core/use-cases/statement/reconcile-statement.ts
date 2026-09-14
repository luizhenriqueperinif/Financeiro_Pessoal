import {
  BankStatementItem,
  ReconciliationPreviewItem,
  ConfirmedStatementItem,
  ReconciliationResult,
} from '../../domain/statement.js';
import {
  ITransactionRepository,
  ICategoryRepository,
} from '../../domain/repositories.js';
import { PaymentMethod } from '../../types/common.js';
import { Transaction } from '../../domain/transaction.js';

export class ReconcileStatementUseCase {
  constructor(
    private transactionRepo: ITransactionRepository,
    private categoryRepo: ICategoryRepository
  ) {}

  /**
   * Analisa itens importados e cruza com os lançamentos existentes no sistema
   * para identificar duplicatas e sugerir categorias de mesmo tipo.
   */
  preview(items: BankStatementItem[]): ReconciliationPreviewItem[] {
    const existingTransactions = this.transactionRepo.list();
    const categories = this.categoryRepo.list();

    const usedTxIds = new Set<string>();
    const previewList: ReconciliationPreviewItem[] = [];

    for (let index = 0; index < items.length; index++) {
      const item = items[index];

      // Busca transação existente ainda não associada a outro item do extrato
      const matched = existingTransactions.find(
        (tx) =>
          !usedTxIds.has(tx.id) &&
          tx.date === item.date &&
          tx.amountCents === item.amountCents &&
          tx.type === item.type &&
          tx.status !== 'CANCELLED'
      );

      const isDuplicate = Boolean(matched);
      if (matched) {
        usedTxIds.add(matched.id);
      }

      // Localiza categoria correspondente do mesmo tipo
      let matchedCategory = categories.find(
        (c) =>
          c.type === item.type &&
          c.name.toLowerCase() === (item.suggestedCategory || '').toLowerCase()
      );

      if (!matchedCategory) {
        matchedCategory =
          categories.find(
            (c) =>
              c.type === item.type &&
              (c.name.toLowerCase().includes('outras') ||
                c.name.toLowerCase().includes('geral') ||
                c.name.toLowerCase().includes('salário'))
          ) ||
          categories.find((c) => c.type === item.type) ||
          categories[0];
      }

      previewList.push({
        id: `preview-${index}-${Date.now()}`,
        item,
        isDuplicate,
        duplicateReason: isDuplicate
          ? `Lançamento idêntico já cadastrado em ${item.date} ("${matched?.description}")`
          : undefined,
        matchedTransactionId: matched?.id,
        categoryId: matchedCategory ? matchedCategory.id : '',
        categoryName: matchedCategory ? matchedCategory.name : undefined,
        selected: !isDuplicate, // Itens duplicados vêm desmarcados por padrão
      });
    }

    return previewList;
  }

  /**
   * Salva os lançamentos confirmados pelo usuário diretamente no repositório.
   */
  commit(items: ConfirmedStatementItem[]): ReconciliationResult {
    const createdTransactions: Transaction[] = [];

    for (const item of items) {
      const validMethod: PaymentMethod = item.paymentMethod || 'OTHER';

      const tx = this.transactionRepo.create({
        description: item.description,
        amountCents: item.amountCents,
        type: item.type,
        categoryId: item.categoryId,
        date: item.date,
        paymentDate: item.date,
        paymentMethod: validMethod,
        status: item.type === 'INCOME' ? 'RECEIVED' : 'PAID',
        notes: item.notes || 'Importado via Extrato Bancário',
      });

      createdTransactions.push(tx);
    }

    return {
      importedCount: createdTransactions.length,
      skippedCount: 0,
      transactions: createdTransactions,
    };
  }
}
