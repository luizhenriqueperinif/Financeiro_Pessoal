import { beforeEach, afterEach, vi } from 'vitest';

// Os testes usam datas fixas em setembro/2026; congela o relógio para que
// status derivados da data atual (ex.: OVERDUE) não dependam do dia da execução.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 8, 1, 12, 0, 0));
});

afterEach(() => {
  vi.useRealTimers();
});
