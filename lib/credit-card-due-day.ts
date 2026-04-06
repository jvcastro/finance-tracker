/**
 * Rough day-of-month heuristic: payment due is often ~20 days after the statement
 * closing day. Values stay in 1–31 (wraps within the month).
 */
export function defaultDueDayFromStatementDay(statementDay: number): number {
  const n = statementDay + 20;
  return n > 31 ? n - 31 : n;
}
