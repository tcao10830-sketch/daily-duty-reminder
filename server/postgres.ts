import postgres from 'postgres';

/**
 * Lazy Postgres client for serverless runtimes.
 *
 * Vercel functions use Supabase's shared transaction pooler. Keep one
 * connection per warm function instance and disable prepared statements,
 * which are not supported by the transaction pooler.
 *
 * This module is intentionally lazy: local development and the existing
 * Render/SQLite runtime do not connect to Postgres unless the new data layer
 * explicitly calls getPostgres().
 */
let client: ReturnType<typeof postgres> | undefined;

export function getPostgres(): ReturnType<typeof postgres> {
  if (client) return client;

  const connectionString = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL (Supabase transaction-pooler URL) is not configured.');
  }

  client = postgres(connectionString, {
    max: 1,
    prepare: false,
    ssl: 'require',
    connect_timeout: 10,
    idle_timeout: 20,
    max_lifetime: 60 * 30,
  });

  return client;
}

/** Close the client in scripts/tests; serverless handlers should reuse it. */
export async function closePostgres(): Promise<void> {
  if (!client) return;
  const current = client;
  client = undefined;
  await current.end({ timeout: 5 });
}
