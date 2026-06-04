# Archon

takt is built feature-by-feature with the Archon `piv-system-evolution` workflow (plan -> implement ->
validate, four human gates, ending in a draft PR). Install it once, then run it per PR-sized issue.

```bash
archon workflow install piv-system-evolution
archon workflow run piv-system-evolution --branch feat/<slug> "#<issue>"
```

Foundational slices land before clock modes; geofence + overtime features get the heaviest gate scrutiny.
The domain canon the loop relies on is in the repo `CLAUDE.md`. The seed issue backlog is in the PRD
(`drafts/artifacts/2026-06-04/takt/takt-prd.md` in the lwiki vault).
