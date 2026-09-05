"use client";

import { useEffect, useState } from "react";
import {
  BUCKET_LABELS,
  BUCKET_ORDER,
  fetchFinanceAnalytics,
  formatVnd,
  PlannerApiError,
  type AnalyticsGrain,
  type FinanceAnalytics,
} from "@/lib/finance-api";

type Props = {
  live: boolean;
};

function fmtPct(v: number | null | undefined): string {
  if (v == null) return "—";
  return `${v}%`;
}

function fmtDelta(d: { deltaVnd: number; deltaPct: number | null }): string {
  const sign = d.deltaVnd > 0 ? "+" : "";
  const pct = d.deltaPct == null ? "" : ` (${d.deltaPct > 0 ? "+" : ""}${d.deltaPct}%)`;
  return `${sign}${formatVnd(d.deltaVnd)}${pct}`;
}

function maxAbs(...vals: number[]): number {
  return Math.max(1, ...vals.map((v) => Math.abs(v)));
}

export function FinanceAnalyticsPanel({ live }: Props) {
  const [grain, setGrain] = useState<AnalyticsGrain>("month");
  const [period, setPeriod] = useState<string | undefined>(undefined);
  const [data, setData] = useState<FinanceAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAllCategories, setShowAllCategories] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const res = await fetchFinanceAnalytics(grain, period);
        if (!cancelled) {
          setData(res);
          setPeriod(res.periodKey);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof PlannerApiError ? err.message : "Could not load analytics");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [grain, period, live]);

  const categories = data
    ? showAllCategories
      ? data.spendingByCategory
      : data.spendingByCategory.slice(0, 8)
    : [];

  const trendMax = data
    ? maxAbs(
        ...data.cashflowTrend.points.flatMap((p) => [
          p.incomeVnd,
          p.expensesVnd,
          p.debtPaidVnd,
        ]),
      )
    : 1;

  return (
    <div className="pos-finance-analytics">
      <div className="pos-finance-grain-tabs" role="tablist" aria-label="Analytics period">
        {(["week", "month", "quarter", "year"] as const).map((g) => (
          <button
            key={g}
            type="button"
            role="tab"
            aria-selected={grain === g}
            className={grain === g ? "active" : undefined}
            onClick={() => {
              setGrain(g);
              setPeriod(undefined);
            }}
          >
            {g[0]!.toUpperCase() + g.slice(1)}
          </button>
        ))}
      </div>

      {data && (
        <div className="pos-finance-toolbar">
          <div className="pos-finance-month-nav">
            <button
              type="button"
              className="pos-btn-ghost"
              aria-label="Previous period"
              onClick={() => setPeriod(data.navigation.previousPeriodKey)}
            >
              ‹
            </button>
            <strong>{data.label}</strong>
            <button
              type="button"
              className="pos-btn-ghost"
              aria-label="Next period"
              onClick={() => setPeriod(data.navigation.nextPeriodKey)}
            >
              ›
            </button>
            <button
              type="button"
              className="pos-btn-ghost"
              onClick={() => setPeriod(data.navigation.currentPeriodKey)}
            >
              Current
            </button>
          </div>
          <span className="pos-muted pos-mono">
            {data.start} → {data.end}
          </span>
        </div>
      )}

      {error && <p className="pos-entity-form-error">{error}</p>}
      {loading && !data && <p className="pos-muted">Loading analytics…</p>}

      {data && (
        <>
          {data.insights.length > 0 && (
            <section className="pos-finance-analytics-section">
              <h3 className="pos-finance-section-title">Insights</h3>
              <ul className="pos-finance-insights">
                {data.insights.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </section>
          )}

          <section className="pos-finance-analytics-section">
            <h3 className="pos-finance-section-title">Financial summary</h3>
            <div className="pos-finance-metrics">
              <div className="pos-finance-metric">
                <div className="pos-finance-metric-label">Income</div>
                <div className="pos-mono pos-finance-metric-value">{formatVnd(data.summary.incomeVnd)}</div>
              </div>
              <div className="pos-finance-metric">
                <div className="pos-finance-metric-label">Actual expenses</div>
                <div className="pos-mono pos-finance-metric-value">{formatVnd(data.summary.expensesVnd)}</div>
              </div>
              <div className="pos-finance-metric">
                <div className="pos-finance-metric-label">Debt payments</div>
                <div className="pos-mono pos-finance-metric-value">{formatVnd(data.summary.debtPaidVnd)}</div>
              </div>
              <div className="pos-finance-metric">
                <div className="pos-finance-metric-label">Net cashflow</div>
                <div className={`pos-mono pos-finance-metric-value ${data.summary.netCashflowVnd < 0 ? "warn" : "ok"}`}>
                  {formatVnd(data.summary.netCashflowVnd)}
                </div>
              </div>
            </div>
            <p className="pos-muted pos-finance-lede">
              Net cashflow = Income − Expenses − Debt payments. Allocations and transfers are not expenses.
            </p>
          </section>

          <section className="pos-finance-analytics-section">
            <h3 className="pos-finance-section-title">Plan vs actual</h3>
            <p className="pos-muted pos-finance-lede">
              Target = policy at income time · Allocated = snapshot · Used = expenses only (debt separate on Living).
            </p>
            <div className="pos-finance-pva">
              {data.planVsActual.map((row) => {
                const scale = maxAbs(row.targetVnd, row.allocatedVnd, row.usedExpenseVnd);
                return (
                  <div key={row.bucket} className="pos-finance-pva-row">
                    <div className="pos-finance-pva-head">
                      <strong>{BUCKET_LABELS[row.bucket]}</strong>
                      <span className="pos-muted">
                        Available {formatVnd(row.lifetimeBalanceVnd)} · Net {formatVnd(row.netChangeVnd)}
                      </span>
                    </div>
                    <BarRow label="Target" amount={row.targetVnd} pct={row.targetPctOfIncome} max={scale} tone="target" />
                    <BarRow label="Allocated" amount={row.allocatedVnd} pct={row.allocatedPctOfIncome} max={scale} tone="alloc" />
                    <BarRow label="Used" amount={row.usedExpenseVnd} pct={row.usagePctOfIncome} max={scale} tone="used" />
                    <div className="pos-muted pos-finance-pva-var">
                      vs alloc {formatVnd(row.varianceVsAllocationVnd)} · vs target {formatVnd(row.varianceVsTargetVnd)}
                      {row.debtWithdrawalsVnd > 0
                        ? ` · debt from Living ${formatVnd(row.debtWithdrawalsVnd)}`
                        : ""}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="pos-finance-rates pos-muted">
              Living usage {fmtPct(data.rates.livingUsageRatePct)} · Growth alloc{" "}
              {fmtPct(data.rates.growthAllocationRatePct)} · Growth use{" "}
              {fmtPct(data.rates.growthUsageRatePct)} · Safety alloc{" "}
              {fmtPct(data.rates.safetyAllocationRatePct)} · Fun use{" "}
              {fmtPct(data.rates.funUsageRatePct)}
            </div>
          </section>

          <section className="pos-finance-analytics-section">
            <h3 className="pos-finance-section-title">Cashflow trend</h3>
            <div className="pos-finance-trend" role="img" aria-label="Cashflow trend">
              {data.cashflowTrend.points.map((p) => (
                <div key={p.key} className="pos-finance-trend-col" title={`${p.label}: in ${p.incomeVnd}`}>
                  <div className="pos-finance-trend-bars">
                    <span
                      className="bar income"
                      style={{ height: `${Math.round((p.incomeVnd / trendMax) * 100)}%` }}
                    />
                    <span
                      className="bar expense"
                      style={{ height: `${Math.round((p.expensesVnd / trendMax) * 100)}%` }}
                    />
                    <span
                      className="bar debt"
                      style={{ height: `${Math.round((p.debtPaidVnd / trendMax) * 100)}%` }}
                    />
                  </div>
                  <span className="pos-finance-trend-label">{p.label}</span>
                </div>
              ))}
            </div>
            <p className="pos-muted pos-finance-lede">Green income · coral expenses · amber debt</p>
          </section>

          <section className="pos-finance-analytics-section">
            <h3 className="pos-finance-section-title">Resilience</h3>
            <div className="pos-finance-metrics">
              <div className="pos-finance-metric">
                <div className="pos-finance-metric-label">Core monthly burn</div>
                <div className="pos-mono pos-finance-metric-value">
                  {formatVnd(data.resilience.coreMonthlyBurnVnd)}
                </div>
              </div>
              <div className="pos-finance-metric">
                <div className="pos-finance-metric-label">Safety runway</div>
                <div className="pos-mono pos-finance-metric-value">
                  {data.resilience.safetyRunwayMonths == null
                    ? "—"
                    : `${data.resilience.safetyRunwayMonths} mo`}
                </div>
              </div>
              <div className="pos-finance-metric">
                <div className="pos-finance-metric-label">Safety balance</div>
                <div className="pos-mono pos-finance-metric-value">
                  {formatVnd(data.resilience.safetyBalanceVnd)}
                </div>
              </div>
              <div className="pos-finance-metric">
                <div className="pos-finance-metric-label">
                  Target ({data.resilience.safetyTargetMonths} mo)
                </div>
                <div className="pos-mono pos-finance-metric-value">
                  {fmtPct(data.resilience.safetyTargetProgressPct)}
                </div>
              </div>
            </div>
            <div className="pos-finance-progress">
              <div
                className="pos-finance-progress-fill"
                style={{
                  width: `${Math.min(100, Math.max(0, data.resilience.safetyTargetProgressPct ?? 0))}%`,
                }}
              />
            </div>
            <p className="pos-muted pos-finance-lede">
              Mandatory obligations {formatVnd(data.resilience.mandatoryObligationsVnd)} · Projected surplus{" "}
              {formatVnd(data.resilience.projectedSurplusVnd)}
            </p>
          </section>

          <section className="pos-finance-analytics-section">
            <h3 className="pos-finance-section-title">Spending by category</h3>
            <ul className="pos-finance-hbar-list">
              {categories.map((row) => (
                <li key={row.categoryId}>
                  <div className="pos-finance-hbar-meta">
                    <span>{row.name}</span>
                    <span className="pos-mono">
                      {formatVnd(row.amountVnd)}
                      {row.pctOfExpenses != null ? ` · ${row.pctOfExpenses}%` : ""}
                    </span>
                  </div>
                  <div className="pos-finance-hbar-track">
                    <div
                      className="pos-finance-hbar-fill"
                      style={{ width: `${Math.min(100, row.pctOfExpenses ?? 0)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
            {data.spendingByCategory.length > 8 && (
              <button
                type="button"
                className="pos-btn-ghost"
                onClick={() => setShowAllCategories((v) => !v)}
              >
                {showAllCategories ? "Show top categories" : "Show all categories"}
              </button>
            )}
          </section>

          <section className="pos-finance-analytics-section">
            <h3 className="pos-finance-section-title">Growth breakdown</h3>
            {data.growthBreakdown.length === 0 ? (
              <p className="pos-muted">No Growth-funded expenses this period.</p>
            ) : (
              <ul className="pos-finance-hbar-list">
                {data.growthBreakdown.map((row) => (
                  <li key={row.group}>
                    <div className="pos-finance-hbar-meta">
                      <span>{row.group}</span>
                      <span className="pos-mono">{formatVnd(row.amountVnd)}</span>
                    </div>
                    <div className="pos-finance-hbar-track">
                      <div
                        className="pos-finance-hbar-fill growth"
                        style={{ width: `${Math.min(100, row.pctOfGrowthUsage ?? 0)}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="pos-finance-analytics-section">
            <h3 className="pos-finance-section-title">Income by source</h3>
            <ul className="pos-finance-hbar-list">
              {data.incomeBySource.map((row) => (
                <li key={row.sourceId}>
                  <div className="pos-finance-hbar-meta">
                    <span>{row.name}</span>
                    <span className="pos-mono">
                      {formatVnd(row.amountVnd)}
                      {row.pctOfIncome != null ? ` · ${row.pctOfIncome}%` : ""}
                    </span>
                  </div>
                  <div className="pos-muted" style={{ fontSize: 12 }}>
                    vs prior {fmtDelta(row)}
                  </div>
                </li>
              ))}
              {data.incomeBySource.length === 0 && (
                <li className="pos-muted">No income this period.</li>
              )}
            </ul>
            {data.incomeConcentrationPct != null && (
              <p className="pos-muted">
                Concentration: largest source is {data.incomeConcentrationPct}% of income.
              </p>
            )}
          </section>

          <section className="pos-finance-analytics-section">
            <h3 className="pos-finance-section-title">Debt</h3>
            <div className="pos-finance-metrics">
              <div className="pos-finance-metric">
                <div className="pos-finance-metric-label">Opening (est.)</div>
                <div className="pos-mono pos-finance-metric-value">
                  {formatVnd(data.debt.openingOutstandingVnd)}
                </div>
              </div>
              <div className="pos-finance-metric">
                <div className="pos-finance-metric-label">Payments</div>
                <div className="pos-mono pos-finance-metric-value">{formatVnd(data.debt.paymentsVnd)}</div>
              </div>
              <div className="pos-finance-metric">
                <div className="pos-finance-metric-label">Closing</div>
                <div className="pos-mono pos-finance-metric-value">
                  {formatVnd(data.debt.closingOutstandingVnd)}
                </div>
              </div>
              <div className="pos-finance-metric">
                <div className="pos-finance-metric-label">Required remaining</div>
                <div className="pos-mono pos-finance-metric-value">
                  {formatVnd(data.debt.remainingRequiredVnd)}
                </div>
              </div>
            </div>
            <p className="pos-muted pos-finance-lede">
              Opening estimated as closing + payments (new debt events not tracked yet).
            </p>
          </section>

          <section className="pos-finance-analytics-section">
            <h3 className="pos-finance-section-title">
              vs {data.comparison.previousLabel}
            </h3>
            <ul className="pos-finance-compare-list">
              {(
                [
                  ["Income", data.comparison.income],
                  ["Expenses", data.comparison.expenses],
                  ["Debt paid", data.comparison.debtPaid],
                  ["Net cashflow", data.comparison.netCashflow],
                  ["Living usage", data.comparison.livingUsage],
                  ["Growth allocated", data.comparison.growthAllocated],
                  ["Fun usage", data.comparison.funUsage],
                ] as const
              ).map(([label, m]) => (
                <li key={label}>
                  <span>{label}</span>
                  <span className="pos-mono">{fmtDelta(m)}</span>
                </li>
              ))}
            </ul>
          </section>

          {grain === "week" && data.weekPace && (
            <p className="pos-muted">
              Enclosing month {data.weekPace.enclosingMonth}
              {data.weekPace.monthElapsedPct != null
                ? ` · ~${data.weekPace.monthElapsedPct}% of month elapsed`
                : ""}
            </p>
          )}
        </>
      )}
    </div>
  );
}

function BarRow({
  label,
  amount,
  pct,
  max,
  tone,
}: {
  label: string;
  amount: number;
  pct: number | null;
  max: number;
  tone: "target" | "alloc" | "used";
}) {
  return (
    <div className={`pos-finance-bar-row ${tone}`}>
      <span className="pos-finance-bar-label">{label}</span>
      <div className="pos-finance-bar-track">
        <div
          className="pos-finance-bar-fill"
          style={{ width: `${Math.min(100, Math.round((amount / max) * 100))}%` }}
        />
      </div>
      <span className="pos-mono pos-finance-bar-amt">
        {formatVnd(amount)}
        {pct != null ? ` · ${pct}%` : ""}
      </span>
    </div>
  );
}
