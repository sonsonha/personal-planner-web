import { PlannerApiError, requestJson } from "@/lib/planner-api";

export type FinanceBucket = "LIVING" | "SAFETY" | "GROWTH" | "FUN";
export type ExpenseCategoryKind = "ESSENTIAL" | "FIXED" | "DISCRETIONARY" | "OTHER";

export type FinanceAllocationSettings = {
  id: string;
  livingPct: number;
  safetyPct: number;
  growthPct: number;
  funPct: number;
  safetyTargetMonths: number;
  currency: string;
  revision: number;
  updatedAt: string;
};

export type FinanceIncomeSource = {
  id: string;
  name: string;
  active: boolean;
  sortOrder: number;
  revision: number;
  updatedAt: string;
};

export type FinanceExpenseCategory = {
  id: string;
  name: string;
  kind: string;
  recurrence: string;
  defaultBucket: string;
  active: boolean;
  sortOrder: number;
  isSystem: boolean;
  revision: number;
  updatedAt: string;
};

export type FinanceDebt = {
  id: string;
  name: string;
  outstandingVnd: number;
  monthlyRequiredVnd: number;
  borrowedAt: string | null;
  lastPaidAt: string | null;
  active: boolean;
  revision: number;
  updatedAt: string;
};

export type FinanceIncomeEntry = {
  id: string;
  sourceId: string;
  amountVnd: number;
  currency: string;
  receivedAt: string;
  note: string;
  createdAt: string;
  revision: number;
  updatedAt: string;
  allocations: Array<{ bucket: string; amountVnd: number; pctApplied: number }>;
};

export type FinanceExpenseEntry = {
  id: string;
  categoryId: string;
  amountVnd: number;
  currency: string;
  fundingBucket: string;
  spentAt: string;
  note: string;
  createdAt: string;
  revision: number;
  updatedAt: string;
};

export type FinanceDebtPayment = {
  id: string;
  debtId: string;
  amountVnd: number;
  currency: string;
  paidAt: string;
  note: string;
  createdAt: string;
  revision: number;
  updatedAt: string;
};

export type FinanceTransaction = {
  id: string;
  type: "income" | "expense" | "debt";
  amountVnd: number;
  occurredAt: string;
  createdAt: string;
  note: string;
  label: string;
  meta: Record<string, unknown>;
};

export type FinanceSummary = {
  month: string;
  currency: string;
  incomeVnd: number;
  spendingVnd: number;
  debtPaidVnd: number;
  netCashflowVnd: number;
  outstandingDebtVnd: number;
  monthlyDebtRequiredVnd: number;
  debtRemainingRequiredVnd: number;
  fixedExpensesVnd: number;
  deficitVnd: number;
  showDeficit: boolean;
  allocationRatePct: number;
  buckets: Array<{
    bucket: FinanceBucket;
    allocatedVnd: number;
    spentVnd: number;
    remainingVnd: number;
    pctOfIncome: number;
    targetPct: number;
    lifetimeBalanceVnd: number;
  }>;
  spendingByCategory: Array<{ categoryId: string; name: string; amountVnd: number }>;
  growthSpendingByCategory: Array<{ categoryId: string; name: string; amountVnd: number }>;
  previousMonth: {
    month: string;
    incomeVnd: number;
    spendingVnd: number;
    debtPaidVnd: number;
    netCashflowVnd: number;
  };
  debts: FinanceDebt[];
  settings: FinanceAllocationSettings;
};

export { PlannerApiError };

export function fetchFinanceSummary(month?: string) {
  const query = month ? `?month=${encodeURIComponent(month)}` : "";
  return requestJson<FinanceSummary>(`/api/finance/summary${query}`);
}

export function fetchAllocationSettings() {
  return requestJson<FinanceAllocationSettings>("/api/finance/allocation-settings");
}

