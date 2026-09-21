/**
 * Utilitário de precisão monetária em centavos inteiros (Evita problemas com IEEE 754 float).
 */
export class Money {
  /**
   * Converte valor em reais (float ou string "1234.56" / "1.234,56") para centavos inteiros.
   */
  static fromReal(value: number | string): number {
    if (typeof value === 'number') {
      return Math.round(value * 100);
    }
    const raw = value.replace(/\s+/g, '').replace(/R\$/g, '');
    const parsed = parseFloat(Money.normalizeDecimal(raw));
    if (isNaN(parsed)) {
      throw new Error(`Valor monetário inválido: "${value}"`);
    }
    return Math.round(parsed * 100);
  }

  /**
   * Normaliza "1.234,56", "1,234.56", "45.90" ou "1.234" para o formato "1234.56".
   * Com os dois separadores, o último é o decimal. Só com pontos, o ponto é decimal
   * quando há um único seguido de 1–2 dígitos; caso contrário é separador de milhar.
   */
  static normalizeDecimal(raw: string): string {
    const lastComma = raw.lastIndexOf(',');
    const lastDot = raw.lastIndexOf('.');
    if (lastComma >= 0 && lastDot >= 0) {
      return lastComma > lastDot
        ? raw.replace(/\./g, '').replace(',', '.')
        : raw.replace(/,/g, '');
    }
    if (lastComma >= 0) {
      return raw.replace(',', '.');
    }
    if (/^[+-]?\d+\.\d{1,2}$/.test(raw)) {
      return raw;
    }
    return raw.replace(/\./g, '');
  }

  /**
   * Converte centavos inteiros para número em reais (float com duas casas).
   */
  static toReal(cents: number): number {
    return cents / 100;
  }

  /**
   * Formata centavos inteiros como string padrão BRL: "R$ 1.250,50".
   */
  static format(cents: number): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(cents / 100);
  }

  /**
   * Divide um valor total em N parcelas exatas em centavos.
   * Se houver sobras na divisão, o centavo de diferença é atribuído à 1ª parcela,
   * garantindo que a soma de todas as parcelas seja exatamente igual ao total_amount_cents.
   *
   * Exemplo: R$ 100,00 (10000 centavos) em 3x:
   * 10000 / 3 = 3333 com resto 1.
   * Parcela 1: 3334 centavos (R$ 33,34)
   * Parcela 2: 3333 centavos (R$ 33,33)
   * Parcela 3: 3333 centavos (R$ 33,33)
   * Total somado: 10000 centavos (R$ 100,00 exatos).
   */
  static splitInstallments(totalCents: number, count: number): number[] {
    if (count <= 0) {
      throw new Error('Quantidade de parcelas deve ser maior que zero');
    }
    const baseAmount = Math.floor(totalCents / count);
    const remainder = totalCents % count;

    const parts: number[] = [];
    for (let i = 0; i < count; i++) {
      // Distribui o resto nos primeiros índices
      const part = baseAmount + (i < remainder ? 1 : 0);
      parts.push(part);
    }
    return parts;
  }
}
