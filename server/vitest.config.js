import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globalSetup: ['./src/tests/globalSetup.js'],
    include: ['src/tests/**/*.test.js'],
    testTimeout: 30000,
    hookTimeout: 120000, // first run downloads the MongoDB binary
    env: { NODE_ENV: 'test', JWT_SECRET: 'test-secret' },
  },
});
