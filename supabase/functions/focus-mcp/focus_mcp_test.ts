// Run: TEST_DB_URL=postgres://… deno test -A --config deno.json
// Needs auth.users + public.focus_state (see supabase/schema.sql). Uses a throwaway user id.
// deno-lint-ignore-file no-explicit-any
import nodeAssert from 'node:assert/strict';
const assert = (v: unknown, m?: string) => nodeAssert.ok(v, m);
const assertEquals = (a: unknown, b: unknown, m?: string) => nodeAssert.deepStrictEqual(a, b, m);
const assertMatch = (s: string, re: RegExp) => nodeAssert.match(s, re);
import postgres from 'postgres';
import { makeHandler } from './server.ts';
import { pgStore } from './db.ts';

const DB = Deno.env.get('TEST_DB_URL')!;
const UID = '22222222-2222-2222-2222-222222222222';
const EMAIL = 'mcp-test@example.com';
const SECRET = 'test-secret-0123456789abcdefghij';
const sql = postgres(DB, { prepare: false, max: 2 });
const fixedNow = () => new Date('2026-11-27T03:00:00Z'); // 11:00 in Bali, Friday

const seed = {
  tasks: [
    { id: 't1', title: 'Pay rent', notes: '', list: 'anytime', date: '2026-11-27', time: '', priority: 'high', status: 'todo', area: 'personal', project: '', repeat: 'monthly', subtasks: [], done: false, completedAt: '', order: 1, createdAt: 1, photos: [], delegatedTo: '' },
    { id: 't2', title: 'Call bank', notes: 'about card', list: 'inbox', date: '', time: '', priority: 'medium', status: 'todo', area: '', project: '', repeat: '', subtasks: [{ id: 's1', title: 'find number', done: false }], done: false, completedAt: '', order: 2, createdAt: 1, photos: [], delegatedTo: '' },
    { id: 't3', title: 'Old overdue thing', notes: '', list: 'anytime', date: '2026-11-20', time: '', priority: 'medium', status: 'todo', area: '', project: 'p1', repeat: '', subtasks: [], done: false, completedAt: '', order: 3, createdAt: 1, photos: [], delegatedTo: '' },
  ],
  projects: [{ id: 'p1', name: 'Berawa lofts', area: 'business', status: 'active', order: 1 }, { id: 'p2', name: 'Berawa website', area: 'business', status: 'active', order: 2 }],
  areas: [{ id: 'personal', name: 'Personal' }, { id: 'business', name: 'Business' }],
  notes: [], habits: [{ id: 'hb_1', name: 'Gym', createdAt: 1, done: {} }], journal: [], finance: [], bookmarks: [], media: [], purchases: [], friends: [],
  settings: { currency: 'USD', assistants: ['Assistant'] },
};
const VAULT = { ciphertext: 'SECRET-SAFE-BLOB' };

async function reset() {
  await sql`delete from public.focus_state where user_id = ${UID}`;
  await sql`delete from auth.users where id = ${UID}`;
  await sql`insert into auth.users (id, email) values (${UID}, ${EMAIL})`;
  await sql`insert into public.focus_state (user_id, data, vault, version) values (${UID}, ${sql.json(seed)}, ${sql.json(VAULT)}, 7)`;
}
const handler = makeHandler({ secret: SECRET, store: pgStore(DB, EMAIL), tz: 'Asia/Makassar', now: fixedNow });
let n = 0;
async function rpc(method: string, params: any = {}, secret = SECRET) {
  const res = await handler(new Request(`http://x/focus-mcp/${secret}`, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify({ jsonrpc: '2.0', id: ++n, method, params }) }));
  return { status: res.status, body: res.status === 200 ? await res.json() : await res.text() };
}
async function call(name: string, args: any = {}) {
  const r = await rpc('tools/call', { name, arguments: args });
  assertEquals(r.status, 200);
  return { text: r.body.result.content[0].text as string, isError: r.body.result.isError as boolean };
}
async function row() { return (await sql`select data, vault, version from public.focus_state where user_id = ${UID}`)[0]; }

Deno.test({ name: 'protocol: auth, initialize, list, notifications', sanitizeResources: false, sanitizeOps: false, async fn() {
  await reset();
  assertEquals((await rpc('initialize', {}, 'wrong-secret-0123456789abcdefghij')).status, 404);
  assertEquals((await handler(new Request(`http://x/focus-mcp/${SECRET}`))).status, 405);
  const weak = makeHandler({ secret: 'short', store: pgStore(DB, EMAIL), tz: 'UTC' });
  assertEquals((await weak(new Request('http://x/focus-mcp/short', { method: 'POST', body: '{}' }))).status, 404);
  const init = await rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '1' } });
  assertEquals(init.body.result.protocolVersion, '2025-06-18');
  assert(init.body.result.capabilities.tools);
  const note = await handler(new Request(`http://x/focus-mcp/${SECRET}`, { method: 'POST', body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) }));
  assertEquals(note.status, 202);
  const list = await rpc('tools/list');
  assertEquals(list.body.result.tools.length, 16);
  for (const t of list.body.result.tools) { assert(t.inputSchema.type === 'object'); assert(t.description.length > 10); }
  assertEquals((await rpc('nope/method')).body.error.code, -32601);
} });

