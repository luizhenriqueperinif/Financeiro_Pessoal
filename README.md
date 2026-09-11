# 💰 Financeiro Pessoal — Sistema Completo de Gestão Financeira

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-20%2B-green?logo=node.js&style=flat-square" alt="Node.js" />
  <img src="https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript&style=flat-square" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Electron-44.x-47848F?logo=electron&style=flat-square" alt="Electron" />
  <img src="https://img.shields.io/badge/React-19.x-61DAFB?logo=react&style=flat-square" alt="React" />
  <img src="https://img.shields.io/badge/Vite-8.x-646CFF?logo=vite&style=flat-square" alt="Vite" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-4.x-38B2AC?logo=tailwind-css&style=flat-square" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/SQLite-Better--SQLite3-003B57?logo=sqlite&style=flat-square" alt="SQLite" />
  <img src="https://img.shields.io/badge/Vitest-32%20passed-success?logo=vitest&style=flat-square" alt="Vitest" />
  <img src="https://img.shields.io/badge/License-MIT-yellow?style=flat-square" alt="License" />
</p>

Sistema completo, moderno, responsivo e seguro de **Gestão Financeira Pessoal**, construído com **Clean Architecture**, alta precisão contábil (representação monetária em centavos inteiros), banco de dados SQLite local embutido, cálculos automatizados de compras parceladas, motor de despesas fixas recorrentes e previsão financeira prospectiva para os próximos meses.

---

## 🚀 Como Executar o Programa Executável (.exe)

O sistema já pode ser empacotado e executado no Windows, **sem necessidade de instalar Node.js, Python ou qualquer ferramenta de desenvolvimento**.

Na pasta `release/`:

1. **Instalador Oficial**:
   * Arquivo: `Financeiro Pessoal Setup 1.0.0.exe`
   * Instalação comum do Windows com assistente passo a passo, criação de atalho na Área de Trabalho e no Menu Iniciar, e desinstalador seguro.
2. **Versão Portátil (Portable)**:
   * Arquivo: `Financeiro Pessoal 1.0.0.exe`
   * Dê duplo clique e use diretamente (pode ser executado direto de um pendrive).
3. **Versão Descompactada**:
   * Localizada em `release/win-unpacked/Financeiro Pessoal.exe`.

---

## 🛠️ Tecnologias Escolhidas e Justificativa

| Tecnologia | Papel no Sistema | Justificativa Técnica |
| :--- | :--- | :--- |
| **Node.js (v24) + TypeScript** | Runtime & Linguagem | Tipagem estática rigorosa para lidar com regras financeiras sem margem para erros, previsibilidade e compartilhamento de código isomórfico entre Desktop, Web e Mobile. |
| **Clean Architecture (@financeiro/core)** | Arquitetura | O núcleo contábil não possui dependências de tela ou de sistema operacional, permitindo que a futura versão mobile (Android/iOS) utilize exatamente a mesma lógica. |
| **SQLite (Better-SQLite3 & SQL)** | Banco de Dados Local | Banco relacional embutido em arquivo único local (`financeiro.db`). Zero configuração para o usuário, suporte completo a transações ACID e integridade referencial com chaves estrangeiras ativas. |
| **Electron + Electron-Builder** | Empacotamento Desktop | Gera executáveis nativos para Windows (.exe instalador e portátil) sem exigir terminal ou código-fonte do usuário final. |
| **React + Vite** | Interface do Usuário | Renderização ultraveloz, interface reativa e moderna para dashboards e filtros complexos em tempo real. |
| **Tailwind CSS + Lucide Icons** | Design System & UI | Visual moderno, limpo, responsivo com alternância nativa de Dark Mode e Light Mode. |
| **Recharts** | Biblioteca de Gráficos | Gráficos SVG responsivos para fluxo de caixa (Receitas x Despesas) e despesas por categoria. |
| **Vitest** | Testes Automatizados | Execução em sub-segundos para testes unitários e de integração contábil (32 testes implementados). |

---

## 🏛️ Arquitetura e Preparação para Futura Versão Mobile

O sistema foi estruturado seguindo **Clean Architecture**:

