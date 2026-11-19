import {
  AlertTriangle,
  ArrowRight,
  BellRing,
  CheckCircle2,
  Plus,
  Sparkles,
  TrendingDown,
} from 'lucide-react';
import {
  BudgetAlert,
  ExpenseItem,
  FamilyMember,
  HouseholdProfile,
  MonthlyTrendPoint,
  NecessityLevel,
  formatCurrency,
  formatMonthLabel,
  getRecentMonthKeys,
  suggestNecessityHint,
} from '../types';
import { CategoryIcon, getCategoryTint } from './CategoryIcon';
import { OverviewCharts } from './OverviewCharts';

interface OverviewTabProps {
  profile: HouseholdProfile;
  monthKey: string;
  members: FamilyMember[];
  expenses: ExpenseItem[];
  alerts: BudgetAlert[];
  monthlyTrend: MonthlyTrendPoint[];
  seeding: boolean;
  onSelectMonth: (monthKey: string) => void;
  onOpenAddExpense: () => void;
  onSeedSample: () => Promise<void>;
  onToggleNecessity: (
    expense: ExpenseItem,
    necessity: NecessityLevel,
    reason?: string
  ) => Promise<void>;
  onInspectMember: (memberId: number) => void;
  onNavigateTab: (tab: 'overview' | 'expenses' | 'members' | 'alerts') => void;
}

