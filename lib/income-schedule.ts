import { endOfMonth, startOfMonth } from "date-fns";

/** Minimal stream fields needed to compute pay dates. */
export type StreamLike = {
  sourceType: string;
  salaryPaySchedule: string | null;
  startDate: Date;
  endDate: Date | null;
  paymentDay: number;
  secondPaymentDay: number | null;
};

export function atNoonLocal(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0, 0);
}

function streamOverlapsRange(
  streamStart: Date,
  streamEnd: Date | null,
  rangeStart: Date,
  rangeEnd: Date,
) {
  return streamStart <= rangeEnd && (streamEnd === null || streamEnd >= rangeStart);
}

function clampDayToMonth(year: number, monthIndex: number, day: number): Date {
  const last = new Date(year, monthIndex + 1, 0).getDate();
  const dom = Math.min(day, last);
  return atNoonLocal(new Date(year, monthIndex, dom));
}

function isPayInStreamWindow(pay: Date, stream: StreamLike): boolean {
  if (pay < stream.startDate) return false;
  if (stream.endDate && pay > stream.endDate) return false;
  return true;
}

/** First calendar date for a one-off pay (payment day on or after stream start). */
function getOneOffPaymentDate(stream: StreamLike): Date | null {
  const day = stream.paymentDay;
  let y = stream.startDate.getFullYear();
  let m = stream.startDate.getMonth();
  for (let i = 0; i < 120; i++) {
    const pay = clampDayToMonth(y, m, day);
    if (pay < stream.startDate) {
      m += 1;
      if (m > 11) {
        m = 0;
        y += 1;
      }
      continue;
    }
    if (stream.endDate && pay > stream.endDate) return null;
    return pay;
  }
  return null;
}

/**
 * Pay dates for this stream that fall inside [monthStart, monthEnd] (calendar month),
 * using explicit payment day(s), not startDate’s day-of-month.
 *
 * - Project/other: one pay per month on `paymentDay`.
 * - Salary MONTHLY: same.
 * - Salary BI_WEEKLY: two pays on `paymentDay` and `secondPaymentDay` (e.g. 15 & 30).
 * - Salary ONE_OFF: a single pay on the first `paymentDay` on or after `startDate`.
 */
export function getPaymentDatesForStream(
  stream: StreamLike,
  monthStart: Date,
  monthEnd: Date,
): Date[] {
  const ms = startOfMonth(monthStart);
  const me = endOfMonth(monthEnd);

  if (!streamOverlapsRange(stream.startDate, stream.endDate, ms, me)) {
    return [];
  }

  const y = ms.getFullYear();
  const m = ms.getMonth();

  if (stream.sourceType !== "SALARY" || !stream.salaryPaySchedule) {
    const pay = clampDayToMonth(y, m, stream.paymentDay);
    if (pay >= ms && pay <= me && isPayInStreamWindow(pay, stream)) {
      return [pay];
    }
    return [];
  }

  switch (stream.salaryPaySchedule) {
    case "MONTHLY": {
      const pay = clampDayToMonth(y, m, stream.paymentDay);
      if (pay < ms || pay > me) return [];
      if (!isPayInStreamWindow(pay, stream)) return [];
      return [pay];
    }
    case "BI_WEEKLY": {
      const second = stream.secondPaymentDay;
      if (second == null) return [];
      const days = [stream.paymentDay, second].sort((a, b) => a - b);
      const uniq = [...new Set(days)];
      const dates: Date[] = [];
      for (const day of uniq) {
        const pay = clampDayToMonth(y, m, day);
        if (pay >= ms && pay <= me && isPayInStreamWindow(pay, stream)) {
          dates.push(pay);
        }
      }
      return dates;
    }
    case "ONE_OFF": {
      const one = getOneOffPaymentDate(stream);
      if (!one) return [];
      if (one >= ms && one <= me) return [one];
      return [];
    }
    default:
      return [];
  }
}

export function sumExpectedIncomeFromStreamsInMonth(
  streams: Array<{ amount: unknown } & StreamLike>,
  monthStart: Date,
  monthEnd: Date,
): number {
  return streams.reduce((sum, stream) => {
    const dates = getPaymentDatesForStream(stream, monthStart, monthEnd);
    return sum + dates.length * Number(stream.amount);
  }, 0);
}
