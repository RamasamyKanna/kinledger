export interface BlueprintFile {
  id: string;
  filename: string;
  language: string;
  summary: string;
  code: string;
}

export const EXPO_BLUEPRINT_FILES: BlueprintFile[] = [
  {
    id: 'app',
    filename: 'App.tsx (React Native + Expo)',
    language: 'tsx',
    summary:
      'Expo Router / React Native TypeScript screen with Supabase Auth, member-filtered daily ledger, and Firebase Cloud Messaging listener.',
    code: `import React, { useEffect, useState } from 'react';
import { SafeAreaView, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from './lib/supabase';
import { registerFcmListener, syncFcmDeviceToken } from './lib/fcm';

interface Expense {
  id: number;
  member_id: number;
  title: string;
  category: string;
  amount_cents: number;
  spent_at: string;
  necessity: 'essential' | 'discretionary' | 'unnecessary';
}

export default function App() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null);

  useEffect(() => {
    void syncFcmDeviceToken();
    const unsubscribe = registerFcmListener((title, body) => {
      console.log('Budget Push Alert:', title, body);
    });
    void fetchMonthExpenses();
    return unsubscribe;
  }, [selectedMemberId]);

  async function fetchMonthExpenses() {
    let query = supabase
      .from('expenses')
      .select('*')
      .order('spent_at', { ascending: false });

    if (selectedMemberId !== null) {
      query = query.eq('member_id', selectedMemberId);
    }
    const { data } = await query;
    if (data) setExpenses(data);
  }

  const unnecessaryTotal = expenses
    .filter((e) => e.necessity === 'unnecessary')
    .reduce((sum, e) => sum + e.amount_cents, 0);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
      <ScrollView contentContainerStyle={{ padding: 20 }}>
        <Text style={{ fontSize: 24, fontWeight: '700', color: '#0F172A' }}>
          KinLedger Family
        </Text>
        <Text style={{ marginTop: 6, color: '#DC2626', fontWeight: '600' }}>
          Recoverable Unnecessary Spend: \${(unnecessaryTotal / 100).toFixed(2)}
        </Text>
        <View style={{ marginTop: 16 }}>
          {expenses.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={{
                paddingVertical: 14,
                borderBottomWidth: 1,
                borderBottomColor: '#E2E8F0',
              }}
            >
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#0F172A' }}>
                {item.title}
              </Text>
              <Text style={{ fontSize: 13, color: '#64748B', marginTop: 2 }}>
                {item.category} · {item.spent_at} · \${(item.amount_cents / 100).toFixed(2)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}`,
  },
  {
    id: 'supabase',
    filename: 'supabase/schema.sql',
    language: 'sql',
    summary:
      'PostgreSQL schema and Row-Level Security policies matching the KinLedger relational tables for Supabase.',
    code: `create table public.households (
  id bigint generated always as identity primary key,
  owner_uid uuid references auth.users not null unique,
  household_name text not null default 'Our Household',
  monthly_budget_cents integer not null default 400000,
  alert_threshold_pct integer not null default 80,
  fcm_token text,
  created_at timestamptz default now()
);

create table public.family_members (
  id bigint generated always as identity primary key,
  household_id bigint references public.households(id) on delete cascade not null,
  name text not null,
  role text not null default 'Member',
  monthly_cap_cents integer not null default 120000,
  avatar_tint text not null default '#0F766E'
);

create table public.expenses (
  id bigint generated always as identity primary key,
  household_id bigint references public.households(id) on delete cascade not null,
  member_id bigint references public.family_members(id) on delete cascade not null,
  title text not null,
  merchant text not null default '',
  category text not null,
  amount_cents integer not null check (amount_cents > 0),
  spent_at date not null,
  necessity text not null default 'essential'
    check (necessity in ('essential', 'discretionary', 'unnecessary')),
  unnecessary_reason text,
  created_at timestamptz default now()
);

alter table public.households enable row level security;
alter table public.family_members enable row level security;
alter table public.expenses enable row level security;`,
  },
  {
    id: 'fcm',
    filename: 'lib/fcm.ts (Firebase Cloud Messaging)',
    language: 'ts',
    summary:
      'Expo + React Native Firebase Cloud Messaging registration and foreground/background budget alert listener.',
    code: `import messaging from '@react-native-firebase/messaging';
import { supabase } from './supabase';

export async function syncFcmDeviceToken() {
  const authStatus = await messaging().requestPermission();
  const enabled =
    authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
    authStatus === messaging.AuthorizationStatus.PROVISIONAL;

  if (!enabled) return null;

  const token = await messaging().getToken();
  const { data: session } = await supabase.auth.getUser();
  if (session.user) {
    await supabase
      .from('households')
      .update({ fcm_token: token })
      .eq('owner_uid', session.user.id);
  }
  return token;
}

export function registerFcmListener(
  onAlert: (title: string, body: string) => void
) {
  return messaging().onMessage(async (remoteMessage) => {
    const title = remoteMessage.notification?.title ?? 'Budget Alert';
    const body = remoteMessage.notification?.body ?? '';
    onAlert(title, body);
  });
}`,
  },
  {
    id: 'github',
    filename: '.github/workflows/eas-build.yml',
    language: 'yaml',
    summary:
      'GitHub Actions CI workflow for TypeScript typechecking and Expo EAS preview/production builds.',
    code: `name: KinLedger Mobile CI
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  typecheck-and-build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npx tsc --noEmit
      - uses: expo/expo-github-action@v8
        with:
          eas-version: latest
          token: \${{ secrets.EXPO_TOKEN }}
      - if: github.ref == 'refs/heads/main'
        run: eas build --platform all --profile preview --non-interactive`,
  },
];
