import { describe, it, expect } from 'vitest';
import { formatCentsInput } from '../../src/ui/components/MoneyInput.js';
import { Money } from '../../src/core/value-objects/money.js';

describe('Campo de valor formatado', () => {
  it('formata os dígitos como centavos enquanto a pessoa digita', () => {
    expect(formatCentsInput('2')).toBe('0,02');
    expect(formatCentsInput('60000')).toBe('600,00');
    expect(formatCentsInput('2000000')).toBe('20.000,00');
    expect(formatCentsInput('20.000,005')).toBe('200.000,05');
    expect(formatCentsInput('')).toBe('');
  });

  it('produz um texto que o app converte de volta para o mesmo valor', () => {
    expect(Money.fromReal(formatCentsInput('2000000'))).toBe(2000000);
    expect(Money.fromReal(formatCentsInput('46000'))).toBe(46000);
  });
});
