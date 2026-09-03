import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

// Multi-user: one row per user. Free DB (Turso libSQL / local file) persists for years.
// ledgers.id = users.id (NOT 'default' anymore; 'default' kept only for migration)
export const ledgers = sqliteTable('ledgers', {
  id: text('id').primaryKey(), // userId
  data: text('data').notNull(), // JSON.stringify(Ledger)
  updatedAt: integer('updated_at').notNull(), // Date.now()
});

export const users = sqliteTable('users', {
  id: text('id').primaryKey(), // crypto.randomUUID()
  username: text('username').notNull().unique(), // lowercased, e.g. 'gaurav'
  displayName: text('display_name').notNull(), // as typed, e.g. 'Gaurav'
  passwordHash: text('password_hash').notNull(), // bcryptjs
  createdAt: integer('created_at').notNull(), // Date.now()
});

export type LedgerRow = typeof ledgers.$inferSelect;
export type NewLedgerRow = typeof ledgers.$inferInsert;
export type UserRow = typeof users.$inferSelect;
export type NewUserRow = typeof users.$inferInsert;
