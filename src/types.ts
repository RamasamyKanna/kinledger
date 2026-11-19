export type NecessityLevel = 'essential' | 'discretionary' | 'unnecessary';

export const EXPENSE_CATEGORIES = [
  'Groceries',
  'Housing',
  'Utilities',
  'Dining Out',
  'Transport',
  'Subscriptions',
  'Healthcare',
  'Shopping',
  'Entertainment',
  'Education',
] as const;

export const UNNECESSARY_REASONS = [
  'Impulse purchase',
  'Delivery markup & fees',
  'Duplicate subscription',
  'Unused service',
  'Overpriced convenience',
  'Late fee / penalty',
] as const;

export const MEMBER_TINTS = [
  '#0F766E',
  '#1D4ED8',
  '#B45309',
  '#7E22CE',
  '#BE123C',
  '#0369A1',
] as const;

export interface HouseholdProfile {
  id: number;
  uid: string;
  email: string;
  displayName: string | null;
  householdName: string;
  monthlyBudgetCents: number;
  alertThresholdPct: number;
  currency: string;
  fcmToken: string | null;
  pushAlertsEnabled: boolean;
}

export interface FamilyMember {
  id: number;
  userId: number;
  name: string;
  role: string;
  monthlyCapCents: number;
  avatarTint: string;
}

export interface ExpenseItem {
  id: number;
  userId: number;
  memberId: number;
  title: string;
  merchant: string;
  category: string;
  amountCents: number;
  spentAt: string; // YYYY-MM-DD
  necessity: NecessityLevel;
  unnecessaryReason: string | null;
  notes: string | null;
}

export interface BudgetAlert {
  id: number;
  userId: number;
  memberId: number | null;
  monthKey: string;
  alertType: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export interface MonthlyTrendPoint {
  monthKey: string;
  totalSpentCents: number;
  essentialCents: number;
  unnecessaryCents: number;
}

export interface HouseholdResponse {
  profile: HouseholdProfile;
  monthKey: string;
  members: FamilyMember[];
  expenses: ExpenseItem[];
  alerts: BudgetAlert[];
  monthlyTrend: MonthlyTrendPoint[];
}

export function formatCurrency(
  cents: number,
  currency = 'USD',
  compact = false
): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: compact && cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: compact && cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

export function getCurrentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function getRecentMonthKeys(count = 6): string[] {
  const keys: string[] = [];
  const base = new Date();
  base.setDate(1);
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
    keys.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    );
  }
  return keys;
}

export function formatMonthLabel(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number);
  if (!y || !m) return monthKey;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    year: 'numeric',
  }).format(new Date(y, m - 1, 1));
}

export function formatDayHeading(isoDate: string): string {
  const today = new Date().toISOString().slice(0, 10);
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = yesterdayDate.toISOString().slice(0, 10);

  if (isoDate === today) return 'Today';
  if (isoDate === yesterday) return 'Yesterday';

  const [y, m, d] = isoDate.split('-').map(Number);
  if (!y || !m || !d) return isoDate;
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(new Date(y, m - 1, d));
}

const SUSPECT_KEYWORDS = [
  'doordash',
  'ubereats',
  'uber eats',
  'grubhub',
  'delivery',
  'skin',
  'cosmetic',
  'impulse',
  'late fee',
  'penalty',
  'starbucks',
  'coffee',
  'upgrade',
  'bundle',
  'streaming',
  'vip',
];

export function suggestNecessityHint(
  title: string,
  merchant: string,
  category: string
): { isSuspect: boolean; suggestedReason: string } {
  const combined = `${title} ${merchant} ${category}`.toLowerCase();
  if (
    combined.includes('doordash') ||
    combined.includes('ubereats') ||
    combined.includes('grubhub') ||
    combined.includes('delivery')
  ) {
    return { isSuspect: true, suggestedReason: 'Delivery markup & fees' };
  }
  if (combined.includes('skin') || combined.includes('drop') || combined.includes('impulse')) {
    return { isSuspect: true, suggestedReason: 'Impulse purchase' };
  }
  if (category === 'Subscriptions' || combined.includes('streaming') || combined.includes('bundle')) {
    return { isSuspect: true, suggestedReason: 'Duplicate subscription' };
  }
  if (SUSPECT_KEYWORDS.some((k) => combined.includes(k))) {
    return { isSuspect: true, suggestedReason: 'Overpriced convenience' };
  }
  return { isSuspect: false, suggestedReason: '' };
}
