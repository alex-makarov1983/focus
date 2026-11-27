// MCP over Streamable HTTP, stateless: every POST carries one JSON-RPC message
// (or a batch) and gets a plain JSON answer. No sessions, no SSE needed.
// deno-lint-ignore-file no-explicit-any
import { type Ctx, type Data, newUid, runTool, TOOLS, WRITE_TOOLS } from './tools.ts';

export interface Store {
  /** Current app data (read-only use). */
  read(): Promise<Data>;
  /** Run `fn` on the data inside a locked transaction; saves (version + 1) only if it reports a change. */
  write<T extends { changed: boolean }>(fn: (data: Data) => T): Promise<T>;
}
export interface Options { secret: string; store: Store; tz: string; now?: () => Date }

const VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'];
const SERVER_INFO = { name: 'focus', title: 'Focus', version: '1.0.0' };
const INSTRUCTIONS = [
  'Focus is the user\'s own app for tasks, projects, notes, habits, journal, money and lists. These tools read and change it; the app picks the changes up within a minute (or when it is reopened).',
  'Call focus_overview first in a conversation: it gives today\'s date in the user\'s time zone and the ids of projects and areas.',
  'Tasks live in a list (Inbox, Anytime, Someday or the user\'s own lists). Today and Most important are smart lists: put a task there by setting its date or priority "urgent". Follow-up and Delegated are tags; statuses are Not started, In progress, Paused, Archive and the user\'s own.',
  'The user often dictates by voice. Turn speech into clean, short titles in the language the user speaks; put extra details into notes. Resolve relative dates ("tomorrow", "next Friday", "в пятницу") against the date from focus_overview.',
  'Do what the user asked; for bigger changes (more than about 5 items, or rewriting plans) say what you will do and ask first. There is no delete tool: offer to complete, move to Someday, or remove the date instead, and say that deleting is done in the app.',
  'After a change, confirm it in one short sentence (what, when, where). Use titles, not ids, when talking to the user.',
  'The Safe (passwords, cards, documents) is not reachable through these tools; never ask for such data.',
].join('\n');

function todayIn(tz: string, d: Date) {
  try { return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d); }
  catch { return d.toISOString().slice(0, 10); }
}
function safeEqual(a: string, b: string) {
  const x = new TextEncoder().encode(a), y = new TextEncoder().encode(b);
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}
const json = (body: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...extra } });
const rpcError = (id: unknown, code: number, message: string) => ({ jsonrpc: '2.0', id: id ?? null, error: { code, message } });

export function makeHandler(o: Options) {
  return async (req: Request): Promise<Response> => {
    const url = new URL(req.url);
    const parts = url.pathname.split('/').filter(Boolean);
    const i = parts.indexOf('focus-mcp');
    const given = (i >= 0 ? parts[i + 1] : parts[parts.length - 1]) || url.searchParams.get('key') || '';
    // Fail closed: no (or a weak) configured secret means nobody gets in.
    if (!o.secret || o.secret.length < 24 || !safeEqual(given, o.secret)) return new Response('Not found', { status: 404 });

    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: { allow: 'POST, OPTIONS' } });
    if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: { allow: 'POST, OPTIONS' } });

    const raw = await req.text();
    if (raw.length > 1_000_000) return json(rpcError(null, -32600, 'Request too large'), 413);
    let msg: any;
    try { msg = JSON.parse(raw); } catch { return json(rpcError(null, -32700, 'Parse error'), 400); }

    const batch = Array.isArray(msg);
    const msgs: any[] = batch ? msg : [msg];
    const out: any[] = [];
    for (const m of msgs) {
      const r = await handleOne(m, o);
      if (r) out.push(r);
    }
    if (!out.length) return new Response(null, { status: 202 });
    return json(batch ? out : out[0]);
  };
}

async function handleOne(m: any, o: Options): Promise<any | null> {
  if (!m || m.jsonrpc !== '2.0' || typeof m.method !== 'string') {
    // Responses from the client (we never send requests) and junk are ignored / rejected.
    return m && 'id' in m && !('result' in m || 'error' in m) ? rpcError(m.id, -32600, 'Invalid request') : null;
  }
  const isNotification = !('id' in m);
  if (isNotification) return null;
  const id = m.id, p = m.params || {};
  try {
    switch (m.method) {
      case 'initialize': {
        const v = VERSIONS.includes(p.protocolVersion) ? p.protocolVersion : VERSIONS[1];
        return { jsonrpc: '2.0', id, result: { protocolVersion: v, capabilities: { tools: { listChanged: false } }, serverInfo: SERVER_INFO, instructions: INSTRUCTIONS } };
      }
      case 'ping': return { jsonrpc: '2.0', id, result: {} };
      case 'tools/list': return { jsonrpc: '2.0', id, result: { tools: TOOLS } };
      case 'resources/list': return { jsonrpc: '2.0', id, result: { resources: [] } };
      case 'prompts/list': return { jsonrpc: '2.0', id, result: { prompts: [] } };
      case 'tools/call': {
        const name = String(p.name || '');
        if (!TOOLS.some((t) => t.name === name)) return rpcError(id, -32602, `Unknown tool: ${name}`);
        const now = o.now ? o.now() : new Date();
        const ctx: Ctx = { today: todayIn(o.tz, now), now: now.getTime(), uid: newUid };
        const res = WRITE_TOOLS.has(name)
          ? await o.store.write((data) => runTool(name, p.arguments, data, ctx))
          : runTool(name, p.arguments, await o.store.read(), ctx);
        console.log(JSON.stringify({ tool: name, changed: res.changed, error: !!res.isError }));
        return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: res.text }], isError: !!res.isError } };
      }
      default: return rpcError(id, -32601, `Method not found: ${m.method}`);
    }
  } catch (e) {
    console.error('focus-mcp error', e instanceof Error ? e.message : e);
    // Tool failures are reported to the model as a tool error it can explain to the user.
    if (m.method === 'tools/call') return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: 'Focus could not be reached right now. Try again in a moment.' }], isError: true } };
    return rpcError(id, -32603, 'Internal error');
  }
}
