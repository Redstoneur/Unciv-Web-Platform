import { fileURLToPath } from 'node:url';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import * as schema from './schema.js';

export type Database = PostgresJsDatabase<typeof schema>;

export interface DatabaseHandle {
  db: Database;
  close: () => Promise<void>;
}

const migrationsFolder = fileURLToPath(new URL('../../drizzle', import.meta.url));

export function createDatabase(url: string): DatabaseHandle {
  const client = postgres(url, { max: 10 });
  return {
    db: drizzle(client, { schema }),
    close: () => client.end({ timeout: 5 }),
  };
}

export async function runMigrations(db: Database): Promise<void> {
  await migrate(db, { migrationsFolder });
}
