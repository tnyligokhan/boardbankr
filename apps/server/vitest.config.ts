import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // With a real PostgreSQL every test file resets the same database (see createTestDb),
    // so files must run one after another. In-process PGlite gives each file its own
    // database and can stay parallel.
    fileParallelism: !process.env.TEST_DATABASE_URL,
  },
});
