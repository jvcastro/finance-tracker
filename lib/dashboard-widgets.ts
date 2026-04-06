/**
 * Dashboard section IDs for visibility (stored in AppSettings.dashboardWidgets).
 * Omitted keys default to visible (`true`).
 */
export const DASHBOARD_WIDGET_IDS = [
  "overview",
  "needThisMonth",
  "reminders",
  "tagByTag",
  "incomeOutlook",
  "cashFlow",
  "insights",
  "recentLists",
] as const;

export type DashboardWidgetId = (typeof DASHBOARD_WIDGET_IDS)[number];

export type DashboardWidgetsState = Record<DashboardWidgetId, boolean>;

const DEFAULTS: DashboardWidgetsState = Object.fromEntries(
  DASHBOARD_WIDGET_IDS.map((id) => [id, true]),
) as DashboardWidgetsState;

/** Merge DB JSON with defaults; invalid values are ignored. */
export function parseDashboardWidgets(json: unknown): DashboardWidgetsState {
  const out = { ...DEFAULTS };
  if (!json || typeof json !== "object" || Array.isArray(json)) return out;
  const o = json as Record<string, unknown>;
  for (const id of DASHBOARD_WIDGET_IDS) {
    if (typeof o[id] === "boolean") {
      out[id] = o[id];
    }
  }
  return out;
}

export const DASHBOARD_WIDGET_LABEL: Record<DashboardWidgetId, string> = {
  overview: "Overview (top stats)",
  needThisMonth: "Need this month",
  reminders: "Reminders (overdue & due soon)",
  tagByTag: "Income & expenses by tag",
  incomeOutlook: "Income outlook (12 months)",
  cashFlow: "Cash flow trend & income breakdown",
  insights: "Savings rate, outflow load, lifetime",
  recentLists: "Recent income & expenses",
};

export function mergeDashboardWidgetPatch(
  existingJson: unknown,
  patch: Partial<Record<DashboardWidgetId, boolean>>,
): DashboardWidgetsState {
  const base = parseDashboardWidgets(existingJson);
  for (const id of DASHBOARD_WIDGET_IDS) {
    if (typeof patch[id] === "boolean") {
      base[id] = patch[id];
    }
  }
  return base;
}
