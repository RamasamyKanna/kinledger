import { useState } from 'react';
import { signInWithPopup } from 'firebase/auth';
import {
  AlertTriangle,
  BellRing,
  CheckCircle2,
  ShieldCheck,
  Users,
  Wallet,
} from 'lucide-react';
import { auth, googleAuthProvider } from '../lib/firebase';

export function AuthLanding() {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleGoogleSignIn() {
    setLoading(true);
    setErrorMsg(null);
    try {
      await signInWithPopup(auth, googleAuthProvider);
    } catch (err: any) {
      setErrorMsg(
        err?.code === 'auth/popup-closed-by-user'
          ? 'Sign-in was cancelled. Try again when ready.'
          : err?.message || 'Unable to sign in with Google.'
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col">
      <header className="border-b border-slate-200/80 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-8">
          <span className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0">
            KinLedger
          </span>
          <span className="hidden sm:inline text-sm text-slate-500">
            Household Expense &amp; Budget Ledger
          </span>
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="min-h-[40px] px-4 py-2 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-xl transition-colors whitespace-nowrap shrink-0 disabled:opacity-60 cursor-pointer"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 lg:py-14 flex flex-col justify-center">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-stretch">
          <section className="lg:col-span-7 flex flex-col justify-center">
            <p className="text-sm font-medium text-teal-700 mb-3">
              Family Expense Manager
            </p>
            <h1 className="font-display text-3xl sm:text-5xl font-bold tracking-tight text-slate-900 leading-[1.12] [text-wrap:balance]">
              See every household dollar by member, and catch waste early.
            </h1>
            <p className="mt-4 text-base sm:text-lg text-slate-600 leading-relaxed max-w-xl">
              Track daily household spending, enforce monthly budgets with
              instant threshold alerts, separate purchases across family
              members, and surface unnecessary expenses before month-end.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="min-h-[48px] px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm rounded-xl transition-colors flex items-center justify-center gap-3 cursor-pointer disabled:opacity-60"
              >
                <Wallet size={18} />
                <span>
                  {loading ? 'Connecting account...' : 'Continue with Google'}
                </span>
              </button>
              <span className="text-xs text-slate-500 sm:pl-2">
                Syncs securely with PostgreSQL &amp; Firebase Auth
              </span>
            </div>

            {errorMsg && (
              <div
                role="alert"
                className="mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-sm text-rose-700"
              >
                {errorMsg}
              </div>
            )}

            <div className="mt-10 pt-8 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div>
                <div className="flex items-center gap-2 text-slate-900 font-semibold text-sm">
                  <Users size={16} className="text-teal-700" />
                  <span>Per-Member Caps</span>
                </div>
                <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                  Separate expenses by parent, partner, teen, or child with
                  monthly limits.
                </p>
              </div>
              <div>
                <div className="flex items-center gap-2 text-slate-900 font-semibold text-sm">
                  <BellRing size={16} className="text-amber-600" />
                  <span>Push Budget Alerts</span>
                </div>
                <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                  Automatic alerts when spending crosses 80% or breaches a
                  member cap.
                </p>
              </div>
              <div>
                <div className="flex items-center gap-2 text-slate-900 font-semibold text-sm">
                  <AlertTriangle size={16} className="text-rose-600" />
                  <span>Waste Radar</span>
                </div>
                <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                  Flag impulse buys, delivery markups, and duplicate
                  subscriptions.
                </p>
              </div>
            </div>
          </section>

          <aside className="lg:col-span-5 flex flex-col justify-center">
            <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-7">
              <div className="flex items-center justify-between pb-5 border-b border-slate-100">
                <div>
                  <p className="text-xs text-slate-500">Monthly Household Pace</p>
                  <p className="font-display text-2xl font-bold text-slate-900 tabular-nums mt-0.5">
                    $3,418 <span className="text-sm font-normal text-slate-500">/ $4,200</span>
                  </p>
                </div>
                <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700">
                  <BellRing size={14} />
                  <span>81% Used</span>
                </div>
              </div>

              <div className="py-5 space-y-4">
                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="font-medium text-slate-700">
                      Alex · Primary
                    </span>
                    <span className="tabular-nums text-slate-600">
                      $1,922 / $2,100
                    </span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-teal-700 rounded-full w-[91%]" />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="font-medium text-slate-700">
                      Maya · Partner
                    </span>
                    <span className="tabular-nums text-slate-600">
                      $940 / $1,500
                    </span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-700 rounded-full w-[63%]" />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="font-medium text-slate-700">
                      Leo · Teen
                    </span>
                    <span className="tabular-nums text-rose-700 font-medium">
                      $462 / $450 (Over cap)
                    </span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-rose-600 rounded-full w-full" />
                  </div>
                </div>
              </div>

              <div className="pt-5 border-t border-slate-100 flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs text-slate-500">
                    Flagged Unnecessary Spend
                  </p>
                  <p className="font-display text-xl font-bold text-rose-700 tabular-nums mt-0.5">
                    $385.78
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Delivery fees · Impulse · Duplicate streaming
                  </p>
                </div>
                <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 shrink-0">
                  <CheckCircle2 size={15} />
                  <span>Save $4,629/yr</span>
                </div>
              </div>

              <div className="mt-5 pt-4 border-t border-slate-100 flex items-center gap-2 text-xs text-slate-500">
                <ShieldCheck size={14} className="text-teal-700 shrink-0" />
                <span>
                  Private household workspace · Includes React Native Expo +
                  Supabase + FCM kit
                </span>
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
