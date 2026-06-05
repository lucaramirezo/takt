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
  // Accept requests proxied from the web app (browser Origin = :3001 via the Next.js rewrite).
  // Better Auth always also trusts its own baseURL origin (:3000), so the existing HTTP test is unaffected.
  trustedOrigins: (process.env.BETTER_AUTH_TRUSTED_ORIGINS ?? process.env.CORS_ALLOWLIST ?? 'http://localhost:3001')
    .split(',').map((s) => s.trim()).filter(Boolean),
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      user,
      session,
      account,
      verification,
      // Keys MUST match the org-plugin modelName values below (organizations/orgMembers/orgInvitations),
      // because the Drizzle adapter resolves models by schema-object key. Keying these as
      // organization/member/invitation makes org-plugin queries throw "model orgMembers not found".
      organizations,
      orgMembers,
      orgInvitations,
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
