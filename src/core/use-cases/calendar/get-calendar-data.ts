import {
  CalendarMonthData,
  CalendarDay,
  CalendarEvent,
} from '../../domain/calendar.js';
import {
  ITransactionRepository,
  IRecurringRuleRepository,
} from '../../domain/repositories.js';
import { ProcessRecurringInstancesUseCase } from '../recurring/process-recurring-instances.js';
import { DateUtils } from '../../utils/date-utils.js';

export class GetCalendarDataUseCase {
  private processRecurring: ProcessRecurringInstancesUseCase;

  constructor(
    private transactionRepo: ITransactionRepository,
    private recurringRepo: IRecurringRuleRepository
  ) {
    this.processRecurring = new ProcessRecurringInstancesUseCase(
      recurringRepo,
      transactionRepo
    );
  }

  execute(yearMonth?: string): CalendarMonthData {
    const todayStr = new Date().toISOString().slice(0, 10);
    const targetYM = yearMonth || DateUtils.getYearMonth(todayStr);

    // Instancia despesas fixas para o mês caso ainda não tenham sido
    this.processRecurring.execute(targetYM);

    const [yearStr, monthStr] = targetYM.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);

    const firstDayDate = new Date(year, month - 1, 1);
    const firstDayOfWeek = firstDayDate.getDay(); // 0 = Domingo
    const lastDayNum = new Date(year, month, 0).getDate();

    const startDate = `${targetYM}-01`;
    const endDate = `${targetYM}-${String(lastDayNum).padStart(2, '0')}`;

    const transactions = this.transactionRepo
      .list({ startDate, endDate })
      .filter((t) => t.status !== 'CANCELLED');

    // Mapeia eventos por dia
    const eventsByDay = new Map<string, CalendarEvent[]>();
    for (const tx of transactions) {
      const list = eventsByDay.get(tx.date) || [];
      list.push({
        id: tx.id,
        description: tx.description,
        amountCents: tx.amountCents,
        type: tx.type,
        status: tx.status,
        isRecurring: !!tx.recurringRuleId,
        isInstallment: !!tx.installmentId,
        categoryName: tx.categoryName,
        categoryColor: tx.categoryColor,
      });
      eventsByDay.set(tx.date, list);
    }

    const days: CalendarDay[] = [];
    let totalIncomeMonthCents = 0;
    let totalExpenseMonthCents = 0;

    for (let d = 1; d <= lastDayNum; d++) {
      const dayDate = `${targetYM}-${String(d).padStart(2, '0')}`;
      const dayEvents = eventsByDay.get(dayDate) || [];

      let dayIncome = 0;
      let dayExpense = 0;

      for (const ev of dayEvents) {
        if (ev.type === 'INCOME') {
          dayIncome += ev.amountCents;
        } else {
          dayExpense += ev.amountCents;
        }
      }

      totalIncomeMonthCents += dayIncome;
      totalExpenseMonthCents += dayExpense;

      days.push({
        date: dayDate,
        dayNumber: d,
        isToday: dayDate === todayStr,
        events: dayEvents,
        totalIncomeCents: dayIncome,
        totalExpenseCents: dayExpense,
      });
    }

    return {
      yearMonth: targetYM,
      year,
      month,
      firstDayOfWeek,
      daysInMonth: lastDayNum,
      days,
      totalIncomeMonthCents,
      totalExpenseMonthCents,
    };
  }
}
