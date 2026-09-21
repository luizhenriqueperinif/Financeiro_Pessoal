# Financeiro Pessoal

Contexto responsável pela gestão financeira pessoal, orçamentária, acompanhamento de liquidez, parcelamentos e previsões de fluxo de caixa.

## Language

### Transações e Saldos

**Receita**:
Entrada financeira prevista ou realizada no patrimônio do usuário.
_Avoid_: Ganho, crédito avulso, provento

**Despesa**:
Saída financeira prevista ou realizada do patrimônio do usuário.
_Avoid_: Gasto, débito avulso, conta

**Lançamento**:
Registro individual de uma Receita ou de uma Despesa, com valor, data de vencimento e status próprios. Uma Parcela gera um Lançamento de Despesa.
_Avoid_: Conta, movimentação, transação (fora do código)

**Liquidação**:
Ato de marcar um Lançamento como Pago (Despesa) ou Recebido (Receita), registrando a data de pagamento. Desfazer a Liquidação devolve o Lançamento a Pendente e apaga a data de pagamento; se o vencimento já passou, ele volta a aparecer como Atrasado.
_Avoid_: Baixa, quitação

**Saldo Atual**:
Soma líquida de todas as receitas recebidas subtraída de todas as despesas efetivamente pagas até o momento.
_Avoid_: Saldo contábil, saldo previsto

**Saldo Previsto**:
Projeção de liquidez financeira ao final de um período calculada a partir do saldo atual acrescido das receitas pendentes e subtraído das despesas pendentes e atrasadas.
_Avoid_: Saldo futuro hipotético

**Status de Lançamento**:
Estado pontual de liquidação de uma obrigação ou direito financeiro (Pendente, Pago/Recebido, Atrasado, Cancelado).
_Avoid_: Situação, fase

### Categorização e Estrutura

**Categoria**:
Classificação temática exclusiva de receitas ou despesas utilizada para agrupamento, orçamentação e análise estatística.
_Avoid_: Grupo, tag, rótulo

### Obrigações Recorrentes e Parceladas

**Despesa Fixa**:
Regra de despesa contínua que se repete periodicamente segundo uma frequência definida e gera lançamentos financeiros periódicos.
_Avoid_: Despesa recorrente, assinatura genérica

**Receita Fixa**:
Regra de receita contínua que se repete periodicamente segundo uma frequência definida e gera lançamentos de receita periódicos (ex.: salário).
_Avoid_: Receita recorrente, renda fixa

**Origem do Lançamento**:
De onde um Lançamento veio: Avulso (cadastrado manualmente ou importado de extrato), gerado por uma Despesa Fixa ou Receita Fixa, ou gerado por uma Parcela.
_Avoid_: Tipo de lançamento, fonte

**Compra Parcelada**:
Operação de compra cujo montante total é fracionado em múltiplas obrigações periódicas vinculadas.
_Avoid_: Financiamento, carnê, compra a prazo

**Parcela**:
Fração individualizada de uma compra parcelada, com valor próprio, número de ordem e data de vencimento específica.
_Avoid_: Mensalidade, prestação

### Previsão e Planejamento

**Previsão Financeira**:
Cálculo prospectivo mensal que consolida receitas programadas, despesas pontuais, parcelas ativas e despesas fixas para projetar o comprometimento de renda futuro.
_Avoid_: Estimativa avulsa, fluxo teórico

### Alertas e Inteligência Financeira

**Alerta de Comprometimento**:
Classificação da saúde financeira do período baseada na relação entre despesas projetadas e receitas previstas (Saudável <= 70%, Atenção entre 70% e 85%, Crítico > 85% ou déficit).
_Avoid_: Aviso de limite, trava de gastos

**Orçamento Diário Disponível**:
Montante financeiro líquido seguro fracionado pelos dias restantes do mês civil para orientar a cadência de desembolsos do usuário e evitar saldo negativo ao final do período.
_Avoid_: Cota diária, limite de gastos diário

**Lembrete de Vencimento**:
Notificação situacional sobre obrigações financeiras imediatas (despesas atrasadas, despesas a vencer nos próximos dias e receitas esperadas não confirmadas).
_Avoid_: Aviso de conta, push de cobrança

