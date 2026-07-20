import { defineConfig } from 'vitest/config';

// Node-environment tests for pure domain/orchestrator code.
export default defineConfig({
  test: {
    include: ['tests/node/**/*.test.ts'],
  },
});
