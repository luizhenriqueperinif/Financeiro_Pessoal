import {
  BankStatementItem,
  BankStatementParseResult,
} from '../domain/statement.js';

export class StatementParserService {
  /**
   * Ponto de entrada público para parsing de extratos bancários (OFX ou CSV).
   */
  parse(content: string, filename: string = ''): BankStatementParseResult {
    const trimmed = content.trim();

    // Detecção por extensão ou conteúdo
    const isOfx =
      filename.toLowerCase().endsWith('.ofx') ||
      trimmed.includes('<OFX>') ||
      trimmed.includes('OFXHEADER');

    if (isOfx) {
      return this.parseOfx(trimmed);
    }

    return this.parseCsv(trimmed, filename);
  }

  // ==========================================
  // PARSER OFX
  // ==========================================
  private parseOfx(content: string): BankStatementParseResult {
    const isCreditCard =
      content.includes('<CREDITCARDMSGSRSV1>') ||
      content.includes('<CCSTMTTRNRS>') ||
      content.includes('<CCSTMTRS>');

    const bankOrgMatch = content.match(/<ORG>([^<\r\n]+)/i);
    const bankName = bankOrgMatch ? bankOrgMatch[1].trim() : 'Instituição Bancária';

    const items: BankStatementItem[] = [];

    // Localiza blocos de transação <STMTTRN>
    const trnRegex = /<STMTTRN>([\s\S]*?)(?=<\/STMTTRN>|<STMTTRN>|<\/BANKTRANLIST>|<\/CCBANKTRANLIST>|$)/gi;
    let match: RegExpExecArray | null;

    let minDate = '9999-99-99';
    let maxDate = '0000-00-00';

    while ((match = trnRegex.exec(content)) !== null) {
      const block = match[1];

      // TRNTYPE
      const typeMatch = block.match(/<TRNTYPE>([^<\r\n]+)/i);
      const rawType = typeMatch ? typeMatch[1].trim().toUpperCase() : '';

      // DTPOSTED (espera formato YYYYMMDD...)
      const dateMatch = block.match(/<DTPOSTED>(\d{8})/i);
      let date = '';
      if (dateMatch) {
        const rawDate = dateMatch[1];
        date = `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`;
        if (date < minDate) minDate = date;
        if (date > maxDate) maxDate = date;
      }

      // TRNAMT (converte sem aritmética de ponto flutuante IEEE 754)
      const amtMatch = block.match(/<TRNAMT>([+-]?[\d,.]+)/i);
      const rawAmt = amtMatch ? amtMatch[1] : '0';
      const { amountCents, isNegative } = this.parseMonetaryCents(rawAmt);

      // FITID
      const fitidMatch = block.match(/<FITID>([^<\r\n]+)/i);
      const externalId = fitidMatch ? fitidMatch[1].trim() : null;

      // MEMO ou NAME
      const memoMatch = block.match(/<MEMO>([^<\r\n]+)/i);
      const nameMatch = block.match(/<NAME>([^<\r\n]+)/i);
      const description = (memoMatch ? memoMatch[1] : nameMatch ? nameMatch[1] : 'Transação Sem Descrição').trim();

      // Determinação de tipo
      let type: 'INCOME' | 'EXPENSE' = 'EXPENSE';
      if (isCreditCard) {
        type = !isNegative && rawType === 'CREDIT' ? 'INCOME' : 'EXPENSE';
      } else {
        if (!isNegative || rawType === 'CREDIT') {
          type = 'INCOME';
        } else {
          type = 'EXPENSE';
        }
      }

      items.push({
        externalId,
        date: date || new Date().toISOString().slice(0, 10),
        description,
        amountCents,
        type,
        suggestedCategory: this.suggestCategory(description, type),
      });
    }

    return {
      bankName,
      accountType: isCreditCard ? 'CREDIT_CARD' : 'CHECKING',
      startDate: minDate !== '9999-99-99' ? minDate : new Date().toISOString().slice(0, 10),
      endDate: maxDate !== '0000-00-00' ? maxDate : new Date().toISOString().slice(0, 10),
      items,
    };
  }

