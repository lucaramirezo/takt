import { defineConfig } from 'vitest/config'

process.env.DATABASE_URL ??= 'postgresql://postgres:dev@localhost:15432/takt'

export default defineConfig({
  test: {
    globalSetup: ['./src/__tests__/global-setup.ts'],
    include: ['src/**/*.test.ts'],
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
})
