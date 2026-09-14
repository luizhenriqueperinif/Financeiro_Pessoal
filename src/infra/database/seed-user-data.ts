import path from 'path';
import DatabaseConstructor, { Database } from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

/**
 * Insere ou garante as categorias padrão necessárias.
 */
function getOrCreateCategoryId(
  db: Database,
  name: string,
  type: 'INCOME' | 'EXPENSE',
  color: string,
  icon: string,
  description?: string
): string {
  const existing = db
    .prepare('SELECT id FROM categories WHERE name = ?')
    .get(name) as { id: string } | undefined;
  if (existing) return existing.id;

  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO categories (id, name, type, description, color, icon, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, name, type, description || name, color, icon, now, now);
  return id;
}

/**
 * Função mestre para aplicar os dados financeiros reais do usuário no banco SQLite.
 */
export function seedUserData(db: Database, forceClean: boolean = false): void {
  // Habilita foreign keys
  db.pragma('foreign_keys = ON');

  const recurringCount = db
    .prepare('SELECT COUNT(*) as count FROM recurring_rules')
    .get() as { count: number };
  const installmentCount = db
    .prepare('SELECT COUNT(*) as count FROM installment_purchases')
    .get() as { count: number };

  if (!forceClean && recurringCount.count > 0 && installmentCount.count > 0) {
    console.log('Banco de dados já contém regras e parcelamentos reais.');
    return;
  }

  console.log('Populando dados financeiros reais do usuário...');

  // 1. Categorias
  const catSalarioId = getOrCreateCategoryId(db, 'Salário', 'INCOME', '#10B981', 'Briefcase', 'Remuneração mensal fixa');
  const catInvestId = getOrCreateCategoryId(db, 'Investimentos', 'INCOME', '#84CC16', 'TrendingUp', 'Rendimentos e proventos');
  const catMoradiaId = getOrCreateCategoryId(db, 'Moradia', 'EXPENSE', '#F97316', 'Home', 'Prestação, água, luz e moradia');
  const catTransporteId = getOrCreateCategoryId(db, 'Transporte', 'EXPENSE', '#F59E0B', 'Car', 'Combustível e transporte');
  const catAssinaturasId = getOrCreateCategoryId(db, 'Assinaturas', 'EXPENSE', '#EC4899', 'Tv', 'Internet e assinaturas');
  const catOutrasId = getOrCreateCategoryId(db, 'Outras Despesas', 'EXPENSE', '#6B7280', 'MoreHorizontal', 'Dízimo e débito CAP');
  const catCartaoId = getOrCreateCategoryId(db, 'Cartão de Crédito', 'EXPENSE', '#8B5CF6', 'CreditCard', 'Faturas de cartões e compras parceladas');

  const runInTransaction = db.transaction(() => {
    // 2. Limpeza prévia para evitar duplicatas caso forceClean
    db.exec(`
      DELETE FROM transactions;
      DELETE FROM installments;
      DELETE FROM installment_purchases;
      DELETE FROM recurring_rules;
    `);

    const now = new Date().toISOString();

    // 3. Cadastra Receitas Fixas Recorrentes
    // Salário Luiz: R$ 2.300,00 (dia 05)
    // Salário Joyce: R$ 1.935,00 (dia 05)
    // Rendimentos: R$ 140,00 (dia 15)
    // Total Ganho Líquido: R$ 4.375,00
    const insertRecurring = db.prepare(`
      INSERT INTO recurring_rules (
        id, description, amount_cents, type, category_id,
        frequency, due_day, start_date, end_date, payment_method, is_active, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 'MONTHLY', ?, '2026-09-01', NULL, ?, 1, ?, ?, ?)
    `);

    const ruleSalarioLuizId = randomUUID();
    const ruleSalarioJoyceId = randomUUID();
    const ruleRendimentosId = randomUUID();

    insertRecurring.run(ruleSalarioLuizId, 'Salário Luiz', 230000, 'INCOME', catSalarioId, 5, 'PIX', 'Remuneração mensal Luiz', now, now);
    insertRecurring.run(ruleSalarioJoyceId, 'Salário Joyce', 193500, 'INCOME', catSalarioId, 5, 'PIX', 'Remuneração mensal Joyce', now, now);
    insertRecurring.run(ruleRendimentosId, 'Rendimentos', 14000, 'INCOME', catInvestId, 15, 'PIX', 'Rendimentos e dividendos', now, now);

    // 4. Cadastra Despesas Fixas Recorrentes
    // Dízimo: 10% do ganho líquido (10% de R$ 4.375,00 = R$ 437,50) + R$ 60,00 = R$ 497,50 (dia 10)
    // Prestação: R$ 1.928,25 (dia 10)
    // Débito CAP: R$ 80,00 (dia 10)
    // Internet: R$ 99,90 (dia 15)
    // Água: R$ 50,00 (dia 20)
    // Energia: R$ 160,00 (dia 20)
    // Combustível: R$ 240,00 (dia 05)
    const ruleDizimoId = randomUUID();
    const rulePrestacaoId = randomUUID();
    const ruleDebitoCapId = randomUUID();
    const ruleInternetId = randomUUID();
    const ruleAguaId = randomUUID();
    const ruleEnergiaId = randomUUID();
    const ruleCombustivelId = randomUUID();

    insertRecurring.run(ruleDizimoId, 'Dízimo (10% + R$ 60)', 49750, 'EXPENSE', catOutrasId, 10, 'PIX', '10% de R$ 4.375,00 + R$ 60,00 fixo', now, now);
    insertRecurring.run(rulePrestacaoId, 'Prestação', 192825, 'EXPENSE', catMoradiaId, 10, 'BOLETO', 'Prestação habitacional', now, now);
    insertRecurring.run(ruleDebitoCapId, 'Débito CAP', 8000, 'EXPENSE', catOutrasId, 10, 'DEBIT', 'Débito automático CAP', now, now);
    insertRecurring.run(ruleInternetId, 'Internet', 9990, 'EXPENSE', catAssinaturasId, 15, 'BOLETO', 'Internet residencial fibra', now, now);
    insertRecurring.run(ruleAguaId, 'Água', 5000, 'EXPENSE', catMoradiaId, 20, 'BOLETO', 'Conta de água', now, now);
    insertRecurring.run(ruleEnergiaId, 'Energia', 16000, 'EXPENSE', catMoradiaId, 20, 'BOLETO', 'Conta de energia elétrica', now, now);
    insertRecurring.run(ruleCombustivelId, 'Combustível', 24000, 'EXPENSE', catTransporteId, 5, 'DEBIT', 'Gasto fixo mensal com combustível', now, now);

    // 5. Cadastra Compras Parceladas / Gastos com Cartões
    const insertPurchase = db.prepare(`
      INSERT INTO installment_purchases (
        id, description, total_amount_cents, total_installments,
        first_due_date, category_id, payment_method, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'CREDIT', ?, ?, ?)
    `);

    const insertInstallment = db.prepare(`
      INSERT INTO installments (
        id, purchase_id, installment_number, total_installments,
        amount_cents, due_date, payment_date, status, transaction_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, NULL, 'PENDING', ?, ?, ?)
    `);

    const insertTransaction = db.prepare(`
      INSERT INTO transactions (
        id, description, amount_cents, type, category_id,
        date, payment_date, payment_method, status, notes,
        installment_id, recurring_rule_id, created_at, updated_at
      ) VALUES (?, ?, ?, 'EXPENSE', ?, ?, NULL, 'CREDIT', 'PENDING', ?, ?, NULL, ?, ?)
    `);

    // Helper para cadastrar compra parcelada completa
    const addCardPurchase = (
      title: string,
      firstDueDate: string,
      notes: string,
      installmentsList: Array<{ number: number; dueDate: string; amountCents: number }>
    ) => {
      const purchaseId = randomUUID();
      const totalAmountCents = installmentsList.reduce((sum, item) => sum + item.amountCents, 0);
      const totalInstallments = installmentsList.length;

      insertPurchase.run(
        purchaseId,
        title,
        totalAmountCents,
        totalInstallments,
        firstDueDate,
        catCartaoId,
        notes,
        now,
        now
      );

      for (const inst of installmentsList) {
        const instId = randomUUID();
        const txId = randomUUID();
        const txDesc = `${title} (${inst.number}/${totalInstallments})`;

        insertInstallment.run(
          instId,
          purchaseId,
          inst.number,
          totalInstallments,
          inst.amountCents,
          inst.dueDate,
          txId,
          now,
          now
        );

        insertTransaction.run(
          txId,
          txDesc,
          inst.amountCents,
          catCartaoId,
          inst.dueDate,
          `Fatura de cartão - parcela ${inst.number} de ${totalInstallments}`,
          instId,
          now,
          now
        );
      }
    };

    // A) CARTÃO NU PJ: 535,79 - OUT, NOV, DEZ (3 parcelas)
    addCardPurchase('Cartão Nu PJ', '2026-10-10', 'Faturas Cartão Nu PJ - Outubro a Dezembro', [
      { number: 1, dueDate: '2026-10-10', amountCents: 53579 },
      { number: 2, dueDate: '2026-11-10', amountCents: 53579 },
      { number: 3, dueDate: '2026-12-10', amountCents: 53579 },
    ]);

    // B) CARTÃO NU CPF: 220,80 - OUT | 194,94 - NOV | 59,94 - DEZ ~ JUN/27 (9 parcelas)
    const nuCpfList = [
      { number: 1, dueDate: '2026-10-10', amountCents: 22080 },
      { number: 2, dueDate: '2026-11-10', amountCents: 19494 },
      { number: 3, dueDate: '2026-12-10', amountCents: 5994 },
      { number: 4, dueDate: '2027-01-10', amountCents: 5994 },
      { number: 5, dueDate: '2027-02-10', amountCents: 5994 },
      { number: 6, dueDate: '2027-03-10', amountCents: 5994 },
      { number: 7, dueDate: '2027-04-10', amountCents: 5994 },
      { number: 8, dueDate: '2027-05-10', amountCents: 5994 },
      { number: 9, dueDate: '2027-06-10', amountCents: 5994 },
    ];
    addCardPurchase('Cartão Nu CPF', '2026-10-10', 'Faturas Cartão Nu CPF - Outubro/2026 a Junho/2027', nuCpfList);

    // C) CARTÃO MERCADO PAGO: 762,56 - OUT | 207,00 - NOV (2 parcelas)
    addCardPurchase('Cartão Mercado Pago', '2026-10-15', 'Faturas Mercado Pago - Outubro e Novembro', [
      { number: 1, dueDate: '2026-10-15', amountCents: 76256 },
      { number: 2, dueDate: '2026-11-15', amountCents: 20700 },
    ]);

    // D) CARTÃO JOYCE: 590,84 - OUT | 580,85 - NOV | 258,35 - DEZ (3 parcelas)
    addCardPurchase('Cartão Joyce', '2026-10-15', 'Faturas Cartão Joyce - Outubro a Dezembro', [
      { number: 1, dueDate: '2026-10-15', amountCents: 59084 },
      { number: 2, dueDate: '2026-11-15', amountCents: 58085 },
      { number: 3, dueDate: '2026-12-15', amountCents: 25835 },
    ]);

    // 6. Instancia lançamentos de Setembro/2026
    const rulesList = [
      { id: ruleSalarioLuizId, desc: 'Salário Luiz', amount: 230000, type: 'INCOME', cat: catSalarioId, day: 5, method: 'PIX' },
      { id: ruleSalarioJoyceId, desc: 'Salário Joyce', amount: 193500, type: 'INCOME', cat: catSalarioId, day: 5, method: 'PIX' },
      { id: ruleCombustivelId, desc: 'Combustível', amount: 24000, type: 'EXPENSE', cat: catTransporteId, day: 5, method: 'DEBIT' },
      { id: ruleDizimoId, desc: 'Dízimo (10% + R$ 60)', amount: 49750, type: 'EXPENSE', cat: catOutrasId, day: 10, method: 'PIX' },
      { id: rulePrestacaoId, desc: 'Prestação', amount: 192825, type: 'EXPENSE', cat: catMoradiaId, day: 10, method: 'BOLETO' },
      { id: ruleDebitoCapId, desc: 'Débito CAP', amount: 8000, type: 'EXPENSE', cat: catOutrasId, day: 10, method: 'DEBIT' },
      { id: ruleRendimentosId, desc: 'Rendimentos', amount: 14000, type: 'INCOME', cat: catInvestId, day: 15, method: 'PIX' },
      { id: ruleInternetId, desc: 'Internet', amount: 9990, type: 'EXPENSE', cat: catAssinaturasId, day: 15, method: 'BOLETO' },
      { id: ruleAguaId, desc: 'Água', amount: 5000, type: 'EXPENSE', cat: catMoradiaId, day: 20, method: 'BOLETO' },
      { id: ruleEnergiaId, desc: 'Energia', amount: 16000, type: 'EXPENSE', cat: catMoradiaId, day: 20, method: 'BOLETO' },
    ];

    const insertMonthTx = db.prepare(`
      INSERT INTO transactions (
        id, description, amount_cents, type, category_id,
        date, payment_date, payment_method, status, notes,
        installment_id, recurring_rule_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)
    `);

    for (const r of rulesList) {
      const dayStr = String(r.day).padStart(2, '0');
      const txDate = `2026-09-${dayStr}`;
      // Vencidos até dia 14/09 são marcados como baixados/recebidos
      const isPast = txDate <= '2026-09-14';
      const status = r.type === 'INCOME' ? (isPast ? 'RECEIVED' : 'PENDING') : (isPast ? 'PAID' : 'PENDING');
      const payDate = isPast ? txDate : null;

      insertMonthTx.run(
        randomUUID(),
        r.desc,
        r.amount,
        r.type,
        r.cat,
        txDate,
        payDate,
        r.method,
        status,
        'Instanciado a partir de regra fixa mensal',
        r.id,
        now,
        now
      );
    }
  });

  runInTransaction();
  console.log('Dados financeiros reais aplicados com sucesso no banco SQLite!');
}

// Execução direta como script de terminal
const isDirectRun =
  typeof process !== 'undefined' &&
  process.argv[1] &&
  (process.argv[1].endsWith('seed-user-data.ts') || process.argv[1].endsWith('seed-user-data.js'));

if (isDirectRun) {
  const appData = process.env.APPDATA || '';
  const dbPath = path.join(appData, 'financeiro_pessoal', 'financeiro.db');
  console.log(`Conectando ao banco SQLite do Electron: ${dbPath}`);
  const db = new DatabaseConstructor(dbPath);
  seedUserData(db, true);
  db.close();
}