export function updateAllocationSettings(input: {
  livingPct: number;
  safetyPct: number;
  growthPct: number;
  funPct: number;
  safetyTargetMonths?: 3 | 6 | 9 | 12;
  currency?: string;
}) {
  return requestJson<FinanceAllocationSettings>("/api/finance/allocation-settings", {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function fetchIncomeSources() {
  return requestJson<{ sources: FinanceIncomeSource[] }>("/api/finance/income-sources");
}

export function createIncomeSource(input: { name: string; sortOrder?: number }) {
  return requestJson<FinanceIncomeSource>("/api/finance/income-sources", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function patchIncomeSource(
  id: string,
  input: Partial<{ name: string; active: boolean; sortOrder: number }>,
) {
  return requestJson<FinanceIncomeSource>(`/api/finance/income-sources/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteIncomeSource(id: string) {
  return requestJson<{ id: string; deleted: boolean; deactivated?: boolean }>(
    `/api/finance/income-sources/${encodeURIComponent(id)}`,
    { method: "DELETE" },
  );
}

export function createIncomeEntry(input: {
  sourceId: string;
  amountVnd: number;
  receivedAt?: string;
  note?: string;
  allocations?: Array<{ bucket: FinanceBucket; amountVnd: number }>;
}) {
  return requestJson<FinanceIncomeEntry>("/api/finance/income-entries", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function patchIncomeEntry(
  id: string,
  input: Partial<{ sourceId: string; amountVnd: number; receivedAt: string; note: string }>,
) {
  return requestJson<FinanceIncomeEntry>(`/api/finance/income-entries/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteIncomeEntry(id: string) {
  return requestJson<{ id: string; deleted: true }>(
    `/api/finance/income-entries/${encodeURIComponent(id)}`,
    { method: "DELETE" },
  );
}

export function fetchExpenseCategories() {
  return requestJson<{ categories: FinanceExpenseCategory[] }>("/api/finance/expense-categories");
}

export function createExpenseCategory(input: {
  name: string;
  kind?: ExpenseCategoryKind;
  defaultBucket?: FinanceBucket;
  sortOrder?: number;
}) {
  return requestJson<FinanceExpenseCategory>("/api/finance/expense-categories", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function patchExpenseCategory(
  id: string,
  input: Partial<{
    name: string;
    kind: ExpenseCategoryKind;
    defaultBucket: FinanceBucket;
    active: boolean;
    sortOrder: number;
  }>,
) {
  return requestJson<FinanceExpenseCategory>(
    `/api/finance/expense-categories/${encodeURIComponent(id)}`,
    { method: "PATCH", body: JSON.stringify(input) },
  );
}

export function deleteExpenseCategory(id: string) {
  return requestJson<{ id: string; deleted: boolean; deactivated?: boolean }>(
    `/api/finance/expense-categories/${encodeURIComponent(id)}`,
    { method: "DELETE" },
  );
}

export function createExpenseEntry(input: {
  categoryId: string;
  amountVnd: number;
  spentAt?: string;
  note?: string;
  fundingBucket?: FinanceBucket;
}) {
  return requestJson<FinanceExpenseEntry>("/api/finance/expense-entries", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function patchExpenseEntry(
  id: string,
  input: Partial<{
    categoryId: string;
    amountVnd: number;
    spentAt: string;
    note: string;
    fundingBucket: FinanceBucket;
  }>,
) {
  return requestJson<FinanceExpenseEntry>(`/api/finance/expense-entries/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteExpenseEntry(id: string) {
  return requestJson<{ id: string; deleted: true }>(
    `/api/finance/expense-entries/${encodeURIComponent(id)}`,
    { method: "DELETE" },
  );
}

export function fetchDebts() {
  return requestJson<{ debts: FinanceDebt[] }>("/api/finance/debts");
}

export function createDebt(input: {
  name: string;
  outstandingVnd: number;
  monthlyRequiredVnd: number;
  borrowedAt?: string | null;
  lastPaidAt?: string | null;
}) {
  return requestJson<FinanceDebt>("/api/finance/debts", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function patchDebt(
  id: string,
  input: Partial<{
    name: string;
    outstandingVnd: number;
    monthlyRequiredVnd: number;
    borrowedAt: string | null;
    lastPaidAt: string | null;
    active: boolean;
  }>,
) {
  return requestJson<FinanceDebt>(`/api/finance/debts/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteDebt(id: string) {
  return requestJson<{ id: string; deleted: true }>(
    `/api/finance/debts/${encodeURIComponent(id)}`,
    { method: "DELETE" },
  );
}

export function createDebtPayment(input: {
  debtId: string;
  amountVnd: number;
  paidAt?: string;
  note?: string;
}) {
  return requestJson<FinanceDebtPayment>("/api/finance/debt-payments", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function patchDebtPayment(
  id: string,
  input: Partial<{ amountVnd: number; paidAt: string; note: string }>,
) {
  return requestJson<FinanceDebtPayment>(`/api/finance/debt-payments/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteDebtPayment(id: string) {
  return requestJson<{ id: string; deleted: true }>(
    `/api/finance/debt-payments/${encodeURIComponent(id)}`,
    { method: "DELETE" },
  );
}

export function fetchFinanceTransactions(opts: {
  type?: "all" | "income" | "expense" | "debt";
  month?: string;
  from?: string;
  to?: string;
  sourceId?: string;
  categoryId?: string;
  limit?: number;
} = {}) {
  const params = new URLSearchParams();
  if (opts.type) params.set("type", opts.type);
  if (opts.month) params.set("month", opts.month);
  if (opts.from) params.set("from", opts.from);
  if (opts.to) params.set("to", opts.to);
  if (opts.sourceId) params.set("sourceId", opts.sourceId);
  if (opts.categoryId) params.set("categoryId", opts.categoryId);
  if (opts.limit) params.set("limit", String(opts.limit));
  const q = params.toString();
  return requestJson<{ transactions: FinanceTransaction[] }>(
    `/api/finance/transactions${q ? `?${q}` : ""}`,
  );
}

export function formatVnd(amount: number): string {
  return `${new Intl.NumberFormat("vi-VN").format(amount)} VND`;
}

export function todayLocalDate(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function currentMonthKey(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
  }).format(new Date());
}

export function formatMonthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  if (!y || !m) return month;
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, 1)));
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export type TransactionsGrain = "day" | "week" | "month" | "year";

function addIsoDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number) as [number, number, number];
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

function monthDateBounds(month: string): { start: string; end: string } {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const start = `${month}-01`;
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const end = `${month}-${String(lastDay).padStart(2, "0")}`;
  return { start, end };
}

function weekDateBounds(anchorDate: string): { start: string; end: string } {
  const [y, m, d] = anchorDate.split("-").map(Number) as [number, number, number];
  const dt = new Date(Date.UTC(y, m - 1, d));
  const dow = dt.getUTCDay();
  const offsetToMon = dow === 0 ? -6 : 1 - dow;
  const start = addIsoDays(anchorDate, offsetToMon);
  return { start, end: addIsoDays(start, 6) };
}

export function resolveTransactionsPeriod(
  grain: TransactionsGrain,
  periodKey?: string,
): { grain: TransactionsGrain; periodKey: string; label: string; start: string; end: string } {
  const today = todayLocalDate();
  if (grain === "day") {
    const key = periodKey && /^\d{4}-\d{2}-\d{2}$/.test(periodKey) ? periodKey : today;
    const label = new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(`${key}T00:00:00Z`));
    return { grain, periodKey: key, label, start: key, end: key };
  }
  if (grain === "week") {
    const anchor = periodKey && /^\d{4}-\d{2}-\d{2}$/.test(periodKey) ? periodKey : today;
    const b = weekDateBounds(anchor);
    return {
      grain,
      periodKey: b.start,
      label: `${b.start} – ${b.end}`,
      start: b.start,
      end: b.end,
    };
  }
  if (grain === "month") {
    const key = periodKey && /^\d{4}-\d{2}$/.test(periodKey) ? periodKey : today.slice(0, 7);
    const b = monthDateBounds(key);
    return {
      grain,
      periodKey: key,
      label: formatMonthLabel(key),
      start: b.start,
      end: b.end,
    };
  }
  const key = periodKey && /^\d{4}$/.test(periodKey) ? periodKey : today.slice(0, 4);
  return {
    grain,
    periodKey: key,
    label: key,
    start: `${key}-01-01`,
    end: `${key}-12-31`,
  };
}

export function shiftTransactionsPeriod(grain: TransactionsGrain, periodKey: string, delta: number): string {
  if (grain === "day") return addIsoDays(periodKey, delta);
  if (grain === "week") return addIsoDays(periodKey, delta * 7);
  if (grain === "month") return shiftMonth(periodKey, delta);
  return String(Number(periodKey) + delta);
}

export function currentTransactionsPeriodKey(grain: TransactionsGrain): string {
  return resolveTransactionsPeriod(grain).periodKey;
}

export const BUCKET_LABELS: Record<FinanceBucket, string> = {
  LIVING: "Living & Fixed",
  SAFETY: "Safety",
  GROWTH: "Growth",
  FUN: "Fun",
};

export const BUCKET_ORDER: FinanceBucket[] = ["LIVING", "SAFETY", "GROWTH", "FUN"];

export type AnalyticsGrain = "week" | "month" | "quarter" | "year";

export type FinanceAnalytics = {
  grain: AnalyticsGrain;
  periodKey: string;
  label: string;
  start: string;
  end: string;
  previousPeriodKey: string;
  currency: string;
  summary: {
    incomeVnd: number;
    expensesVnd: number;
    debtPaidVnd: number;
    netCashflowVnd: number;
    livingUsageVnd: number;
    growthUsageVnd: number;
    safetyAllocatedVnd: number;
    funUsageVnd: number;
  };
  planVsActual: Array<{
    bucket: FinanceBucket;
    targetVnd: number;
    targetPctOfIncome: number | null;
    allocatedVnd: number;
    allocatedPctOfIncome: number | null;
    usedExpenseVnd: number;
    usagePctOfIncome: number | null;
    varianceVsAllocationVnd: number;
    varianceVsTargetVnd: number;
    incomeAllocatedVnd: number;
    reallocInVnd: number;
    reallocOutVnd: number;
    debtWithdrawalsVnd: number;
    netChangeVnd: number;
    lifetimeBalanceVnd: number;
  }>;
  rates: {
    livingUsageRatePct: number | null;
    growthAllocationRatePct: number | null;
    growthUsageRatePct: number | null;
    safetyAllocationRatePct: number | null;
    funUsageRatePct: number | null;
  };
  spendingByCategory: Array<{
    categoryId: string;
    name: string;
    amountVnd: number;
    kind: string;
    recurrence: string;
    pctOfExpenses: number | null;
    previousAmountVnd: number;
    deltaVnd: number;
    deltaPct: number | null;
  }>;
  growthBreakdown: Array<{
    group: string;
    amountVnd: number;
    pctOfGrowthUsage: number | null;
  }>;
  incomeBySource: Array<{
    sourceId: string;
    name: string;
    amountVnd: number;
    pctOfIncome: number | null;
    previousAmountVnd: number;
    deltaVnd: number;
    deltaPct: number | null;
  }>;
  incomeConcentrationPct: number | null;
  cashflowTrend: {
    seriesGrain: "day" | "month";
    points: Array<{
      key: string;
      label: string;
      incomeVnd: number;
      expensesVnd: number;
      debtPaidVnd: number;
      netCashflowVnd: number;
    }>;
  };
  debt: {
    openingOutstandingVnd: number;
    paymentsVnd: number;
    closingOutstandingVnd: number;
    monthlyRequiredVnd: number;
    remainingRequiredVnd: number;
    openingAssumption: string;
    trend: Array<{ key: string; label: string; debtPaidVnd: number }>;
  };
  resilience: {
    coreMonthlyBurnVnd: number;
    fixedEssentialVnd: number;
    variableEssentialAvgVnd: number;
    safetyBalanceVnd: number;
    safetyTargetMonths: number;
    safetyTargetAmountVnd: number;
    safetyRunwayMonths: number | null;
    safetyTargetProgressPct: number | null;
    mandatoryObligationsVnd: number;
    projectedSurplusVnd: number;
  };
  comparison: {
    periodKey: string;
    previousPeriodKey: string;
    previousLabel: string;
    income: { currentVnd: number; previousVnd: number; deltaVnd: number; deltaPct: number | null };
    expenses: { currentVnd: number; previousVnd: number; deltaVnd: number; deltaPct: number | null };
    debtPaid: { currentVnd: number; previousVnd: number; deltaVnd: number; deltaPct: number | null };
    netCashflow: { currentVnd: number; previousVnd: number; deltaVnd: number; deltaPct: number | null };
    livingUsage: { currentVnd: number; previousVnd: number; deltaVnd: number; deltaPct: number | null };
    growthAllocated: { currentVnd: number; previousVnd: number; deltaVnd: number; deltaPct: number | null };
    funUsage: { currentVnd: number; previousVnd: number; deltaVnd: number; deltaPct: number | null };
  };
  insights: string[];
  weekPace: {
    enclosingMonth: string;
    monthElapsedPct: number | null;
    livingUsedOfMonthAllocatedPct: number | null;
  } | null;
  navigation: {
    previousPeriodKey: string;
    nextPeriodKey: string;
    currentPeriodKey: string;
  };
};

export function fetchFinanceAnalytics(grain: AnalyticsGrain, period?: string) {
  const params = new URLSearchParams({ grain });
  if (period) params.set("period", period);
  return requestJson<FinanceAnalytics>(`/api/finance/analytics?${params.toString()}`);
}

/** Client-side preview matching backend allocateAmountVnd (remainder → Fun). */
export function previewAllocationAmounts(
  amountVnd: number,
  pcts: { livingPct: number; safetyPct: number; growthPct: number; funPct: number },
): Record<FinanceBucket, number> {
  if (!Number.isFinite(amountVnd) || amountVnd < 0) {
    return { LIVING: 0, SAFETY: 0, GROWTH: 0, FUN: 0 };
  }
  const n = Math.floor(amountVnd);
  const living = Math.floor((n * pcts.livingPct) / 100);
  const safety = Math.floor((n * pcts.safetyPct) / 100);
  const growth = Math.floor((n * pcts.growthPct) / 100);
  const fun = n - living - safety - growth;
  return { LIVING: living, SAFETY: safety, GROWTH: growth, FUN: fun };
}