```
Desktop App (Electron + ContextBridge)    <-- Versão Atual
Mobile App (Capacitor / React Native)     <-- Futura Versão
           │
           ▼
┌────────────────────────────────────────────────────────┐
│               @financeiro/core (TypeScript)            │
│  - Entidades (Transaction, Category, Installments)     │
│  - Casos de Uso (Previsão, Parcelas, Recorrências)     │
│  - Value Objects (Money, DateUtils)                    │
│  - Interfaces de Repositório (ICategoryRepository...)  │
└────────────────────────────────────────────────────────┘
           │
           ▼
Persistência SQLite (Local / Offline-first)
```

* **Reaproveitamento no Mobile**:
  1. O pacote `src/core/` pode ser copiado ou compartilhado diretamente em um projeto mobile.
  2. A interface React atual, desenvolvida com Tailwind responsivo, pode ser empacotada diretamente via **Capacitor** para Android e iOS sem reescrever telas.
  3. A camada de repositório conecta-se ao plugin SQLite nativo do dispositivo móvel mantendo os mesmos dados e regras de negócio.

---

## 💡 Principais Funcionalidades Implementadas

### 1. Dashboard Financeiro Inteligente
* **Saldo Atual Real**: Soma exata de receitas recebidas menos despesas pagas.
* **Receitas do Mês**: Entradas realizadas e previstas.
* **Despesas do Mês**: Despesas pagas e total pendente a vencer.
* **Saldo Previsto do Mês**: Projeção líquida considerando todas as obrigações e receitas programadas.
* **Gráficos Interativos**:
  * Receitas x Despesas dos últimos 6 meses (BarChart comparativo).
  * Distribuição de gastos por categoria (PieChart com porcentagens).
* **Tabela de Previsão Prospectiva**: Próximos 6 meses com cálculo de comprometimento de renda (alerta de meses de alto gasto).

### 2. Gestão Completa de Receitas e Despesas
* Adicionar, editar, excluir, filtrar por mês/ano, categoria, forma de pagamento e status.
* Pesquisa textual instantânea por descrição ou observações.
* Baixa rápida de contas (botão "Pagar" ou "Marcar como Recebida").

### 3. Compras Parceladas no Cartão de Crédito
* **Fracionamento Inteligente**: Uma compra de R$ 3.600 em 12x gera 12 parcelas mensais de R$ 300 com seus devidos vencimentos.
* **Sem Distorção Contábil**: O sistema não lança R$ 3.600 em cada mês; cada mês recebe apenas o impacto da sua respectiva parcela.
* **Acompanhamento e Antecipação**: Barra de progresso de quitação (ex: 3/12 pagas), valor total restante e botão para adiantar ou pagar parcelas específicas.

### 4. Despesas Fixas e Recorrentes
* Cadastro de gastos que se repetem periodicamente (Aluguel, Internet, Assinaturas, Condomínio).
* **Instanciação Concreta Mensal**: A cada mês, o sistema instancia automaticamente um lançamento pendente no financeiro, mantendo o histórico de meses passados imutável e auditável.
* Opção de pausar, reativar ou encerrar a regra fixa.

### 5. Previsão Financeira Prospectiva
* Motor que analisa receitas programadas, fixas ativas e parcelas de compras para projetar o fluxo de caixa dos próximos meses.
* Identificação imediata de meses com comprometimento superior a 80% da renda.

### 6. Calendário Financeiro
* Visão de calendário em grade mensal.
* Indicadores diários de receitas e despesas.
* Ao clicar em um dia, abre os detalhes de todos os vencimentos com atalho para novos lançamentos.

### 7. Relatórios e Auditoria Anual
* Fluxo de caixa anual (12 meses).
* Taxa de poupança líquida (% da renda economizada).
* Resumo do saldo comprometido com parcelas futuras do cartão.

### 8. Segurança, Precisão e Backups
* **Precisão Matemática**: Valores armazenados em centavos inteiros (`amount_cents`), eliminando erros de arredondamento de ponto flutuante IEEE 754.
* **Exportação de Backup JSON**: Permite baixar uma cópia de segurança completa de todas as tabelas.
* **Restauração de Backup**: Permite restaurar os dados a qualquer momento substituindo atomicamente em transação segura.

