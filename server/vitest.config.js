import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globalSetup: ['./src/tests/globalSetup.js'],
    include: ['src/tests/**/*.test.js'],
    testTimeout: 30000,
    hookTimeout: 120000, // each file migrates + seeds its own Postgres schema
    env: { NODE_ENV: 'test', JWT_SECRET: 'test-secret' },
  },
});