Deno.test({ name: 'reads do not change anything', sanitizeResources: false, sanitizeOps: false, async fn() {
  await reset();
  const o = await call('focus_overview');
  assertMatch(o.text, /Today is Friday 2026-11-27/);
  assertMatch(o.text, /Overdue \(1\)/);
  assertMatch(o.text, /\[t1\] Pay rent/);
  assertMatch(o.text, /Berawa lofts \[p1\]/);
  assertMatch((await call('focus_search', { query: 'bank' })).text, /\[t2\] Call bank/);
  assertMatch((await call('focus_get', { type: 'task', id: 't2' })).text, /find number/);
  assertMatch((await call('focus_list_tasks', { view: 'project', project: 'lofts' })).text, /Old overdue thing/);
  assertEquals(Number((await row()).version), 7);
} });

Deno.test({ name: 'tasks: create, update, complete, reopen', sanitizeResources: false, sanitizeOps: false, async fn() {
  await reset();
  let r = await call('focus_create_task', { title: 'Buy milk' });
  assertMatch(r.text, /Buy milk · Inbox/);
  r = await call('focus_create_task', { title: 'Meet Aldo', date: '2026-11-28', time: '15:00', project: 'Berawa lofts', subtasks: ['bring contract'] });
  assertMatch(r.text, /Anytime · 2026-11-28 15:00 · project: Berawa lofts · subtasks 0\/1/);
  // ambiguous project name is an error, nothing saved
  r = await call('focus_create_task', { title: 'X', project: 'Berawa' });
  assert(r.isError); assertMatch(r.text, /Several projects/);
  r = await call('focus_create_task', { title: 'Y', date: '28.11.2026' });
  assert(r.isError);
  let d = (await row()).data;
  assertEquals(d.tasks.length, 5);
  const meet = d.tasks.find((t: any) => t.title === 'Meet Aldo');
  assertEquals(meet.area, 'business');
  assert(meet.order < 0, 'new tasks go on top like in the app');
  r = await call('focus_update_task', { id: 'Call bank', date: '2026-11-29', priority: 'urgent', append_notes: 'ask about limits', check_subtasks: ['find number'], status: 'waiting' });
  assertMatch(r.text, /Anytime · 2026-11-29 · urgent · status: Follow-up/);
  d = (await row()).data;
  const bank = d.tasks.find((t: any) => t.id === 't2');
  assertEquals(bank.notes, 'about card\n\nask about limits');
  assertEquals(bank.subtasks[0].done, true);
  // repeating task spawns the next one, as in the app
  r = await call('focus_complete_task', { id: 't1' });
  assertMatch(r.text, /Next one on 2026-12-27/);
  d = (await row()).data;
  assertEquals(d.tasks.find((t: any) => t.id === 't1').done, true);
  assertEquals(d.tasks.filter((t: any) => t.title === 'Pay rent' && !t.done)[0].repeat, 'monthly');
  r = await call('focus_complete_task', { id: 't1', reopen: true });
  assertMatch(r.text, /Reopened/);
  assertEquals(d.tasks.length, 6);
} });

