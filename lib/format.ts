/** Default ISO 4217 code for new users and fallbacks. */
export const DEFAULT_CURRENCY = "PHP";

function currencyLocale(currencyCode: string): string | undefined {
  const c = currencyCode.toUpperCase();
  if (c === "PHP") return "en-PH";
  return undefined;
}

/** Symbol for UI labels (e.g. amount fields, table headers). */
export function getCurrencySymbol(currencyCode: string): string {
  const code = currencyCode.toUpperCase();
  try {
    return (
      new Intl.NumberFormat(currencyLocale(code), {
        style: "currency",
        currency: code,
        currencyDisplay: "narrowSymbol",
      })
        .formatToParts(0)
        .find((p) => p.type === "currency")?.value ?? code
    );
  } catch {
    return code;
  }
}

export function formatCurrency(amount: number, currency: string = DEFAULT_CURRENCY) {
  const code = currency.toUpperCase();
  try {
    return new Intl.NumberFormat(currencyLocale(code), {
      style: "currency",
      currency: code,
      currencyDisplay: "narrowSymbol",
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: code,
      maximumFractionDigits: 2,
    }).format(amount);
  }
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

