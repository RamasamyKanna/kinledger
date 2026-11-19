import { useState } from 'react';
import { Pencil, Plus, Trash2, UserPlus, X } from 'lucide-react';
import {
  ExpenseItem,
  FamilyMember,
  HouseholdProfile,
  MEMBER_TINTS,
  formatCurrency,
  formatMonthLabel,
} from '../types';

interface MembersTabProps {
  profile: HouseholdProfile;
  monthKey: string;
  members: FamilyMember[];
  expenses: ExpenseItem[];
  onCreateMember: (payload: {
    name: string;
    role: string;
    monthlyCapCents: number;
    avatarTint: string;
  }) => Promise<void>;
  onUpdateMember: (
    id: number,
    payload: {
      name: string;
      role: string;
      monthlyCapCents: number;
      avatarTint: string;
    }
  ) => Promise<void>;
  onDeleteMember: (id: number) => Promise<void>;
  onAddExpenseForMember: (memberId: number) => void;
  onInspectMemberLedger: (memberId: number) => void;
}

const ROLE_OPTIONS = ['Primary', 'Partner', 'Teen', 'Child', 'Dependent'];

export function MembersTab({
  profile,
  monthKey,
  members,
  expenses,
  onCreateMember,
  onUpdateMember,
  onDeleteMember,
  onAddExpenseForMember,
  onInspectMemberLedger,
}: MembersTabProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<FamilyMember | null>(null);
  const [name, setName] = useState('');
  const [role, setRole] = useState('Partner');
  const [capDollars, setCapDollars] = useState('1000');
  const [avatarTint, setAvatarTint] = useState<string>(MEMBER_TINTS[1]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openCreate() {
    setEditingMember(null);
    setName('');
    setRole('Partner');
    setCapDollars('1000');
    setAvatarTint(MEMBER_TINTS[members.length % MEMBER_TINTS.length]);
    setError(null);
    setFormOpen(true);
  }

  function openEdit(member: FamilyMember) {
    setEditingMember(member);
    setName(member.name);
    setRole(member.role);
    setCapDollars(String(Math.round(member.monthlyCapCents / 100)));
    setAvatarTint(member.avatarTint);
    setError(null);
    setFormOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const parsedCap = Number.parseFloat(capDollars);
    if (!name.trim()) {
      setError('Enter a name for this family member.');
      return;
    }
    if (!Number.isFinite(parsedCap) || parsedCap < 0) {
      setError('Enter a valid monthly spending cap.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: name.trim(),
        role: role.trim() || 'Member',
        monthlyCapCents: Math.round(parsedCap * 100),
        avatarTint,
      };
      if (editingMember) {
        await onUpdateMember(editingMember.id, payload);
      } else {
        await onCreateMember(payload);
      }
      setFormOpen(false);
    } catch (err: any) {
      setError(err?.message || 'Could not save member.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-slate-900">
            Family Members &amp; Monthly Caps
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Separate expenses by household member for {formatMonthLabel(monthKey)}
          </p>
        </div>

        <button
          type="button"
          onClick={openCreate}
          className="min-h-[44px] px-4 py-2.5 bg-teal-700 hover:bg-teal-800 text-white text-sm font-semibold rounded-xl flex items-center justify-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
        >
          <UserPlus size={17} />
          <span>Add Family Member</span>
        </button>
      </div>

      {formOpen && (
        <section className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display text-base font-bold text-slate-900">
              {editingMember ? `Edit ${editingMember.name}` : 'New Family Member'}
            </h3>
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              aria-label="Close member form"
              className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label
                  htmlFor="member-name"
                  className="block text-xs font-medium text-slate-600 mb-1"
                >
                  Name
                </label>
                <input
                  id="member-name"
                  type="text"
                  placeholder="e.g. Maya"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-600"
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="member-role"
                  className="block text-xs font-medium text-slate-600 mb-1"
                >
                  Role
                </label>
                <select
                  id="member-role"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-600"
                >
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="member-cap"
                  className="block text-xs font-medium text-slate-600 mb-1"
                >
                  Monthly Cap ({profile.currency})
                </label>
                <input
                  id="member-cap"
                  type="number"
                  min="0"
                  step="10"
                  value={capDollars}
                  onChange={(e) => setCapDollars(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 py-2 text-sm tabular-nums bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-600"
                  required
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-slate-600 mr-1">
                  Color:
                </span>
                {MEMBER_TINTS.map((tint) => (
                  <button
                    key={tint}
                    type="button"
                    onClick={() => setAvatarTint(tint)}
                    aria-label={`Select color ${tint}`}
                    className={`w-8 h-8 rounded-full transition-transform cursor-pointer ${
                      avatarTint === tint
                        ? 'ring-2 ring-offset-2 ring-slate-900 scale-105'
                        : ''
                    }`}
                    style={{ backgroundColor: tint }}
                  />
                ))}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="min-h-[44px] px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="min-h-[44px] px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-xl cursor-pointer disabled:opacity-60"
                >
                  {saving ? 'Saving...' : 'Save Member'}
                </button>
              </div>
            </div>

            {error && (
              <p role="alert" className="text-xs text-rose-700">
                {error}
              </p>
            )}
          </form>
        </section>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {members.map((member) => {
          const memberExpenses = expenses.filter(
            (e) => e.memberId === member.id
          );
          const total = memberExpenses.reduce((s, e) => s + e.amountCents, 0);
          const essential = memberExpenses
            .filter((e) => e.necessity === 'essential')
            .reduce((s, e) => s + e.amountCents, 0);
          const unnecessary = memberExpenses
            .filter((e) => e.necessity === 'unnecessary')
            .reduce((s, e) => s + e.amountCents, 0);

          const cap = Math.max(member.monthlyCapCents, 1);
          const pct = Math.round((total / cap) * 100);
          const barWidth = Math.min(pct, 100);
          const overCap = total > member.monthlyCapCents;

          return (
            <section
              key={member.id}
              className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className="w-11 h-11 rounded-2xl text-base font-bold text-white flex items-center justify-center shrink-0"
                      style={{ backgroundColor: member.avatarTint }}
                    >
                      {member.name.slice(0, 1).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <h3 className="font-display text-lg font-bold text-slate-900 truncate">
                        {member.name}
                      </h3>
                      <p className="text-xs text-slate-500">
                        {member.role} · {memberExpenses.length} transactions
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => openEdit(member)}
                      aria-label={`Edit ${member.name}`}
                      className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
                    >
                      <Pencil size={16} />
                    </button>
                    {members.length > 1 && (
                      <button
                        type="button"
                        onClick={() => onDeleteMember(member.id)}
                        aria-label={`Remove ${member.name}`}
                        className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-slate-400 hover:text-rose-700 hover:bg-rose-50 cursor-pointer"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>

                <div className="mt-5">
                  <div className="flex items-baseline justify-between mb-2">
                    <span className="font-display text-2xl font-bold text-slate-900 tabular-nums">
                      {formatCurrency(total, profile.currency)}
                    </span>
                    <span
                      className={`text-xs font-semibold tabular-nums ${
                        overCap ? 'text-rose-700' : 'text-slate-500'
                      }`}
                    >
                      {pct}% of{' '}
                      {formatCurrency(member.monthlyCapCents, profile.currency)}{' '}
                      cap
                    </span>
                  </div>
                  <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${barWidth}%`,
                        backgroundColor: overCap ? '#DC2626' : member.avatarTint,
                      }}
                    />
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-slate-500">Essential Spend</span>
                    <p className="font-semibold text-slate-900 tabular-nums mt-0.5">
                      {formatCurrency(essential, profile.currency)}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-500">Unnecessary Flagged</span>
                    <p
                      className={`font-semibold tabular-nums mt-0.5 ${
                        unnecessary > 0 ? 'text-rose-700' : 'text-slate-900'
                      }`}
                    >
                      {formatCurrency(unnecessary, profile.currency)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-5 pt-4 border-t border-slate-100 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onAddExpenseForMember(member.id)}
                  className="flex-1 min-h-[42px] px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Plus size={15} />
                  <span>Log for {member.name}</span>
                </button>
                <button
                  type="button"
                  onClick={() => onInspectMemberLedger(member.id)}
                  className="min-h-[42px] px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl cursor-pointer"
                >
                  View Ledger
                </button>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