Deno.test({ name: 'notes, projects, money, habits, journal, lists', sanitizeResources: false, sanitizeOps: false, async fn() {
  await reset();
  assertMatch((await call('focus_create_note', { title: 'Ideas', body: 'one', project: 'p1' })).text, /Created note/);
  assertMatch((await call('focus_update_note', { id: 'Ideas', append: 'two' })).text, /Updated note/);
  assertMatch((await call('focus_save_project', { name: 'Pilot license', area: 'Personal' })).text, /Created project “Pilot license”.*Personal/);
  assertMatch((await call('focus_save_project', { id: 'p2', status: 'paused' })).text, /paused/);
  assertMatch((await call('focus_add_money', { kind: 'expense', amount: 12.5, currency: 'usd', category: 'Transport', note: 'Grab' })).text, /12.5 USD · Transport · 2026-11-27/);
  assertMatch((await call('focus_habit', { habit: 'gym' })).text, /marked done for 2026-11-27/);
  assertMatch((await call('focus_habit', { habit: 'Read 20 pages', create: true })).text, /Created habit/);
  assertMatch((await call('focus_journal', { text: 'Good day', mood: 4 })).text, /mood Good/);
  await call('focus_journal', { text: 'Evening walk' });
  assertMatch((await call('focus_add_item', { type: 'media', title: 'Dune', media_type: 'Book' })).text, /Book/);
  assertMatch((await call('focus_add_item', { type: 'bookmark', title: 'Betterplace', url: 'https://betterplace.cc' })).text, /Bookmark saved/);
  assert((await call('focus_add_item', { type: 'bookmark', title: 'bad', url: 'betterplace' })).isError);
  assertMatch((await call('focus_add_item', { type: 'purchase', title: 'Sea Ray 275', amount: 30000 })).text, /30000 USD/);
  assertMatch((await call('focus_add_item', { type: 'friend', title: 'Michael', cadence_days: 14 })).text, /every 14 days/);
  assertMatch((await call('focus_update_item', { type: 'media', id: 'Dune', status: 'Done' })).text, /Updated media/);
  assertMatch((await call('focus_update_item', { type: 'friend', id: 'Michael', contacted_today: true })).text, /Updated friend/);
  const { data: d, vault, version } = await row();
  assertEquals(d.notes[0].body, 'one\n\ntwo');
  assertEquals(d.notes[0].project, 'p1');
  assertEquals(d.habits[0].done['2026-11-27'], true);
  assertEquals(d.journal[0].text, 'Good day\n\nEvening walk');
  assertEquals(d.media[0].status, 'Done');
  assertEquals(d.friends[0].last, '2026-11-27');
  assertEquals(d.projects.find((p: any) => p.id === 'p2').status, 'paused');
  assertEquals(vault, VAULT, 'the Safe is never touched');
  assertEquals(Number(version), 7 + 15, 'each successful write bumps the version once');
} });

Deno.test({ name: 'parallel writes are not lost (row lock)', sanitizeResources: false, sanitizeOps: false, async fn() {
  await reset();
  await Promise.all(Array.from({ length: 12 }, (_, i) => call('focus_create_task', { title: 'Parallel ' + i })));
  const { data, version } = await row();
  assertEquals(data.tasks.filter((t: any) => t.title.startsWith('Parallel')).length, 12);
  assertEquals(Number(version), 19);
} });

