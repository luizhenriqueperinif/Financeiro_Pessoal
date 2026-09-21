import { describe, it, expect, vi } from 'vitest';
import { DateUtils } from '../../src/core/utils/date-utils.js';

describe('DateUtils.today', () => {
  it('usa a data do calendário local, mesmo à noite quando o UTC já virou o dia', () => {
    vi.setSystemTime(new Date(2026, 8, 21, 23, 30, 0));
    expect(DateUtils.today()).toBe('2026-09-21');
  });

  it('retorna o mês local corrente no último dia do mês à noite', () => {
    vi.setSystemTime(new Date(2026, 8, 30, 23, 59, 0));
    expect(DateUtils.currentYearMonth()).toBe('2026-09');
  });
});
