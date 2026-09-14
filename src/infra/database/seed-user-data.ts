import path from 'path';
import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';

// Caminho do banco SQLite do Electron no Windows
const appData = process.env.APPDATA || '';
const dbPath = path.join(appData, 'financeiro_pessoal', 'financeiro.db');

console.log(`Conectando ao banco SQLite: ${dbPath}`);
const db = new Database(dbPath);

// Habilita foreign keys
db.pragma('foreign_keys = ON');

// 1. Garante que as categorias existam
function getCategoryId(name: string, type: 'INCOME' | 'EXPENSE', color: string, icon: string): string {
  const existing = db.prepare('SELECT id FROM categories WHERE name = ?').get(name) as { id: string } | undefined;
  if (existing) return existing.id;

  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO categories (id, name, type, description, color, icon, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, name, type, name, color, icon, now, now);
  return id;
}

const catSalarioId = getCategoryId('Salário', 'INCOME', '#10B981', 'Briefcase');
const catInvestId = getCategoryId('Investimentos', 'INCOME', '#84CC16', 'TrendingUp');
const catMoradiaId = getCategoryId('Moradia', 'EXPENSE', '#F97316', 'Home');
const catTransporteId = getCategoryId('Transporte', 'EXPENSE', '#F59E0B', 'Car');
const catAssinaturasId = getCategoryId('Assinaturas', 'EXPENSE', '#EC4899', 'Tv');
const catOutrasId = getCategoryId('Outras Despesas', 'EXPENSE', '#6B7280', 'MoreHorizontal');
const catCartaoId = getCategoryId('Cartão de Crédito', 'EXPENSE', '#8B5CF6', 'CreditCard');

// 2. Limpa dados antigos de transações, regras fixas e compras parceladas
console.log('Limpando registros anteriores de testes...');
db.exec(`
  DELETE FROM transactions;
  DELETE FROM installments;
  DELETE FROM installment_purchases;
  DELETE FROM recurring_rules;
`);

const now = new Date().toISOString();

// 3. Cadastra as RECEITAS FIXAS (Recorrentes)
console.log('Cadastrando Receitas Fixas...');
const insertRecurring = db.prepare(`
  INSERT INTO recurring_rules (
    id, description, amount_cents, type, category_id,
    frequency, due_day, start_date, end_date, payment_method, is_active, notes, created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, 'MONTHLY', ?, '2026-09-01', NULL, ?, 1, ?, ?, ?)
`);

// Receitas:
// Salário Luiz: R$ 2.300,00
insertRecurring.run(randomUUID(), 'Salário Luiz', 230000, 'INCOME', catSalarioId, 5, 'PIX', 'Remuneração mensal Luiz', now, now);
// Salário Joyce: R$ 1.935,00
insertRecurring.run(randomUUID(), 'Salário Joyce', 193500, 'INCOME', catSalarioId, 5, 'PIX', 'Remuneração mensal Joyce', now, now);
// Rendimentos: R$ 140,00
insertRecurring.run(randomUUID(), 'Rendimentos', 14000, 'INCOME', catInvestId, 15, 'PIX', 'Rendimentos e dividendos', now, now);

// 4. Cadastra as DESPESAS FIXAS (Recorrentes)
console.log('Cadastrando Despesas Fixas...');
// Dízimo: 10% do ganho líquido (10% de R$ 4.375,00 = R$ 437,50) + R$ 60,00 = R$ 497,50
insertRecurring.run(randomUUID(), 'Dízimo (10% + R$ 60)', 49750, 'EXPENSE', catOutrasId, 10, 'PIX', '10% de R$ 4.375,00 + R$ 60,00 fixo', now, now);
// Prestação: R$ 1.928,25
insertRecurring.run(randomUUID(), 'Prestação', 192825, 'EXPENSE', catMoradiaId, 10, 'BOLETO', 'Prestação habitacional/imóvel', now, now);
// Débito CAP: R$ 80,00
insertRecurring.run(randomUUID(), 'Débito CAP', 8000, 'EXPENSE', catOutrasId, 10, 'DEBIT', 'Débito CAP', now, now);
// Internet: R$ 99,90
insertRecurring.run(randomUUID(), 'Internet', 9990, 'EXPENSE', catAssinaturasId, 15, 'BOLETO', 'Internet residencial', now, now);
// Água: R$ 50,00
insertRecurring.run(randomUUID(), 'Água', 5000, 'EXPENSE', catMoradiaId, 20, 'BOLETO', 'Conta de água', now, now);
// Energia: R$ 160,00
insertRecurring.run(randomUUID(), 'Energia', 16000, 'EXPENSE', catMoradiaId, 20, 'BOLETO', 'Conta de energia', now, now);
// Combustível: R$ 240,00
insertRecurring.run(randomUUID(), 'Combustível', 24000, 'EXPENSE', catTransporteId, 5, 'DEBIT', 'Despesa fixa estimada de combustível', now, now);

