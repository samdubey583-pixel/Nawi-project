import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';
import { DEMO_USERS, DEMO_WORKSPACE_ID } from './demoWorkspace.js';

/** Creates only the two reserved demo identities. Repeated startup leaves existing records intact. */
export async function seedDemoAccounts() {
  const seeded: Record<'TESTER' | 'REVIEWER', unknown> = {} as any;
  for (const role of ['TESTER', 'REVIEWER'] as const) {
    const identity = DEMO_USERS[role];
    let user: any = await User.findOne({ email: identity.email }).select('+passwordHash');
    if (user && !(user.isDemo && user.demoWorkspaceId === DEMO_WORKSPACE_ID && user.role === role)) {
      throw new Error(`Reserved demo identity ${identity.email} is already used by a non-demo account.`);
    }
    if (!user) {
      const passwordHash = await bcrypt.hash(randomBytes(48).toString('base64url'), 12);
      user = await User.create({ ...identity, email: identity.email, role, isActive: true, isDemo: true, demoWorkspaceId: DEMO_WORKSPACE_ID, passwordHash });
    }
    seeded[role] = user;
  }
  return seeded;
}
