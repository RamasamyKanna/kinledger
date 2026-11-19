import 'dotenv/config';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { and, desc, eq, gte, like, lte } from 'drizzle-orm';
import { db } from './src/db/index.ts';
import {
  budgetAlerts,
  expenses,
  familyMembers,
  users,
} from './src/db/schema.ts';
import { getOrCreateUser } from './src/db/users.ts';
import {
  evaluateHouseholdAlerts,
  seedSampleHouseholdMonth,
} from './src/db/alerts.ts';
import { AuthRequest, requireAuth } from './src/middleware/auth.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

function currentMonthKey(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function getTrailingMonthKeys(anchorMonthKey: string, count = 6): string[] {
  const [y, m] = anchorMonthKey.split('-').map(Number);
  const keys: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(y, m - 1 - i, 1);
    keys.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    );
  }
  return keys;
}

app.get('/api/household', requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.user!.uid;
    const email = req.user!.email || `${uid}@household.local`;
    const displayName = (req.user!.name as string | undefined) || null;

    const user = await getOrCreateUser(uid, email, displayName);
    const monthKey =
      typeof req.query.month === 'string' && /^\d{4}-\d{2}$/.test(req.query.month)
        ? req.query.month
        : currentMonthKey();

    const members = await db
      .select()
      .from(familyMembers)
      .where(eq(familyMembers.userId, user.id))
      .orderBy(familyMembers.id);

    const monthExpenses = await db
      .select()
      .from(expenses)
      .where(
        and(eq(expenses.userId, user.id), like(expenses.spentAt, `${monthKey}-%`))
      )
      .orderBy(desc(expenses.spentAt), desc(expenses.id));

    const alerts = await db
      .select()
      .from(budgetAlerts)
      .where(eq(budgetAlerts.userId, user.id))
      .orderBy(desc(budgetAlerts.createdAt))
      .limit(30);

    const trendKeys = getTrailingMonthKeys(monthKey, 6);
    const oldestKey = trendKeys[0];
    const newestKey = trendKeys[trendKeys.length - 1];

    const windowExpenses = await db
      .select({
        spentAt: expenses.spentAt,
        amountCents: expenses.amountCents,
        necessity: expenses.necessity,
      })
      .from(expenses)
      .where(
        and(
          eq(expenses.userId, user.id),
          gte(expenses.spentAt, `${oldestKey}-01`),
          lte(expenses.spentAt, `${newestKey}-31`)
        )
      );

    const trendMap = new Map(
      trendKeys.map((mk) => [
        mk,
        {
          monthKey: mk,
          totalSpentCents: 0,
          essentialCents: 0,
          unnecessaryCents: 0,
        },
      ])
    );

    for (const row of windowExpenses) {
      const mk = row.spentAt.slice(0, 7);
      const bucket = trendMap.get(mk);
      if (!bucket) continue;
      bucket.totalSpentCents += row.amountCents;
      if (row.necessity === 'essential') {
        bucket.essentialCents += row.amountCents;
      } else if (row.necessity === 'unnecessary') {
        bucket.unnecessaryCents += row.amountCents;
      }
    }

    res.json({
      profile: user,
      monthKey,
      members,
      expenses: monthExpenses,
      alerts,
      monthlyTrend: Array.from(trendMap.values()),
    });
  } catch (error: any) {
    console.error('Failed to fetch household ledger:', error);
    res
      .status(500)
      .json({ error: error.message || 'Failed to load household data.' });
  }
});

