import type { MemberRole, RosterOutput } from '@takt/domain'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { RoleEditCell } from './role-edit-cell'
import { SetPinDialog } from './set-pin-dialog'

export function RosterTable({ rows, meRole }: { rows: RosterOutput; meRole: MemberRole }) {
  const canManage = meRole === 'owner' || meRole === 'people_manager'
  const canSetPin = meRole !== 'employee'
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Role</TableHead>
          <TableHead>Employment</TableHead><TableHead>Status</TableHead>
          <TableHead className="text-right">Joined</TableHead>
          {canSetPin && <TableHead className="text-right">PIN</TableHead>}
          {canManage && <TableHead className="text-right">Actions</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.memberId}>
            <TableCell className="font-medium">{r.name}</TableCell>
            <TableCell className="text-muted-foreground">{r.email}</TableCell>
            <TableCell>
              <span className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                {r.role.replaceAll('_', ' ')}
              </span>
            </TableCell>
            <TableCell>{r.employmentType ?? 'Not set'}</TableCell>
            <TableCell>{r.active === null ? 'Not set' : r.active ? 'Active' : 'Inactive'}</TableCell>
            <TableCell className="text-right font-mono tabular-nums">
              {new Date(r.joinedAt).toLocaleDateString()}
            </TableCell>
            {canSetPin && (
              <TableCell className="text-right">
                {r.employeeProfileId ? (
                  <SetPinDialog employeeId={r.employeeProfileId} employeeName={r.name} />
                ) : (
                  <span className="text-xs text-muted-foreground">No profile</span>
                )}
              </TableCell>
            )}
            {canManage && (
              <TableCell className="text-right">
                <RoleEditCell row={r} meRole={meRole} />
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
