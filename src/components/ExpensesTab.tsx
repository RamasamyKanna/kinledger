import { useState } from 'react';
import {
  AlertTriangle,
  Pencil,
  Search,
  Trash2,
} from 'lucide-react';
import {
  EXPENSE_CATEGORIES,
  ExpenseItem,
  FamilyMember,
  HouseholdProfile,
  NecessityLevel,
  formatCurrency,
  formatDayHeading,
  formatMonthLabel,
  getRecentMonthKeys,
} from '../types';
import { CategoryIcon, getCategoryTint } from './CategoryIcon';

interface ExpensesTabProps {
  profile: HouseholdProfile;
  monthKey: string;
  members: FamilyMember[];
  expenses: ExpenseItem[];
  initialMemberFilter: number | 'all';
  onSelectMonth: (monthKey: string) => void;
  onChangeMemberFilter: (id: number | 'all') => void;
  onEditExpense: (expense: ExpenseItem) => void;
  onDeleteExpense: (expenseId: number) => Promise<void>;
  onToggleNecessity: (
    expense: ExpenseItem,
    necessity: NecessityLevel,
    reason?: string
  ) => Promise<void>;
}

export function ExpensesTab({
  profile,
  monthKey,
  members,
  expenses,
  initialMemberFilter,
  onSelectMonth,
  onChangeMemberFilter,
  onEditExpense,
  onDeleteExpense,
  onToggleNecessity,
}: ExpensesTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [necessityFilter, setNecessityFilter] = useState<'all' | NecessityLevel>(
    'all'
  );
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const memberMap = new Map(members.map((m) => [m.id, m]));
  const recentMonths = getRecentMonthKeys(6);

  const filtered = expenses.filter((exp) => {
    if (
      initialMemberFilter !== 'all' &&
      exp.memberId !== initialMemberFilter
    ) {
      return false;
    }
    if (necessityFilter !== 'all' && exp.necessity !== necessityFilter) {
      return false;
    }
    if (categoryFilter !== 'all' && exp.category !== categoryFilter) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const hay =
        `${exp.title} ${exp.merchant} ${exp.category} ${exp.unnecessaryReason || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const filteredTotal = filtered.reduce((sum, e) => sum + e.amountCents, 0);

  // Group by YYYY-MM-DD
  const grouped = new Map<string, ExpenseItem[]>();
  for (const exp of filtered) {
    const list = grouped.get(exp.spentAt) || [];
    list.push(exp);
    grouped.set(exp.spentAt, list);
  }
  const dayKeys = Array.from(grouped.keys()).sort((a, b) => b.localeCompare(a));

  return (
    <div className="space-y-5">
      {/* Month & Search Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
          {recentMonths.map((mk) => {
            const active = mk === monthKey;
            return (
              <button
                key={mk}
                type="button"
                onClick={() => onSelectMonth(mk)}
                className={`min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer ${
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

        <div className="relative sm:w-72">
          <Search
            size={16}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="search"
            placeholder="Search merchant or item..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full min-h-[44px] pl-10 pr-3.5 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-600"
          />
        </div>
      </div>

      {/* Member & Necessity Filter Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          <button
            type="button"
            onClick={() => onChangeMemberFilter('all')}
            className={`min-h-[40px] px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer ${
              initialMemberFilter === 'all'
                ? 'bg-teal-700 text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900'
            }`}
          >
            All Members
          </button>
          {members.map((m) => {
            const active = initialMemberFilter === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => onChangeMemberFilter(m.id)}
                className={`min-h-[40px] px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-teal-700 text-white'
                    : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900'
                }`}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: active ? '#FFFFFF' : m.avatarTint }}
                />
                <span>{m.name}</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl overflow-x-auto no-scrollbar">
            {(
              [
                { id: 'all', label: 'All' },
                { id: 'essential', label: 'Essential' },
                { id: 'discretionary', label: 'Planned' },
                { id: 'unnecessary', label: 'Unnecessary' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setNecessityFilter(opt.id)}
                className={`min-h-[36px] px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer ${
                  necessityFilter === opt.id
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <select
            aria-label="Filter by category"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="min-h-[44px] px-3 py-2 text-xs font-medium bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-600"
          >
            <option value="all">All Categories</option>
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary Bar */}
      <div className="flex items-center justify-between px-1 text-xs text-slate-500">
        <span>
          Showing {filtered.length}{' '}
          {filtered.length === 1 ? 'transaction' : 'transactions'}
        </span>
        <span className="font-display text-sm font-bold text-slate-900 tabular-nums">
          Total: {formatCurrency(filteredTotal, profile.currency)}
        </span>
      </div>

      {/* Grouped Daily Ledger */}
      {dayKeys.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-3xl p-8 text-center text-sm text-slate-500">
          No expenses match your current filters.
        </div>
      ) : (
        <div className="space-y-4">
          {dayKeys.map((day) => {
            const items = grouped.get(day) || [];
            const daySum = items.reduce((s, e) => s + e.amountCents, 0);
            return (
              <section
                key={day}
                className="bg-white border border-slate-200 rounded-3xl overflow-hidden"
              >
                <div className="px-5 py-3 bg-slate-50/70 border-b border-slate-100 flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-800">
                    {formatDayHeading(day)}
                  </span>
                  <span className="font-mono font-medium text-slate-600 tabular-nums">
                    {formatCurrency(daySum, profile.currency)}
                  </span>
                </div>

                <div className="divide-y divide-slate-100">
                  {items.map((item) => {
                    const member = memberMap.get(item.memberId);
                    const isWaste = item.necessity === 'unnecessary';
                    return (
                      <div
                        key={item.id}
                        className="px-4 sm:px-5 py-3.5 min-h-[64px] flex items-center justify-between gap-3 hover:bg-slate-50/60 transition-colors"
                      >
                        <div className="flex items-center gap-3.5 min-w-0 flex-1">
                          <div
                            className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${getCategoryTint(item.category)}`}
                          >
                            <CategoryIcon category={item.category} size={17} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold text-slate-900 truncate">
                                {item.title}
                              </p>
                              {isWaste && (
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 shrink-0">
                                  <AlertTriangle size={12} />
                                  <span>Unnecessary</span>
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-500 truncate mt-0.5">
                              {item.merchant ? `${item.merchant} · ` : ''}
                              {member?.name || 'Member'} · {item.category}
                              {item.unnecessaryReason
                                ? ` · ${item.unnecessaryReason}`
                                : ''}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                          <span
                            className={`font-display text-sm sm:text-base font-bold tabular-nums mr-1 ${
                              isWaste ? 'text-rose-700' : 'text-slate-900'
                            }`}
                          >
                            {formatCurrency(item.amountCents, profile.currency)}
                          </span>

                          <button
                            type="button"
                            onClick={() =>
                              onToggleNecessity(
                                item,
                                isWaste ? 'essential' : 'unnecessary',
                                isWaste ? undefined : 'Impulse purchase'
                              )
                            }
                            title={
                              isWaste
                                ? 'Mark as essential'
                                : 'Flag as unnecessary spending'
                            }
                            aria-label={
                              isWaste
                                ? 'Mark as essential'
                                : 'Flag as unnecessary spending'
                            }
                            className={`min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl transition-colors cursor-pointer ${
                              isWaste
                                ? 'text-rose-700 bg-rose-50 hover:bg-rose-100'
                                : 'text-slate-400 hover:text-rose-700 hover:bg-rose-50'
                            }`}
                          >
                            <AlertTriangle size={16} />
                          </button>

                          <button
                            type="button"
                            onClick={() => onEditExpense(item)}
                            aria-label={`Edit ${item.title}`}
                            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
                          >
                            <Pencil size={16} />
                          </button>

                          <button
                            type="button"
                            onClick={() => onDeleteExpense(item.id)}
                            aria-label={`Delete ${item.title}`}
                            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-slate-400 hover:text-rose-700 hover:bg-rose-50 cursor-pointer"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
