/**
 * Utilitários para manipulação segura de datas contábeis no formato YYYY-MM-DD.
 */
export class DateUtils {
  /**
   * Data de hoje (YYYY-MM-DD) no fuso local. Não use toISOString(), que é UTC
   * e no Brasil já vira o dia seguinte a partir das 21h.
   */
  static today(): string {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${now.getFullYear()}-${month}-${day}`;
  }

  /**
   * Mês corrente (YYYY-MM) no fuso local.
   */
  static currentYearMonth(): string {
    return DateUtils.today().slice(0, 7);
  }

  /**
   * Adiciona N meses a uma data inicial (YYYY-MM-DD), preservando o dia do mês
   * ou ajustando para o último dia caso o mês de destino seja mais curto.
   *
   * Exemplo:
   * addMonthsPreservingDay('2026-01-31', 1) => '2026-02-28' (ou 29)
   * addMonthsPreservingDay('2026-08-31', 1) => '2026-09-30'
   */
  static addMonthsPreservingDay(dateStr: string, monthsToAdd: number): string {
    const [yearStr, monthStr, dayStr] = dateStr.split('-');
    const origYear = parseInt(yearStr, 10);
    const origMonth = parseInt(monthStr, 10) - 1; // 0-indexed no JS Date
    const origDay = parseInt(dayStr, 10);

    // Calcula o ano e mês alvo
    const targetDateObj = new Date(origYear, origMonth + monthsToAdd, 1);
    const targetYear = targetDateObj.getFullYear();
    const targetMonth = targetDateObj.getMonth();

    // Descobre o último dia do mês alvo
    const lastDayOfTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
    const safeDay = Math.min(origDay, lastDayOfTargetMonth);

    const formattedMonth = String(targetMonth + 1).padStart(2, '0');
    const formattedDay = String(safeDay).padStart(2, '0');

    return `${targetYear}-${formattedMonth}-${formattedDay}`;
  }

  /**
   * Retorna o ano e mês no formato YYYY-MM a partir de uma data YYYY-MM-DD.
   */
  static getYearMonth(dateStr: string): string {
    return dateStr.slice(0, 7);
  }

  /**
   * Retorna os próximos N meses a partir de uma data ou mês de referência (inclusive).
   * Retorna array de strings: ['2026-09', '2026-10', '2026-11', ...]
   */
  static getNextMonths(startYearMonth: string, count: number): string[] {
    const [yStr, mStr] = startYearMonth.split('-');
    let y = parseInt(yStr, 10);
    let m = parseInt(mStr, 10);

    const months: string[] = [];
    for (let i = 0; i < count; i++) {
      months.push(`${y}-${String(m).padStart(2, '0')}`);
      m++;
      if (m > 12) {
        m = 1;
        y++;
      }
    }
    return months;
  }

  /**
   * Retorna o total de dias de um mês no formato YYYY-MM.
   */
  static getDaysInMonth(yearMonth: string): number {
    const [yStr, mStr] = yearMonth.split('-');
    const year = parseInt(yStr, 10);
    const month = parseInt(mStr, 10);
    return new Date(year, month, 0).getDate();
  }

  /**
   * Retorna a diferença em dias entre dateA e dateB (dateA - dateB) em dias inteiros.
   */
  static diffInDays(dateA: string, dateB: string): number {
    const msA = new Date(`${dateA}T00:00:00Z`).getTime();
    const msB = new Date(`${dateB}T00:00:00Z`).getTime();
    return Math.round((msA - msB) / (1000 * 60 * 60 * 24));
  }
}