---

## 📂 Estrutura do Projeto

```
Financeiro_Pessoal/
├── CONTEXT.md                         # Glossário canônico e linguagem ubíqua do domínio
├── docs/adr/                          # Registros de Decisões de Arquitetura (ADRs)
│   ├── 0001-electron-react-sqlite-stack.md
│   ├── 0002-integer-cents-monetary-representation.md
│   └── 0003-concrete-monthly-instantiation-for-recurring-expenses.md
├── src/
│   ├── core/                          # Regras de Negócio Puras (Portável para Mobile)
│   │   ├── domain/                    # Entidades (Transaction, Category, Installments, Recurring)
│   │   ├── use-cases/                 # Casos de uso de todas as funcionalidades
│   │   ├── value-objects/             # Money (cálculos em centavos) e DateUtils
│   │   ├── validation/                # Schemas de validação Zod
│   │   └── services/                  # BackupService (Exportação e importação JSON)
│   ├── infra/                         # Persistência e Sistema de Arquivos
│   │   ├── database/                  # Conexão SQLite, DDL de tabelas e categorias padrão
│   │   └── repositories/              # Repositórios concretos em SQLite
│   ├── desktop/                       # Casca do Electron
│   │   ├── main.ts                    # Processo Principal e registro de IPC Handlers
│   │   └── preload.ts                 # ContextBridge com tipagem estrita
│   └── ui/                            # Interface Web (React + Vite + Tailwind CSS)
│       ├── components/                # Sidebar, TopBar, TransactionModal, CategoryModal, etc.
│       ├── pages/                     # Dashboard, Incomes, Expenses, Installments, Calendar, etc.
│       └── services/                  # Cliente de API com fallback para desenvolvimento web
├── tests/                             # Suíte de Testes Automatizados (Vitest)
│   ├── unit/                          # Testes unitários de regras de negócio e cálculos
│   └── integration/                   # Testes de integração de banco de dados e repositórios
├── electron-builder.yml               # Configuração do gerador de instaladores Windows
└── package.json
```

---

## 💻 Como Começar e Comandos de Desenvolvimento

### Pré-requisitos
- [Node.js](https://nodejs.org/) versão **20.x** ou superior
- Gerenciador de pacotes **npm**

### 1. Clonar e Instalar Dependências
```bash
git clone <URL_DO_REPOSITORIO>
cd Financeiro_Pessoal
npm install
```

### 2. Executar em Desenvolvimento (Desktop - Electron + Vite)
```bash
npm run dev
```
> Inicia simultaneamente o servidor Vite com Hot Reload e abre a janela nativa do Electron conectada ao SQLite local.

### 3. Executar Testes Automatizados
```bash
npm test
```
> Executa 32 testes unitários e de integração cobrindo divisões de parcelas, regras de despesas fixas, integridade contábil do banco SQLite e geração de previsões financeiras.

### 4. Rodar Somente a Interface Web (Navegador)
```bash
npm run dev:web
```
> Abre o servidor Vite em `http://localhost:5173` usando WebAssembly (sql.js) em memória.

### 5. Compilar o Projeto
```bash
npm run build
```
> Compila a interface React via Vite e empacota o processo do Electron via esbuild na pasta `dist/`.

### 6. Gerar Novos Instaladores (.exe)
```bash
npm run package
```
> Gera os arquivos executáveis (`Financeiro Pessoal Setup 1.0.0.exe` e versão portátil `.exe`) na pasta `release/`.

---

## 🔒 Segurança e Dados Locais

* Todos os dados são armazenados localmente em arquivo SQLite protegido no diretório seguro de dados do usuário:
  `%APPDATA%\financeiro_pessoal\financeiro.db`
* O sistema não envia dados financeiros para servidores externos (arquitetura 100% offline-first e privada).
* Para migrar de computador ou fazer backup de segurança, utilize a opção **Configurações > Exportar Backup** no menu lateral.

---

## 📄 Licença

Distribuído sob a licença **MIT**. Consulte o arquivo `LICENSE` para mais informações.

