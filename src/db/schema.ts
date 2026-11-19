import { relations } from 'drizzle-orm';
import {
  boolean,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  displayName: text('display_name'),
  householdName: text('household_name').notNull().default('Our Household'),
  monthlyBudgetCents: integer('monthly_budget_cents').notNull().default(400000),
  alertThresholdPct: integer('alert_threshold_pct').notNull().default(80),
  currency: text('currency').notNull().default('USD'),
  fcmToken: text('fcm_token'),
  pushAlertsEnabled: boolean('push_alerts_enabled').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow(),
});

export const familyMembers = pgTable('family_members', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  name: text('name').notNull(),
  role: text('role').notNull().default('Member'),
  monthlyCapCents: integer('monthly_cap_cents').notNull().default(120000),
  avatarTint: text('avatar_tint').notNull().default('#0F766E'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const expenses = pgTable('expenses', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  memberId: integer('member_id')
    .references(() => familyMembers.id, { onDelete: 'cascade' })
    .notNull(),
  title: text('title').notNull(),
  merchant: text('merchant').notNull().default(''),
  category: text('category').notNull(),
  amountCents: integer('amount_cents').notNull(),
  spentAt: text('spent_at').notNull(), // YYYY-MM-DD
  necessity: text('necessity').notNull().default('essential'), // essential | discretionary | unnecessary
  unnecessaryReason: text('unnecessary_reason'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const budgetAlerts = pgTable('budget_alerts', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  memberId: integer('member_id').references(() => familyMembers.id, {
    onDelete: 'set null',
  }),
  monthKey: text('month_key').notNull(), // YYYY-MM
  alertType: text('alert_type').notNull(), // household_warning | household_exceeded | member_exceeded | unnecessary_spike
  severity: text('severity').notNull().default('warning'), // info | warning | critical
  title: text('title').notNull(),
  message: text('message').notNull(),
  isRead: boolean('is_read').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

export const usersRelations = relations(users, ({ many }) => ({
  familyMembers: many(familyMembers),
  expenses: many(expenses),
  budgetAlerts: many(budgetAlerts),
}));

export const familyMembersRelations = relations(
  familyMembers,
  ({ one, many }) => ({
    householdOwner: one(users, {
      fields: [familyMembers.userId],
      references: [users.id],
    }),
    expenses: many(expenses),
    alerts: many(budgetAlerts),
  })
);

export const expensesRelations = relations(expenses, ({ one }) => ({
  householdOwner: one(users, {
    fields: [expenses.userId],
    references: [users.id],
  }),
  member: one(familyMembers, {
    fields: [expenses.memberId],
    references: [familyMembers.id],
  }),
}));

export const budgetAlertsRelations = relations(budgetAlerts, ({ one }) => ({
  householdOwner: one(users, {
    fields: [budgetAlerts.userId],
    references: [users.id],
  }),
  member: one(familyMembers, {
    fields: [budgetAlerts.memberId],
    references: [familyMembers.id],
  }),
}));
