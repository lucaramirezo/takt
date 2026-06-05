import type { MemberRole, RosterOutput } from '@takt/domain'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { RoleEditCell } from './role-edit-cell'

export function RosterTable({ rows, meRole }: { rows: RosterOutput; meRole: MemberRole }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Role</TableHead>
          <TableHead>Employment</TableHead><TableHead>Status</TableHead>
          <TableHead className="text-right">Joined</TableHead>
          <TableHead className="text-right">Actions</TableHead>
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
            <TableCell className="text-right">
              <RoleEditCell row={r} meRole={meRole} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
