export const DEMO_WORKSPACE_ID = 'nawi-demo-workspace';
export const DEMO_USERS = {
  TESTER: { email: 'demo.tester@nawi.local', firstName: 'Demo', lastName: 'Tester' },
  REVIEWER: { email: 'demo.reviewer@nawi.local', firstName: 'Demo', lastName: 'Reviewer' },
} as const;

export type WorkspaceUser = { isDemo?: boolean; demoWorkspaceId?: string };

/** Normal reviewers retain access to normal users, while demo reviewers are tenant-bound. */
export function reviewerTesterFilter(user: WorkspaceUser) {
  return user.isDemo && user.demoWorkspaceId
    ? { demoWorkspaceId: user.demoWorkspaceId }
    : { $or: [{ demoWorkspaceId: { $exists: false } }, { demoWorkspaceId: null }] };
}

export function userBelongsToWorkspace(reviewer: WorkspaceUser, candidate: WorkspaceUser) {
  const reviewerIsDemo = Boolean(reviewer.isDemo && reviewer.demoWorkspaceId);
  const candidateIsDemo = Boolean(candidate.isDemo && candidate.demoWorkspaceId);
  if (reviewerIsDemo) return candidateIsDemo && reviewer.demoWorkspaceId === candidate.demoWorkspaceId;
  return !candidateIsDemo;
}

export function demoLoginFilter(role: 'TESTER' | 'REVIEWER') {
  return { ...DEMO_USERS[role], email: DEMO_USERS[role].email, role, isActive: true, isDemo: true, demoWorkspaceId: DEMO_WORKSPACE_ID };
}

export function reviewerReportFilter(testerIds: unknown[], requestedTesterId?: string) {
  const ids = requestedTesterId ? testerIds.filter(id => String(id) === requestedTesterId) : testerIds;
  if (!ids.length) return { _id: { $exists: false } };
  return { $or: [{ testerId: { $in: ids } }, { submittedBy: { $in: ids } }] };
}
