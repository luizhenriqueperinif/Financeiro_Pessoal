export const CREATE_TABLES_SQL = `
-- Habilita chaves estrangeiras
PRAGMA foreign_keys = ON;

-- Tabela de Categorias
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK(type IN ('INCOME', 'EXPENSE')),
  description TEXT,
  color TEXT,
  icon TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Tabela de Regras Recorrentes (Despesas/Receitas Fixas)
CREATE TABLE IF NOT EXISTS recurring_rules (
  id TEXT PRIMARY KEY,
  description TEXT NOT NULL,
  amount_cents INTEGER NOT NULL CHECK(amount_cents > 0),
  type TEXT NOT NULL CHECK(type IN ('INCOME', 'EXPENSE')),
  category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  frequency TEXT NOT NULL CHECK(frequency IN ('MONTHLY', 'WEEKLY', 'YEARLY')),
  due_day INTEGER NOT NULL CHECK(due_day >= 1 AND due_day <= 31),
  start_date TEXT NOT NULL,
  end_date TEXT,
  payment_method TEXT NOT NULL CHECK(payment_method IN ('MONEY', 'PIX', 'DEBIT', 'CREDIT', 'BOLETO', 'OTHER')),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Tabela de Compras Parceladas (Cabeçalho da compra original)
CREATE TABLE IF NOT EXISTS installment_purchases (
  id TEXT PRIMARY KEY,
  description TEXT NOT NULL,
  total_amount_cents INTEGER NOT NULL CHECK(total_amount_cents > 0),
  total_installments INTEGER NOT NULL CHECK(total_installments >= 2),
  first_due_date TEXT NOT NULL,
  category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  payment_method TEXT NOT NULL DEFAULT 'CREDIT',
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Tabela de Parcelas individuais
CREATE TABLE IF NOT EXISTS installments (
  id TEXT PRIMARY KEY,
  purchase_id TEXT NOT NULL REFERENCES installment_purchases(id) ON DELETE CASCADE,
  installment_number INTEGER NOT NULL,
  total_installments INTEGER NOT NULL,
  amount_cents INTEGER NOT NULL CHECK(amount_cents > 0),
  due_date TEXT NOT NULL,
  payment_date TEXT,
  status TEXT NOT NULL CHECK(status IN ('PENDING', 'PAID', 'OVERDUE', 'CANCELLED')),
  transaction_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Tabela de Transações (Receitas e Despesas)
CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  description TEXT NOT NULL,
  amount_cents INTEGER NOT NULL CHECK(amount_cents > 0),
  type TEXT NOT NULL CHECK(type IN ('INCOME', 'EXPENSE')),
  category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  date TEXT NOT NULL,
  payment_date TEXT,
  payment_method TEXT NOT NULL CHECK(payment_method IN ('MONEY', 'PIX', 'DEBIT', 'CREDIT', 'BOLETO', 'OTHER')),
  status TEXT NOT NULL CHECK(status IN ('PENDING', 'PAID', 'RECEIVED', 'OVERDUE', 'CANCELLED')),
  notes TEXT,
  installment_id TEXT REFERENCES installments(id) ON DELETE SET NULL,
  recurring_rule_id TEXT REFERENCES recurring_rules(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Índices para consultas de alta performance
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_transactions_recurring ON transactions(recurring_rule_id);
CREATE INDEX IF NOT EXISTS idx_installments_purchase ON installments(purchase_id);
CREATE INDEX IF NOT EXISTS idx_installments_due_date ON installments(due_date);
`;

export const DEFAULT_CATEGORIES = [
  // Despesas
  { name: 'Alimentação', type: 'EXPENSE', description: 'Supermercado, feiras, restaurantes e delivery', color: '#EF4444', icon: 'Utensils' },
  { name: 'Moradia', type: 'EXPENSE', description: 'Aluguel, condomínio, IPTU, água, luz e gás', color: '#F97316', icon: 'Home' },
  { name: 'Transporte', type: 'EXPENSE', description: 'Combustível, transporte público, Uber e manutenção', color: '#F59E0B', icon: 'Car' },
  { name: 'Saúde', type: 'EXPENSE', description: 'Plano de saúde, farmácia, consultas e exames', color: '#10B981', icon: 'HeartPulse' },
  { name: 'Educação', type: 'EXPENSE', description: 'Cursos, faculdade, livros e mensalidades escolares', color: '#3B82F6', icon: 'GraduationCap' },
  { name: 'Lazer', type: 'EXPENSE', description: 'Cinema, passeios, viagens e entretenimento', color: '#8B5CF6', icon: 'Smile' },
  { name: 'Assinaturas', type: 'EXPENSE', description: 'Streaming, internet, celular e serviços recorrentes', color: '#EC4899', icon: 'Tv' },
  { name: 'Outras Despesas', type: 'EXPENSE', description: 'Gastos diversos não categorizados', color: '#6B7280', icon: 'MoreHorizontal' },

  // Receitas
  { name: 'Salário', type: 'INCOME', description: 'Remuneração mensal fixa', color: '#10B981', icon: 'Briefcase' },
  { name: 'Comissão', type: 'INCOME', description: 'Comissões sobre vendas ou metas', color: '#06B6D4', icon: 'Percent' },
  { name: 'Freelance', type: 'INCOME', description: 'Projetos e trabalhos avulsos', color: '#6366F1', icon: 'Laptop' },
  { name: 'Investimentos', type: 'INCOME', description: 'Rendimentos, dividendos e juros', color: '#84CC16', icon: 'TrendingUp' },
  { name: 'Outras Receitas', type: 'INCOME', description: 'Entradas diversas extraordinárias', color: '#14B8A6', icon: 'PlusCircle' },
];
