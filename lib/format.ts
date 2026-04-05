export function formatCurrency(amount: number, currency = "USD") {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(d: Date | string) {
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
  }).format(date);
}

/** Income validity window: start through end, or “Ongoing” when end is null. */
export function formatIncomePeriod(
  start: Date | string,
  end: Date | string | null | undefined,
) {
  const startStr = formatDate(start);
  if (end == null) {
    return `${startStr} → Ongoing`;
  }
  return `${startStr} – ${formatDate(end)}`;
}