export function OverviewTab({
  profile,
  monthKey,
  members,
  expenses,
  alerts,
  monthlyTrend,
  seeding,
  onSelectMonth,
  onOpenAddExpense,
  onSeedSample,
  onToggleNecessity,
  onInspectMember,
  onNavigateTab,
}: OverviewTabProps) {
  const recentMonths = getRecentMonthKeys(6);
  const totalSpent = expenses.reduce((sum, e) => sum + e.amountCents, 0);
  const budget = Math.max(profile.monthlyBudgetCents, 1);
  const pctUsed = Math.round((totalSpent / budget) * 100);
  const remaining = profile.monthlyBudgetCents - totalSpent;

  const essentialSpent = expenses
    .filter((e) => e.necessity === 'essential')
    .reduce((sum, e) => sum + e.amountCents, 0);
  const discretionarySpent = expenses
    .filter((e) => e.necessity === 'discretionary')
    .reduce((sum, e) => sum + e.amountCents, 0);
  const unnecessaryItems = expenses.filter(
    (e) => e.necessity === 'unnecessary'
  );
  const unnecessarySpent = unnecessaryItems.reduce(
    (sum, e) => sum + e.amountCents,
    0
  );

  // Suspect items not yet flagged as unnecessary
  const reviewCandidates = expenses.filter((e) => {
    if (e.necessity === 'unnecessary') return false;
    return suggestNecessityHint(e.title, e.merchant, e.category).isSuspect;
  });

  const unreadAlerts = alerts.filter((a) => !a.isRead).length;
  const memberMap = new Map(members.map((m) => [m.id, m]));

  // Budget status with explicit text + icon (never hue-only)
  const isOverBudget = totalSpent > profile.monthlyBudgetCents;
  const isWarning =
    !isOverBudget && pctUsed >= profile.alertThresholdPct;

  const ringRadius = 46;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const clampedRatio = Math.min(totalSpent / budget, 1);
  const ringOffset = ringCircumference * (1 - clampedRatio);

  // Build daily totals for current month (days 1..31 present or up to today)
  const dailyMap = new Map<
    string,
    { total: number; unnecessary: number; label: string }
  >();
  for (const exp of expenses) {
    const dayNum = exp.spentAt.slice(8, 10);
    const prev = dailyMap.get(exp.spentAt) || {
      total: 0,
      unnecessary: 0,
      label: dayNum,
    };
    prev.total += exp.amountCents;
    if (exp.necessity === 'unnecessary') {
      prev.unnecessary += exp.amountCents;
    }
    dailyMap.set(exp.spentAt, prev);
  }
  const dailySeries = Array.from(dailyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, val]) => ({ date, ...val }));
  const maxDaily = Math.max(...dailySeries.map((d) => d.total), 1);

  return (
    <div className="space-y-6">
      {/* Horizontal Month Scroller */}
      <div className="flex items-center justify-between gap-4">
        <div
          className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1"
          role="tablist"
          aria-label="Select month"
        >
          {recentMonths.map((mk) => {
            const active = mk === monthKey;
            return (
              <button
                key={mk}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onSelectMonth(mk)}
                className={`min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  active
                    ? 'bg-slate-900 text-white'
                    : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900'
                }`}
              >
                {formatMonthLabel(mk)}
              </button>
            );
          })}
        </div>
      </div>

      {expenses.length === 0 ? (
        <section className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-10 text-center">
          <h2 className="font-display text-xl sm:text-2xl font-bold text-slate-900">
            No expenses recorded for {formatMonthLabel(monthKey)}
          </h2>
          <p className="mt-2 text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
            Log your first daily purchase to start tracking household budgets,
            per-member spending caps, and unnecessary expenses—or load a sample
            family month to explore right away.
          </p>
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              type="button"
              onClick={onOpenAddExpense}
              className="w-full sm:w-auto min-h-[44px] px-5 py-2.5 bg-teal-700 hover:bg-teal-800 text-white text-sm font-semibold rounded-xl flex items-center justify-center gap-2 cursor-pointer"
            >
              <Plus size={18} />
              <span>Log First Expense</span>
            </button>
            <button
              type="button"
              onClick={onSeedSample}
              disabled={seeding}
              className="w-full sm:w-auto min-h-[44px] px-5 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-800 text-sm font-semibold rounded-xl flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              <Sparkles size={16} className="text-teal-700" />
              <span>
                {seeding ? 'Loading Sample...' : 'Load Sample Family Month'}
              </span>
            </button>
          </div>
        </section>
      ) : (
        <>
          {/* Focal Anchor + 4-Metric Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            {/* Primary Budget Ring Card */}
            <section className="lg:col-span-5 bg-white border border-slate-200 rounded-3xl p-6 flex flex-col justify-between">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-medium text-slate-500">
                    {profile.householdName} · {formatMonthLabel(monthKey)}
                  </p>
                  <h2 className="font-display text-3xl sm:text-4xl font-bold text-slate-900 tabular-nums mt-1">
                    {formatCurrency(totalSpent, profile.currency)}
                  </h2>
                  <p className="text-sm text-slate-500 tabular-nums mt-1">
                    of {formatCurrency(profile.monthlyBudgetCents, profile.currency)}{' '}
                    monthly budget
                  </p>
                </div>

                <div className="relative w-28 h-28 shrink-0 flex items-center justify-center">
                  <svg
                    className="w-28 h-28 -rotate-90"
                    viewBox="0 0 112 112"
                    aria-hidden="true"
                  >
                    <circle
                      cx="56"
                      cy="56"
                      r={ringRadius}
                      fill="none"
                      stroke="#E2E8F0"
                      strokeWidth="10"
                    />
                    <circle
                      cx="56"
                      cy="56"
                      r={ringRadius}
                      fill="none"
                      stroke={
                        isOverBudget
                          ? '#DC2626'
                          : isWarning
                            ? '#D97706'
                            : '#0F766E'
                      }
                      strokeWidth="10"
                      strokeLinecap="round"
                      strokeDasharray={ringCircumference}
                      strokeDashoffset={ringOffset}
                    />
                  </svg>
                  <span className="absolute font-display text-lg font-bold text-slate-900 tabular-nums">
                    {pctUsed}%
                  </span>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  {isOverBudget ? (
                    <AlertTriangle size={16} className="text-rose-600 shrink-0" />
                  ) : isWarning ? (
                    <BellRing size={16} className="text-amber-600 shrink-0" />
                  ) : (
                    <CheckCircle2
                      size={16}
                      className="text-emerald-600 shrink-0"
                    />
                  )}
                  <span
                    className={`text-xs font-semibold ${
                      isOverBudget
                        ? 'text-rose-700'
                        : isWarning
                          ? 'text-amber-700'
                          : 'text-emerald-700'
                    }`}
                  >
                    {isOverBudget
                      ? `Over budget by ${formatCurrency(Math.abs(remaining), profile.currency)}`
                      : isWarning
                        ? `${profile.alertThresholdPct}% alert threshold reached`
                        : `${formatCurrency(remaining, profile.currency)} remaining`}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigateTab('alerts')}
                  className="min-h-[36px] text-xs font-semibold text-teal-700 hover:text-teal-800 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Adjust Budget
                </button>
              </div>
            </section>

            {/* 4-Metric Classification Strip */}
            <div className="lg:col-span-7 grid grid-cols-2 gap-4">
              <div className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col justify-between">
                <span className="text-xs font-medium text-slate-500">
                  Essential Spend
                </span>
                <div className="mt-3">
                  <p className="font-display text-2xl font-bold text-slate-900 tabular-nums">
                    {formatCurrency(essentialSpent, profile.currency, true)}
                  </p>
                  <p className="text-xs text-slate-500 mt-1 tabular-nums">
                    {totalSpent > 0
                      ? `${Math.round((essentialSpent / totalSpent) * 100)}% of monthly total`
                      : '0% of monthly total'}
                  </p>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col justify-between">
                <span className="text-xs font-medium text-slate-500">
                  Discretionary
                </span>
                <div className="mt-3">
                  <p className="font-display text-2xl font-bold text-slate-900 tabular-nums">
                    {formatCurrency(discretionarySpent, profile.currency, true)}
                  </p>
                  <p className="text-xs text-slate-500 mt-1 tabular-nums">
                    {totalSpent > 0
                      ? `${Math.round((discretionarySpent / totalSpent) * 100)}% planned lifestyle`
                      : '0% planned lifestyle'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onNavigateTab('expenses')}
                className="bg-white border border-slate-200 hover:border-rose-300 rounded-2xl p-5 flex flex-col justify-between text-left transition-colors cursor-pointer"
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-xs font-medium text-rose-700">
                    Unnecessary Waste
                  </span>
                  <TrendingDown size={16} className="text-rose-600" />
                </div>
                <div className="mt-3">
                  <p className="font-display text-2xl font-bold text-rose-700 tabular-nums">
                    {formatCurrency(unnecessarySpent, profile.currency, true)}
                  </p>
                  <p className="text-xs text-slate-600 mt-1 tabular-nums">
                    {unnecessaryItems.length} flagged · Save{' '}
                    {formatCurrency(unnecessarySpent * 12, profile.currency, true)}
                    /yr
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => onNavigateTab('alerts')}
                className="bg-white border border-slate-200 hover:border-teal-300 rounded-2xl p-5 flex flex-col justify-between text-left transition-colors cursor-pointer"
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-xs font-medium text-slate-500">
                    Spending Alerts
                  </span>
                  <BellRing
                    size={16}
                    className={
                      unreadAlerts > 0 ? 'text-amber-600' : 'text-slate-400'
                    }
                  />
                </div>
                <div className="mt-3">
                  <p className="font-display text-2xl font-bold text-slate-900 tabular-nums">
                    {unreadAlerts} Unread
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {alerts.length} total threshold notices
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* Family Member Separation Section */}
          <section className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6">
            <div className="flex items-center justify-between gap-4 mb-5">
              <div>
                <h3 className="font-display text-lg font-bold text-slate-900">
                  Spending by Family Member
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Tap a member to inspect their daily ledger and cap pace
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab('members')}
                className="min-h-[40px] px-3 py-1.5 text-xs font-semibold text-teal-700 hover:bg-teal-50 rounded-xl flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <span>Manage Members</span>
                <ArrowRight size={14} />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {members.map((member) => {
                const memberExpenses = expenses.filter(
                  (e) => e.memberId === member.id
                );
                const memberTotal = memberExpenses.reduce(
                  (s, e) => s + e.amountCents,
                  0
                );
                const memberUnnecessary = memberExpenses
                  .filter((e) => e.necessity === 'unnecessary')
                  .reduce((s, e) => s + e.amountCents, 0);
                const cap = Math.max(member.monthlyCapCents, 1);
                const ratio = Math.min((memberTotal / cap) * 100, 100);
                const overCap = memberTotal > member.monthlyCapCents;

                return (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => onInspectMember(member.id)}
                    className="text-left p-4 rounded-2xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50/70 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className="w-8 h-8 rounded-full text-xs font-bold text-white flex items-center justify-center shrink-0"
                          style={{ backgroundColor: member.avatarTint }}
                        >
                          {member.name.slice(0, 1).toUpperCase()}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900 truncate">
                            {member.name}
                          </p>
                          <p className="text-xs text-slate-500">{member.role}</p>
                        </div>
                      </div>
                      {overCap && (
                        <span className="text-[11px] font-semibold text-rose-700 shrink-0">
                          Over Cap
                        </span>
                      )}
                    </div>

                    <div className="mt-4">
                      <div className="flex items-baseline justify-between text-xs mb-1.5">
                        <span className="font-display text-base font-bold text-slate-900 tabular-nums">
                          {formatCurrency(memberTotal, profile.currency, true)}
                        </span>
                        <span className="text-slate-500 tabular-nums">
                          / {formatCurrency(member.monthlyCapCents, profile.currency, true)}
                        </span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${ratio}%`,
                            backgroundColor: overCap
                              ? '#DC2626'
                              : member.avatarTint,
                          }}
                        />
                      </div>
                      <p className="mt-2 text-xs text-slate-500 tabular-nums">
                        {memberExpenses.length} items ·{' '}
                        <span
                          className={
                            memberUnnecessary > 0
                              ? 'text-rose-700 font-medium'
                              : ''
                          }
                        >
                          {formatCurrency(memberUnnecessary, profile.currency, true)}{' '}
                          unnecessary
                        </span>
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Recharts Monthly Trend & Category Breakdown */}
          <OverviewCharts
            expenses={expenses}
            monthlyTrend={monthlyTrend}
            monthlyBudgetCents={profile.monthlyBudgetCents}
            currency={profile.currency}
            monthKey={monthKey}
          />

          {/* Daily Trend + Unnecessary Spending Radar */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Unnecessary Spending Radar */}
            <section className="lg:col-span-7 bg-white border border-slate-200 rounded-3xl p-5 sm:p-6">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <h3 className="font-display text-lg font-bold text-slate-900">
                    Unnecessary Spending Radar
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Cut these non-essential items to recover{' '}
                    <span className="font-semibold text-rose-700 tabular-nums">
                      {formatCurrency(unnecessarySpent, profile.currency)}/mo
                    </span>
                  </p>
                </div>
                <span className="text-xs font-semibold text-emerald-700 tabular-nums shrink-0">
                  {formatCurrency(unnecessarySpent * 12, profile.currency, true)}
                  /yr potential
                </span>
              </div>

              {unnecessaryItems.length === 0 && reviewCandidates.length === 0 ? (
                <div className="py-8 text-center text-sm text-slate-500">
                  No unnecessary expenses flagged this month.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {unnecessaryItems.map((item) => {
                    const m = memberMap.get(item.memberId);
                    return (
                      <div
                        key={item.id}
                        className="py-3.5 flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${getCategoryTint(item.category)}`}
                          >
                            <CategoryIcon category={item.category} size={17} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-900 truncate">
                              {item.title}
                            </p>
                            <p className="text-xs text-slate-500 truncate">
                              {m?.name || 'Member'} ·{' '}
                              {item.unnecessaryReason || item.category} ·{' '}
                              {item.spentAt}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-sm font-bold text-rose-700 tabular-nums">
                            {formatCurrency(item.amountCents, profile.currency)}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              onToggleNecessity(item, 'essential')
                            }
                            className="min-h-[36px] px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg cursor-pointer"
                          >
                            Keep
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {reviewCandidates.map((item) => {
                    const m = memberMap.get(item.memberId);
                    const hint = suggestNecessityHint(
                      item.title,
                      item.merchant,
                      item.category
                    );
                    return (
                      <div
                        key={item.id}
                        className="py-3.5 flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-full bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
                            <AlertTriangle size={17} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-900 truncate">
                              {item.title}
                            </p>
                            <p className="text-xs text-amber-800 truncate">
                              Suggested review · {m?.name || 'Member'} ·{' '}
                              {hint.suggestedReason}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-sm font-semibold text-slate-900 tabular-nums">
                            {formatCurrency(item.amountCents, profile.currency)}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              onToggleNecessity(
                                item,
                                'unnecessary',
                                hint.suggestedReason
                              )
                            }
                            className="min-h-[36px] px-2.5 py-1 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg cursor-pointer"
                          >
                            Flag Waste
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Daily Cashflow Bars */}
            <section className="lg:col-span-5 bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 flex flex-col justify-between">
              <div>
                <h3 className="font-display text-lg font-bold text-slate-900">
                  Daily Spending Pace
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Daily household outflow with unnecessary spend highlighted
                </p>
              </div>

              <div className="mt-6 h-48 flex items-end gap-2">
                {dailySeries.map((day) => {
                  const totalPct = Math.max(
                    Math.round((day.total / maxDaily) * 100),
                    6
                  );
                  const wastePct =
                    day.total > 0
                      ? Math.round((day.unnecessary / day.total) * 100)
                      : 0;
                  return (
                    <div
                      key={day.date}
                      className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end min-w-0"
                      title={`${day.date}: ${formatCurrency(day.total, profile.currency)}`}
                    >
                      <div
                        className="w-full max-w-[24px] rounded-t-lg overflow-hidden bg-teal-700 flex flex-col justify-start"
                        style={{ height: `${totalPct}%` }}
                      >
                        {wastePct > 0 && (
                          <div
                            className="w-full bg-rose-500"
                            style={{ height: `${wastePct}%` }}
                          />
                        )}
                      </div>
                      <span className="text-[10px] font-mono text-slate-500 tabular-nums">
                        {day.label}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span>Teal: Essential &amp; Planned</span>
                <span className="text-rose-700 font-medium">
                  Red: Unnecessary
                </span>
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
