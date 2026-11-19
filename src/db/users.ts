import { eq } from 'drizzle-orm';
import { db } from './index.ts';
import { familyMembers, users } from './schema.ts';

export async function getOrCreateUser(
  uid: string,
  email: string,
  displayName?: string | null
) {
  try {
    const result = await db
      .insert(users)
      .values({
        uid,
        email,
        displayName: displayName || null,
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email,
          ...(displayName ? { displayName } : {}),
        },
      })
      .returning();

    const user = result[0];

    // Ensure at least one primary family member exists for immediate expense logging
    const existingMembers = await db
      .select()
      .from(familyMembers)
      .where(eq(familyMembers.userId, user.id));

    if (existingMembers.length === 0) {
      const fallbackName =
        displayName?.split(' ')[0] || email.split('@')[0] || 'Me';
      await db.insert(familyMembers).values({
        userId: user.id,
        name: fallbackName,
        role: 'Primary',
        monthlyCapCents: 180000,
        avatarTint: '#0F766E',
      });
    }

    return user;
  } catch (error) {
    console.error('Database query failed in getOrCreateUser:', error);
    throw new Error('Failed to synchronize user account.', { cause: error });
  }
}
