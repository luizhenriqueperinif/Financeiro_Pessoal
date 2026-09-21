import {
  InstallmentPurchase,
  Installment,
  UpdateInstallmentDTO,
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