  // ==========================================
  // PARSER CSV
  // ==========================================
  private parseCsv(content: string, filename: string): BankStatementParseResult {
    const lines = content.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) {
      return {
        bankName: 'Extrato CSV',
        accountType: 'CHECKING',
        startDate: '',
        endDate: '',
        items: [],
      };
    }

    const header = lines[0];
    const delimiter = (header.match(/;/g) || []).length >= (header.match(/,/g) || []).length ? ';' : ',';
    const headers = header.split(delimiter).map((h) => h.trim().toLowerCase().replace(/"/g, ''));

    const fn = filename.toLowerCase();
    const isCreditCard =
      fn.includes('card') ||
      fn.includes('cartao') ||
      fn.includes('cartão') ||
      fn.includes('fatura') ||
      headers.some((h) => h.includes('cartao') || h.includes('cartão') || h.includes('parcela') || h.includes('fatura'));

    // Localiza índices das colunas
    const dateIdx = headers.findIndex((h) => h.includes('data') || h.includes('date'));
    const amtIdx = headers.findIndex((h) => h.includes('valor') || h.includes('amount') || h.includes('val'));
    const descIdx = headers.findIndex(
      (h) => h.includes('desc') || h.includes('detalhe') || h.includes('memo') || h.includes('title') || h.includes('nome')
    );
    const idIdx = headers.findIndex((h) => h.includes('identificador') || h.includes('id') || h.includes('fitid'));

    const items: BankStatementItem[] = [];
    let minDate = '9999-99-99';
    let maxDate = '0000-00-00';

    for (let i = 1; i < lines.length; i++) {
      const row = lines[i];
      if (!row) continue;

      const cols = this.splitCsvRow(row, delimiter);

      const rawDate = dateIdx !== -1 && cols[dateIdx] ? cols[dateIdx].trim() : '';
      const rawAmt = amtIdx !== -1 && cols[amtIdx] ? cols[amtIdx].trim() : '0';
      const description = descIdx !== -1 && cols[descIdx] ? cols[descIdx].trim() : `Lançamento Linha ${i}`;
      const externalId = idIdx !== -1 && cols[idIdx] ? cols[idIdx].trim() : null;

      const date = this.normalizeDate(rawDate);
      if (date && date < minDate) minDate = date;
      if (date && date > maxDate) maxDate = date;

      const { amountCents, isNegative } = this.parseMonetaryCents(rawAmt);

      // Em faturas de cartão, compras são despesas mesmo com sinal positivo no CSV
      let type: 'INCOME' | 'EXPENSE';
      if (isCreditCard) {
        type = isNegative ? 'INCOME' : 'EXPENSE';
      } else {
        type = isNegative ? 'EXPENSE' : 'INCOME';
      }

      items.push({
        externalId,
        date: date || new Date().toISOString().slice(0, 10),
        description,
        amountCents,
        type,
        suggestedCategory: this.suggestCategory(description, type),
      });
    }

    const bankName = fn.includes('nubank')
      ? 'Nubank'
      : fn.includes('mercado')
      ? 'Mercado Pago'
      : fn.includes('inter')
      ? 'Banco Inter'
      : 'Extrato Importado';

    return {
      bankName,
      accountType: isCreditCard ? 'CREDIT_CARD' : 'CHECKING',
      startDate: minDate !== '9999-99-99' ? minDate : '',
      endDate: maxDate !== '0000-00-00' ? maxDate : '',
      items,
    };
  }

  // ==========================================
  // HELPERS DE NORMALIZAÇÃO
  // ==========================================
  private splitCsvRow(row: string, delimiter: string): string[] {
    const result: string[] = [];
    let cur = '';
    let inQuotes = false;

    for (let i = 0; i < row.length; i++) {
      const c = row[i];
      if (c === '"') {
        inQuotes = !inQuotes;
      } else if (c === delimiter && !inQuotes) {
        result.push(cur.replace(/^"|"$/g, '').trim());
        cur = '';
      } else {
        cur += c;
      }
    }
    result.push(cur.replace(/^"|"$/g, '').trim());
    return result;
  }

  private normalizeDate(raw: string): string {
    const clean = raw.replace(/"/g, '').trim();
    // Formato DD/MM/AAAA ou DD-MM-AAAA
    const brMatch = clean.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);
    if (brMatch) {
      const day = brMatch[1].padStart(2, '0');
      const month = brMatch[2].padStart(2, '0');
      const year = brMatch[3];
      return `${year}-${month}-${day}`;
    }

    // Formato AAAA-MM-DD
    const isoMatch = clean.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})/);
    if (isoMatch) {
      const year = isoMatch[1];
      const month = isoMatch[2].padStart(2, '0');
      const day = isoMatch[3].padStart(2, '0');
      return `${year}-${month}-${day}`;
    }

    return clean;
  }

  /**
   * Converte representações numéricas diretamente para centavos inteiros
   * evitando erros de ponto flutuante IEEE 754 (ADR 0002).
   */
  private parseMonetaryCents(raw: string): { amountCents: number; isNegative: boolean } {
    let clean = raw.replace(/"/g, '').replace(/R\$\s?/, '').trim();
    const isNegative = clean.startsWith('-');

    if (isNegative) {
      clean = clean.slice(1).trim();
    }

    // Trata formato brasileiro (1.928,25) convertendo para separador único decimal
    if (clean.includes(',')) {
      clean = clean.replace(/\./g, '').replace(',', '.');
    }

    const parts = clean.split('.');
    const intPart = parseInt(parts[0].replace(/\D/g, '') || '0', 10);
    const decRaw = (parts[1] || '').replace(/\D/g, '');
    const decPart = parseInt((decRaw + '00').slice(0, 2), 10);
    const amountCents = intPart * 100 + decPart;

    return {
      amountCents,
      isNegative,
    };
  }

  private suggestCategory(description: string, type: 'INCOME' | 'EXPENSE'): string {
    const lower = description.toLowerCase();

    if (type === 'INCOME') {
      if (lower.includes('salario') || lower.includes('salário') || lower.includes('remuner') || lower.includes('folha')) {
        return 'Salário';
      }
      if (lower.includes('rendimento') || lower.includes('dividendo') || lower.includes('cdb') || lower.includes('juros') || lower.includes('invest')) {
        return 'Investimentos';
      }
      return 'Salário';
    }

    // Despesas
    if (lower.includes('posto') || lower.includes('shell') || lower.includes('ipiranga') || lower.includes('combustivel') || lower.includes('combustível') || lower.includes('gasolina') || lower.includes('uber') || lower.includes('99')) {
      return 'Transporte';
    }

    if (lower.includes('habitacional') || lower.includes('prestacao') || lower.includes('prestação') || lower.includes('aluguel') || lower.includes('agua') || lower.includes('água') || lower.includes('sabesp') || lower.includes('energia') || lower.includes('enel') || lower.includes('cpfl') || lower.includes('luz')) {
      return 'Moradia';
    }

    if (lower.includes('internet') || lower.includes('fibra') || lower.includes('netflix') || lower.includes('spotify') || lower.includes('claro') || lower.includes('vivo') || lower.includes('tim')) {
      return 'Assinaturas';
    }

    if (lower.includes('mercado') || lower.includes('supermercado') || lower.includes('padaria') || lower.includes('acougue') || lower.includes('açougue') || lower.includes('ifood')) {
      return 'Alimentação';
    }

    if (lower.includes('cartao') || lower.includes('cartão') || lower.includes('fatura') || lower.includes('parcela')) {
      return 'Cartão de Crédito';
    }

    return 'Outras Despesas';
  }
}
