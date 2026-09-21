import {
  InstallmentPurchase,
  Installment,
  UpdateInstallmentDTO,
  CardSummary,
} from '../../domain/installment-purchase.js';
import { IInstallmentPurchaseRepository } from '../../domain/repositories.js';
import { DateUtils } from '../../utils/date-utils.js';

export class ListInstallmentPurchasesUseCase {
  constructor(private installmentRepo: IInstallmentPurchaseRepository) {}

  execute(): InstallmentPurchase[] {
    return this.installmentRepo.list();
  }
}

export class PayInstallmentUseCase {
  constructor(private installmentRepo: IInstallmentPurchaseRepository) {}

  execute(installmentId: string, paymentDate?: string): Installment {
    const existing = this.installmentRepo.findInstallmentById(installmentId);
    if (!existing) {
      throw new Error('Parcela não encontrada');
    }

    const targetDate = paymentDate || DateUtils.today();
    const updated = this.installmentRepo.updateInstallment(installmentId, {
      status: 'PAID',
      paymentDate: targetDate,
    });

    if (!updated) {
      throw new Error('Erro ao registrar pagamento da parcela');
    }
    return updated;
  }
}

export class GetCardSummariesUseCase {
  constructor(private installmentRepo: IInstallmentPurchaseRepository) {}

  /**
   * Agrupa as parcelas de todas as compras por cartão (nome sem diferenciar maiúsculas/espaços),
   * com o total, o que falta pagar e a soma de cada mês. Cartões com mais saldo em aberto vêm primeiro.
   */
  execute(): CardSummary[] {
    const byCard = new Map<string, CardSummary & { monthMap: Map<string, { amountCents: number; remainingCents: number }> }>();

    for (const purchase of this.installmentRepo.list()) {
      const name = purchase.cardName?.trim();
      if (!name) continue;
      const key = name.toLowerCase();

      let card = byCard.get(key);
      if (!card) {
        card = { cardName: name, purchaseCount: 0, totalCents: 0, remainingCents: 0, months: [], monthMap: new Map() };
        byCard.set(key, card);
      }
      card.purchaseCount++;

      for (const inst of purchase.installments || []) {
        if (inst.status === 'CANCELLED') continue;
        const open = inst.status !== 'PAID';
        const ym = inst.dueDate.slice(0, 7);
        const month = card.monthMap.get(ym) || { amountCents: 0, remainingCents: 0 };
        month.amountCents += inst.amountCents;
        card.totalCents += inst.amountCents;
        if (open) {
          month.remainingCents += inst.amountCents;
          card.remainingCents += inst.amountCents;
        }
        card.monthMap.set(ym, month);
      }
    }

    return [...byCard.values()]
      .map(({ monthMap, ...card }) => ({
        ...card,
        months: [...monthMap.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([yearMonth, m]) => ({ yearMonth, ...m })),
      }))
      .sort((a, b) => b.remainingCents - a.remainingCents);
  }
}

export class UnpayInstallmentUseCase {
  constructor(private installmentRepo: IInstallmentPurchaseRepository) {}

  /** Desfaz a liquidação: a parcela e seu lançamento voltam a Pendente, sem data de pagamento. */
  execute(installmentId: string): Installment {
    const existing = this.installmentRepo.findInstallmentById(installmentId);
    if (!existing) {
      throw new Error('Parcela não encontrada');
    }

    const updated = this.installmentRepo.updateInstallment(installmentId, {
      status: 'PENDING',
      paymentDate: null,
    });

    if (!updated) {
      throw new Error('Erro ao desfazer pagamento da parcela');
    }
    return updated;
  }
}

export class UpdateInstallmentUseCase {
  constructor(private installmentRepo: IInstallmentPurchaseRepository) {}

  execute(installmentId: string, dto: UpdateInstallmentDTO): Installment {
    const existing = this.installmentRepo.findInstallmentById(installmentId);
    if (!existing) {
      throw new Error('Parcela não encontrada');
    }

    const updated = this.installmentRepo.updateInstallment(installmentId, dto);
    if (!updated) {
      throw new Error('Erro ao atualizar dados da parcela');
    }
    return updated;
  }
}

export class DeleteInstallmentPurchaseUseCase {
  constructor(private installmentRepo: IInstallmentPurchaseRepository) {}

  execute(id: string): boolean {
    const existing = this.installmentRepo.findById(id);
    if (!existing) {
      throw new Error('Compra parcelada não encontrada');
    }
    return this.installmentRepo.delete(id);
  }
}
