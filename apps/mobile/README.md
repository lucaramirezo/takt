# @takt/mobile

Expo worker + kiosk app (one binary; kiosk = device-bound mode). Phase 0 is a minimal placeholder.

## Finalize (run once, then the native features are built via Archon)
The native-only requirements (background geofencing, NFC, kiosk lockdown, offline outbox) need a
DEV-BUILD, not Expo Go. After `pnpm install` at the repo root:

```bash
cd apps/mobile
npx expo install            # aligns native deps to the SDK
# add the native modules as features land:
#   expo-location expo-task-manager   (geofencing)
#   react-native-nfc-manager          (NFC tap)
#   @op-engineering/op-sqlite         (offline outbox)
#   expo-secure-store                 (kiosk device token)
#   nativewind + @takt/ui-tokens      (shared design tokens)
npx expo prebuild           # generate native projects for the dev-build
```

See the repo `CLAUDE.md` for the design tokens and the gotchas (Expo Go cannot run the native views;
gate them behind a placeholder seam).
