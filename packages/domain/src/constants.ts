/**
 * Placeholder organization timezone for day-bucketing. Both the timesheet fold and the
 * irregularity detector MUST bucket days in this single zone so the two admin surfaces never
 * disagree on which calendar day a punch belongs to (e.g. an overtime alert the timesheet denies).
 * Future work: replace with a per-org IANA zone column; until then this is deterministic and
 * viewer-independent (better than the browser-local zone, which differed between admins).
 */
export const ORG_DISPLAY_TZ = 'Europe/Madrid'
