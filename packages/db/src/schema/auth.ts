import { boolean, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core'

// Better Auth core tables. IDs are STRINGS (text), never uuid: Better Auth generates
// base62 ids and the drizzle adapter breaks on uuid columns. JS keys are camelCase to
// match Better Auth field names; casing:'snake_case' maps them to snake_case columns.

export const user = pgTable('user', {
  id: text().primaryKey(),
  name: text().notNull(),
  email: text().notNull().unique(),
  emailVerified: boolean().notNull().default(false),
  image: text(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
})

export const session = pgTable('session', {
  id: text().primaryKey(),
  expiresAt: timestamp({ withTimezone: true }).notNull(),
  token: text().notNull().unique(),
  ipAddress: text(),
  userAgent: text(),
  userId: text()
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  activeOrganizationId: text(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
})

export const account = pgTable('account', {
  id: text().primaryKey(),
  accountId: text().notNull(),
  providerId: text().notNull(),
  userId: text()
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text(),
  refreshToken: text(),
  idToken: text(),
  accessTokenExpiresAt: timestamp({ withTimezone: true }),
  refreshTokenExpiresAt: timestamp({ withTimezone: true }),
  scope: text(),
  password: text(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
})

export const verification = pgTable('verification', {
  id: text().primaryKey(),
  identifier: text().notNull(),
  value: text().notNull(),
  expiresAt: timestamp({ withTimezone: true }).notNull(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
})

// Better Auth organization plugin. modelName remap (organizations / org_members /
// org_invitations) and field remap (organizationId -> orgId) mirror the KULT sibling.

export const organizations = pgTable('organizations', {
  id: text().primaryKey(),
  name: text().notNull(),
  slug: text().unique(),
  logo: text(),
  metadata: jsonb(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
})

export const orgMembers = pgTable('org_members', {
  id: text().primaryKey(),
  orgId: text()
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  userId: text()
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  role: text().notNull().default('employee'),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
})

export const orgInvitations = pgTable('org_invitations', {
  id: text().primaryKey(),
  orgId: text()
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  email: text().notNull(),
  role: text(),
  status: text().notNull().default('pending'),
  expiresAt: timestamp({ withTimezone: true }).notNull(),
  inviterId: text()
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
})
