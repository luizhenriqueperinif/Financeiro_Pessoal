import React from 'react';

/** "2000000" (centavos digitados) → "20.000,00". */
export function formatCentsInput(digits: string): string {
  const clean = digits.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
  if (!clean) return '';
  const cents = clean.padStart(3, '0');
  const integer = cents.slice(0, -2).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${integer},${cents.slice(-2)}`;
}

interface MoneyInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'prefix'> {
  value: string;
  onChange: (formatted: string) => void;
  /** Mostra "R$" dentro do campo (desligue em células estreitas de tabela). */
  showPrefix?: boolean;
}

/**
 * Campo de valor em reais que formata enquanto digita: 2 → 0,02; 2000000 → 20.000,00.
 * O valor devolvido está no formato brasileiro, aceito por Money.fromReal.
 */
export const MoneyInput: React.FC<MoneyInputProps> = ({ value, onChange, className, showPrefix = true, ...rest }) => (
  <div className="relative">
    {showPrefix && (
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 pointer-events-none">R$</span>
    )}
    <input
      {...rest}
      type="text"
      inputMode="numeric"
      value={value}
      onChange={(e) => onChange(formatCentsInput(e.target.value))}
      className={`${className ?? ''} ${showPrefix ? 'pl-9' : ''} text-right tabular-nums`}
    />
  </div>
);
