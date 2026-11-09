import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import type { ExtractTablesWithRelations } from 'drizzle-orm';
import type { PgTransaction } from 'drizzle-orm/pg-core';
import * as schema from './schema';

export { schema };
export type Schema = typeof schema;

/** Works with both the postgres-js driver (production) and PGlite (tests). */
export type Db = PgDatabase<PgQueryResultHKT, Schema>;
export type Tx = PgTransaction<PgQueryResultHKT, Schema, ExtractTablesWithRelations<Schema>>;