app.patch(
  '/api/household/settings',
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const user = await getOrCreateUser(
        req.user!.uid,
        req.user!.email || '',
        (req.user!.name as string | undefined) || null
      );

      const {
        householdName,
        monthlyBudgetCents,
        alertThresholdPct,
        currency,
        pushAlertsEnabled,
        fcmToken,
      } = req.body ?? {};

      const updates: Partial<typeof users.$inferInsert> = {};
      if (typeof householdName === 'string' && householdName.trim()) {
        updates.householdName = householdName.trim().slice(0, 60);
      }
      if (
        typeof monthlyBudgetCents === 'number' &&
        Number.isFinite(monthlyBudgetCents) &&
        monthlyBudgetCents >= 100
      ) {
        updates.monthlyBudgetCents = Math.round(monthlyBudgetCents);
      }
      if (
        typeof alertThresholdPct === 'number' &&
        alertThresholdPct >= 20 &&
        alertThresholdPct <= 100
      ) {
        updates.alertThresholdPct = Math.round(alertThresholdPct);
      }
      if (typeof currency === 'string' && /^[A-Z]{3}$/.test(currency)) {
        updates.currency = currency;
      }
      if (typeof pushAlertsEnabled === 'boolean') {
        updates.pushAlertsEnabled = pushAlertsEnabled;
      }
      if (typeof fcmToken === 'string') {
        updates.fcmToken = fcmToken.slice(0, 512);
      }

      const [updated] = await db
        .update(users)
        .set(updates)
        .where(eq(users.id, user.id))
        .returning();

      const monthKey =
        typeof req.body?.monthKey === 'string' &&
        /^\d{4}-\d{2}$/.test(req.body.monthKey)
          ? req.body.monthKey
          : currentMonthKey();

      const triggeredAlerts = await evaluateHouseholdAlerts(user.id, monthKey);
      res.json({ profile: updated, triggeredAlerts });
    } catch (error: any) {
      console.error('Failed to update household settings:', error);
      res
        .status(500)
        .json({ error: error.message || 'Failed to update settings.' });
    }
  }
);

app.post('/api/members', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await getOrCreateUser(
      req.user!.uid,
      req.user!.email || '',
      (req.user!.name as string | undefined) || null
    );
    const { name, role, monthlyCapCents, avatarTint } = req.body ?? {};

    if (typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ error: 'Member name is required.' });
      return;
    }

    const [created] = await db
      .insert(familyMembers)
      .values({
        userId: user.id,
        name: name.trim().slice(0, 40),
        role:
          typeof role === 'string' && role.trim()
            ? role.trim().slice(0, 24)
            : 'Member',
        monthlyCapCents:
          typeof monthlyCapCents === 'number' && monthlyCapCents >= 0
            ? Math.round(monthlyCapCents)
            : 100000,
        avatarTint:
          typeof avatarTint === 'string' && /^#[0-9A-Fa-f]{6}$/.test(avatarTint)
            ? avatarTint
            : '#0F766E',
      })
      .returning();

    res.status(201).json({ member: created });
  } catch (error: any) {
    console.error('Failed to add family member:', error);
    res.status(500).json({ error: error.message || 'Failed to add member.' });
  }
});

app.patch('/api/members/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await getOrCreateUser(
      req.user!.uid,
      req.user!.email || '',
      (req.user!.name as string | undefined) || null
    );
    const memberId = Number(req.params.id);
    if (!Number.isInteger(memberId)) {
      res.status(400).json({ error: 'Invalid member ID.' });
      return;
    }

    const { name, role, monthlyCapCents, avatarTint } = req.body ?? {};
    const updates: Partial<typeof familyMembers.$inferInsert> = {};

    if (typeof name === 'string' && name.trim()) {
      updates.name = name.trim().slice(0, 40);
    }
    if (typeof role === 'string' && role.trim()) {
      updates.role = role.trim().slice(0, 24);
    }
    if (
      typeof monthlyCapCents === 'number' &&
      Number.isFinite(monthlyCapCents) &&
      monthlyCapCents >= 0
    ) {
      updates.monthlyCapCents = Math.round(monthlyCapCents);
    }
    if (typeof avatarTint === 'string' && /^#[0-9A-Fa-f]{6}$/.test(avatarTint)) {
      updates.avatarTint = avatarTint;
    }

    const [updated] = await db
      .update(familyMembers)
      .set(updates)
      .where(
        and(eq(familyMembers.id, memberId), eq(familyMembers.userId, user.id))
      )
      .returning();

    if (!updated) {
      res.status(404).json({ error: 'Family member not found.' });
      return;
    }

    const triggeredAlerts = await evaluateHouseholdAlerts(
      user.id,
      currentMonthKey()
    );
    res.json({ member: updated, triggeredAlerts });
  } catch (error: any) {
    console.error('Failed to update family member:', error);
    res.status(500).json({ error: error.message || 'Failed to update member.' });
  }
});

