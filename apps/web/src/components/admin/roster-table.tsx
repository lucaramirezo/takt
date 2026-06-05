import type { RosterOutput } from '@takt/domain'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

export function RosterTable({ rows }: { rows: RosterOutput }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Role</TableHead>
          <TableHead>Employment</TableHead><TableHead>Status</TableHead>
          <TableHead className="text-right">Joined</TableHead>
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
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
