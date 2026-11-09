import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node22',
  platform: 'node',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  // The shared workspace package is TypeScript source, so bundle it in.
  noExternal: ['@mdb/shared'],
  // Dev-only database; never bundled.
  external: ['@electric-sql/pglite'],
});
