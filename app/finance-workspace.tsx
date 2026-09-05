"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  BUCKET_LABELS,
  createDebt,
  createDebtPayment,
  createExpenseEntry,
  createIncomeEntry,
  createIncomeSource,
  currentMonthKey,
  deleteDebtPayment,
  deleteExpenseEntry,
  deleteIncomeEntry,
  fetchDebts,
  fetchExpenseCategories,
  fetchFinanceSummary,
  fetchFinanceTransactions,
  fetchIncomeSources,
  formatVnd,
  patchDebtPayment,
  patchExpenseEntry,
  patchIncomeEntry,
  PlannerApiError,
  shiftMonth,
  todayLocalDate,
  updateAllocationSettings,
  type FinanceBucket,
  type FinanceDebt,
  type FinanceExpenseCategory,
  type FinanceIncomeSource,
  type FinanceSummary,
  type FinanceTransaction,
} from "@/lib/finance-api";

type Props = {
  live: boolean;
  onChanged: (message: string) => void;
};

type Modal =
  | { kind: "income"; source: FinanceIncomeSource }
  | { kind: "expense" }
  | { kind: "debt-pay" }
  | { kind: "settings" }
  | { kind: "edit"; tx: FinanceTransaction }
  | null;

function parseAmountInput(raw: string): number | null {
  const cleaned = raw.replace(/[^\d]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function FinanceWorkspace({ live, onChanged }: Props) {
  const [month, setMonth] = useState(currentMonthKey);
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [sources, setSources] = useState<FinanceIncomeSource[]>([]);
  const [categories, setCategories] = useState<FinanceExpenseCategory[]>([]);
  const [debts, setDebts] = useState<FinanceDebt[]>([]);
  const [transactions, setTransactions] = useState<FinanceTransaction[]>([]);
  const [txFilter, setTxFilter] = useState<"all" | "income" | "expense" | "debt">("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<Modal>(null);
  const [saving, setSaving] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const reload = useCallback(() => setReloadKey((v) => v + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      fetchFinanceSummary(month),
      fetchIncomeSources(),
      fetchExpenseCategories(),
      fetchDebts(),
      fetchFinanceTransactions({ type: txFilter, month, limit: 80 }),
    ])
      .then(([sum, src, cats, debtRes, tx]) => {
        if (cancelled) return;
        setSummary(sum);
        setSources(src.sources.filter((s) => s.active));
        setCategories(cats.categories.filter((c) => c.active));
        setDebts(debtRes.debts.filter((d) => d.active));
        setTransactions(tx.transactions);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof PlannerApiError ? err.message : "Could not load finance data");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [month, txFilter, reloadKey]);

  const activeSources = useMemo(() => sources, [sources]);

  return (
    <section className="gp-workspace gp-workspace-overview pos-finance" aria-label="Finance">
      <div className="pos-finance-toolbar">
        <div className="pos-finance-month">
          <button type="button" className="pos-btn-ghost" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Previous month">
            ‹
          </button>
          <strong className="pos-mono">{month}</strong>
          <button type="button" className="pos-btn-ghost" onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Next month">
            ›
          </button>
          <button type="button" className="pos-btn-ghost" onClick={() => setMonth(currentMonthKey())}>
            This month
          </button>
        </div>
        <div className="pos-finance-actions">
          <button type="button" className="pos-btn-secondary" onClick={() => setModal({ kind: "expense" })} disabled={!live}>
            + Expense
          </button>
          <button type="button" className="pos-btn-secondary" onClick={() => setModal({ kind: "debt-pay" })} disabled={!live || debts.length === 0}>
            + Debt payment
          </button>
          <button type="button" className="pos-btn-ghost" onClick={() => setModal({ kind: "settings" })}>
            Settings
          </button>
        </div>
      </div>

      {error && <p className="pos-entity-form-error">{error}</p>}
      {loading && !summary && <p className="pos-muted">Loading finance…</p>}

      {summary && (
        <>
          {summary.showDeficit && (
            <div className="pos-finance-deficit" role="status">
              <strong>Deficit signal</strong>
              <span>
                Income {formatVnd(summary.incomeVnd)} is below required debt payments{" "}
                {formatVnd(summary.monthlyDebtRequiredVnd)}
                {summary.deficitVnd < 0 ? ` (${formatVnd(summary.deficitVnd)})` : ""}.
              </span>
            </div>
          )}

          <div className="pos-finance-metrics">
            <Metric label="Income" value={formatVnd(summary.incomeVnd)} />
            <Metric label="Spending" value={formatVnd(summary.spendingVnd)} />
            <Metric label="Debt paid" value={formatVnd(summary.debtPaidVnd)} />
            <Metric
              label="Net cashflow"
              value={formatVnd(summary.netCashflowVnd)}
              tone={summary.netCashflowVnd < 0 ? "warn" : "ok"}
            />
            <Metric label="Outstanding debt" value={formatVnd(summary.outstandingDebtVnd)} />
            <Metric
              label="Debt due this month"
              value={`${formatVnd(summary.debtPaidVnd)} / ${formatVnd(summary.monthlyDebtRequiredVnd)}`}
            />
          </div>

          <div className="pos-finance-compare pos-muted">
            vs {summary.previousMonth.month}: income {formatVnd(summary.previousMonth.incomeVnd)},
            spend {formatVnd(summary.previousMonth.spendingVnd)},
            net {formatVnd(summary.previousMonth.netCashflowVnd)}
          </div>

          <h3 className="pos-finance-section-title">Allocation buckets</h3>
          <p className="pos-muted pos-finance-lede">
            Personal allocation framework — Living, Safety, Compound, Opportunity. Allocations are not expenses.
          </p>
          <div className="pos-finance-buckets">
            {summary.buckets.map((b) => (
              <div key={b.bucket} className="pos-finance-bucket-card">
                <div className="pos-finance-bucket-head">
                  <strong>{BUCKET_LABELS[b.bucket]}</strong>
                  <span className="pos-muted">{b.pctOfIncome}% of income</span>
                </div>
                <div className="pos-mono pos-finance-bucket-main">{formatVnd(b.remainingVnd)}</div>
                <div className="pos-muted pos-finance-bucket-sub">
                  Allocated {formatVnd(b.allocatedVnd)} · Used {formatVnd(b.spentVnd)}
                </div>
                <div className="pos-muted pos-finance-bucket-sub">
                  Lifetime {formatVnd(b.lifetimeBalanceVnd)}
                </div>
              </div>
            ))}
          </div>

          <h3 className="pos-finance-section-title">Income sources</h3>
          <div className="pos-finance-sources">
            {activeSources.length === 0 && (
              <p className="pos-muted">No income sources yet — add one in Settings.</p>
            )}
            {activeSources.map((source) => (
              <button
                key={source.id}
                type="button"
                className="pos-finance-source-card"
                disabled={!live}
                onClick={() => setModal({ kind: "income", source })}
              >
                <strong>{source.name}</strong>
                <span>Tap to record income</span>
              </button>
            ))}
          </div>

          <div className="pos-finance-two-col">
            <div>
              <h3 className="pos-finance-section-title">Spending by category</h3>
              {summary.spendingByCategory.length === 0 ? (
                <p className="pos-muted">No expenses this month.</p>
              ) : (
                <ul className="pos-finance-cat-list">
                  {summary.spendingByCategory.map((c) => (
                    <li key={c.categoryId}>
                      <span>{c.name}</span>
                      <strong className="pos-mono">{formatVnd(c.amountVnd)}</strong>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h3 className="pos-finance-section-title">Debts</h3>
              {debts.length === 0 ? (
                <p className="pos-muted">No debts tracked — add in Settings.</p>
              ) : (
                <ul className="pos-finance-cat-list">
                  {debts.map((d) => (
                    <li key={d.id}>
                      <span>
                        {d.name}
                        <small className="pos-muted"> · due {formatVnd(d.monthlyRequiredVnd)}/mo</small>
                      </span>
                      <strong className="pos-mono">{formatVnd(d.outstandingVnd)}</strong>
                    </li>
                  ))}
                </ul>
              )}
              <p className="pos-muted">
                Remaining required this month: {formatVnd(summary.debtRemainingRequiredVnd)}
              </p>
            </div>
          </div>

          <div className="pos-finance-history-head">
            <h3 className="pos-finance-section-title">Transactions</h3>
            <div className="pos-finance-tx-filters" role="tablist">
              {(["all", "income", "expense", "debt"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  className={txFilter === f ? "active" : undefined}
                  onClick={() => setTxFilter(f)}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
          <ul className="pos-finance-tx-list">
            {transactions.length === 0 && <li className="pos-muted">No transactions.</li>}
            {transactions.map((tx) => (
              <li key={`${tx.type}-${tx.id}`}>
                <button
                  type="button"
                  className="pos-finance-tx-row"
                  onClick={() => setModal({ kind: "edit", tx })}
                >
                  <div>
                    <strong>{tx.label}</strong>
                    <span className="pos-muted">
                      {" "}{tx.type} · {tx.occurredAt}
                      {tx.note ? ` · ${tx.note}` : ""}
                    </span>
                  </div>
                  <strong className={`pos-mono ${tx.type === "income" ? "ok" : ""}`}>
                    {tx.type === "income" ? "+" : "−"}
                    {formatVnd(tx.amountVnd)}
                  </strong>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {modal?.kind === "income" && (
        <QuickAmountModal
          title={`Income · ${modal.source.name}`}
          amountLabel="Amount (VND)"
          dateLabel="Received on"
          defaultDate={todayLocalDate()}
          saving={saving}
          preview={summary ? (
            <AllocationPreview
              livingPct={summary.settings.livingPct}
              safetyPct={summary.settings.safetyPct}
              compoundPct={summary.settings.compoundPct}
              opportunityPct={summary.settings.opportunityPct}
            />
          ) : null}
          onClose={() => !saving && setModal(null)}
          onSave={async ({ amount, date, note }) => {
            setSaving(true);
            try {
              await createIncomeEntry({
                sourceId: modal.source.id,
                amountVnd: amount,
                receivedAt: date,
                note,
              });
              onChanged("Income recorded");
              setModal(null);
              reload();
            } catch (err) {
              setError(err instanceof PlannerApiError ? err.message : "Could not save income");
            } finally {
              setSaving(false);
            }
          }}
        />
      )}

      {modal?.kind === "expense" && (
        <ExpenseModal
          categories={categories}
          saving={saving}
          onClose={() => !saving && setModal(null)}
          onSave={async (payload) => {
            setSaving(true);
            try {
              await createExpenseEntry(payload);
              onChanged("Expense recorded");
              setModal(null);
              reload();
            } catch (err) {
              setError(err instanceof PlannerApiError ? err.message : "Could not save expense");
            } finally {
              setSaving(false);
            }
          }}
        />
      )}

      {modal?.kind === "debt-pay" && (
        <DebtPayModal
          debts={debts}
          saving={saving}
          onClose={() => !saving && setModal(null)}
          onSave={async (payload) => {
            setSaving(true);
            try {
              await createDebtPayment(payload);
              onChanged("Debt payment recorded");
              setModal(null);
              reload();
            } catch (err) {
              setError(err instanceof PlannerApiError ? err.message : "Could not save payment");
            } finally {
              setSaving(false);
            }
          }}
        />
      )}

      {modal?.kind === "settings" && summary && (
        <SettingsModal
          settings={summary.settings}
          sources={sources}
          debts={debts}
          saving={saving}
          live={live}
          onClose={() => !saving && setModal(null)}
          onSaveSettings={async (pcts) => {
            setSaving(true);
            try {
              await updateAllocationSettings(pcts);
              onChanged("Allocation settings updated");
              reload();
            } catch (err) {
              setError(err instanceof PlannerApiError ? err.message : "Could not save settings");
            } finally {
              setSaving(false);
            }
          }}
          onAddSource={async (name) => {
            setSaving(true);
            try {
              await createIncomeSource({ name });
              onChanged("Income source added");
              reload();
            } catch (err) {
              setError(err instanceof PlannerApiError ? err.message : "Could not add source");
            } finally {
              setSaving(false);
            }
          }}
          onAddDebt={async (input) => {
            setSaving(true);
            try {
              await createDebt(input);
              onChanged("Debt added");
              reload();
            } catch (err) {
              setError(err instanceof PlannerApiError ? err.message : "Could not add debt");
            } finally {
              setSaving(false);
            }
          }}
        />
      )}

      {modal?.kind === "edit" && (
        <EditTransactionModal
          tx={modal.tx}
          categories={categories}
          saving={saving}
          onClose={() => !saving && setModal(null)}
          onSave={async () => {
            setModal(null);
            onChanged("Transaction updated");
            reload();
          }}
          onDelete={async () => {
            setModal(null);
            onChanged("Transaction deleted");
            reload();
          }}
          setSaving={setSaving}
          setError={setError}
        />
      )}
    </section>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "ok" | "warn";
}) {
  return (
    <div className="pos-finance-metric">
      <div className="pos-finance-metric-label">{label}</div>
      <div className={`pos-mono pos-finance-metric-value ${tone ?? ""}`}>{value}</div>
    </div>
  );
}

function AllocationPreview({
  livingPct,
  safetyPct,
  compoundPct,
  opportunityPct,
}: {
  livingPct: number;
  safetyPct: number;
  compoundPct: number;
  opportunityPct: number;
}) {
  return (
    <p className="pos-qa-for-hint">
      Will allocate {livingPct}% Living · {safetyPct}% Safety · {compoundPct}% Compound ·{" "}
      {opportunityPct}% Opportunity (snapshot stored; changing settings later won’t rewrite this).
    </p>
  );
}

function QuickAmountModal({
  title,
  amountLabel,
  dateLabel,
  defaultDate,
  saving,
  preview,
  onClose,
  onSave,
}: {
  title: string;
  amountLabel: string;
  dateLabel: string;
  defaultDate: string;
  saving: boolean;
  preview?: ReactNode;
  onClose: () => void;
  onSave: (input: { amount: number; date: string; note: string }) => Promise<void>;
}) {
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(defaultDate);
  const [note, setNote] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  return (
    <div className="pos-qa-backdrop">
      <button type="button" className="pos-qa-dismiss" aria-label="Close" onClick={onClose} disabled={saving} />
      <form
        className="pos-qa-modal pos-entity-form-modal"
        onSubmit={(e) => {
          e.preventDefault();
          const n = parseAmountInput(amount);
          if (n == null || n < 0) {
            setLocalError("Enter a valid amount");
            return;
          }
          void onSave({ amount: n, date, note });
        }}
      >
        <div className="pos-qa-header">
          <span className="pos-qa-eyebrow">{title}</span>
          <button type="button" className="pos-qa-close" onClick={onClose} disabled={saving}>×</button>
        </div>
        {preview}
        <div className="pos-qa-fields">
          <label className="pos-qa-field">
            <span className="pos-qa-field-label">{amountLabel}</span>
            <input value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus disabled={saving} inputMode="numeric" />
          </label>
          <label className="pos-qa-field">
            <span className="pos-qa-field-label">{dateLabel}</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} disabled={saving} />
          </label>
          <label className="pos-qa-field">
            <span className="pos-qa-field-label">Note (optional)</span>
            <input value={note} onChange={(e) => setNote(e.target.value)} disabled={saving} />
          </label>
        </div>
        {localError && <p className="pos-entity-form-error">{localError}</p>}
        <div className="pos-entity-form-footer">
          <div className="pos-entity-form-primary">
            <button type="button" className="pos-btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="pos-btn-primary" disabled={saving}>{saving ? "Saving…" : "Save"}</button>
          </div>
        </div>
      </form>
    </div>
  );
}

function ExpenseModal({
  categories,
  saving,
  onClose,
  onSave,
}: {
  categories: FinanceExpenseCategory[];
  saving: boolean;
  onClose: () => void;
  onSave: (input: {
    categoryId: string;
    amountVnd: number;
    spentAt: string;
    note?: string;
    fundingBucket: FinanceBucket;
  }) => Promise<void>;
}) {
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const selected = categories.find((c) => c.id === categoryId);
  const [bucket, setBucket] = useState<FinanceBucket>(
    (selected?.defaultBucket as FinanceBucket) || "LIVING",
  );
  const [date, setDate] = useState(todayLocalDate());
  const [note, setNote] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (selected?.defaultBucket) setBucket(selected.defaultBucket as FinanceBucket);
  }, [selected?.defaultBucket, categoryId]);

  return (
    <div className="pos-qa-backdrop">
      <button type="button" className="pos-qa-dismiss" aria-label="Close" onClick={onClose} disabled={saving} />
      <form
        className="pos-qa-modal pos-entity-form-modal"
        onSubmit={(e) => {
          e.preventDefault();
          const n = parseAmountInput(amount);
          if (n == null || n < 0) {
            setLocalError("Enter a valid amount");
            return;
          }
          if (!categoryId) {
            setLocalError("Pick a category");
            return;
          }
          void onSave({
            categoryId,
            amountVnd: n,
            spentAt: date,
            note,
            fundingBucket: bucket,
          });
        }}
      >
        <div className="pos-qa-header">
          <span className="pos-qa-eyebrow">Add expense</span>
          <button type="button" className="pos-qa-close" onClick={onClose} disabled={saving}>×</button>
        </div>
        <div className="pos-qa-fields">
          <label className="pos-qa-field">
            <span className="pos-qa-field-label">Amount (VND)</span>
            <input value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus disabled={saving} inputMode="numeric" />
          </label>
          <label className="pos-qa-field">
            <span className="pos-qa-field-label">Category</span>
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} disabled={saving}>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
          <label className="pos-qa-field">
            <span className="pos-qa-field-label">Funded from</span>
            <select value={bucket} onChange={(e) => setBucket(e.target.value as FinanceBucket)} disabled={saving}>
              {(Object.keys(BUCKET_LABELS) as FinanceBucket[]).map((b) => (
                <option key={b} value={b}>{BUCKET_LABELS[b]}</option>
              ))}
            </select>
          </label>
          <label className="pos-qa-field">
            <span className="pos-qa-field-label">Spent on</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} disabled={saving} />
          </label>
          <label className="pos-qa-field">
            <span className="pos-qa-field-label">Note (optional)</span>
            <input value={note} onChange={(e) => setNote(e.target.value)} disabled={saving} />
          </label>
        </div>
        {localError && <p className="pos-entity-form-error">{localError}</p>}
        <div className="pos-entity-form-footer">
          <div className="pos-entity-form-primary">
            <button type="button" className="pos-btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="pos-btn-primary" disabled={saving}>{saving ? "Saving…" : "Save"}</button>
          </div>
        </div>
      </form>
    </div>
  );
}

function DebtPayModal({
  debts,
  saving,
  onClose,
  onSave,
}: {
  debts: FinanceDebt[];
  saving: boolean;
  onClose: () => void;
  onSave: (input: { debtId: string; amountVnd: number; paidAt: string; note?: string }) => Promise<void>;
}) {
  const [debtId, setDebtId] = useState(debts[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayLocalDate());
  const [note, setNote] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const debt = debts.find((d) => d.id === debtId);

  return (
    <div className="pos-qa-backdrop">
      <button type="button" className="pos-qa-dismiss" aria-label="Close" onClick={onClose} disabled={saving} />
      <form
        className="pos-qa-modal pos-entity-form-modal"
        onSubmit={(e) => {
          e.preventDefault();
          const n = parseAmountInput(amount);
          if (n == null || n <= 0) {
            setLocalError("Enter a positive amount");
            return;
          }
          if (!debtId) {
            setLocalError("Pick a debt");
            return;
          }
          void onSave({ debtId, amountVnd: n, paidAt: date, note });
        }}
      >
        <div className="pos-qa-header">
          <span className="pos-qa-eyebrow">Debt payment</span>
          <button type="button" className="pos-qa-close" onClick={onClose} disabled={saving}>×</button>
        </div>
        <p className="pos-entity-form-lede">
          Mandatory obligation — funded from Living. Not counted as category spending.
        </p>
        <div className="pos-qa-fields">
          <label className="pos-qa-field">
            <span className="pos-qa-field-label">Debt</span>
            <select value={debtId} onChange={(e) => setDebtId(e.target.value)} disabled={saving}>
              {debts.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({formatVnd(d.outstandingVnd)} left)
                </option>
              ))}
            </select>
          </label>
          <label className="pos-qa-field">
            <span className="pos-qa-field-label">Amount (VND)</span>
            <input value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus disabled={saving} inputMode="numeric" />
          </label>
          {debt && (
            <p className="pos-qa-for-hint">Monthly required: {formatVnd(debt.monthlyRequiredVnd)}</p>
          )}
          <label className="pos-qa-field">
            <span className="pos-qa-field-label">Paid on</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} disabled={saving} />
          </label>
          <label className="pos-qa-field">
            <span className="pos-qa-field-label">Note (optional)</span>
            <input value={note} onChange={(e) => setNote(e.target.value)} disabled={saving} />
          </label>
        </div>
        {localError && <p className="pos-entity-form-error">{localError}</p>}
        <div className="pos-entity-form-footer">
          <div className="pos-entity-form-primary">
            <button type="button" className="pos-btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="pos-btn-primary" disabled={saving}>{saving ? "Saving…" : "Save"}</button>
          </div>
        </div>
      </form>
    </div>
  );
}

function SettingsModal({
  settings,
  sources,
  debts,
  saving,
  live,
  onClose,
  onSaveSettings,
  onAddSource,
  onAddDebt,
}: {
  settings: FinanceSummary["settings"];
  sources: FinanceIncomeSource[];
  debts: FinanceDebt[];
  saving: boolean;
  live: boolean;
  onClose: () => void;
  onSaveSettings: (pcts: {
    livingPct: number;
    safetyPct: number;
    compoundPct: number;
    opportunityPct: number;
  }) => Promise<void>;
  onAddSource: (name: string) => Promise<void>;
  onAddDebt: (input: {
    name: string;
    outstandingVnd: number;
    monthlyRequiredVnd: number;
  }) => Promise<void>;
}) {
  const [living, setLiving] = useState(String(settings.livingPct));
  const [safety, setSafety] = useState(String(settings.safetyPct));
  const [compound, setCompound] = useState(String(settings.compoundPct));
  const [opportunity, setOpportunity] = useState(String(settings.opportunityPct));
  const [sourceName, setSourceName] = useState("");
  const [debtName, setDebtName] = useState("");
  const [debtOut, setDebtOut] = useState("");
  const [debtDue, setDebtDue] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const sum = Number(living) + Number(safety) + Number(compound) + Number(opportunity);

  return (
    <div className="pos-qa-backdrop">
      <button type="button" className="pos-qa-dismiss" aria-label="Close" onClick={onClose} disabled={saving} />
      <div className="pos-qa-modal pos-entity-form-modal pos-finance-settings" role="dialog">
        <div className="pos-qa-header">
          <span className="pos-qa-eyebrow">Finance settings</span>
          <button type="button" className="pos-qa-close" onClick={onClose} disabled={saving}>×</button>
        </div>
        <div className="pos-qa-fields">
          <p className="pos-qa-field-label">Allocation % (must total 100)</p>
          <div className="pos-entity-form-row">
            <label className="pos-qa-field">Living<input type="number" value={living} onChange={(e) => setLiving(e.target.value)} disabled={saving} /></label>
            <label className="pos-qa-field">Safety<input type="number" value={safety} onChange={(e) => setSafety(e.target.value)} disabled={saving} /></label>
          </div>
          <div className="pos-entity-form-row">
            <label className="pos-qa-field">Compound<input type="number" value={compound} onChange={(e) => setCompound(e.target.value)} disabled={saving} /></label>
            <label className="pos-qa-field">Opportunity<input type="number" value={opportunity} onChange={(e) => setOpportunity(e.target.value)} disabled={saving} /></label>
          </div>
          <p className={`pos-qa-for-hint ${sum !== 100 ? "warn" : ""}`}>Total: {sum}%{sum !== 100 ? " — must be 100" : ""}</p>
          <button
            type="button"
            className="pos-btn-primary"
            disabled={saving || !live || sum !== 100}
            onClick={() => {
              void onSaveSettings({
                livingPct: Number(living),
                safetyPct: Number(safety),
                compoundPct: Number(compound),
                opportunityPct: Number(opportunity),
              });
            }}
          >
            Save allocation
          </button>

          <hr className="pos-finance-hr" />
          <p className="pos-qa-field-label">Income sources</p>
          <ul className="pos-finance-cat-list compact">
            {sources.map((s) => (
              <li key={s.id}><span>{s.name}</span><span className="pos-muted">{s.active ? "active" : "off"}</span></li>
            ))}
          </ul>
          <div className="pos-entity-form-row">
            <label className="pos-qa-field">
              <span className="pos-qa-field-label">New source</span>
              <input value={sourceName} onChange={(e) => setSourceName(e.target.value)} disabled={saving || !live} placeholder="Salary" />
            </label>
            <button
              type="button"
              className="pos-btn-secondary"
              disabled={saving || !live || !sourceName.trim()}
              onClick={() => {
                const name = sourceName.trim();
                setSourceName("");
                void onAddSource(name);
              }}
            >
              Add
            </button>
          </div>

          <hr className="pos-finance-hr" />
          <p className="pos-qa-field-label">Debts</p>
          <ul className="pos-finance-cat-list compact">
            {debts.map((d) => (
              <li key={d.id}>
                <span>{d.name}</span>
                <strong className="pos-mono">{formatVnd(d.outstandingVnd)}</strong>
              </li>
            ))}
          </ul>
          <label className="pos-qa-field">
            <span className="pos-qa-field-label">Debt name</span>
            <input value={debtName} onChange={(e) => setDebtName(e.target.value)} disabled={saving || !live} />
          </label>
          <div className="pos-entity-form-row">
            <label className="pos-qa-field">
              <span className="pos-qa-field-label">Outstanding</span>
              <input value={debtOut} onChange={(e) => setDebtOut(e.target.value)} disabled={saving || !live} inputMode="numeric" />
            </label>
            <label className="pos-qa-field">
              <span className="pos-qa-field-label">Monthly due</span>
              <input value={debtDue} onChange={(e) => setDebtDue(e.target.value)} disabled={saving || !live} inputMode="numeric" />
            </label>
          </div>
          <button
            type="button"
            className="pos-btn-secondary"
            disabled={saving || !live || !debtName.trim()}
            onClick={() => {
              const out = parseAmountInput(debtOut) ?? 0;
              const due = parseAmountInput(debtDue) ?? 0;
              if (!debtName.trim()) {
                setLocalError("Debt name required");
                return;
              }
              const name = debtName.trim();
              setDebtName("");
              setDebtOut("");
              setDebtDue("");
              void onAddDebt({ name, outstandingVnd: out, monthlyRequiredVnd: due });
            }}
          >
            Add debt
          </button>
          {localError && <p className="pos-entity-form-error">{localError}</p>}
        </div>
        <div className="pos-entity-form-footer">
          <div className="pos-entity-form-primary">
            <button type="button" className="pos-btn-ghost" onClick={onClose} disabled={saving}>Close</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function EditTransactionModal({
  tx,
  categories,
  saving,
  onClose,
  onSave,
  onDelete,
  setSaving,
  setError,
}: {
  tx: FinanceTransaction;
  categories: FinanceExpenseCategory[];
  saving: boolean;
  onClose: () => void;
  onSave: () => Promise<void>;
  onDelete: () => Promise<void>;
  setSaving: (v: boolean) => void;
  setError: (v: string | null) => void;
}) {
  const [amount, setAmount] = useState(String(tx.amountVnd));
  const [date, setDate] = useState(tx.occurredAt);
  const [note, setNote] = useState(tx.note);
  const [bucket, setBucket] = useState<FinanceBucket>(
    (tx.meta.fundingBucket as FinanceBucket) || "LIVING",
  );
  const [categoryId, setCategoryId] = useState(String(tx.meta.categoryId ?? categories[0]?.id ?? ""));
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  return (
    <div className="pos-qa-backdrop">
      <button type="button" className="pos-qa-dismiss" aria-label="Close" onClick={onClose} disabled={saving} />
      <form
        className="pos-qa-modal pos-entity-form-modal"
        onSubmit={(e) => {
          e.preventDefault();
          const n = parseAmountInput(amount);
          if (n == null || n < 0) {
            setLocalError("Enter a valid amount");
            return;
          }
          setSaving(true);
          void (async () => {
            try {
              if (tx.type === "income") {
                await patchIncomeEntry(tx.id, { amountVnd: n, receivedAt: date, note });
              } else if (tx.type === "expense") {
                await patchExpenseEntry(tx.id, {
                  amountVnd: n,
                  spentAt: date,
                  note,
                  fundingBucket: bucket,
                  categoryId: categoryId || undefined,
                });
              } else {
                await patchDebtPayment(tx.id, { amountVnd: Math.max(1, n), paidAt: date, note });
              }
              await onSave();
            } catch (err) {
              setError(err instanceof PlannerApiError ? err.message : "Could not update");
            } finally {
              setSaving(false);
            }
          })();
        }}
      >
        <div className="pos-qa-header">
          <span className="pos-qa-eyebrow">Edit {tx.type} · {tx.label}</span>
          <button type="button" className="pos-qa-close" onClick={onClose} disabled={saving}>×</button>
        </div>
        <p className="pos-qa-for-hint">Logged {new Date(tx.createdAt).toLocaleString()} · occurrence date is what stats use.</p>
        <div className="pos-qa-fields">
          <label className="pos-qa-field">
            <span className="pos-qa-field-label">Amount (VND)</span>
            <input value={amount} onChange={(e) => setAmount(e.target.value)} disabled={saving} inputMode="numeric" />
          </label>
          <label className="pos-qa-field">
            <span className="pos-qa-field-label">
              {tx.type === "income" ? "Received on" : tx.type === "expense" ? "Spent on" : "Paid on"}
            </span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} disabled={saving} />
          </label>
          {tx.type === "expense" && (
            <>
              <label className="pos-qa-field">
                <span className="pos-qa-field-label">Category</span>
                <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} disabled={saving}>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </label>
              <label className="pos-qa-field">
                <span className="pos-qa-field-label">Funded from</span>
                <select value={bucket} onChange={(e) => setBucket(e.target.value as FinanceBucket)} disabled={saving}>
                  {(Object.keys(BUCKET_LABELS) as FinanceBucket[]).map((b) => (
                    <option key={b} value={b}>{BUCKET_LABELS[b]}</option>
                  ))}
                </select>
              </label>
            </>
          )}
          <label className="pos-qa-field">
            <span className="pos-qa-field-label">Note</span>
            <input value={note} onChange={(e) => setNote(e.target.value)} disabled={saving} />
          </label>
        </div>
        {localError && <p className="pos-entity-form-error">{localError}</p>}
        <div className="pos-entity-form-footer">
          <div className="pos-entity-form-secondary">
            <button
              type="button"
              className="pos-btn-ghost danger"
              disabled={saving}
              onClick={() => {
                if (!confirmDelete) {
                  setConfirmDelete(true);
                  return;
                }
                setSaving(true);
                void (async () => {
                  try {
                    if (tx.type === "income") await deleteIncomeEntry(tx.id);
                    else if (tx.type === "expense") await deleteExpenseEntry(tx.id);
                    else await deleteDebtPayment(tx.id);
                    await onDelete();
                  } catch (err) {
                    setError(err instanceof PlannerApiError ? err.message : "Could not delete");
                  } finally {
                    setSaving(false);
                  }
                })();
              }}
            >
              {confirmDelete ? "Confirm delete" : "Delete"}
            </button>
          </div>
          <div className="pos-entity-form-primary">
            <button type="button" className="pos-btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="pos-btn-primary" disabled={saving}>{saving ? "Saving…" : "Save"}</button>
          </div>
        </div>
      </form>
    </div>
  );
}