app.delete('/api/members/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await getOrCreateUser(
      req.user!.uid,
      req.user!.email || '',
      (req.user!.name as string | undefined) || null
    );
    const memberId = Number(req.params.id);
    if (!Number.isInteger(memberId)) {
      res.status(400).json({ error: 'Invalid member ID.' });
      return;
    }

    const allMembers = await db
      .select()
      .from(familyMembers)
      .where(eq(familyMembers.userId, user.id));

    if (allMembers.length <= 1) {
      res
        .status(400)
        .json({ error: 'At least one family member must remain in the household.' });
      return;
    }

    const [deleted] = await db
      .delete(familyMembers)
      .where(
        and(eq(familyMembers.id, memberId), eq(familyMembers.userId, user.id))
      )
      .returning();

    if (!deleted) {
      res.status(404).json({ error: 'Family member not found.' });
      return;
    }

    res.json({ deletedId: deleted.id });
  } catch (error: any) {
    console.error('Failed to remove family member:', error);
    res.status(500).json({ error: error.message || 'Failed to delete member.' });
  }
});

app.post('/api/expenses', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await getOrCreateUser(
      req.user!.uid,
      req.user!.email || '',
      (req.user!.name as string | undefined) || null
    );

    const {
      memberId,
      title,
      merchant,
      category,
      amountCents,
      spentAt,
      necessity,
      unnecessaryReason,
      notes,
    } = req.body ?? {};

    if (typeof title !== 'string' || !title.trim()) {
      res.status(400).json({ error: 'Expense title is required.' });
      return;
    }
    if (
      typeof amountCents !== 'number' ||
      !Number.isFinite(amountCents) ||
      amountCents <= 0
    ) {
      res.status(400).json({ error: 'Amount must be greater than zero.' });
      return;
    }
    if (typeof spentAt !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(spentAt)) {
      res.status(400).json({ error: 'Valid date (YYYY-MM-DD) is required.' });
      return;
    }

    const [member] = await db
      .select()
      .from(familyMembers)
      .where(
        and(
          eq(familyMembers.id, Number(memberId)),
          eq(familyMembers.userId, user.id)
        )
      );

    if (!member) {
      res.status(400).json({ error: 'Selected family member was not found.' });
      return;
    }

    const cleanNecessity =
      necessity === 'unnecessary' || necessity === 'discretionary'
        ? necessity
        : 'essential';

    const [created] = await db
      .insert(expenses)
      .values({
        userId: user.id,
        memberId: member.id,
        title: title.trim().slice(0, 80),
        merchant:
          typeof merchant === 'string' ? merchant.trim().slice(0, 60) : '',
        category:
          typeof category === 'string' && category.trim()
            ? category.trim().slice(0, 32)
            : 'Groceries',
        amountCents: Math.round(amountCents),
        spentAt,
        necessity: cleanNecessity,
        unnecessaryReason:
          cleanNecessity === 'unnecessary' &&
          typeof unnecessaryReason === 'string' &&
          unnecessaryReason.trim()
            ? unnecessaryReason.trim().slice(0, 80)
            : null,
        notes:
          typeof notes === 'string' && notes.trim()
            ? notes.trim().slice(0, 200)
            : null,
      })
      .returning();

    const triggeredAlerts = await evaluateHouseholdAlerts(
      user.id,
      spentAt.slice(0, 7)
    );

    res.status(201).json({ expense: created, triggeredAlerts });
  } catch (error: any) {
    console.error('Failed to create expense:', error);
    res
      .status(500)
      .json({ error: error.message || 'Failed to save expense.' });
  }
});

