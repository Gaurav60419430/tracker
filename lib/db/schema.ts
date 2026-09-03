import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

// Single ledger blob per deployment (key = 'default') — stores entire Ledger JSON.
// For multi-user later, add userId column.
// Updated_at is unix seconds for easy comparison.
export const ledgers = sqliteTable('ledgers', {
  id: text('id').primaryKey(), // e.g. 'default' or per-user id
  data: text('data').notNull(), // JSON.stringify(Ledger)
  updatedAt: integer('updated_at').notNull(), // Date.now()
});

export type LedgerRow = typeof ledgers.$inferSelect;
export type NewLedgerRow = typeof ledgers.$inferInsert;
