import {
  InstallmentPurchase,
  CreateInstallmentPurchaseDTO,
} from '../../domain/installment-purchase.js';
import {
  IInstallmentPurchaseRepository,
  ICategoryRepository,
} from '../../domain/repositories.js';
import { Money } from '../../value-objects/money.js';
import { DateUtils } from '../../utils/date-utils.js';

export class CreateInstallmentPurchaseUseCase {
  constructor(
    private installmentRepo: IInstallmentPurchaseRepository,
    private categoryRepo: ICategoryRepository
  ) {}

  execute(dto: CreateInstallmentPurchaseDTO): InstallmentPurchase {
    if (!dto.description || dto.description.trim().length === 0) {
      throw new Error('A descrição da compra parcelada é obrigatória');
    }

    if (!dto.totalAmountCents || dto.totalAmountCents <= 0) {
      throw new Error('O valor total da compra deve ser maior que zero');
    }

    if (!dto.totalInstallments || dto.totalInstallments < 2) {
      throw new Error('Uma compra parcelada deve possuir no mínimo 2 parcelas');
    }

    if (!dto.firstDueDate || !/^\d{4}-\d{2}-\d{2}$/.test(dto.firstDueDate)) {
      throw new Error('Data da primeira parcela inválida. Use o formato AAAA-MM-DD');
    }

    const category = this.categoryRepo.findById(dto.categoryId);
    if (!category) {
      throw new Error('Categoria informada não existe');
    }

    // Fraciona o valor total garantindo soma exata em centavos
    const parts = Money.splitInstallments(
      dto.totalAmountCents,
      dto.totalInstallments
    );

    const installmentsData = parts.map((amountCents, index) => {
      const installmentNumber = index + 1;
      const dueDate = DateUtils.addMonthsPreservingDay(
        dto.firstDueDate,
        index
      );

      return {
        purchaseId: '',
        installmentNumber,
        totalInstallments: dto.totalInstallments,
        amountCents,
        dueDate,
        status: 'PENDING' as const,
      };
    });

    return this.installmentRepo.create(dto, installmentsData);
  }
}
