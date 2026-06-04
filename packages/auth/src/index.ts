import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { organization } from 'better-auth/plugins'
import {
  account,
  db,
  orgInvitations,
  orgMembers,
  organizations,
  session,
  user,
  verification,
} from '@takt/db'
import { ac, roles } from './permissions'

/**
 * takt auth. Phase 0 uses email + password to avoid external email infra;
 * emailOTP / Google OAuth come later. The organization plugin provides multi-tenant
 * membership + the owner/manager/people_manager/employee role model.
 */
export const auth = betterAuth({
  appName: 'takt',
  baseURL: process.env.BETTER_AUTH_URL ?? 'http://localhost:3000',
  secret: process.env.BETTER_AUTH_SECRET ?? 'dev-secret-change-me',
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      user,
      session,
      account,
      verification,
      organization: organizations,
      member: orgMembers,
      invitation: orgInvitations,
    },
  }),
  emailAndPassword: { enabled: true },
  plugins: [
    organization({
      ac,
      roles,
      creatorRole: 'owner',
      schema: {
        organization: { modelName: 'organizations' },
        member: { modelName: 'orgMembers', fields: { organizationId: 'orgId' } },
        invitation: { modelName: 'orgInvitations', fields: { organizationId: 'orgId' } },
      },
    }),
  ],
})

export type Auth = typeof auth
export { ac, roles, roleCan } from './permissions'
