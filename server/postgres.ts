import { Pool } from 'pg';

/**
 * PostgreSQL pool for Vercel's Node.js serverless runtime.
 *
 * Use the Supabase shared transaction-pooler connection string (port 6543).
 * node-postgres sends unnamed parameterized statements unless a query config
 * explicitly supplies "name"; do not add named prepared statements here.
 *
 * Keep one client per warm function instance to avoid multiplying connections.
 * The pool is lazy so importing this module never connects during build time.
 */
let pool: Pool | undefined;

export function getPostgres(): Pool {
  if (pool) return pool;

  const connectionString = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL (Supabase transaction-pooler URL) is not configured.');
  }

  pool = new Pool({
    connectionString,
    max: 1,
    idleTimeoutMillis: 20_000,
    connectionTimeoutMillis: 10_000,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10_000,
    ssl: { rejectUnauthorized: false },
  });

  pool.on('error', (error) => {
    // Idle sockets can be closed while a serverless instance is frozen.
    // node-postgres removes errored idle clients; log without leaking config.
    console.error('PostgreSQL idle connection error:', error.message);
  });

  return pool;
}

/** Close the pool in scripts/tests; do not call this after each serverless request. */
export async function closePostgres(): Promise<void> {
  if (!pool) return;
  const current = pool;
  pool = undefined;
  await current.end();
}
