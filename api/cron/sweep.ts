import type { IncomingMessage, ServerResponse } from 'node:http';
import { HttpError } from '../../server/errors.ts';
import { sweepDeadlines } from '../../server/postgres-tasks.ts';
import * as cloud from '../../server/supabase.ts';

type Request = IncomingMessage & { method?: string };
type Response = ServerResponse & { status(code: number): Response; json(body: unknown): void };

export default async function handler(req: Request, res: Response) {
  try {
    const secret = process.env.CRON_SECRET || '';
    const authorization = req.headers.authorization || '';
    if (!secret || authorization !== `Bearer ${secret}`) {
      res.status(401).json({ error: 'Unauthorized.' });
      return;
    }
    if (req.method !== 'GET') {
      res.status(405).json({ error: 'Method not allowed.' });
      return;
    }
    await sweepDeadlines();
    const cleaned = await cloud.cleanupExpiredSubmissions();
    res.status(200).json({ ok: true, cleanedSubmissions: cleaned });
  } catch (error) {
    if (error instanceof HttpError) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    console.error('Daily Duty scheduled sweep failed:', error);
    res.status(500).json({ error: 'Scheduled sweep failed.' });
  }
}
