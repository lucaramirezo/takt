import { type Database, type OrgCtx, employeeProfile, orgMembers, user, withOrgCtx } from '@takt/db'
import type { MemberRole, RosterOutput } from '@takt/domain'
import { and, asc, eq } from 'drizzle-orm'

export async function getRoster(db: Database, ctx: OrgCtx): Promise<RosterOutput> {
  return withOrgCtx(db, ctx, async (tx) => {
    const rows = await tx
      .select({
        memberId: orgMembers.id,
        userId: orgMembers.userId,
        name: user.name,
        email: user.email,
        role: orgMembers.role,
        employeeProfileId: employeeProfile.id,
        employmentType: employeeProfile.employmentType,
        active: employeeProfile.active,
        joinedAt: orgMembers.createdAt,
      })
      .from(orgMembers)
      .innerJoin(user, eq(user.id, orgMembers.userId))
      .leftJoin(
        employeeProfile,
        and(eq(employeeProfile.userId, orgMembers.userId), eq(employeeProfile.orgId, ctx.orgId)),
      )
      .where(eq(orgMembers.orgId, ctx.orgId))
      .orderBy(asc(user.name))
    return rows.map((r) => ({ ...r, role: r.role as MemberRole, joinedAt: r.joinedAt.toISOString() }))
  })
}
