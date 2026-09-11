import {
  InstallmentPurchase,
  Installment,
  UpdateInstallmentDTO,
} from '../../domain/installment-purchase.js';
import { IInstallmentPurchaseRepository } from '../../domain/repositories.js';

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

    const targetDate = paymentDate || new Date().toISOString().slice(0, 10);
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
