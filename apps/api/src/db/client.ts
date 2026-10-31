import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema';

const connectionString =
  process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/vintrix';

const client = postgres(connectionString, {
  max: 10,
  connect_timeout: 5,
  onnotice: () => {},
});

export const db = drizzle(client, { schema });
export type DB = typeof db;
