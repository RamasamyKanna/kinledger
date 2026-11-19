import { and, desc, eq, like } from 'drizzle-orm';
import { db } from './index.ts';
import { budgetAlerts, expenses, familyMembers, users } from './schema.ts';

function formatMoney(cents: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

/**
 * Evaluates household monthly budget, per-member monthly caps, and unnecessary spending spikes
 * for the given monthKey (YYYY-MM) and creates/updates actionable alerts.
 */
export async function evaluateHouseholdAlerts(userId: number, monthKey: string) {
  try {
    const [userRow] = await db.select().from(users).where(eq(users.id, userId));
    if (!userRow) return [];

    const members = await db
      .select()
      .from(familyMembers)
      .where(eq(familyMembers.userId, userId));

    const monthExpenses = await db
      .select()
      .from(expenses)
      .where(
        and(eq(expenses.userId, userId), like(expenses.spentAt, `${monthKey}-%`))
      );

    const existingAlerts = await db
      .select()
      .from(budgetAlerts)
      .where(
        and(
          eq(budgetAlerts.userId, userId),
          eq(budgetAlerts.monthKey, monthKey)
        )
      )
      .orderBy(desc(budgetAlerts.createdAt));

    const totalSpent = monthExpenses.reduce((acc, e) => acc + e.amountCents, 0);
    const unnecessarySpent = monthExpenses
      .filter((e) => e.necessity === 'unnecessary')
      .reduce((acc, e) => acc + e.amountCents, 0);

    const createdAlerts: (typeof budgetAlerts.$inferSelect)[] = [];

    const hasAlert = (type: string, memberId: number | null = null) =>
      existingAlerts.some(
        (a) => a.alertType === type && (a.memberId ?? null) === memberId
      );

    // 1. Household budget threshold & exceeded alerts
    if (userRow.monthlyBudgetCents > 0) {
      const pct = Math.round((totalSpent / userRow.monthlyBudgetCents) * 100);
      if (
        totalSpent > userRow.monthlyBudgetCents &&
        !hasAlert('household_exceeded')
      ) {
        const overBy = totalSpent - userRow.monthlyBudgetCents;
        const [inserted] = await db
          .insert(budgetAlerts)
          .values({
            userId,
            memberId: null,
            monthKey,
            alertType: 'household_exceeded',
            severity: 'critical',
            title: 'Monthly Household Budget Exceeded',
            message: `Spending reached ${formatMoney(totalSpent, userRow.currency)} (${pct}% of your ${formatMoney(userRow.monthlyBudgetCents, userRow.currency)} limit — ${formatMoney(overBy, userRow.currency)} over).`,
          })
          .returning();
        createdAlerts.push(inserted);
      } else if (
        pct >= userRow.alertThresholdPct &&
        totalSpent <= userRow.monthlyBudgetCents &&
        !hasAlert('household_warning')
      ) {
        const [inserted] = await db
          .insert(budgetAlerts)
          .values({
            userId,
            memberId: null,
            monthKey,
            alertType: 'household_warning',
            severity: 'warning',
            title: `${pct}% of Monthly Budget Used`,
            message: `Your household has spent ${formatMoney(totalSpent, userRow.currency)} out of ${formatMoney(userRow.monthlyBudgetCents, userRow.currency)} for ${monthKey}.`,
          })
          .returning();
        createdAlerts.push(inserted);
      }
    }

    // 2. Per-member cap alerts
    for (const member of members) {
      if (member.monthlyCapCents <= 0) continue;
      const memberSpent = monthExpenses
        .filter((e) => e.memberId === member.id)
        .reduce((acc, e) => acc + e.amountCents, 0);

      if (
        memberSpent > member.monthlyCapCents &&
        !hasAlert('member_exceeded', member.id)
      ) {
        const [inserted] = await db
          .insert(budgetAlerts)
          .values({
            userId,
            memberId: member.id,
            monthKey,
            alertType: 'member_exceeded',
            severity: 'warning',
            title: `${member.name} Exceeded Monthly Cap`,
            message: `${member.name} spent ${formatMoney(memberSpent, userRow.currency)} against a ${formatMoney(member.monthlyCapCents, userRow.currency)} member cap.`,
          })
          .returning();
        createdAlerts.push(inserted);
      }
    }

    // 3. Unnecessary spending spike alert (> 15% of total spend or >= $150)
    if (
      totalSpent > 0 &&
      (unnecessarySpent / totalSpent >= 0.15 || unnecessarySpent >= 15000) &&
      !hasAlert('unnecessary_spike')
    ) {
      const share = Math.round((unnecessarySpent / totalSpent) * 100);
      const [inserted] = await db
        .insert(budgetAlerts)
        .values({
          userId,
          memberId: null,
          monthKey,
          alertType: 'unnecessary_spike',
          severity: 'warning',
          title: 'Unnecessary Spending Spike Detected',
          message: `${formatMoney(unnecessarySpent, userRow.currency)} (${share}% of monthly spend) is flagged as unnecessary. Review the Waste Radar to trim recurring leaks.`,
        })
        .returning();
      createdAlerts.push(inserted);
    }

    return createdAlerts;
  } catch (error) {
    console.error('Error evaluating household alerts:', error);
    throw new Error('Failed to evaluate spending alerts.', { cause: error });
  }
}

/**
 * Seeds a realistic sample household month for a newly signed-in user upon explicit request.
 */
export async function seedSampleHouseholdMonth(
  userId: number,
  monthKey: string
) {
  try {
    const existingMembers = await db
      .select()
      .from(familyMembers)
      .where(eq(familyMembers.userId, userId));

    let primary = existingMembers[0];
    if (!primary) {
      [primary] = await db
        .insert(familyMembers)
        .values({
          userId,
          name: 'Alex',
          role: 'Primary',
          monthlyCapCents: 180000,
          avatarTint: '#0F766E',
        })
        .returning();
    }

    const memberDefs = [
      {
        name: 'Maya',
        role: 'Partner',
        monthlyCapCents: 150000,
        avatarTint: '#1D4ED8',
      },
      {
        name: 'Leo',
        role: 'Teen',
        monthlyCapCents: 45000,
        avatarTint: '#B45309',
      },
      {
        name: 'Sofia',
        role: 'Child',
        monthlyCapCents: 30000,
        avatarTint: '#7E22CE',
      },
    ];

    const byName = new Map<string, number>();
    byName.set('primary', primary.id);

    for (const def of memberDefs) {
      const found = existingMembers.find(
        (m) => m.name.toLowerCase() === def.name.toLowerCase()
      );
      if (found) {
        byName.set(def.name.toLowerCase(), found.id);
      } else {
        const [created] = await db
          .insert(familyMembers)
          .values({
            userId,
            name: def.name,
            role: def.role,
            monthlyCapCents: def.monthlyCapCents,
            avatarTint: def.avatarTint,
          })
          .returning();
        byName.set(def.name.toLowerCase(), created.id);
      }
    }

    const sampleRows = [
      {
        memberId: primary.id,
        title: 'Weekly Fresh Groceries',
        merchant: 'Trader Joe’s',
        category: 'Groceries',
        amountCents: 18450,
        spentAt: `${monthKey}-02`,
        necessity: 'essential',
        unnecessaryReason: null,
        notes: 'Produce, pantry staples, dairy',
      },
      {
        memberId: byName.get('maya')!,
        title: 'Electric & Gas Utility Bill',
        merchant: 'ConEdison',
        category: 'Utilities',
        amountCents: 21400,
        spentAt: `${monthKey}-03`,
        necessity: 'essential',
        unnecessaryReason: null,
        notes: 'Monthly household billing cycle',
      },
      {
        memberId: byName.get('leo')!,
        title: 'Late-Night App Food Delivery',
        merchant: 'DoorDash',
        category: 'Dining Out',
        amountCents: 4680,
        spentAt: `${monthKey}-05`,
        necessity: 'unnecessary',
        unnecessaryReason: 'Delivery markup & service fees',
        notes: 'Ordered fast food despite dinner at home',
      },
      {
        memberId: primary.id,
        title: 'Unused Streaming Bundle Renewal',
        merchant: 'StreamPlus 4K',
        category: 'Subscriptions',
        amountCents: 2499,
        spentAt: `${monthKey}-06`,
        necessity: 'unnecessary',
        unnecessaryReason: 'Duplicate subscription',
        notes: 'Already covered by annual family plan',
      },
      {
        memberId: byName.get('maya')!,
        title: 'Pediatric Dental Checkup',
        merchant: 'BrightSmile Family Dental',
        category: 'Healthcare',
        amountCents: 14500,
        spentAt: `${monthKey}-08`,
        necessity: 'essential',
        unnecessaryReason: null,
        notes: 'Routine 6-month cleaning copay',
      },
      {
        memberId: byName.get('sofia')!,
        title: 'School Robotics Club Supplies',
        merchant: 'STEM Depot',
        category: 'Education',
        amountCents: 6800,
        spentAt: `${monthKey}-09`,
        necessity: 'essential',
        unnecessaryReason: null,
        notes: 'Semester lab kit',
      },
      {
        memberId: primary.id,
        title: 'Morning Espresso & Pastries (Week)',
        merchant: 'Blue Bottle Coffee',
        category: 'Dining Out',
        amountCents: 7250,
        spentAt: `${monthKey}-11`,
        necessity: 'discretionary',
        unnecessaryReason: null,
        notes: '5 weekday cafe stops',
      },
      {
        memberId: byName.get('leo')!,
        title: 'In-Game Cosmetic Skins Pack',
        merchant: 'PlayStation Store',
        category: 'Entertainment',
        amountCents: 5999,
        spentAt: `${monthKey}-12`,
        necessity: 'unnecessary',
        unnecessaryReason: 'Impulse digital purchase',
        notes: 'Unplanned weekend purchase',
      },
      {
        memberId: byName.get('maya')!,
        title: 'Household Bulk Pantry & Detergents',
        merchant: 'Costco Wholesale',
        category: 'Groceries',
        amountCents: 26840,
        spentAt: `${monthKey}-14`,
        necessity: 'essential',
        unnecessaryReason: null,
        notes: 'Monthly bulk restock',
      },
      {
        memberId: primary.id,
        title: 'Express Car Wash & Detailing Add-on',
        merchant: 'ShineAuto',
        category: 'Transport',
        amountCents: 6500,
        spentAt: `${monthKey}-15`,
        necessity: 'unnecessary',
        unnecessaryReason: 'Premium upsell not needed',
        notes: 'Upgraded to ceramic wax package',
      },
      {
        memberId: byName.get('maya')!,
        title: 'Monthly Commuter Transit Pass',
        merchant: 'Metro Transit',
        category: 'Transport',
        amountCents: 12700,
        spentAt: `${monthKey}-16`,
        necessity: 'essential',
        unnecessaryReason: null,
        notes: '30-day unlimited pass',
      },
      {
        memberId: byName.get('leo')!,
        title: 'Sneaker Drop Limited Edition',
        merchant: 'KicksVault',
        category: 'Shopping',
        amountCents: 18900,
        spentAt: `${monthKey}-17`,
        necessity: 'unnecessary',
        unnecessaryReason: 'Impulse fashion spend',
        notes: 'Already owns 3 pairs of running shoes',
      },
      {
        memberId: byName.get('sofia')!,
        title: 'Weekend Family Zoo Tickets',
        merchant: 'City Botanical Zoo',
        category: 'Entertainment',
        amountCents: 9400,
        spentAt: `${monthKey}-18`,
        necessity: 'discretionary',
        unnecessaryReason: null,
        notes: 'Planned Saturday family outing',
      },
      {
        memberId: primary.id,
        title: 'Mortgage & Home Insurance Escrow',
        merchant: 'FirstHome Bank',
        category: 'Housing',
        amountCents: 185000,
        spentAt: `${monthKey}-01`,
        necessity: 'essential',
        unnecessaryReason: null,
        notes: 'Monthly fixed housing obligation',
      },
    ];

    await db.insert(expenses).values(
      sampleRows.map((row) => ({
        userId,
        ...row,
      }))
    );

    // Update household monthly budget to $4,200 so the 80%+ spending alert triggers authentically
    await db
      .update(users)
      .set({ monthlyBudgetCents: 420000, alertThresholdPct: 80 })
      .where(eq(users.id, userId));

    await evaluateHouseholdAlerts(userId, monthKey);
  } catch (error) {
    console.error('Failed to seed sample household month:', error);
    throw new Error('Failed to load sample household transactions.', {
      cause: error,
    });
  }
}
