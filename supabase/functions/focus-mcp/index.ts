// Focus MCP server — lets Claude (claude.ai, the Claude apps, voice) read and edit Focus.
// Address: https://<project>.supabase.co/functions/v1/focus-mcp/<FOCUS_MCP_SECRET>
// Secrets (set by .github/workflows/mcp.yml from GitHub secrets):
//   FOCUS_MCP_SECRET   long random string; it is the password inside the connector URL
//   FOCUS_USER_EMAIL   the Focus account to work with (optional while there is only one account)
//   FOCUS_TZ           time zone for "today", default Asia/Makassar (Bali)
// SUPABASE_DB_URL is provided by Supabase to every edge function.
import { makeHandler } from './server.ts';
import { pgStore } from './db.ts';

const env = (k: string) => Deno.env.get(k) || '';
Deno.serve(makeHandler({
  secret: env('FOCUS_MCP_SECRET'),
  store: pgStore(env('SUPABASE_DB_URL'), env('FOCUS_USER_EMAIL')),
  tz: env('FOCUS_TZ') || 'Asia/Makassar',
}));
