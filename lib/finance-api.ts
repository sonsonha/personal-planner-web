import { PlannerApiError, requestJson } from "@/lib/planner-api";

export type FinanceBucket = "LIVING" | "SAFETY" | "COMPOUND" | "OPPORTUNITY";
export type ExpenseCategoryKind = "ESSENTIAL" | "FIXED" | "DISCRETIONARY" | "OTHER";

export type FinanceAllocationSettings = {
  id: string;
  livingPct: number;
  safetyPct: number;
  compoundPct: number;
  opportunityPct: number;
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
    lifetimeBalanceVnd: number;
  }>;
  spendingByCategory: Array<{ categoryId: string; name: string; amountVnd: number }>;
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
  compoundPct: number;
  opportunityPct: number;
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
  sourceId?: string;
  categoryId?: string;
  limit?: number;
} = {}) {
  const params = new URLSearchParams();
  if (opts.type) params.set("type", opts.type);
  if (opts.month) params.set("month", opts.month);
  if (opts.sourceId) params.set("sourceId", opts.sourceId);
  if (opts.categoryId) params.set("categoryId", opts.categoryId);
  if (opts.limit) params.set("limit", String(opts.limit));
  const q = params.toString();
  return requestJson<{ transactions: FinanceTransaction[] }>(
    `/api/finance/transactions${q ? `?${q}` : ""}`,
  );
}

export function formatVnd(amount: number): string {
  return new Intl.NumberFormat("vi-VN").format(amount) + "₫";
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

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export const BUCKET_LABELS: Record<FinanceBucket, string> = {
  LIVING: "Living",
  SAFETY: "Safety",
  COMPOUND: "Compound",
  OPPORTUNITY: "Opportunity",
};
