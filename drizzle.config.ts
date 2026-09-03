import { defineConfig } from 'drizzle-kit';

const url = process.env.TURSO_DATABASE_URL ?? process.env.DATABASE_URL ?? 'file:./data/money-tees.db';

export default defineConfig({
  schema: './lib/db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: { url },
  verbose: true,
  strict: true,
});
