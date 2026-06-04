import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'
import { clockSource, employmentType, timeEntryStatus, timeEntryType } from './enums'
import { organizations, user } from './auth'

// Every takt domain row carries org_id (text -> organizations.id) for RLS.

export const employeeProfile = pgTable(
  'employee_profile',
  {
    id: uuid().primaryKey().defaultRandom(),
    orgId: text()
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    employmentType: employmentType().notNull().default('hourly'),
    payRateCents: integer(),
    defaultSiteId: uuid(),
    active: boolean().notNull().default(true),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('employee_profile_org_idx').on(t.orgId)],
)

export const site = pgTable(
  'site',
  {
    id: uuid().primaryKey().defaultRandom(),
    orgId: text()
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    address: text(),
    lat: doublePrecision(),
    lng: doublePrecision(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('site_org_idx').on(t.orgId)],
)

export const geofence = pgTable(
  'geofence',
  {
    id: uuid().primaryKey().defaultRandom(),
    orgId: text()
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    centerLat: doublePrecision().notNull(),
    centerLng: doublePrecision().notNull(),
    radiusM: integer().notNull().default(150),
    siteId: uuid().references(() => site.id, { onDelete: 'set null' }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('geofence_org_idx').on(t.orgId)],
)

export const assignment = pgTable(
  'assignment',
  {
    id: uuid().primaryKey().defaultRandom(),
    orgId: text()
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    employeeId: uuid()
      .notNull()
      .references(() => employeeProfile.id, { onDelete: 'cascade' }),
    siteId: uuid().references(() => site.id, { onDelete: 'set null' }),
    geofenceId: uuid().references(() => geofence.id, { onDelete: 'set null' }),
    remoteOpsEnabled: boolean().notNull().default(false),
    scheduledStart: timestamp({ withTimezone: true }),
    scheduledEnd: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('assignment_org_idx').on(t.orgId), index('assignment_employee_idx').on(t.employeeId)],
)

// The heart of the system. APPEND-ONLY and immutable: no updatedAt, no deletes
// (enforced by revoking UPDATE/DELETE from takt_api in the manual RLS migration).
// Corrections are NEW adjustment rows, never edits. client_uuid is the idempotency key.
export const timeEntry = pgTable(
  'time_entry',
  {
    id: uuid().primaryKey().defaultRandom(),
    clientUuid: text().notNull().unique(),
    orgId: text()
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    employeeId: uuid()
      .notNull()
      .references(() => employeeProfile.id, { onDelete: 'cascade' }),
    assignmentId: uuid().references(() => assignment.id, { onDelete: 'set null' }),
    type: timeEntryType().notNull(),
    source: clockSource().notNull(),
    capturedAtClient: timestamp({ withTimezone: true }).notNull(),
    recordedAtServer: timestamp({ withTimezone: true }).notNull().defaultNow(),
    lat: doublePrecision(),
    lng: doublePrecision(),
    accuracyM: integer(),
    mockLocation: boolean().notNull().default(false),
    deviceId: text(),
    geofenceIdEval: uuid(),
    inZone: boolean(),
    photoRef: text(),
    nfcTagId: text(),
    status: timeEntryStatus().notNull().default('valid'),
  },
  (t) => [
    index('time_entry_org_idx').on(t.orgId),
    index('time_entry_employee_idx').on(t.employeeId),
  ],
)

// APPEND-ONLY. Records every manual edit, geofence change, role change, approval.
export const auditLog = pgTable(
  'audit_log',
  {
    id: uuid().primaryKey().defaultRandom(),
    orgId: text()
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    actorUserId: text(),
    action: text().notNull(),
    entityType: text().notNull(),
    entityId: text().notNull(),
    before: jsonb(),
    after: jsonb(),
    at: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('audit_log_org_idx').on(t.orgId)],
)
