import { useState } from 'react';
import {
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ExpenseItem,
  MonthlyTrendPoint,
  formatCurrency,
  formatMonthLabel,
} from '../types';

interface OverviewChartsProps {
  expenses: ExpenseItem[];
  monthlyTrend: MonthlyTrendPoint[];
  monthlyBudgetCents: number;
  currency: string;
  monthKey: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  Housing: '#0F172A',
  Groceries: '#0F766E',
  Utilities: '#D97706',
  'Dining Out': '#EA580C',
  Transport: '#0284C7',
  Subscriptions: '#4F46E5',
  Healthcare: '#BE123C',
  Shopping: '#C026D3',
  Entertainment: '#7C3AED',
  Education: '#0D9488',
};

const FALLBACK_COLORS = [
  '#0F766E',
  '#1D4ED8',
  '#D97706',
  '#DC2626',
  '#7C3AED',
  '#0284C7',
  '#475569',
];

function shortMonthLabel(mk: string): string {
  const [y, m] = mk.split('-').map(Number);
  if (!y || !m) return mk;
  return new Intl.DateTimeFormat('en-US', { month: 'short' }).format(
    new Date(y, m - 1, 1)
  );
}

export function OverviewCharts({
  expenses,
  monthlyTrend,
  monthlyBudgetCents,
  currency,
  monthKey,
}: OverviewChartsProps) {
  const activeMonthsCount = monthlyTrend.filter(
    (m) => m.totalSpentCents > 0
  ).length;

  const [trendMode, setTrendMode] = useState<'month' | '6months'>(
    activeMonthsCount > 1 ? '6months' : 'month'
  );

  // Build cumulative daily spending trend for the selected month
  const dailyTotals = new Map<string, { total: number; unnecessary: number }>();
  for (const exp of expenses) {
    const prev = dailyTotals.get(exp.spentAt) || { total: 0, unnecessary: 0 };
    prev.total += exp.amountCents;
    if (exp.necessity === 'unnecessary') {
      prev.unnecessary += exp.amountCents;
    }
    dailyTotals.set(exp.spentAt, prev);
  }

  let runningTotalCents = 0;
  let runningWasteCents = 0;
  const cumulativeDailyData = Array.from(dailyTotals.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, val]) => {
      runningTotalCents += val.total;
      runningWasteCents += val.unnecessary;
      return {
        label: date.slice(5), // MM-DD
        total: Number((runningTotalCents / 100).toFixed(2)),
        unnecessary: Number((runningWasteCents / 100).toFixed(2)),
      };
    });

  const sixMonthData = monthlyTrend.map((point) => ({
    label: shortMonthLabel(point.monthKey),
    total: Number((point.totalSpentCents / 100).toFixed(2)),
    unnecessary: Number((point.unnecessaryCents / 100).toFixed(2)),
  }));

  const lineData =
    trendMode === '6months' ? sixMonthData : cumulativeDailyData;
  const budgetDollars = Math.round(monthlyBudgetCents / 100);

  // Build category breakdown for PieChart
  const categoryTotals = new Map<string, number>();
  for (const exp of expenses) {
    categoryTotals.set(
      exp.category,
      (categoryTotals.get(exp.category) || 0) + exp.amountCents
    );
  }
  const grandTotalCents = Math.max(
    expenses.reduce((s, e) => s + e.amountCents, 0),
    1
  );

  const pieData = Array.from(categoryTotals.entries())
    .sort(([, a], [, b]) => b - a)
    .map(([name, cents], idx) => ({
      name,
      cents,
      value: Number((cents / 100).toFixed(2)),
      pct: Math.round((cents / grandTotalCents) * 100),
      color:
        CATEGORY_COLORS[name] ||
        FALLBACK_COLORS[idx % FALLBACK_COLORS.length],
    }));

  const currencySymbol =
    currency === 'INR'
      ? '₹'
      : currency === 'EUR'
        ? '€'
        : currency === 'GBP'
          ? '£'
          : '$';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Monthly Spending Trend Line Chart */}
      <section className="lg:col-span-7 bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 flex flex-col justify-between">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div>
            <h3 className="font-display text-lg font-bold text-slate-900">
              Monthly Spending Trend
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {trendMode === 'month'
                ? `Cumulative household outflow in ${formatMonthLabel(monthKey)} vs. budget cap`
                : 'Trailing 6-month total spending vs. unnecessary waste'}
            </p>
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setTrendMode('month')}
              className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                trendMode === 'month'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              This Month
            </button>
            <button
              type="button"
              onClick={() => setTrendMode('6months')}
              className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                trendMode === '6months'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              6-Month
            </button>
          </div>
        </div>

        <div className="w-full h-[250px] min-h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={lineData}
              margin={{ top: 10, right: 12, left: 0, bottom: 4 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="#E2E8F0"
              />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: '#64748B' }}
                axisLine={false}
                tickLine={false}
                dy={6}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#64748B' }}
                axisLine={false}
                tickLine={false}
                width={52}
                tickFormatter={(v: number) =>
                  `${currencySymbol}${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}`
                }
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#FFFFFF',
                  borderColor: '#E2E8F0',
                  borderRadius: '14px',
                  fontSize: '12px',
                  boxShadow: '0 4px 12px rgba(15, 23, 42, 0.08)',
                }}
                formatter={(value, name) => {
                  const num = typeof value === 'number' ? value : Number(value || 0);
                  return [
                    formatCurrency(Math.round(num * 100), currency),
                    name === 'total' ? 'Total Spend' : 'Unnecessary Spend',
                  ];
                }}
              />
              <ReferenceLine
                y={budgetDollars}
                stroke="#94A3B8"
                strokeDasharray="4 4"
                label={{
                  value: `Budget ${currencySymbol}${budgetDollars.toLocaleString()}`,
                  position: 'insideTopRight',
                  fill: '#64748B',
                  fontSize: 11,
                }}
              />
              <Line
                type="monotone"
                dataKey="total"
                name="total"
                stroke="#0F766E"
                strokeWidth={2.5}
                dot={{ r: 3.5, fill: '#0F766E', strokeWidth: 0 }}
                activeDot={{ r: 5.5, fill: '#0F766E' }}
              />
              <Line
                type="monotone"
                dataKey="unnecessary"
                name="unnecessary"
                stroke="#DC2626"
                strokeWidth={2}
                dot={{ r: 3, fill: '#DC2626', strokeWidth: 0 }}
                activeDot={{ r: 5, fill: '#DC2626' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 font-medium text-slate-700">
              <span className="w-3 h-0.5 bg-teal-700 inline-block" />
              Total Spend
            </span>
            <span className="flex items-center gap-1.5 font-medium text-rose-700">
              <span className="w-3 h-0.5 bg-rose-600 inline-block" />
              Unnecessary
            </span>
          </div>
          <span className="tabular-nums">
            Monthly Cap: {formatCurrency(monthlyBudgetCents, currency, true)}
          </span>
        </div>
      </section>

      {/* Category-Based Pie Chart */}
      <section className="lg:col-span-5 bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 flex flex-col justify-between">
        <div>
          <h3 className="font-display text-lg font-bold text-slate-900">
            Spending by Category
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Share of {formatMonthLabel(monthKey)} household outflow
          </p>
        </div>

        <div className="mt-3 flex flex-col sm:flex-row lg:flex-col xl:flex-row items-center gap-4">
          <div className="w-full sm:w-48 lg:w-full xl:w-48 h-[196px] shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={52}
                  outerRadius={82}
                  paddingAngle={2}
                  stroke="none"
                >
                  {pieData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#FFFFFF',
                    borderColor: '#E2E8F0',
                    borderRadius: '12px',
                    fontSize: '12px',
                  }}
                  formatter={(value) => {
                    const num =
                      typeof value === 'number' ? value : Number(value || 0);
                    return [
                      formatCurrency(Math.round(num * 100), currency),
                      'Spent',
                    ];
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="flex-1 w-full space-y-2.5 max-h-[200px] overflow-y-auto pr-1">
            {pieData.map((item) => (
              <div
                key={item.name}
                className="flex items-center justify-between gap-2 text-xs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="font-medium text-slate-700 truncate">
                    {item.name}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0 tabular-nums">
                  <span className="font-semibold text-slate-900">
                    {formatCurrency(item.cents, currency, true)}
                  </span>
                  <span className="text-slate-400 w-8 text-right">
                    {item.pct}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
