// Storage on the same focus_state row the app syncs with.
// Writes lock the row, change `data`, and bump `version`, exactly like the app's
// focus_save(): the app then sees a newer version and merges it in (three-way merge),
// so nothing typed on the phone in the meantime is lost. `vault` (the Safe) is never touched.
// deno-lint-ignore-file no-explicit-any
import postgres from 'postgres';
import type { Data } from './tools.ts';
import type { Store } from './server.ts';

export function pgStore(dbUrl: string, email: string): Store {
  const sql = postgres(dbUrl, { prepare: false, max: 2, idle_timeout: 20, connect_timeout: 10 });
  let userId = '';

  async function user(): Promise<string> {
    if (userId) return userId;
    if (email) {
      const rows = await sql`select id from auth.users where lower(email) = lower(${email}) limit 1`;
      if (!rows.length) throw new Error('No Focus account with the configured e-mail');
      userId = rows[0].id;
    } else {
      // No e-mail configured: allowed only while there is exactly one Focus account.
      const rows = await sql`select user_id from public.focus_state limit 2`;
      if (rows.length !== 1) throw new Error('Set FOCUS_USER_EMAIL: there is not exactly one Focus account');
      userId = rows[0].user_id;
    }
    return userId;
  }

  return {
    async read(): Promise<Data> {
      const uid = await user();
      const rows = await sql`select data from public.focus_state where user_id = ${uid}`;
      return rows.length ? (rows[0].data || {}) : {};
    },
    async write<T extends { changed: boolean }>(fn: (data: Data) => T): Promise<T> {
      const uid = await user();
      let out!: T;
      await sql.begin(async (tx: any) => {
        const rows = await tx`select data from public.focus_state where user_id = ${uid} for update`;
        const data = rows.length ? (rows[0].data || {}) : {};
        const res = fn(data);
        if (res.changed) {
          if (rows.length) await tx`update public.focus_state set data = ${tx.json(data)}, version = version + 1, device = 'Claude connector', updated_at = now() where user_id = ${uid}`;
          else await tx`insert into public.focus_state (user_id, data, version, device) values (${uid}, ${tx.json(data)}, 1, 'Claude connector')`;
        }
        out = res;
      });
      return out;
    },
  };
}
