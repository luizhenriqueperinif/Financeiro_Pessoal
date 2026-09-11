import { z } from 'zod';

export const CategorySchema = z.object({
  name: z.string().trim().min(1, 'O nome da categoria é obrigatório').max(100),
  type: z.enum(['INCOME', 'EXPENSE'], {
    message: 'Tipo de categoria inválido. Deve ser Receita ou Despesa.',
  }),
  description: z.string().trim().max(255).optional().nullable(),
  color: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Cor inválida (use formato hexadecimal, ex: #EF4444)').optional().nullable(),
  icon: z.string().max(50).optional().nullable(),
});

export const TransactionSchema = z.object({
  description: z.string().trim().min(1, 'A descrição da transação é obrigatória').max(255),
  amountCents: z.number().int().positive('O valor deve ser positivo e maior que zero'),
  type: z.enum(['INCOME', 'EXPENSE']),
  categoryId: z.string().min(1, 'A categoria é obrigatória'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar no formato AAAA-MM-DD'),
  paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar no formato AAAA-MM-DD').optional().nullable(),
  paymentMethod: z.enum(['MONEY', 'PIX', 'DEBIT', 'CREDIT', 'BOLETO', 'OTHER']),
  status: z.enum(['PENDING', 'PAID', 'RECEIVED', 'OVERDUE', 'CANCELLED']).optional(),
  notes: z.string().max(1000).optional().nullable(),
  installmentId: z.string().optional().nullable(),
  recurringRuleId: z.string().optional().nullable(),
});

export const RecurringRuleSchema = z.object({
  description: z.string().trim().min(1, 'A descrição da despesa fixa é obrigatória').max(255),
  amountCents: z.number().int().positive('O valor deve ser positivo e maior que zero'),
  type: z.enum(['INCOME', 'EXPENSE']),
  categoryId: z.string().min(1, 'A categoria é obrigatória'),
  frequency: z.enum(['MONTHLY', 'WEEKLY', 'YEARLY']),
  dueDay: z.number().int().min(1, 'Dia do mês deve ser no mínimo 1').max(31, 'Dia do mês deve ser no máximo 31'),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data de início deve estar no formato AAAA-MM-DD'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data de término deve estar no formato AAAA-MM-DD').optional().nullable(),
  paymentMethod: z.enum(['MONEY', 'PIX', 'DEBIT', 'CREDIT', 'BOLETO', 'OTHER']),
  isActive: z.boolean().optional(),
  notes: z.string().max(1000).optional().nullable(),
});

export const InstallmentPurchaseSchema = z.object({
  description: z.string().trim().min(1, 'A descrição da compra parcelada é obrigatória').max(255),
  totalAmountCents: z.number().int().positive('O valor total deve ser positivo e maior que zero'),
  totalInstallments: z.number().int().min(2, 'O parcelamento deve ter no mínimo 2 parcelas').max(120, 'O número máximo de parcelas é 120'),
  firstDueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data da primeira parcela deve estar no formato AAAA-MM-DD'),
  categoryId: z.string().min(1, 'A categoria é obrigatória'),
  paymentMethod: z.enum(['MONEY', 'PIX', 'DEBIT', 'CREDIT', 'BOLETO', 'OTHER']).optional(),
  notes: z.string().max(1000).optional().nullable(),
});
