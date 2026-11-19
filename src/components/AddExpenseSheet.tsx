import { useEffect, useState } from 'react';
import { AlertTriangle, Check, X } from 'lucide-react';
import {
  EXPENSE_CATEGORIES,
  ExpenseItem,
  FamilyMember,
  NecessityLevel,
  UNNECESSARY_REASONS,
  suggestNecessityHint,
} from '../types';

interface AddExpenseSheetProps {
  isOpen: boolean;
  members: FamilyMember[];
  currency: string;
  editingExpense: ExpenseItem | null;
  defaultMemberId?: number;
  onClose: () => void;
  onSubmit: (payload: {
    id?: number;
    memberId: number;
    title: string;
    merchant: string;
    category: string;
    amountCents: number;
    spentAt: string;
    necessity: NecessityLevel;
    unnecessaryReason: string;
    notes: string;
  }) => Promise<void>;
}

export function AddExpenseSheet({
  isOpen,
  members,
  currency,
  editingExpense,
  defaultMemberId,
  onClose,
  onSubmit,
}: AddExpenseSheetProps) {
  const [title, setTitle] = useState('');
  const [merchant, setMerchant] = useState('');
  const [amountInput, setAmountInput] = useState('');
  const [memberId, setMemberId] = useState<number>(0);
  const [category, setCategory] = useState<string>('Groceries');
  const [spentAt, setSpentAt] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [necessity, setNecessity] = useState<NecessityLevel>('essential');
  const [unnecessaryReason, setUnnecessaryReason] = useState<string>(
    'Impulse purchase'
  );
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    if (editingExpense) {
      setTitle(editingExpense.title);
      setMerchant(editingExpense.merchant || '');
      setAmountInput((editingExpense.amountCents / 100).toFixed(2));
      setMemberId(editingExpense.memberId);
      setCategory(editingExpense.category);
      setSpentAt(editingExpense.spentAt);
      setNecessity(editingExpense.necessity);
      setUnnecessaryReason(
        editingExpense.unnecessaryReason || 'Impulse purchase'
      );
      setNotes(editingExpense.notes || '');
    } else {
      setTitle('');
      setMerchant('');
      setAmountInput('');
      setMemberId(defaultMemberId || members[0]?.id || 0);
      setCategory('Groceries');
      setSpentAt(new Date().toISOString().slice(0, 10));
      setNecessity('essential');
      setUnnecessaryReason('Impulse purchase');
      setNotes('');
    }
  }, [isOpen, editingExpense, members, defaultMemberId]);

  if (!isOpen) return null;

  const hint = suggestNecessityHint(title, merchant, category);
  const currencySymbol =
    currency === 'INR'
      ? '₹'
      : currency === 'EUR'
        ? '€'
        : currency === 'GBP'
          ? '£'
          : '$';

  async function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsedAmount = Number.parseFloat(amountInput);
    if (!title.trim()) {
      setError('Enter a short description for this expense.');
      return;
    }
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError('Enter a valid amount greater than zero.');
      return;
    }
    if (!memberId) {
      setError('Select which family member made this purchase.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        id: editingExpense?.id,
        memberId,
        title: title.trim(),
        merchant: merchant.trim(),
        category,
        amountCents: Math.round(parsedAmount * 100),
        spentAt,
        necessity,
        unnecessaryReason:
          necessity === 'unnecessary' ? unnecessaryReason : '',
        notes: notes.trim(),
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Unable to save expense.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="expense-sheet-title"
    >
      <div className="w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-3xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-200">
        <div className="sm:hidden pt-3 pb-1 flex justify-center">
          <div className="w-10 h-1.5 bg-slate-300 rounded-full" />
        </div>

        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2
            id="expense-sheet-title"
            className="font-display text-lg font-bold text-slate-900"
          >
            {editingExpense ? 'Edit Expense' : 'Log Household Expense'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close expense drawer"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        <form
          onSubmit={handleFormSubmit}
          className="flex-1 overflow-y-auto px-5 py-4 space-y-5"
        >
          <div>
            <label
              htmlFor="expense-amount"
              className="block text-xs font-medium text-slate-500 mb-1.5"
            >
              Amount ({currency})
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-4 text-2xl font-display font-bold text-slate-400">
                {currencySymbol}
              </span>
              <input
                id="expense-amount"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                className="w-full pl-10 pr-4 py-3 text-2xl font-display font-bold tabular-nums text-slate-900 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-teal-600 focus:bg-white"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="expense-title"
                className="block text-xs font-medium text-slate-600 mb-1"
              >
                Item or Description
              </label>
              <input
                id="expense-title"
                type="text"
                placeholder="e.g. Weekly groceries"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-600"
                required
              />
            </div>
            <div>
              <label
                htmlFor="expense-merchant"
                className="block text-xs font-medium text-slate-600 mb-1"
              >
                Merchant (optional)
              </label>
              <input
                id="expense-merchant"
                type="text"
                placeholder="e.g. Trader Joe’s"
                value={merchant}
                onChange={(e) => setMerchant(e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>
          </div>

          <div>
            <span className="block text-xs font-medium text-slate-600 mb-2">
              Family Member
            </span>
            <div className="flex flex-wrap gap-2">
              {members.map((m) => {
                const active = m.id === memberId;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMemberId(m.id)}
                    className={`min-h-[44px] px-3.5 py-2 rounded-xl text-sm font-medium flex items-center gap-2 border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      active
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <span
                      className="w-5 h-5 rounded-full text-[11px] font-bold text-white flex items-center justify-center shrink-0"
                      style={{ backgroundColor: m.avatarTint }}
                    >
                      {m.name.slice(0, 1).toUpperCase()}
                    </span>
                    <span>{m.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="expense-category"
                className="block text-xs font-medium text-slate-600 mb-1"
              >
                Category
              </label>
              <select
                id="expense-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-600"
              >
                {EXPENSE_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="expense-date"
                className="block text-xs font-medium text-slate-600 mb-1"
              >
                Date
              </label>
              <input
                id="expense-date"
                type="date"
                value={spentAt}
                onChange={(e) => setSpentAt(e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-600"
                required
              />
            </div>
          </div>

          <div>
            <span className="block text-xs font-medium text-slate-600 mb-2">
              Spending Classification
            </span>
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-xl">
              {(
                [
                  { id: 'essential', label: 'Essential' },
                  { id: 'discretionary', label: 'Discretionary' },
                  { id: 'unnecessary', label: 'Unnecessary' },
                ] as const
              ).map((opt) => {
                const active = necessity === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setNecessity(opt.id)}
                    className={`min-h-[40px] px-2 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      active
                        ? opt.id === 'unnecessary'
                          ? 'bg-rose-600 text-white'
                          : 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>

            {hint.isSuspect && necessity !== 'unnecessary' && (
              <div className="mt-2.5 p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between gap-3">
                <div className="flex items-start gap-2 text-xs text-amber-900">
                  <AlertTriangle size={15} className="shrink-0 mt-0.5 text-amber-700" />
                  <span>
                    Looks like a potential non-essential spend (
                    {hint.suggestedReason}).
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setNecessity('unnecessary');
                    setUnnecessaryReason(hint.suggestedReason);
                  }}
                  className="min-h-[36px] px-3 py-1 bg-white border border-amber-300 rounded-lg text-xs font-semibold text-amber-900 hover:bg-amber-100 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Flag Waste
                </button>
              </div>
            )}

            {necessity === 'unnecessary' && (
              <div className="mt-3">
                <label
                  htmlFor="unnecessary-reason"
                  className="block text-xs font-medium text-rose-700 mb-1"
                >
                  Why was this unnecessary?
                </label>
                <select
                  id="unnecessary-reason"
                  value={unnecessaryReason}
                  onChange={(e) => setUnnecessaryReason(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-rose-50/60 border border-rose-200 text-rose-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500"
                >
                  {UNNECESSARY_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div>
            <label
              htmlFor="expense-notes"
              className="block text-xs font-medium text-slate-600 mb-1"
            >
              Notes (optional)
            </label>
            <input
              id="expense-notes"
              type="text"
              placeholder="Optional receipt or context note"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-600"
            />
          </div>

          {error && (
            <div
              role="alert"
              className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700"
            >
              {error}
            </div>
          )}

          <div className="pt-2 pb-safe">
            <button
              type="submit"
              disabled={saving}
              className="w-full min-h-[48px] rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-semibold text-sm flex items-center justify-center gap-2 active:scale-[0.99] transition-transform cursor-pointer disabled:opacity-60"
            >
              <Check size={18} />
              <span>
                {saving
                  ? 'Saving...'
                  : editingExpense
                    ? 'Save Changes'
                    : 'Save Expense'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