app.patch('/api/expenses/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await getOrCreateUser(
      req.user!.uid,
      req.user!.email || '',
      (req.user!.name as string | undefined) || null
    );
    const expenseId = Number(req.params.id);
    if (!Number.isInteger(expenseId)) {
      res.status(400).json({ error: 'Invalid expense ID.' });
      return;
    }

    const {
      memberId,
      title,
      merchant,
      category,
      amountCents,
      spentAt,
      necessity,
      unnecessaryReason,
      notes,
    } = req.body ?? {};

    const updates: Partial<typeof expenses.$inferInsert> = {};
    if (typeof title === 'string' && title.trim()) {
      updates.title = title.trim().slice(0, 80);
    }
    if (typeof merchant === 'string') {
      updates.merchant = merchant.trim().slice(0, 60);
    }
    if (typeof category === 'string' && category.trim()) {
      updates.category = category.trim().slice(0, 32);
    }
    if (
      typeof amountCents === 'number' &&
      Number.isFinite(amountCents) &&
      amountCents > 0
    ) {
      updates.amountCents = Math.round(amountCents);
    }
    if (typeof spentAt === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(spentAt)) {
      updates.spentAt = spentAt;
    }
    if (
      necessity === 'essential' ||
      necessity === 'discretionary' ||
      necessity === 'unnecessary'
    ) {
      updates.necessity = necessity;
      if (necessity !== 'unnecessary') {
        updates.unnecessaryReason = null;
      }
    }
    if (typeof unnecessaryReason === 'string') {
      updates.unnecessaryReason = unnecessaryReason.trim()
        ? unnecessaryReason.trim().slice(0, 80)
        : null;
    }
    if (typeof notes === 'string') {
      updates.notes = notes.trim() ? notes.trim().slice(0, 200) : null;
    }
    if (typeof memberId === 'number' && Number.isInteger(memberId)) {
      const [member] = await db
        .select()
        .from(familyMembers)
        .where(
          and(
            eq(familyMembers.id, memberId),
            eq(familyMembers.userId, user.id)
          )
        );
      if (member) {
        updates.memberId = member.id;
      }
    }

    const [updated] = await db
      .update(expenses)
      .set(updates)
      .where(and(eq(expenses.id, expenseId), eq(expenses.userId, user.id)))
      .returning();

    if (!updated) {
      res.status(404).json({ error: 'Expense not found.' });
      return;
    }

    const triggeredAlerts = await evaluateHouseholdAlerts(
      user.id,
      updated.spentAt.slice(0, 7)
    );

    res.json({ expense: updated, triggeredAlerts });
  } catch (error: any) {
    console.error('Failed to update expense:', error);
    res
      .status(500)
      .json({ error: error.message || 'Failed to update expense.' });
  }
});

app.delete('/api/expenses/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await getOrCreateUser(
      req.user!.uid,
      req.user!.email || '',
      (req.user!.name as string | undefined) || null
    );
    const expenseId = Number(req.params.id);
    if (!Number.isInteger(expenseId)) {
      res.status(400).json({ error: 'Invalid expense ID.' });
      return;
    }

    const [deleted] = await db
      .delete(expenses)
      .where(and(eq(expenses.id, expenseId), eq(expenses.userId, user.id)))
      .returning();

    if (!deleted) {
      res.status(404).json({ error: 'Expense not found.' });
      return;
    }

    res.json({ deletedId: deleted.id });
  } catch (error: any) {
    console.error('Failed to delete expense:', error);
    res
      .status(500)
      .json({ error: error.message || 'Failed to delete expense.' });
  }
});

app.post('/api/alerts/:id/read', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await getOrCreateUser(
      req.user!.uid,
      req.user!.email || '',
      (req.user!.name as string | undefined) || null
    );
    const alertId = Number(req.params.id);
    if (!Number.isInteger(alertId)) {
      res.status(400).json({ error: 'Invalid alert ID.' });
      return;
    }

    const [updated] = await db
      .update(budgetAlerts)
      .set({ isRead: true })
      .where(
        and(eq(budgetAlerts.id, alertId), eq(budgetAlerts.userId, user.id))
      )
      .returning();

    res.json({ alert: updated });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to update alert.' });
  }
});

app.post('/api/alerts/read-all', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await getOrCreateUser(
      req.user!.uid,
      req.user!.email || '',
      (req.user!.name as string | undefined) || null
    );

    await db
      .update(budgetAlerts)
      .set({ isRead: true })
      .where(eq(budgetAlerts.userId, user.id));

    res.json({ ok: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to mark alerts read.' });
  }
});

app.post(
  '/api/household/seed-sample',
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const user = await getOrCreateUser(
        req.user!.uid,
        req.user!.email || '',
        (req.user!.name as string | undefined) || null
      );
      const monthKey =
        typeof req.body?.monthKey === 'string' &&
        /^\d{4}-\d{2}$/.test(req.body.monthKey)
          ? req.body.monthKey
          : currentMonthKey();

      await seedSampleHouseholdMonth(user.id, monthKey);
      res.json({ ok: true });
    } catch (error: any) {
      res
        .status(500)
        .json({ error: error.message || 'Failed to seed sample data.' });
    }
  }
);

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build output not found.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`KinLedger server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