// 5. Cadastra GASTOS DE CARTÕES (Faturas / Parcelamentos)
console.log('Cadastrando Faturas e Parcelas dos Cartões de Crédito...');
const insertTx = db.prepare(`
  INSERT INTO transactions (
    id, description, amount_cents, type, category_id,
    date, payment_date, payment_method, status, notes,
    installment_id, recurring_rule_id, created_at, updated_at
  ) VALUES (?, ?, ?, 'EXPENSE', ?, ?, NULL, 'CREDIT', 'PENDING', ?, NULL, NULL, ?, ?)
`);

// CARTÃO NU PJ: 535,79 - OUT, NOV, DEZ
insertTx.run(randomUUID(), 'Cartão Nu PJ (1/3)', 53579, catCartaoId, '2026-10-10', 'Fatura Cartão Nu PJ - Outubro', now, now);
insertTx.run(randomUUID(), 'Cartão Nu PJ (2/3)', 53579, catCartaoId, '2026-11-10', 'Fatura Cartão Nu PJ - Novembro', now, now);
insertTx.run(randomUUID(), 'Cartão Nu PJ (3/3)', 53579, catCartaoId, '2026-12-10', 'Fatura Cartão Nu PJ - Dezembro', now, now);

// CARTÃO NU CPF: 220,80 - OUT | 194,94 - NOV | 59,94 - DEZ ~ JUN/27
insertTx.run(randomUUID(), 'Cartão Nu CPF', 22080, catCartaoId, '2026-10-10', 'Fatura Cartão Nu CPF - Outubro', now, now);
insertTx.run(randomUUID(), 'Cartão Nu CPF', 19494, catCartaoId, '2026-11-10', 'Fatura Cartão Nu CPF - Novembro', now, now);

const nuCpfMonths = [
  '2026-12-10',
  '2027-01-10',
  '2027-02-10',
  '2027-03-10',
  '2027-04-10',
  '2027-05-10',
  '2027-06-10',
];
nuCpfMonths.forEach((d, idx) => {
  insertTx.run(
    randomUUID(),
    `Cartão Nu CPF (${idx + 1}/7)`,
    5994,
    catCartaoId,
    d,
    `Parcela Nu CPF até Junho/2027`,
    now,
    now
  );
});

// CARTÃO MERCADO PAGO: 762,56 - OUT | 207,00 - NOV
insertTx.run(randomUUID(), 'Cartão Mercado Pago', 76256, catCartaoId, '2026-10-15', 'Fatura Mercado Pago - Outubro', now, now);
insertTx.run(randomUUID(), 'Cartão Mercado Pago', 20700, catCartaoId, '2026-11-15', 'Fatura Mercado Pago - Novembro', now, now);

// CARTÃO JOYCE: 590,84 - OUT | 580,85 - NOV | 258,35 - DEZ
insertTx.run(randomUUID(), 'Cartão Joyce', 59084, catCartaoId, '2026-10-15', 'Fatura Cartão Joyce - Outubro', now, now);
insertTx.run(randomUUID(), 'Cartão Joyce', 58085, catCartaoId, '2026-11-15', 'Fatura Cartão Joyce - Novembro', now, now);
insertTx.run(randomUUID(), 'Cartão Joyce', 25835, catCartaoId, '2026-12-15', 'Fatura Cartão Joyce - Dezembro', now, now);

// 6. Instancia lançamentos concretos de Setembro/2026 para que o mês atual já tenha receitas e despesas
console.log('Instanciando lançamentos do mês atual (Setembro/2026)...');
const rules = db.prepare('SELECT * FROM recurring_rules WHERE is_active = 1').all() as any[];
for (const r of rules) {
  const dayStr = String(r.due_day).padStart(2, '0');
  const txDate = `2026-09-${dayStr}`;
  // Marca salário como recebido e despesas vencidas até dia 14 como pagas
  const isPast = txDate <= '2026-09-14';
  const status = r.type === 'INCOME' ? (isPast ? 'RECEIVED' : 'PENDING') : (isPast ? 'PAID' : 'PENDING');
  const payDate = isPast ? txDate : null;

  db.prepare(`
    INSERT INTO transactions (
      id, description, amount_cents, type, category_id,
      date, payment_date, payment_method, status, notes,
      installment_id, recurring_rule_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)
  `).run(
    randomUUID(),
    r.description,
    r.amount_cents,
    r.type,
    r.category_id,
    txDate,
    payDate,
    r.payment_method,
    status,
    'Instanciado automaticamente a partir de regra fixa',
    r.id,
    now,
    now
  );
}

console.log('Dados financeiros reais inseridos com sucesso!');
db.close();
