import { describe, it, expect } from 'vitest';
import { StatementParserService } from '../../src/core/services/statement-parser-service.js';

describe('StatementParserService (Costura 1: Parsing de Extratos OFX e CSV)', () => {
  const parser = new StatementParserService();

  it('faz parse com sucesso de extrato bancário em formato OFX (conta corrente Nubank)', () => {
    const ofxContent = `
OFXHEADER:100
DATA:OFXSGML
VERSION:102
<OFX>
  <SIGNONMSGSRSV1>
    <SONRS>
      <FI><ORG>Nu Pagamentos S.A.<FID>260</FI>
    </SONRS>
  </SIGNONMSGSRSV1>
  <BANKMSGSRSV1>
    <STMTTRNRS>
      <STMTRS>
        <BANKACCTFROM>
          <BANKID>260
          <ACCTID>123456-7
          <ACCTTYPE>CHECKING
        </BANKACCTFROM>
        <BANKTRANLIST>
          <DTSTART>20260901
          <DTEND>20260914
          <STMTTRN>
            <TRNTYPE>DEBIT
            <DTPOSTED>20260905120000[-3:BRT]
            <TRNAMT>-240.00
            <FITID>nu-tx-001
            <MEMO>Posto Shell Combustivel
          </STMTTRN>
          <STMTTRN>
            <TRNTYPE>CREDIT
            <DTPOSTED>20260905100000[-3:BRT]
            <TRNAMT>2300.00
            <FITID>nu-tx-002
            <MEMO>Pix Recebido Salario Luiz
          </STMTTRN>
        </BANKTRANLIST>
      </STMTRS>
    </STMTTRNRS>
  </BANKMSGSRSV1>
</OFX>
    `;

    const result = parser.parse(ofxContent, 'extrato_nubank.ofx');

    expect(result.accountType).toBe('CHECKING');
    expect(result.bankName).toContain('Nu');
    expect(result.items).toHaveLength(2);

    // Despesa: Posto de combustível
    const despesa = result.items.find((i) => i.externalId === 'nu-tx-001')!;
    expect(despesa).toBeDefined();
    expect(despesa.type).toBe('EXPENSE');
    expect(despesa.amountCents).toBe(24000);
    expect(despesa.date).toBe('2026-09-05');
    expect(despesa.description).toContain('Posto Shell');
    expect(despesa.suggestedCategory).toBe('Transporte');

    // Receita: Salário
    const receita = result.items.find((i) => i.externalId === 'nu-tx-002')!;
    expect(receita).toBeDefined();
    expect(receita.type).toBe('INCOME');
    expect(receita.amountCents).toBe(230000);
    expect(receita.date).toBe('2026-09-05');
    expect(receita.suggestedCategory).toBe('Salário');
  });

  it('faz parse de fatura de Cartão de Crédito em formato OFX', () => {
    const ofxCardContent = `
<OFX>
  <CREDITCARDMSGSRSV1>
    <CCSTMTTRNRS>
      <CCSTMTRS>
        <CCACCTFROM><ACCTID>5502****1234</ACCTID></CCACCTFROM>
        <BANKTRANLIST>
          <STMTTRN>
            <TRNTYPE>DEBIT
            <DTPOSTED>20261010
            <TRNAMT>-535.79
            <FITID>card-pj-1
            <MEMO>Nu PJ Parcela 1/3
          </STMTTRN>
        </BANKTRANLIST>
      </CCSTMTRS>
    </CCSTMTTRNRS>
  </CREDITCARDMSGSRSV1>
</OFX>
    `;

    const result = parser.parse(ofxCardContent, 'fatura_card.ofx');
    expect(result.accountType).toBe('CREDIT_CARD');
    expect(result.items).toHaveLength(1);
    expect(result.items[0].amountCents).toBe(53579);
    expect(result.items[0].type).toBe('EXPENSE');
    expect(result.items[0].date).toBe('2026-10-10');
  });

  it('faz parse de arquivo CSV padrão Nubank (separador vírgula e data dd/mm/yyyy)', () => {
    const csvContent = `Data,Valor,Identificador,Descrição
05/09/2026,-240.00,id-1,Posto Ipiranga Combustivel
10/09/2026,-1928.25,id-2,Pagamento Boleto Habitacional Prestacao
15/09/2026,140.00,id-3,Rendimentos Conta Nubank`;

    const result = parser.parse(csvContent, 'extrato_nubank.csv');
    expect(result.items).toHaveLength(3);

    expect(result.items[0].date).toBe('2026-09-05');
    expect(result.items[0].amountCents).toBe(24000);
    expect(result.items[0].type).toBe('EXPENSE');
    expect(result.items[0].suggestedCategory).toBe('Transporte');

    expect(result.items[1].date).toBe('2026-09-10');
    expect(result.items[1].amountCents).toBe(192825);
    expect(result.items[1].type).toBe('EXPENSE');
    expect(result.items[1].suggestedCategory).toBe('Moradia');

    expect(result.items[2].date).toBe('2026-09-15');
    expect(result.items[2].amountCents).toBe(14000);
    expect(result.items[2].type).toBe('INCOME');
    expect(result.items[2].suggestedCategory).toBe('Investimentos');
  });

  it('faz parse de arquivo CSV padrão Mercado Pago (separador ponto-e-vírgula e formato brasileiro 1.234,56)', () => {
    const csvContent = `DATA;DESCRICAO;VALOR
2026-10-15;Mercado Pago Compra Cartao;-762,56
2026-11-15;Mercado Pago Compra Cartao;-207,00`;

    const result = parser.parse(csvContent, 'mercado_pago.csv');
    expect(result.items).toHaveLength(2);
    expect(result.items[0].date).toBe('2026-10-15');
    expect(result.items[0].amountCents).toBe(76256);
    expect(result.items[0].type).toBe('EXPENSE');

    expect(result.items[1].date).toBe('2026-11-15');
    expect(result.items[1].amountCents).toBe(20700);
    expect(result.items[1].type).toBe('EXPENSE');
  });
});
