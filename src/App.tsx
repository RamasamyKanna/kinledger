import { useCallback, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signOut } from 'firebase/auth';
import {
  BellRing,
  LayoutGrid,
  ListOrdered,
  LogOut,
  Plus,
  Users,
  X,
} from 'lucide-react';
import { AddExpenseSheet } from './components/AddExpenseSheet';
import { AlertsTab } from './components/AlertsTab';
import { AuthLanding } from './components/AuthLanding';
import { ExpensesTab } from './components/ExpensesTab';
import { ExpoKitModal } from './components/ExpoKitModal';
import { MembersTab } from './components/MembersTab';
import { OverviewTab } from './components/OverviewTab';
import { auth, dispatchLocalPushAlert } from './lib/firebase';
import {
  BudgetAlert,
  ExpenseItem,
  HouseholdResponse,
  NecessityLevel,
  getCurrentMonthKey,
} from './types';

type ActiveTab = 'overview' | 'expenses' | 'members' | 'alerts';

export default function App() {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);

  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [monthKey, setMonthKey] = useState<string>(getCurrentMonthKey());
  const [data, setData] = useState<HouseholdResponse | null>(null);
  const [loadingData, setLoadingData] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [memberFilter, setMemberFilter] = useState<number | 'all'>('all');
  const [expenseSheetOpen, setExpenseSheetOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<ExpenseItem | null>(
    null
  );
  const [defaultMemberId, setDefaultMemberId] = useState<number | undefined>(
    undefined
  );
  const [expoKitOpen, setExpoKitOpen] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [toastAlert, setToastAlert] = useState<BudgetAlert | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setAuthReady(true);
    });
    return unsub;
  }, []);

  const authFetch = useCallback(
    async (url: string, init: RequestInit = {}) => {
      if (!firebaseUser) {
        throw new Error('Authentication required.');
      }
      const token = await firebaseUser.getIdToken();
      const headers = new Headers(init.headers);
      headers.set('Authorization', `Bearer ${token}`);
      if (init.body && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
      }
      const response = await fetch(url, { ...init, headers });
      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        throw new Error(errBody.error || `Request failed (${response.status})`);
      }
      return response.json();
    },
    [firebaseUser]
  );

  const loadHousehold = useCallback(async () => {
    if (!firebaseUser) return;
    setLoadingData(true);
    setLoadError(null);
    try {
      const payload: HouseholdResponse = await authFetch(
        `/api/household?month=${encodeURIComponent(monthKey)}`
      );
      setData(payload);
    } catch (err: any) {
      setLoadError(err?.message || 'Unable to load household data.');
    } finally {
      setLoadingData(false);
    }
  }, [authFetch, firebaseUser, monthKey]);

  useEffect(() => {
    if (firebaseUser) {
      void loadHousehold();
    } else {
      setData(null);
    }
  }, [firebaseUser, loadHousehold]);

  function notifyNewAlerts(triggered?: BudgetAlert[]) {
    if (!triggered || triggered.length === 0) return;
    const latest = triggered[0];
    setToastAlert(latest);
    dispatchLocalPushAlert(latest.title, latest.message);
  }

  async function handleSaveExpense(payload: {
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
  }) {
    if (payload.id) {
      const res = await authFetch(`/api/expenses/${payload.id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      notifyNewAlerts(res.triggeredAlerts);
    } else {
      const res = await authFetch('/api/expenses', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      notifyNewAlerts(res.triggeredAlerts);
    }
    await loadHousehold();
  }

  async function handleDeleteExpense(expenseId: number) {
    await authFetch(`/api/expenses/${expenseId}`, { method: 'DELETE' });
    await loadHousehold();
  }

  async function handleToggleNecessity(
    expense: ExpenseItem,
    necessity: NecessityLevel,
    reason?: string
  ) {
    const res = await authFetch(`/api/expenses/${expense.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        necessity,
        unnecessaryReason:
          necessity === 'unnecessary' ? reason || 'Impulse purchase' : '',
      }),
    });
    notifyNewAlerts(res.triggeredAlerts);
    await loadHousehold();
  }

  async function handleCreateMember(payload: {
    name: string;
    role: string;
    monthlyCapCents: number;
    avatarTint: string;
  }) {
    await authFetch('/api/members', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    await loadHousehold();
  }

  async function handleUpdateMember(
    id: number,
    payload: {
      name: string;
      role: string;
      monthlyCapCents: number;
      avatarTint: string;
    }
  ) {
    const res = await authFetch(`/api/members/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    notifyNewAlerts(res.triggeredAlerts);
    await loadHousehold();
  }

  async function handleDeleteMember(id: number) {
    await authFetch(`/api/members/${id}`, { method: 'DELETE' });
    if (memberFilter === id) setMemberFilter('all');
    await loadHousehold();
  }

  async function handleUpdateSettings(payload: {
    householdName: string;
    monthlyBudgetCents: number;
    alertThresholdPct: number;
    currency: string;
    pushAlertsEnabled: boolean;
    fcmToken?: string | null;
    monthKey: string;
  }) {
    const res = await authFetch('/api/household/settings', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    notifyNewAlerts(res.triggeredAlerts);
    await loadHousehold();
  }

  async function handleMarkAlertRead(id: number) {
    await authFetch(`/api/alerts/${id}/read`, { method: 'POST' });
    await loadHousehold();
  }

  async function handleMarkAllRead() {
    await authFetch('/api/alerts/read-all', { method: 'POST' });
    await loadHousehold();
  }

  async function handleSeedSample() {
    setSeeding(true);
    try {
      await authFetch('/api/household/seed-sample', {
        method: 'POST',
        body: JSON.stringify({ monthKey }),
      });
      await loadHousehold();
    } finally {
      setSeeding(false);
    }
  }

  if (!authReady) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center text-sm text-slate-500">
        Loading workspace...
      </div>
    );
  }

  if (!firebaseUser) {
    return <AuthLanding />;
  }

  const unreadCount = data
    ? data.alerts.filter((a) => !a.isRead).length
    : 0;

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 pb-20 lg:pb-10">
      {/* Desktop Top Bar (3-Zone Contract) & Compact Mobile App Bar (52px) */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-[52px] lg:h-16 flex items-center justify-between gap-8">
          <a
            href="#overview"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('overview');
            }}
            className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
          >
            KinLedger
          </a>

          <nav
            className="hidden lg:flex items-center gap-7 text-sm font-medium text-slate-600"
            aria-label="Primary"
          >
            {(
              [
                { id: 'overview', label: 'Overview' },
                { id: 'expenses', label: 'Ledger' },
                { id: 'members', label: 'Members' },
                {
                  id: 'alerts',
                  label: unreadCount > 0 ? `Alerts (${unreadCount})` : 'Alerts',
                },
              ] as const
            ).map((item) => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'border-teal-700 text-slate-900 font-semibold'
                      : 'border-transparent hover:text-slate-900'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                setEditingExpense(null);
                setDefaultMemberId(undefined);
                setExpenseSheetOpen(true);
              }}
              className="min-h-[38px] lg:min-h-[40px] px-3.5 lg:px-4 py-1.5 bg-teal-700 hover:bg-teal-800 text-white text-xs sm:text-sm font-semibold rounded-xl flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus size={16} />
              <span>Log Expense</span>
            </button>
            <button
              type="button"
              onClick={() => signOut(auth)}
              aria-label="Sign out"
              title="Sign out"
              className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </header>

      {/* Instant Budget Alert Banner (Triggered on threshold breach) */}
      {toastAlert && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-4">
          <div
            role="status"
            className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-2.5 text-xs sm:text-sm text-amber-950 min-w-0">
              <BellRing size={17} className="text-amber-700 shrink-0" />
              <p className="truncate">
                <strong className="font-semibold">{toastAlert.title}:</strong>{' '}
                {toastAlert.message}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setToastAlert(null)}
              aria-label="Dismiss alert notice"
              className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-amber-800 hover:bg-amber-100 shrink-0 cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Main Content Canvas */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-5 lg:py-8">
        {loadError && (
          <div
            role="alert"
            className="mb-6 p-4 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-between gap-4 text-sm text-rose-800"
          >
            <span>{loadError}</span>
            <button
              type="button"
              onClick={loadHousehold}
              className="min-h-[36px] px-3 py-1 bg-white border border-rose-300 rounded-lg text-xs font-semibold cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        {loadingData && !data ? (
          <div className="bg-white border border-slate-200 rounded-3xl p-10 text-center text-sm text-slate-500">
            Loading household ledger...
          </div>
        ) : data ? (
          <>
            {activeTab === 'overview' && (
              <OverviewTab
                profile={data.profile}
                monthKey={data.monthKey}
                members={data.members}
                expenses={data.expenses}
                alerts={data.alerts}
                monthlyTrend={data.monthlyTrend || []}
                seeding={seeding}
                onSelectMonth={setMonthKey}
                onOpenAddExpense={() => {
                  setEditingExpense(null);
                  setDefaultMemberId(undefined);
                  setExpenseSheetOpen(true);
                }}
                onSeedSample={handleSeedSample}
                onToggleNecessity={handleToggleNecessity}
                onInspectMember={(id) => {
                  setMemberFilter(id);
                  setActiveTab('expenses');
                }}
                onNavigateTab={setActiveTab}
              />
            )}

            {activeTab === 'expenses' && (
              <ExpensesTab
                profile={data.profile}
                monthKey={data.monthKey}
                members={data.members}
                expenses={data.expenses}
                initialMemberFilter={memberFilter}
                onSelectMonth={setMonthKey}
                onChangeMemberFilter={setMemberFilter}
                onEditExpense={(exp) => {
                  setEditingExpense(exp);
                  setExpenseSheetOpen(true);
                }}
                onDeleteExpense={handleDeleteExpense}
                onToggleNecessity={handleToggleNecessity}
              />
            )}

            {activeTab === 'members' && (
              <MembersTab
                profile={data.profile}
                monthKey={data.monthKey}
                members={data.members}
                expenses={data.expenses}
                onCreateMember={handleCreateMember}
                onUpdateMember={handleUpdateMember}
                onDeleteMember={handleDeleteMember}
                onAddExpenseForMember={(memberId) => {
                  setEditingExpense(null);
                  setDefaultMemberId(memberId);
                  setExpenseSheetOpen(true);
                }}
                onInspectMemberLedger={(memberId) => {
                  setMemberFilter(memberId);
                  setActiveTab('expenses');
                }}
              />
            )}

            {activeTab === 'alerts' && (
              <AlertsTab
                profile={data.profile}
                alerts={data.alerts}
                monthKey={data.monthKey}
                onUpdateSettings={handleUpdateSettings}
                onMarkAlertRead={handleMarkAlertRead}
                onMarkAllRead={handleMarkAllRead}
                onOpenExpoKit={() => setExpoKitOpen(true)}
              />
            )}
          </>
        ) : null}
      </main>

      {/* Fixed Mobile Bottom Thumb Tab Bar (60px + safe-area, strictly < 15% cap with 52px top bar) */}
      <nav
        aria-label="Mobile navigation"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 pb-safe"
      >
        <div className="grid grid-cols-4 items-center h-[60px]">
          {(
            [
              { id: 'overview', label: 'Overview', icon: LayoutGrid },
              { id: 'expenses', label: 'Ledger', icon: ListOrdered },
              { id: 'members', label: 'Members', icon: Users },
              { id: 'alerts', label: 'Alerts', icon: BellRing },
            ] as const
          ).map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`min-h-[44px] flex flex-col items-center justify-center relative cursor-pointer ${
                  active ? 'text-teal-700' : 'text-slate-500'
                }`}
              >
                <Icon size={21} strokeWidth={active ? 2.4 : 1.9} />
                <span className="text-[10px] font-semibold tracking-tight mt-0.5">
                  {tab.label}
                  {tab.id === 'alerts' && unreadCount > 0
                    ? ` (${unreadCount})`
                    : ''}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Add / Edit Expense Sheet */}
      {data && (
        <AddExpenseSheet
          isOpen={expenseSheetOpen}
          members={data.members}
          currency={data.profile.currency}
          editingExpense={editingExpense}
          defaultMemberId={defaultMemberId}
          onClose={() => setExpenseSheetOpen(false)}
          onSubmit={handleSaveExpense}
        />
      )}

      {/* Expo + Supabase + FCM & GitHub Kit Modal */}
      <ExpoKitModal
        isOpen={expoKitOpen}
        onClose={() => setExpoKitOpen(false)}
      />
    </div>
  );
}
