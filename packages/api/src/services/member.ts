import { ORPCError } from '@orpc/server'
import { type Database, type OrgCtx, auditLog, orgMembers, withOrgCtx } from '@takt/db'
import type { SetMemberRoleInput, SetMemberRoleOutput } from '@takt/domain'
import { and, eq } from 'drizzle-orm'

export async function setMemberRole(
  db: Database,
  ctx: OrgCtx,
  input: SetMemberRoleInput,
): Promise<SetMemberRoleOutput> {
  return withOrgCtx(db, ctx, async (tx) => {
    const [member] = await tx
      .select({ role: orgMembers.role })
      .from(orgMembers)
      .where(and(eq(orgMembers.id, input.memberId), eq(orgMembers.orgId, ctx.orgId)))
      .limit(1)
    if (!member) throw new ORPCError('NOT_FOUND', { message: 'Member not found in this organization' })

    if ((member.role === 'owner' || input.role === 'owner') && ctx.memberRole !== 'owner') {
      throw new ORPCError('FORBIDDEN', { message: 'Only an owner can change owner roles' })
    }

    if (member.role === 'owner' && input.role !== 'owner') {
      const owners = await tx
        .select({ id: orgMembers.id })
        .from(orgMembers)
        .where(and(eq(orgMembers.orgId, ctx.orgId), eq(orgMembers.role, 'owner')))
      if (owners.length <= 1) {
        throw new ORPCError('CONFLICT', { message: 'Cannot demote the last owner' })
      }
    }

    await tx
      .update(orgMembers)
      .set({ role: input.role })
      .where(and(eq(orgMembers.id, input.memberId), eq(orgMembers.orgId, ctx.orgId)))

    await tx.insert(auditLog).values({
      orgId: ctx.orgId,
      actorUserId: ctx.userId,
      action: 'org.member.set_role',
      entityType: 'org_members',
      entityId: input.memberId,
      before: { role: member.role },
      after: { role: input.role },
    })

    return { memberId: input.memberId, role: input.role }
  })
}