Deno.test({ name: 'lists, statuses, tags and the 1.11 task fields', sanitizeResources: false, sanitizeOps: false, async fn() {
  await reset();
  let r = await call('focus_organize', { kind: 'list', name: 'Calls' });
  assertMatch(r.text, /Created list “Calls”/);
  r = await call('focus_create_task', { title: 'Call Aldo', list: 'calls', status: 'Follow-up', tags: ['Bali', 'Berawa'], life_area: 'Household', location: 'bali', priority: 'High', links: ['example.com/lease'], ai_chat: 'https://claude.ai/chat/x' });
  assertMatch(r.text, /Call Aldo · Calls · high · status: Follow-up · #Bali #Berawa · life area: Household & Assets management · location: Bali/);
  assertMatch(r.text, /New tag created: Berawa/);
  r = await call('focus_create_task', { title: 'Z', list: 'Today' });
  assert(r.isError); assertMatch(r.text, /smart lists/);
  r = await call('focus_create_task', { title: 'Z', priority: 'Critical' });
  assert(r.isError); assertMatch(r.text, /Priority must be one of: Urgent, High, Medium, Low/);
  assertMatch((await call('focus_list_tasks', { view: 'list', list: 'Calls' })).text, /Call Aldo/);
  assertMatch((await call('focus_list_tasks', { view: 'tag', tag: 'Berawa' })).text, /Call Aldo/);
  assertMatch((await call('focus_list_tasks', { view: 'followup' })).text, /Call Aldo/);
  r = await call('focus_update_task', { id: 'Call Aldo', status: 'In progress', remove_tags: ['Bali'], location: '' });
  assertMatch(r.text, /status: In progress · #Berawa · life area/);
  assertMatch((await call('focus_list_tasks', { view: 'followup' })).text, /none/);
  r = await call('focus_update_task', { id: 'Call bank', delegated_to: 'Business assistant' });
  assertMatch(r.text, /delegated to Business assistant/);
  assertMatch((await call('focus_list_tasks', { view: 'delegated' })).text, /Call bank/);
  r = await call('focus_update_task', { id: 'Call bank', status: 'Archive' });
  assertMatch((await call('focus_list_tasks', { view: 'inbox' })).text, /none/);
  assertMatch((await call('focus_list_tasks', { view: 'archived' })).text, /Call bank/);
  assertMatch((await call('focus_organize', { kind: 'location', name: 'Dubai' })).text, /Created location “Dubai”/);
  const o = (await call('focus_overview')).text;
  assertMatch(o, /Lists: .*Calls \[l_/);
  assertMatch(o, /Locations: Online, USA, Russia, Bali, Dubai/);
  const d = (await row()).data;
  const t = d.tasks.find((x: any) => x.title === 'Call Aldo');
  assertEquals([t.sphere, t.location, t.links, t.aiChat], ['sp_household_assets_management', '', ['https://example.com/lease'], 'https://claude.ai/chat/x']);
  assertEquals(d.tags.map((g: any) => g.name), ['Moscow', 'Bali', 'USA', 'Berawa']);
} });

Deno.test({ name: 'data from Focus 1.10: Follow-up and Delegated tags become a status and the field', sanitizeResources: false, sanitizeOps: false, async fn() {
  await reset();
  const d0 = structuredClone(seed) as any;
  d0.tags = [{ id: 'followup', name: 'Follow-up', builtin: true }, { id: 'delegated', name: 'Delegated', builtin: true }];
  d0.tasks[1].tags = ['followup']; d0.tasks[2].tags = ['delegated'];
  await sql`update public.focus_state set data = ${sql.json(d0)} where user_id = ${UID}`;
  assertMatch((await call('focus_list_tasks', { view: 'followup' })).text, /Call bank/);
  await call('focus_create_task', { title: 'touch' });
  const d = (await row()).data;
  assertEquals(d.tasks.find((t: any) => t.id === 't2').status, 'followup');
  assertEquals(d.tasks.find((t: any) => t.id === 't3').tags, []);
  assertEquals(d.tags.length, 0);
} });

// The app's own three-way merge, copied from app.js (v1.4 cloud sync), to prove the phone keeps
// its unsynced edits and also receives what Claude added.
function same(a: any, b: any) { return JSON.stringify(a) === JSON.stringify(b); }
function isIdList(a: any) { return Array.isArray(a) && a.length > 0 && a.every((x) => x && typeof x === 'object' && 'id' in x); }
function mergeState(base: any, local: any, remote: any) {
  const out: any = {}, keys: any = {};
  [local, remote].forEach((o) => Object.keys(o || {}).forEach((k) => { keys[k] = 1; }));
  Object.keys(keys).forEach((k) => {
    const b = base ? base[k] : undefined, l = local[k], r = remote[k];
    if ((isIdList(l) || isIdList(r) || isIdList(b)) && Array.isArray(l || []) && Array.isArray(r || [])) { out[k] = mergeList(base ? (b || []) : null, l || [], r || []); return; }
    if (!base) out[k] = r !== undefined ? r : l;
    else out[k] = (l !== undefined && !same(l, b)) ? l : (r !== undefined ? r : l);
  });
  return out;
}
function mergeList(b: any, l: any[], r: any[]) {
  const B: any = {}, L: any = {}, R: any = {}, order: any[] = [];
  (b || []).forEach((x: any) => { B[x.id] = x; }); l.forEach((x) => { L[x.id] = x; }); r.forEach((x) => { R[x.id] = x; });
  r.forEach((x) => order.push(x.id)); l.forEach((x) => { if (!R[x.id]) order.push(x.id); });
  const res: any[] = [];
  order.forEach((id) => {
    const inB = !!B[id], li = L[id], ri = R[id];
    if (li && ri) res.push(!b ? ri : (!same(li, B[id]) ? li : ri));
    else if (li) { if (!b || !inB || !same(li, B[id])) res.push(li); }
    else if (ri) { if (!b || !inB || !same(ri, B[id])) res.push(ri); }
  });
  return res;
}

Deno.test({ name: 'the app merges Claude\'s changes with its own unsynced edits', sanitizeResources: false, sanitizeOps: false, async fn() {
  await reset();
  const base: any = structuredClone(seed);
  const local: any = structuredClone(seed);
  local.tasks.find((t: any) => t.id === 't3').title = 'Edited on the phone';
  local.notes.push({ id: 'n-phone', title: 'Phone note' });
  await call('focus_create_task', { title: 'Added by voice' });
  await call('focus_complete_task', { id: 't2' });
  const merged = mergeState(base, local, (await row()).data);
  assert(merged.tasks.some((t: any) => t.title === 'Added by voice'));
  assertEquals(merged.tasks.find((t: any) => t.id === 't3').title, 'Edited on the phone');
  assertEquals(merged.tasks.find((t: any) => t.id === 't2').done, true);
  assert(merged.notes.some((n: any) => n.id === 'n-phone'));
  await sql`delete from public.focus_state where user_id = ${UID}`;
  await sql`delete from auth.users where id = ${UID}`;
  await sql.end();
} });
