import { describe, it, expect } from 'vitest';
import { Money } from '../../src/core/value-objects/money.js';

describe('Money Value Object', () => {
  it('converte valor float em reais para centavos inteiros com precisão', () => {
    expect(Money.fromReal(1250.5)).toBe(125050);
    expect(Money.fromReal(0.1 + 0.2)).toBe(30); // Elimina o erro clássico 0.30000000000000004
    expect(Money.fromReal(99.99)).toBe(9999);
  });

  it('converte string formatada em reais para centavos inteiros', () => {
    expect(Money.fromReal('R$ 1.250,50')).toBe(125050);
    expect(Money.fromReal('3500')).toBe(350000);
    expect(Money.fromReal(' 45,90 ')).toBe(4590);
  });

  it('converte centavos para valor float em reais', () => {
    expect(Money.toReal(125050)).toBe(1250.5);
    expect(Money.toReal(30)).toBe(0.3);
  });

  it('divide parcelas com precisão e preserva soma total exata com centavo de resto', () => {
    // R$ 100,00 em 3x (10000 centavos / 3) -> 3334, 3333, 3333 = 10000
    const parts = Money.splitInstallments(10000, 3);
    expect(parts).toEqual([3334, 3333, 3333]);
    const sum = parts.reduce((acc, curr) => acc + curr, 0);
    expect(sum).toBe(10000);
  });

  it('divide parcelas perfeitamente divisíveis', () => {
    const parts = Money.splitInstallments(120000, 3); // R$ 1.200 em 3x
    expect(parts).toEqual([40000, 40000, 40000]);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(120000);
  });
});
