import { AdminUserSummary, AdminHouseholdSummary, AdminAuditLogEntry } from '@wealthnest/domain';

export const DEMO_ADMIN_USERS: AdminUserSummary[] = [
  {
    id: '4c4fa116-57d5-4fc8-af89-be56b5069b50',
    email: 'investor@wealthnest.local',
    displayName: 'Ketan Vaghela',
    status: 'active',
    platformRole: 'super_admin',
    createdAt: '2026-10-17T13:10:58.169Z',
    lastSignInAt: '2026-10-24T07:15:00.000Z',
    householdCount: 1,
  },
  {
    id: 'usr-parul-vaghela-02',
    email: 'parul.vaghela@wealthnest.local',
    displayName: 'Parul Vaghela',
    status: 'active',
    platformRole: 'support_admin',
    createdAt: '2026-10-18T09:30:00.000Z',
    lastSignInAt: '2026-10-23T16:45:00.000Z',
    householdCount: 1,
  },
  {
    id: 'usr-shamalbhai-vaghela-03',
    email: 'shamalbhai.huf@wealthnest.local',
    displayName: 'Shamalbhai Vaghela HUF',
    status: 'active',
    createdAt: '2026-10-19T11:20:00.000Z',
    householdCount: 1,
  },
  {
    id: 'usr-ramilaben-vaghela-04',
    email: 'ramilaben.vaghela@wealthnest.local',
    displayName: 'Ramilaben Vaghela',
    status: 'active',
    createdAt: '2026-10-20T14:15:00.000Z',
    householdCount: 1,
  },
  {
    id: 'usr-krisha-vaghela-05',
    email: 'krisha.vaghela@wealthnest.local',
    displayName: 'Krisha Vaghela',
    status: 'invited',
    createdAt: '2026-10-24T06:00:00.000Z',
    householdCount: 1,
  },
];

export const DEMO_HOUSEHOLDS: AdminHouseholdSummary[] = [
  {
    id: 'a0000000-0000-0000-0000-000000000001',
    name: 'Vaghela Household',
    createdByName: 'Ketan Vaghela',
    createdAt: '2026-10-17T13:10:58.169Z',
    memberCount: 5,
  },
];

export const demoAuditLogsStore: AdminAuditLogEntry[] = [
  {
    id: 'audit-demo-01',
    actorUserId: '4c4fa116-57d5-4fc8-af89-be56b5069b50',
    actorName: 'Ketan Vaghela',
    targetUserId: '4c4fa116-57d5-4fc8-af89-be56b5069b50',
    targetName: 'Ketan Vaghela',
    action: 'SYSTEM_BOOTSTRAP',
    outcome: 'success',
    reasonCode: 'INITIAL_DEPLOYMENT',
    ipAddress: '127.0.0.1',
    safeMetadata: { note: 'Platform admin and Vaghela Household bootstrapped' },
    createdAt: '2026-10-24T07:25:22.000Z',
  },
];
