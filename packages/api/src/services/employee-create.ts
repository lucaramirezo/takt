import { randomUUID } from 'node:crypto'
import { ORPCError } from '@orpc/server'
import { type Database, type OrgCtx, auditLog, employeeProfile, orgMembers, user, withOrgCtx } from '@takt/db'
import type { EmployeeCreateInput, EmployeeCreateOutput } from '@takt/domain'
import { hashPin } from '../lib/crypto'

export async function createEmployee(
  db: Database,
  ctx: OrgCtx,
  input: EmployeeCreateInput,
): Promise<EmployeeCreateOutput> {
  if (input.role === 'owner' && ctx.memberRole !== 'owner') {
    throw new ORPCError('FORBIDDEN', { message: 'Only an owner can create an owner' })
  }

  const userId = 'user_' + randomUUID()
  const memberId = 'member_' + randomUUID()
  const email = input.email ?? 'worker-' + userId + '@workers.takt.local'
  const pinHash = input.pin ? await hashPin(input.pin) : null

  // Phase A: insert into no-RLS tables (user + orgMembers) using raw db.
  try {
    await db.insert(user).values({ id: userId, name: input.name, email, emailVerified: false })
  } catch (err) {
    const code =
      (err as { cause?: { code?: string }; code?: string }).cause?.code ??
      (err as { code?: string }).code
    if (code === '23505') throw new ORPCError('CONFLICT', { message: 'Email already in use' })
    throw err
  }
  await db.insert(orgMembers).values({ id: memberId, orgId: ctx.orgId, userId, role: input.role })

  // Phase B: insert RLS-gated rows inside withOrgCtx.
  return withOrgCtx(db, ctx, async (tx) => {
    const [profileRow] = await tx
      .insert(employeeProfile)
      .values({ orgId: ctx.orgId, userId, employmentType: input.employmentType, pinHash, active: true })
      .returning({ id: employeeProfile.id })
    const profileId = profileRow!.id
    await tx.insert(auditLog).values({
      orgId: ctx.orgId,
      actorUserId: ctx.userId,
      action: 'employee.create',
      entityType: 'employee_profile',
      entityId: profileId,
      before: null,
      after: { userId, memberId, role: input.role, employmentType: input.employmentType },
    })
    return { userId, memberId, employeeProfileId: profileId, role: input.role }
  })
}
