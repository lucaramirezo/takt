import { pgEnum } from 'drizzle-orm/pg-core'

// Org member roles. NOTE: Better Auth stores member.role as plain text (see auth.ts);
// this list is the canonical allowed set used by permission logic, not a DB enum on that column.
export const MEMBER_ROLES = ['owner', 'manager', 'people_manager', 'employee'] as const
export type MemberRole = (typeof MEMBER_ROLES)[number]

// Bare pg enum names only (no `_enum` suffix). Manual SQL must match these names.
export const employmentType = pgEnum('employment_type', ['hourly', 'salaried', 'contractor'])
export const clockSource = pgEnum('clock_source', ['in_app', 'kiosk', 'nfc', 'remote'])
export const timeEntryType = pgEnum('time_entry_type', [
  'clock_in',
  'clock_out',
  'break_start',
  'break_end',
])
export const timeEntryStatus = pgEnum('time_entry_status', ['valid', 'flagged'])
