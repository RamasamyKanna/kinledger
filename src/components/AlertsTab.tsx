import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  BellRing,
  CheckCheck,
  Code2,
  Save,
} from 'lucide-react';
import { dispatchLocalPushAlert, registerPushChannel } from '../lib/firebase';
import { BudgetAlert, HouseholdProfile } from '../types';

interface AlertsTabProps {
  profile: HouseholdProfile;
  alerts: BudgetAlert[];
  monthKey: string;
  onUpdateSettings: (payload: {
    householdName: string;
    monthlyBudgetCents: number;
    alertThresholdPct: number;
    currency: string;
    pushAlertsEnabled: boolean;
    fcmToken?: string | null;
    monthKey: string;
  }) => Promise<void>;
  onMarkAlertRead: (id: number) => Promise<void>;
  onMarkAllRead: () => Promise<void>;
  onOpenExpoKit: () => void;
}

export function AlertsTab({
  profile,
  alerts,
  monthKey,
  onUpdateSettings,
  onMarkAlertRead,
  onMarkAllRead,
  onOpenExpoKit,
}: AlertsTabProps) {
  const [householdName, setHouseholdName] = useState(profile.householdName);
  const [budgetDollars, setBudgetDollars] = useState(
    String(Math.round(profile.monthlyBudgetCents / 100))
  );
  const [thresholdPct, setThresholdPct] = useState(
    String(profile.alertThresholdPct)
  );
  const [currency, setCurrency] = useState(profile.currency);
  const [pushEnabled, setPushEnabled] = useState(profile.pushAlertsEnabled);
  const [pushStatus, setPushStatus] = useState<string>(
    profile.fcmToken ? 'Push channel linked' : 'Browser push not yet activated'
  );
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  useEffect(() => {
    setHouseholdName(profile.householdName);
    setBudgetDollars(String(Math.round(profile.monthlyBudgetCents / 100)));
    setThresholdPct(String(profile.alertThresholdPct));
    setCurrency(profile.currency);
    setPushEnabled(profile.pushAlertsEnabled);
  }, [profile]);

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    const parsedBudget = Number.parseFloat(budgetDollars);
    const parsedPct = Number.parseInt(thresholdPct, 10);
    if (!Number.isFinite(parsedBudget) || parsedBudget < 10) return;

    setSaving(true);
    setSavedNotice(null);
    try {
      await onUpdateSettings({
        householdName: householdName.trim() || 'Our Household',
        monthlyBudgetCents: Math.round(parsedBudget * 100),
        alertThresholdPct: Math.min(Math.max(parsedPct || 80, 20), 100),
        currency,
        pushAlertsEnabled: pushEnabled,
        monthKey,
      });
      setSavedNotice('Budget limits and alert thresholds updated.');
    } finally {
      setSaving(false);
    }
  }

  async function handleEnablePush() {
    const res = await registerPushChannel();
    if (!res.supported) {
      setPushStatus('Notifications unavailable in this browser context');
      return;
    }
    if (res.permission === 'granted') {
      setPushEnabled(true);
      setPushStatus('Push notifications active');
      await onUpdateSettings({
        householdName: householdName.trim() || profile.householdName,
        monthlyBudgetCents: profile.monthlyBudgetCents,
        alertThresholdPct: profile.alertThresholdPct,
        currency,
        pushAlertsEnabled: true,
        fcmToken: res.token || undefined,
        monthKey,
      });
      dispatchLocalPushAlert(
        'KinLedger Alerts Ready',
        'You will receive instant alerts when household spending crosses your threshold.'
      );
    } else {
      setPushStatus(`Notification permission: ${res.permission}`);
    }
  }

  const unreadCount = alerts.filter((a) => !a.isRead).length;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Left: Monthly Budget & Push Alert Controls */}
      <div className="lg:col-span-5 space-y-6">
        <section className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6">
          <h2 className="font-display text-lg font-bold text-slate-900">
            Monthly Budget &amp; Alert Rules
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Set your household cap and when spending warnings trigger
          </p>

          <form onSubmit={handleSaveSettings} className="mt-5 space-y-4">
            <div>
              <label
                htmlFor="household-name"
                className="block text-xs font-medium text-slate-600 mb-1"
              >
                Household Name
              </label>
              <input
                id="household-name"
                type="text"
                value={householdName}
                onChange={(e) => setHouseholdName(e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="monthly-budget"
                  className="block text-xs font-medium text-slate-600 mb-1"
                >
                  Monthly Limit ({currency})
                </label>
                <input
                  id="monthly-budget"
                  type="number"
                  min="10"
                  step="50"
                  value={budgetDollars}
                  onChange={(e) => setBudgetDollars(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 py-2 text-sm tabular-nums bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-600"
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="currency-select"
                  className="block text-xs font-medium text-slate-600 mb-1"
                >
                  Currency
                </label>
                <select
                  id="currency-select"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-600"
                >
                  <option value="USD">USD ($)</option>
                  <option value="INR">INR (₹)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                </select>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label
                  htmlFor="alert-threshold"
                  className="text-xs font-medium text-slate-600"
                >
                  Early Warning Threshold
                </label>
                <span className="text-xs font-bold text-teal-700 tabular-nums">
                  {thresholdPct}% of budget
                </span>
              </div>
              <input
                id="alert-threshold"
                type="range"
                min="50"
                max="100"
                step="5"
                value={thresholdPct}
                onChange={(e) => setThresholdPct(e.target.value)}
                className="w-full accent-teal-700 cursor-pointer"
              />
            </div>

            <div className="pt-2 flex items-center justify-between gap-3">
              <label className="flex items-center gap-2.5 text-sm text-slate-700 cursor-pointer min-h-[44px]">
                <input
                  type="checkbox"
                  checked={pushEnabled}
                  onChange={(e) => setPushEnabled(e.target.checked)}
                  className="w-4 h-4 accent-teal-700 rounded"
                />
                <span>Enable Spending Push Alerts</span>
              </label>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 min-h-[44px] px-4 py-2.5 bg-teal-700 hover:bg-teal-800 text-white text-sm font-semibold rounded-xl flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                <Save size={16} />
                <span>{saving ? 'Saving...' : 'Save Budget Rules'}</span>
              </button>
              <button
                type="button"
                onClick={handleEnablePush}
                className="min-h-[44px] px-4 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-800 text-xs font-semibold rounded-xl flex items-center justify-center gap-2 cursor-pointer"
              >
                <Bell size={15} className="text-teal-700" />
                <span>Activate Push</span>
              </button>
            </div>

            <p className="text-xs text-slate-500">{pushStatus}</p>

            {savedNotice && (
              <p className="text-xs font-medium text-emerald-700">
                {savedNotice}
              </p>
            )}
          </form>
        </section>

        {/* Native Expo + Supabase + FCM + GitHub Developer Kit */}
        <section className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-display text-base font-bold text-slate-900">
                Mobile Expo, Supabase &amp; GitHub Kit
              </h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Access the companion React Native Expo TypeScript source,
                Supabase SQL schema, Firebase Cloud Messaging handler, and
                GitHub Actions CI workflow.
              </p>
            </div>
            <Code2 size={20} className="text-teal-700 shrink-0" />
          </div>
          <button
            type="button"
            onClick={onOpenExpoKit}
            className="mt-4 w-full min-h-[44px] px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl cursor-pointer"
          >
            Open Expo &amp; GitHub Source Kit
          </button>
        </section>
      </div>

      {/* Right: Alert Center Feed */}
      <section className="lg:col-span-7 bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 flex flex-col">
        <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <h2 className="font-display text-lg font-bold text-slate-900">
              Spending Alerts Feed
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {unreadCount} unread · Automatically evaluated on every expense
            </p>
          </div>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={onMarkAllRead}
              className="min-h-[40px] px-3 py-1.5 text-xs font-semibold text-teal-700 hover:bg-teal-50 rounded-xl flex items-center gap-1.5 cursor-pointer"
            >
              <CheckCheck size={15} />
              <span>Mark All Read</span>
            </button>
          )}
        </div>

        {alerts.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-500">
            No budget warnings triggered yet. Alerts appear here automatically
            when spending crosses {profile.alertThresholdPct}% of your budget, a
            member exceeds their cap, or unnecessary spending spikes.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {alerts.map((alert) => {
              const isCritical = alert.severity === 'critical';
              return (
                <div
                  key={alert.id}
                  className={`py-4 flex items-start justify-between gap-4 ${
                    alert.isRead ? 'opacity-65' : ''
                  }`}
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                        isCritical
                          ? 'bg-rose-50 text-rose-700'
                          : 'bg-amber-50 text-amber-700'
                      }`}
                    >
                      {isCritical ? (
                        <AlertTriangle size={17} />
                      ) : (
                        <BellRing size={17} />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-slate-900">
                          {alert.title}
                        </p>
                        {!alert.isRead && (
                          <span className="text-[11px] font-semibold text-teal-700">
                            New
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                        {alert.message}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-1.5">
                        {alert.monthKey} ·{' '}
                        {new Date(alert.createdAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </p>
                    </div>
                  </div>

                  {!alert.isRead && (
                    <button
                      type="button"
                      onClick={() => onMarkAlertRead(alert.id)}
                      className="min-h-[36px] px-3 py-1 border border-slate-200 hover:bg-slate-50 rounded-lg text-xs font-medium text-slate-700 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      Dismiss
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
