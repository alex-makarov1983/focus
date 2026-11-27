// Focus MCP tools: pure functions over the app's data object (focus_state.data).
// They follow the same rules as app.js (quickCreate, completeTask, nextDate…),
// so items made here look exactly like items made in the app.
// The Safe (focus_state.vault) is never read or written here.

// deno-lint-ignore-file no-explicit-any
export type Data = Record<string, any>;
export interface Ctx { today: string; now: number; uid: () => string; notes?: string[] }
export interface Result { text: string; changed: boolean; isError?: boolean }

const LIST_DEFAULTS = [{ id: 'inbox', name: 'Inbox' }, { id: 'today', name: 'Today' }, { id: 'urgent', name: 'Most important & Urgent', short: 'Most important' }, { id: 'anytime', name: 'Anytime' }, { id: 'someday', name: 'Someday' }];
const STATUS_DEFAULTS = [{ id: 'todo', name: 'Not started', color: 'gray' }, { id: 'doing', name: 'In progress', color: 'blue' }, { id: 'followup', name: 'Follow-up', color: 'purple' }, { id: 'paused', name: 'Paused', color: 'orange' }, { id: 'done', name: 'Done', color: 'green' }, { id: 'archived', name: 'Archive', color: 'gray' }];
const PURCHASE_PRIORITIES = ['urgent', 'high', 'medium', 'low'];
const TAG_DEFAULTS = [{ id: 'moscow', name: 'Moscow', color: 'red' }, { id: 'bali', name: 'Bali', color: 'green' }, { id: 'usa', name: 'USA', color: 'blue' }];
const PRIORITY_DEFAULTS = [{ id: 'urgent', name: 'Urgent' }, { id: 'high', name: 'High' }, { id: 'medium', name: 'Medium' }, { id: 'low', name: 'Low' }];
const SPHERE_DEFAULTS = ['Health', 'Security', 'Wealth', 'Family', 'Friends & Relatives', 'Household & Assets management', 'Travel, Leisure & Hobbies', 'Routines', 'Self improvement', 'Recognition', 'Self-realization', 'Betterment'];
const LOCATION_DEFAULTS = ['Online', 'USA', 'Russia', 'Bali'];
const slug = (x: string) => x.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
const COLORS = ['gray', 'blue', 'green', 'orange', 'red', 'purple', 'teal', 'pink'];
const PROJECT_STATUSES = ['active', 'paused', 'completed'];
const REPEATS = ['', 'daily', 'weekly', 'monthly', 'yearly'];
const MEDIA_TYPES = ['Movie', 'Series', 'Book', 'Lecture', 'YouTube', 'Music', 'Podcast'];
const MEDIA_STATUS = ['To do', 'In progress', 'Done'];
const PURCHASE_STATUSES = ['Wishlist', 'Researching', 'Planned', 'Saving', 'Bought'];
const MOODS = ['', 'Awful', 'Bad', 'Okay', 'Good', 'Great'];
const DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function newUid(): string { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

/* ---------- dates (same arithmetic as app.js) ---------- */
function parseYmd(s: string) { const [y, m, d] = s.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); }
function ymd(d: Date) { return d.toISOString().slice(0, 10); }
export function addDays(s: string, n: number) { const d = parseYmd(s); d.setUTCDate(d.getUTCDate() + n); return ymd(d); }
export function addMonths(s: string, n: number) {
  const d = parseYmd(s), day = d.getUTCDate();
  d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + n);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last)); return ymd(d);
}
function nextDate(d: string, rep: string) {
  if (rep === 'daily') return addDays(d, 1);
  if (rep === 'weekly') return addDays(d, 7);
  if (rep === 'monthly') return addMonths(d, 1);
  if (rep === 'yearly') return addMonths(d, 12);
  return d;
}
const isYmd = (s: unknown) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(parseYmd(s).getTime());
const isTime = (s: unknown) => typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
function dow(s: string) { return DOW[parseYmd(s).getUTCDay()]; }

/* ---------- data shape ---------- */
export function normalize(d: Data): Data {
  for (const k of ['tasks', 'projects', 'notes', 'finance', 'purchases', 'headings', 'bookmarks', 'accounts', 'balances', 'trips', 'friends', 'media', 'habits', 'journal']) if (!Array.isArray(d[k])) d[k] = [];
  if (!Array.isArray(d.areas) || !d.areas.length) d.areas = [{ id: 'personal', name: 'Personal' }, { id: 'business', name: 'Business' }];
  // Lists, statuses and tags as Focus 1.9 keeps them (built-ins are flagged so the app treats them the same).
  const seed = (defs: any[]) => defs.map((x, i) => ({ order: i + 1, builtin: true, ...x }));
  if (!Array.isArray(d.lists) || !d.lists.length) d.lists = seed(LIST_DEFAULTS);
  if (!Array.isArray(d.statuses) || !d.statuses.length) d.statuses = seed(STATUS_DEFAULTS);
  if (!Array.isArray(d.tags)) d.tags = seed(TAG_DEFAULTS);
  if (!Array.isArray(d.priorities) || !d.priorities.length) d.priorities = seed(PRIORITY_DEFAULTS);
  if (!Array.isArray(d.spheres)) d.spheres = SPHERE_DEFAULTS.map((n, i) => ({ id: 'sp_' + slug(n), name: n, order: i + 1 }));
  if (!Array.isArray(d.locations)) d.locations = LOCATION_DEFAULTS.map((n, i) => ({ id: 'lo_' + slug(n), name: n, order: i + 1 }));
  if (!d.settings || typeof d.settings !== 'object') d.settings = {};
  if (!Array.isArray(d.settings.assistants)) d.settings.assistants = ['AI assistant', 'Personal assistant', 'Business assistant'];
  if (!d.statuses.some((x: any) => x.id === 'followup')) d.statuses.push({ id: 'followup', name: 'Follow-up', color: 'purple', builtin: true, order: 2.5 });
  // Focus 1.10 kept Follow-up and Delegated as tags: they are a status and the "Delegated to" field now.
  const old = d.tags.filter((g: any) => g.builtin && (g.id === 'followup' || g.id === 'delegated')).map((g: any) => g.id);
  for (const t of d.tasks) {
    if (!Array.isArray(t.tags)) t.tags = [];
    if (old.includes('followup') && t.tags.includes('followup') && !t.done && (!t.status || t.status === 'todo' || t.status === 'doing')) t.status = 'followup';
    if (old.length) t.tags = t.tags.filter((x: string) => !old.includes(x));
    if (t.status === 'waiting') t.status = 'followup';
  }
  if (old.length) d.tags = d.tags.filter((g: any) => !old.includes(g.id));
  return d;
}
const byIdIn = (arr: any[], id: string) => (arr || []).find((x: any) => x.id === id);
const ord = (arr: any[]) => arr.slice().sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
const isOpen = (t: any) => !t.done && t.status !== 'archived';
const hasTag = (t: any, id: string) => Array.isArray(t.tags) && t.tags.includes(id);

class UserError extends Error {}
const fail = (m: string): never => { throw new UserError(m); };
const str = (v: unknown, max = 100000) => String(v ?? '').slice(0, max);
const low = (s: unknown) => String(s ?? '').trim().toLowerCase();
function oneOf(v: unknown, allowed: string[], field: string): string {
  const s = String(v ?? '');
  const hit = allowed.find((a) => a.toLowerCase() === s.toLowerCase());
  if (hit === undefined) fail(`${field} must be one of: ${allowed.filter(Boolean).join(', ')}${allowed.includes('') ? ' (or empty)' : ''}.`);
  return hit as string;
}

/* Find by id first, then by exact title, then by a unique partial title match. */
function findRef<T extends Record<string, any>>(arr: T[], ref: unknown, kind: string, titleKey = 'title', prefer?: (x: T) => boolean): T {
  const r = String(ref ?? '').trim();
  if (!r) fail(`Give the ${kind} id or name.`);
  const byId = arr.find((x) => x.id === r); if (byId) return byId;
  const pool = prefer ? [arr.filter(prefer), arr] : [arr];
  for (const p of pool) {
    const exact = p.filter((x) => low(x[titleKey]) === low(r));
    if (exact.length === 1) return exact[0];
    const part = p.filter((x) => low(x[titleKey]).includes(low(r)));
    if (part.length === 1) return part[0];
    if (exact.length > 1 || part.length > 1) {
      const c = (exact.length > 1 ? exact : part).slice(0, 8).map((x) => `“${x[titleKey]}” [${x.id}]`).join('; ');
      fail(`Several ${kind}s match “${r}”: ${c}. Use the id.`);
    }
  }
  return fail(`No ${kind} found for “${r}”. Search first to get its id.`);
}
const project = (d: Data, ref: unknown) => findRef(d.projects, ref, 'project', 'name', (p) => p.status !== 'completed');
const area = (d: Data, ref: unknown) => findRef(d.areas, ref, 'area', 'name');
const task = (d: Data, ref: unknown) => findRef(d.tasks, ref, 'task', 'title', (t) => !t.done);
/** Where a task lives: inbox, anytime, someday or one of the user's own lists (id or name). */
function listRef(d: Data, v: unknown): string {
  const r = low(v);
  if (r === 'today' || r === 'urgent' || low(byIdIn(d.lists, 'today')?.name) === r || low(byIdIn(d.lists, 'urgent')?.name) === r || r === 'most important')
    fail('Today and Most important are smart lists: set date (for Today) or priority "urgent" (for Most important) instead of list.');
  for (const id of ['inbox', 'anytime', 'someday']) if (r === id || low(byIdIn(d.lists, id)?.name) === r) return id;
  return findRef(d.lists.filter((l: any) => !l.builtin && !LIST_DEFAULTS.some((x) => x.id === l.id)), v, 'list', 'name').id;
}
function statusRef(d: Data, v: unknown, allowDone = false): string {
  const r = low(v);
  if (r === 'waiting' || r === 'follow-up' || r === 'followup') return 'followup';
  const part = d.statuses.filter((x: any) => low(x.name).includes(r));
  const s = d.statuses.find((x: any) => x.id === v || low(x.name) === r) || (part.length === 1 ? part[0] : null);
  if (!s) fail(`Unknown status “${v}”. Statuses: ${ord(d.statuses).map((x: any) => x.name).join(', ')}.`);
  if (s.id === 'done' && !allowDone) fail('Use focus_complete_task to mark a task done.');
  return s.id;
}
/** Tag ids for names or ids; missing tags are created (reported in `made`). */
function tagRefs(d: Data, v: unknown, c: Ctx, made: string[]): string[] {
  const xs = Array.isArray(v) ? v : [v];
  return xs.map((x) => String(x ?? '').replace(/^#/, '').trim()).filter(Boolean).map((name) => {
    const g = d.tags.find((t: any) => t.id === name || low(t.name) === low(name));
    if (g) return g.id;
    const n = { id: 'tg_' + c.uid(), name: name.slice(0, 40), color: 'gray', builtin: false, order: Math.max(0, ...d.tags.map((t: any) => t.order || 0)) + 1 };
    d.tags.push(n); made.push(n.name); return n.id;
  });
}
const listName = (d: Data, id: string) => (byIdIn(d.lists, id) || {}).name || id;
const statusName = (d: Data, id: string) => (byIdIn(d.statuses, id) || {}).name || id;
const tagName = (d: Data, id: string) => (byIdIn(d.tags, id) || {}).name || id;

/* ---------- formatting ---------- */
function projName(d: Data, id: string) { const p = d.projects.find((x: any) => x.id === id); return p ? p.name : ''; }
function areaName(d: Data, id: string) { const a = d.areas.find((x: any) => x.id === id); return a ? a.name : ''; }
function taskLine(d: Data, t: any) {
  const bits = [listName(d, t.list || 'inbox')];
  if (t.date) bits.push(t.date + (t.time ? ' ' + t.time : '') + (t.deadline ? ' (deadline)' : ''));
  if (t.priority && t.priority !== 'medium') bits.push(t.priority);
  if (t.status && t.status !== 'todo' && !t.done) bits.push('status: ' + statusName(d, t.status));
  if (t.tags && t.tags.length) bits.push(t.tags.map((id: string) => '#' + tagName(d, id)).join(' '));
  if (t.sphere) bits.push('life area: ' + ((byIdIn(d.spheres, t.sphere) || {}).name || t.sphere));
  if (t.location) bits.push('location: ' + ((byIdIn(d.locations, t.location) || {}).name || t.location));
  if (t.project) bits.push('project: ' + projName(d, t.project));
  else if (t.area) bits.push('type: ' + areaName(d, t.area));
  if (t.repeat) bits.push('repeats ' + t.repeat);
  if (t.delegatedTo) bits.push('delegated to ' + t.delegatedTo);
  if (t.done) bits.push('done ' + (t.completedAt || ''));
  const subs = (t.subtasks || []).length ? ` · subtasks ${(t.subtasks || []).filter((s: any) => s.done).length}/${t.subtasks.length}` : '';
  return `- [${t.id}] ${t.title} · ${bits.join(' · ')}${subs}`;
}
function block(title: string, d: Data, xs: any[], limit = 40) {
  if (!xs.length) return `${title}: none`;
  return `${title} (${xs.length}):\n` + xs.slice(0, limit).map((t) => taskLine(d, t)).join('\n') + (xs.length > limit ? `\n… and ${xs.length - limit} more` : '');
}
const byOrder = (a: any, b: any) => (a.order ?? 0) - (b.order ?? 0);
const byDate = (a: any, b: any) => (a.date || '9') < (b.date || '9') ? -1 : (a.date || '9') > (b.date || '9') ? 1 : (a.time || '99') < (b.time || '99') ? -1 : byOrder(a, b);

/* ---------- task views (same filters as app.js `sel`) ---------- */
function view(d: Data, name: string, c: Ctx, projectRef?: unknown, a: any = {}): any[] {
  const open = d.tasks.filter(isOpen), T = c.today;
  switch (name) {
    case 'inbox': return open.filter((t: any) => t.list === 'inbox').sort(byOrder);
    case 'today': return open.filter((t: any) => t.list === 'anytime' && t.date && t.date <= T).sort(byDate);
    case 'overdue': return open.filter((t: any) => t.list !== 'someday' && t.date && t.date < T).sort(byDate);
    case 'upcoming': return open.filter((t: any) => t.list === 'anytime' && t.date && t.date > T).sort(byDate);
    case 'anytime': return open.filter((t: any) => t.list === 'anytime' && !t.date && t.status !== 'paused').sort(byOrder);
    case 'someday': return open.filter((t: any) => t.list === 'someday').sort(byOrder);
    case 'waiting': case 'followup': return open.filter((t: any) => t.status === 'followup' || t.status === 'waiting').sort(byOrder);
    case 'archived': return d.tasks.filter((t: any) => !t.done && t.status === 'archived').sort(byOrder);
    case 'list': { const id = listRef(d, a.list); return open.filter((t: any) => t.list === id).sort(byOrder); }
    case 'tag': { const g = findRef(d.tags, a.tag, 'tag', 'name'); return open.filter((t: any) => hasTag(t, g.id)).sort(byOrder); }
    case 'status': { const id = statusRef(d, a.status); return d.tasks.filter((t: any) => !t.done && t.status === id).sort(byOrder); }
    case 'paused': return open.filter((t: any) => t.status === 'paused').sort(byOrder);
    case 'urgent': return open.filter((t: any) => t.priority === 'urgent').sort(byDate);
    case 'deadlines': return open.filter((t: any) => t.deadline && t.date).sort(byDate);
    case 'delegated': return open.filter((t: any) => t.delegatedTo).sort(byDate);
    case 'routines': return open.filter((t: any) => t.repeat).sort(byDate);
    case 'logbook': return d.tasks.filter((t: any) => t.done).sort((a: any, b: any) => String(b.completedAt || '') < String(a.completedAt || '') ? -1 : 1);
    case 'project': { const p = project(d, projectRef); return d.tasks.filter((t: any) => t.project === p.id).sort((a: any, b: any) => (a.done ? 1 : 0) - (b.done ? 1 : 0) || byOrder(a, b)); }
    case 'all_open': return open.sort(byDate);
  }
  return fail('Unknown view.');
}

/* ---------- task rules (same as app.js) ---------- */
function minOrder(d: Data) { let m = 0; for (const t of d.tasks.concat(d.headings || [])) if (typeof t.order === 'number' && t.order < m) m = t.order; return m; }
function completeTask(d: Data, t: any, c: Ctx) {
  t.done = true; t.status = 'done'; t.completedAt = c.today;
  if (t.repeat) {
    let nd = nextDate(t.date || c.today, t.repeat), guard = 0;
    while (nd < c.today && guard++ < 1000) nd = nextDate(nd, t.repeat);
    const copy = JSON.parse(JSON.stringify(t));
    copy.id = c.uid(); copy.done = false; copy.status = 'todo'; copy.completedAt = ''; copy.date = nd; copy.createdAt = c.now;
    copy.subtasks = (copy.subtasks || []).map((s: any) => ({ id: c.uid(), title: s.title, done: false }));
    if (copy.list === 'inbox') copy.list = 'anytime';
    t.repeat = '';
    d.tasks.push(copy);
    return copy;
  }
  return null;
}
function setStatus(d: Data, t: any, s: string, c: Ctx) {
  if (s === 'done') { if (!t.done) return completeTask(d, t, c); return null; }
  if (s === 'waiting') s = 'followup';
  if (t.done) { t.done = false; t.completedAt = ''; }
  t.status = s; return null;
}
/* Apply task fields shared by create and update. */
function applyTaskFields(d: Data, t: any, a: any, c: Ctx) {
  if (a.title != null) { t.title = str(a.title, 300).trim(); if (!t.title) fail('The title cannot be empty.'); }
  if (a.notes != null) t.notes = str(a.notes);
  if (a.date != null) { if (a.date !== '' && !isYmd(a.date)) fail('date must be YYYY-MM-DD (or empty to clear).'); t.date = a.date; if (!t.date) { t.deadline = false; } }
  if (a.time != null) { if (a.time !== '' && !isTime(a.time)) fail('time must be HH:MM (24h) or empty.'); t.time = a.time; }
  if (a.priority != null) { const p = d.priorities.find((x: any) => x.id === a.priority || low(x.name) === low(a.priority)); if (!p) fail(`Priority must be one of: ${ord(d.priorities).map((x: any) => x.name).join(', ')}.`); t.priority = p.id; }
  if (a.life_area != null) t.sphere = a.life_area === '' ? '' : findRef(d.spheres, a.life_area, 'life area', 'name').id;
  if (a.location != null) t.location = a.location === '' ? '' : findRef(d.locations, a.location, 'location', 'name').id;
  if (a.links != null) t.links = (Array.isArray(a.links) ? a.links : [a.links]).map((u: unknown) => String(u).trim()).filter(Boolean).map((u: string) => /^https?:\/\//i.test(u) ? u : 'https://' + u);
  if (a.ai_chat != null) t.aiChat = String(a.ai_chat).trim();
  if (a.list != null) t.list = listRef(d, a.list);
  if (a.repeat != null) t.repeat = oneOf(a.repeat, REPEATS, 'repeat');
  if (a.project != null) {
    if (a.project === '') t.project = '';
    else { const p = project(d, a.project); t.project = p.id; t.area = p.area; }
  }
  const typ = a.type ?? a.area;
  if (typ != null && !t.project) t.area = typ === '' ? '' : area(d, typ).id;
  if (a.delegated_to != null) {
    t.delegatedTo = str(a.delegated_to, 80).trim();
    if (!Array.isArray(t.tags)) t.tags = [];
    if (t.delegatedTo && !d.settings.assistants.includes(t.delegatedTo)) d.settings.assistants.push(t.delegatedTo);
  }
  if (!Array.isArray(t.tags)) t.tags = [];
  const made: string[] = [];
  if (a.tags != null) t.tags = tagRefs(d, a.tags, c, made);
  if (a.add_tags != null) for (const id of tagRefs(d, a.add_tags, c, made)) if (!t.tags.includes(id)) t.tags.push(id);
  if (a.remove_tags != null) { const rm = (Array.isArray(a.remove_tags) ? a.remove_tags : [a.remove_tags]).map((x: unknown) => findRef(d.tags, String(x).replace(/^#/, ''), 'tag', 'name').id); t.tags = t.tags.filter((x: string) => !rm.includes(x)); }
  if (made.length) c.notes = (c.notes || []).concat(`New tag${made.length > 1 ? 's' : ''} created: ${made.join(', ')}.`);
  if (a.deadline != null) t.deadline = !!a.deadline && !!t.date;
  // A dated task in Inbox would not show in Today/Upcoming in the app: move it to Anytime, as the app does.
  if (a.date && t.list === 'inbox' && a.list == null) t.list = 'anytime';
  if (a.priority === 'urgent' && t.list === 'inbox' && a.list == null) t.list = 'anytime';
  if (Array.isArray(a.add_subtasks)) t.subtasks = (t.subtasks || []).concat(a.add_subtasks.map((s: unknown) => ({ id: c.uid(), title: str(s, 300), done: false })));
  if (Array.isArray(a.check_subtasks)) for (const ref of a.check_subtasks) findRef(t.subtasks || [], ref, 'subtask').done = true;
  if (Array.isArray(a.uncheck_subtasks)) for (const ref of a.uncheck_subtasks) findRef(t.subtasks || [], ref, 'subtask').done = false;
}

/* ---------- search ---------- */
function search(d: Data, raw: string) {
  const q = low(raw); if (q.length < 2) fail('Search needs at least 2 characters.');
  const has = (...xs: unknown[]) => xs.some((x) => low(x).includes(q));
  const out: string[] = [];
  const add = (name: string, rows: string[]) => { if (rows.length) out.push(`${name} (${rows.length}):\n` + rows.slice(0, 20).join('\n') + (rows.length > 20 ? `\n… and ${rows.length - 20} more` : '')); };
  add('Tasks', d.tasks.filter((t: any) => has(t.title, t.notes, (t.subtasks || []).map((s: any) => s.title).join(' '))).sort((a: any, b: any) => (a.done ? 1 : 0) - (b.done ? 1 : 0)).map((t: any) => taskLine(d, t)));
  add('Projects', d.projects.filter((p: any) => has(p.name, p.notes)).map((p: any) => `- [${p.id}] ${p.name} · ${p.status || 'active'} · ${areaName(d, p.area)}`));
  add('Notes', d.notes.filter((n: any) => has(n.title, n.body)).map((n: any) => `- [${n.id}] ${n.title || 'Untitled'}`));
  add('Bookmarks', d.bookmarks.filter((b: any) => has(b.title, b.url, b.tag, b.note)).map((b: any) => `- [${b.id}] ${b.title} · ${b.url}`));
  add('Watch·Read·Listen', d.media.filter((m: any) => has(m.title, m.by, m.note)).map((m: any) => `- [${m.id}] ${m.title} · ${m.type} · ${m.status}`));
  add('Purchases', d.purchases.filter((p: any) => has(p.title, p.note)).map((p: any) => `- [${p.id}] ${p.title} · ${p.amount} ${p.currency} · ${p.status}`));
  add('Friends', d.friends.filter((f: any) => has(f.name, f.notes, f.contact)).map((f: any) => `- [${f.id}] ${f.name}${f.last ? ' · last contact ' + f.last : ''}`));
  add('Habits', d.habits.filter((h: any) => has(h.name)).map((h: any) => `- [${h.id}] ${h.name}`));
  add('Trips', d.trips.filter((t: any) => has(t.title, t.destination, t.notes)).map((t: any) => `- [${t.id}] ${t.title}${t.start ? ' · ' + t.start : ''}`));
  add('Journal', d.journal.filter((j: any) => has(j.text)).map((j: any) => `- ${j.date}: ${str(j.text, 120)}`));
  add('Money records', d.finance.filter((r: any) => has(r.category, r.note)).map((r: any) => `- [${r.id}] ${r.date} ${r.kind} ${r.amount} ${r.currency} · ${r.category}${r.note ? ' · ' + r.note : ''}`));
  return out.length ? out.join('\n\n') : `Nothing found for “${raw}”.`;
}

/* ---------- tool definitions (MCP) ---------- */
const S = (description: string, extra: Record<string, unknown> = {}) => ({ type: 'string', description, ...extra });
const taskProps = {
  title: S('Task title'),
  notes: S('Task notes (replaces existing notes)'),
  date: S('When to do it, YYYY-MM-DD; empty string clears it'),
  time: S('HH:MM, 24-hour; empty string clears it'),
  priority: S('Priority name: Urgent, High, Medium, Low or the user\'s own'),
  list: S('inbox (not sorted yet), anytime (active), someday (later/maybe), or the id/name of one of the user\'s own lists. Today and Most important are not lists: use date / priority'),
  project: S('Project id or name; empty string removes the project'),
  type: S('Type: Personal or Business (id or name; used when there is no project)'),
  life_area: S('Life area: Health, Security, Wealth, Family, Friends & Relatives, Household & Assets management, Travel, Leisure & Hobbies, Routines, Self improvement, Recognition, Self-realization, Betterment, or the user\'s own; empty string clears'),
  location: S('Location: Online, USA, Russia, Bali or the user\'s own; empty string clears'),
  links: { type: 'array', items: { type: 'string' }, description: 'Links for the task (replaces the list)' },
  ai_chat: S('Link to the AI chat where this task was researched'),
  repeat: S('Repeats after completion', { enum: REPEATS }),
  deadline: { type: 'boolean', description: 'The date is a hard deadline' },
  delegated_to: S('Who it is delegated to: AI assistant, Personal assistant, Business assistant or another name; empty string to take it back'),
  tags: { type: 'array', items: { type: 'string' }, description: 'Tag names (replaces the task\'s tags). Missing tags are created. Start with: Moscow, Bali, USA' },
};
const RO = { readOnlyHint: true };
const RW = { readOnlyHint: false, destructiveHint: false };

export const TOOLS = [
  { name: 'focus_overview', title: 'Focus: overview', annotations: RO, description: 'Start here. Today\'s date and weekday in the user\'s time zone, overdue tasks, today, inbox, next 7 days, waiting and delegated tasks, habits for today, active projects and areas with their ids.', inputSchema: { type: 'object', properties: {} } },
  { name: 'focus_list_tasks', title: 'Focus: list tasks', annotations: RO, description: 'List tasks in one view of the app.', inputSchema: { type: 'object', properties: { view: S('Which view', { enum: ['inbox', 'today', 'overdue', 'upcoming', 'anytime', 'someday', 'followup', 'paused', 'urgent', 'deadlines', 'delegated', 'routines', 'logbook', 'archived', 'project', 'list', 'tag', 'status', 'all_open'] }), project: S('Project id or name, for view=project'), list: S('One of the user\'s own lists, for view=list'), tag: S('Tag name, for view=tag'), status: S('Status name, for view=status'), limit: { type: 'integer', description: 'Max tasks (default 60)' } }, required: ['view'] } },
  { name: 'focus_search', title: 'Focus: search', annotations: RO, description: 'Search everything in Focus by text (tasks, projects, notes, bookmarks, watch/read/listen, purchases, friends, habits, trips, journal, money records). Returns ids for editing. The Safe is never searched.', inputSchema: { type: 'object', properties: { query: S('Text to look for') }, required: ['query'] } },
  { name: 'focus_get', title: 'Focus: get details', annotations: RO, description: 'Full details of one item: task (notes, subtasks), project (notes and its tasks), note (full text), or another item by id.', inputSchema: { type: 'object', properties: { type: S('Item type', { enum: ['task', 'project', 'note', 'bookmark', 'media', 'purchase', 'friend', 'habit', 'money', 'journal'] }), id: S('Item id (or title/name; for journal: date YYYY-MM-DD)') }, required: ['type', 'id'] } },
  { name: 'focus_create_task', title: 'Focus: create task', annotations: RW, description: 'Create a task. Without a date and list it goes to Inbox; with a date it shows in Today/Upcoming.', inputSchema: { type: 'object', properties: { ...taskProps, status: S('Status id or name: Not started (todo), In progress (doing), Paused, Archive, or the user\'s own statuses'), subtasks: { type: 'array', items: { type: 'string' }, description: 'Checklist items' } }, required: ['title'] } },
  { name: 'focus_update_task', title: 'Focus: update task', annotations: RW, description: 'Change an existing task. Pass only what changes. Use focus_complete_task to mark it done.', inputSchema: { type: 'object', properties: { id: S('Task id (or exact title)'), ...taskProps, status: S('Status id or name: Not started (todo), In progress (doing), Paused, Archive (hides it from lists), or the user\'s own statuses'), add_tags: { type: 'array', items: { type: 'string' }, description: 'Tag names to add (missing ones are created)' }, remove_tags: { type: 'array', items: { type: 'string' } }, append_notes: S('Text to add at the end of the notes'), add_subtasks: { type: 'array', items: { type: 'string' } }, check_subtasks: { type: 'array', items: { type: 'string' }, description: 'Subtask ids or titles to tick' }, uncheck_subtasks: { type: 'array', items: { type: 'string' } } }, required: ['id'] } },
  { name: 'focus_complete_task', title: 'Focus: complete task', annotations: RW, description: 'Mark a task done (a repeating task gets its next copy, as in the app). Set reopen=true to bring a done task back.', inputSchema: { type: 'object', properties: { id: S('Task id (or exact title)'), reopen: { type: 'boolean' } }, required: ['id'] } },
  { name: 'focus_create_note', title: 'Focus: create note', annotations: RW, description: 'Create a note.', inputSchema: { type: 'object', properties: { title: S('Title'), body: S('Text'), project: S('Project id or name (optional)'), pinned: { type: 'boolean' } }, required: ['title'] } },
  { name: 'focus_update_note', title: 'Focus: update note', annotations: RW, description: 'Change a note: new title, replace the text, or append text at the end.', inputSchema: { type: 'object', properties: { id: S('Note id (or title)'), title: S('New title'), body: S('New full text (replaces)'), append: S('Text to add at the end'), pinned: { type: 'boolean' } }, required: ['id'] } },
  { name: 'focus_save_project', title: 'Focus: create or update project', annotations: RW, description: 'Create a project (no id) or change one (with id): name, area, status, notes.', inputSchema: { type: 'object', properties: { id: S('Project id or name, to update; omit to create'), name: S('Project name'), area: S('Area id or name'), status: S('Status', { enum: PROJECT_STATUSES }), notes: S('Project notes (replaces)'), append_notes: S('Text to add to the notes') } } },
  { name: 'focus_organize', title: 'Focus: lists, tags, statuses', annotations: RW, description: 'Create or rename one of the user\'s lists, tags or statuses (no deleting: that is done in the app). Omit id to create.', inputSchema: { type: 'object', properties: { kind: S('What', { enum: ['list', 'tag', 'status', 'priority', 'life_area', 'location'] }), id: S('Existing id or name, to rename / recolour'), name: S('New name'), color: S('For tag, status or priority', { enum: COLORS }) }, required: ['kind', 'name'] } },
  { name: 'focus_add_money', title: 'Focus: income or expense', annotations: RW, description: 'Record income or an expense in Money → Income & Expenses.', inputSchema: { type: 'object', properties: { kind: S('Type', { enum: ['expense', 'income'] }), amount: { type: 'number', description: 'Positive amount' }, currency: S('Currency code, e.g. USD, EUR, RUB, IDR'), category: S('Expense: Housing, Family living, Utilities, Transport, Health, Education, Travel, Business, Other. Income: Salary, Business, Rental, Investments, Other'), date: S('YYYY-MM-DD, default today'), note: S('Note'), planned: { type: 'boolean', description: 'Planned rather than actual' } }, required: ['kind', 'amount'] } },
  { name: 'focus_habit', title: 'Focus: habits', annotations: RW, description: 'Mark a habit done (or not done) for a day, or create a new habit.', inputSchema: { type: 'object', properties: { habit: S('Habit id or name'), date: S('YYYY-MM-DD, default today'), done: { type: 'boolean', description: 'Default true' }, create: { type: 'boolean', description: 'Create a new habit with this name' } }, required: ['habit'] } },
  { name: 'focus_journal', title: 'Focus: journal', annotations: RW, description: 'Write in the diary for a day (mood 1–5: Awful, Bad, Okay, Good, Great).', inputSchema: { type: 'object', properties: { date: S('YYYY-MM-DD, default today'), text: S('Text'), mode: S('append (default) or replace', { enum: ['append', 'replace'] }), mood: { type: 'integer', minimum: 1, maximum: 5 } } } },
  { name: 'focus_add_item', title: 'Focus: add to a list', annotations: RW, description: 'Add a bookmark, a watch/read/listen item, a planned purchase, or a friend to keep in touch with.', inputSchema: { type: 'object', properties: { type: S('List', { enum: ['bookmark', 'media', 'purchase', 'friend'] }), title: S('Title / name'), url: S('Bookmark or media link'), tag: S('Bookmark tag'), note: S('Note'), media_type: S('For media', { enum: MEDIA_TYPES }), by: S('For media: author, director or artist'), amount: { type: 'number', description: 'For purchase: price' }, currency: S('For purchase'), priority: S('For purchase', { enum: PURCHASE_PRIORITIES }), status: S('For media or purchase (Wishlist, Researching, Planned, Saving, Bought / To do, In progress, Done)'), contact: S('For friend: phone, @handle or email'), cadence_days: { type: 'integer', description: 'For friend: keep in touch every N days (default 30)' } }, required: ['type', 'title'] } },
  { name: 'focus_update_item', title: 'Focus: update a list item', annotations: RW, description: 'Change a bookmark, media item, purchase or friend (for a friend, set contacted_today=true to log a contact).', inputSchema: { type: 'object', properties: { type: S('List', { enum: ['bookmark', 'media', 'purchase', 'friend'] }), id: S('Item id or title/name'), title: S('New title / name'), url: S('Link'), tag: S('Tag'), note: S('Note (replaces)'), status: S('New status'), amount: { type: 'number' }, saved: { type: 'number', description: 'For purchase: amount saved so far' }, currency: S('Currency'), contacted_today: { type: 'boolean' } }, required: ['type', 'id'] } },
];
export const WRITE_TOOLS = new Set(TOOLS.filter((t) => !t.annotations.readOnlyHint).map((t) => t.name));

/* ---------- tool runner ---------- */
export function runTool(name: string, a: any, data: Data, c: Ctx): Result {
  a = a || {};
  const d = normalize(data);
  c.notes = [];
  try { const r = exec(name, a, d, c); if (c.notes.length && r.changed) r.text += ' ' + c.notes.join(' '); return r; } catch (e) {
    if (e instanceof UserError) return { text: e.message, changed: false, isError: true };
    throw e;
  }
}

function exec(name: string, a: any, d: Data, c: Ctx): Result {
  const ok = (text: string) => ({ text, changed: true });
  const read = (text: string) => ({ text, changed: false });
  const T = c.today;
  switch (name) {
    case 'focus_overview': {
      const nextWeek = view(d, 'upcoming', c).filter((t: any) => t.date <= addDays(T, 7));
      const today = view(d, 'today', c).filter((t: any) => t.date === T);
      const habits = d.habits.length ? 'Habits today: ' + d.habits.map((h: any) => `${h.name} ${h.done && h.done[T] ? '✓' : '✗'} [${h.id}]`).join(', ') : 'Habits: none';
      const projects = d.projects.filter((p: any) => p.status !== 'completed');
      return read([
        `Today is ${dow(T)} ${T}.`,
        block('Overdue', d, view(d, 'overdue', c)),
        block('Today', d, today),
        block('Inbox', d, view(d, 'inbox', c), 25),
        block('Next 7 days', d, nextWeek, 30),
        block('Follow-up', d, view(d, 'waiting', c), 15),
        block('Delegated', d, view(d, 'delegated', c), 15),
        habits,
        'Projects: ' + (projects.length ? projects.map((p: any) => `${p.name} [${p.id}] (${areaName(d, p.area)}, ${p.status || 'active'}, ${d.tasks.filter((t: any) => t.project === p.id && !t.done).length} open)`).join('; ') : 'none'),
        'Types: ' + d.areas.map((x: any) => `${x.name} [${x.id}]`).join(', '),
        'Life areas: ' + ord(d.spheres).map((x: any) => x.name).join(', ') + '. Locations: ' + ord(d.locations).map((x: any) => x.name).join(', ') + '. Priorities: ' + ord(d.priorities).map((x: any) => x.name).join(', ') + '. Delegated to: ' + d.settings.assistants.join(', ') + '.',
        'Lists: ' + ord(d.lists).map((l: any) => l.id === 'today' || l.id === 'urgent' ? `${l.name} (smart: by ${l.id === 'today' ? 'date' : 'priority'})` : `${l.name} [${l.id}] (${d.tasks.filter((t: any) => isOpen(t) && t.list === l.id).length} open)`).join('; '),
        'Statuses: ' + ord(d.statuses).map((x: any) => `${x.name} [${x.id}]`).join(', ') + '. Tags: ' + (d.tags.length ? ord(d.tags).map((x: any) => `#${x.name} (${d.tasks.filter((t: any) => isOpen(t) && hasTag(t, x.id)).length})`).join(', ') : 'none') + '.',
        `Open tasks in total: ${d.tasks.filter(isOpen).length}. Notes: ${d.notes.length}.`,
      ].join('\n\n'));
    }
    case 'focus_list_tasks': {
      const v = oneOf(a.view, ['inbox', 'today', 'overdue', 'upcoming', 'anytime', 'someday', 'followup', 'waiting', 'paused', 'urgent', 'deadlines', 'delegated', 'routines', 'logbook', 'archived', 'project', 'list', 'tag', 'status', 'all_open'], 'view');
      const lim = Math.max(1, Math.min(200, Number(a.limit) || 60));
      const title = v === 'project' ? 'Project “' + project(d, a.project).name + '”' : v === 'list' ? 'List “' + listName(d, listRef(d, a.list)) + '”' : v === 'tag' ? 'Tag “' + a.tag + '”' : v === 'status' ? 'Status “' + a.status + '”' : (byIdIn(d.lists, v) || {}).name || v;
      return read(block(title, d, view(d, v, c, a.project, a), lim));
    }
    case 'focus_search': return read(search(d, str(a.query, 200)));
    case 'focus_get': {
      const type = oneOf(a.type, ['task', 'project', 'note', 'bookmark', 'media', 'purchase', 'friend', 'habit', 'money', 'journal'], 'type');
      if (type === 'task') {
        const t = task(d, a.id);
        return read([taskLine(d, t), t.notes ? 'Notes:\n' + t.notes : 'No notes.', (t.subtasks || []).length ? 'Subtasks:\n' + t.subtasks.map((s: any) => `${s.done ? '[x]' : '[ ]'} ${s.title} [${s.id}]`).join('\n') : ''].filter(Boolean).join('\n\n'));
      }
      if (type === 'project') {
        const p = project(d, a.id);
        const ts = d.tasks.filter((t: any) => t.project === p.id);
        return read(`${p.name} [${p.id}] · ${areaName(d, p.area)} · ${p.status || 'active'}\n\n${p.notes ? 'Notes:\n' + p.notes + '\n\n' : ''}${block('Open tasks', d, ts.filter((t: any) => !t.done).sort(byOrder), 100)}\n\nDone: ${ts.filter((t: any) => t.done).length}\nNotes linked: ${d.notes.filter((n: any) => n.project === p.id).map((n: any) => `${n.title} [${n.id}]`).join('; ') || 'none'}`);
      }
      if (type === 'note') { const n = findRef(d.notes, a.id, 'note'); return read(`${n.title || 'Untitled'} [${n.id}]${n.project ? ' · project ' + projName(d, n.project) : ''}\n\n${str(n.body, 20000)}`); }
      if (type === 'journal') { const j = d.journal.find((x: any) => x.date === a.id); return read(j ? `${j.date}${j.mood ? ' · mood ' + MOODS[j.mood] : ''}\n${j.text || ''}` : `No journal entry for ${a.id}.`); }
      const arr = { bookmark: d.bookmarks, media: d.media, purchase: d.purchases, friend: d.friends, habit: d.habits, money: d.finance }[type] as any[];
      const x = findRef(arr, a.id, type, type === 'friend' || type === 'habit' ? 'name' : type === 'money' ? 'note' : 'title');
      return read(JSON.stringify(x, null, 1));
    }
    case 'focus_create_task': {
      const t: any = { id: c.uid(), title: '', notes: '', list: 'inbox', date: '', time: '', priority: 'medium', status: 'todo', area: '', project: '', repeat: '', subtasks: [], done: false, completedAt: '', order: minOrder(d) - 1, createdAt: c.now, photos: [], delegatedTo: '', deadline: false };
      if (!str(a.title).trim()) fail('Give the task a title.');
      applyTaskFields(d, t, { ...a, add_subtasks: a.subtasks }, c);
      if (a.status) setStatus(d, t, statusRef(d, a.status), c);
      d.tasks.push(t);
      return ok(`Created: ${taskLine(d, t).slice(2)}`);
    }
    case 'focus_update_task': {
      const t = task(d, a.id);
      applyTaskFields(d, t, a, c);
      if (a.append_notes) t.notes = (t.notes ? t.notes + '\n\n' : '') + str(a.append_notes);
      if (a.status) setStatus(d, t, statusRef(d, a.status, true), c);
      return ok(`Updated: ${taskLine(d, t).slice(2)}`);
    }
    case 'focus_complete_task': {
      const t = a.reopen ? findRef(d.tasks, a.id, 'task', 'title', (x) => x.done) : task(d, a.id);
      if (a.reopen) { if (!t.done) return read(`“${t.title}” is not done.`); t.done = false; t.completedAt = ''; if (t.status === 'done') t.status = 'todo'; return ok(`Reopened “${t.title}”.`); }
      if (t.done) return read(`“${t.title}” is already done.`);
      const next = completeTask(d, t, c);
      return ok(`Completed “${t.title}”.` + (next ? ` Next one on ${next.date} [${next.id}].` : ''));
    }
    case 'focus_create_note': {
      const p = a.project ? project(d, a.project) : null;
      const title = str(a.title, 120).trim(); if (!title) fail('Give the note a title.');
      const n = { id: c.uid(), title, body: str(a.body), area: p ? p.area : '', project: p ? p.id : '', pinned: !!a.pinned, createdAt: c.now, updatedAt: c.now, photos: [], links: [] };
      d.notes.push(n);
      return ok(`Created note “${n.title}” [${n.id}].`);
    }
    case 'focus_update_note': {
      const n = findRef(d.notes, a.id, 'note');
      if (a.title != null) n.title = str(a.title, 120);
      if (a.body != null) n.body = str(a.body);
      if (a.append) n.body = (n.body ? n.body + '\n\n' : '') + str(a.append);
      if (a.pinned != null) n.pinned = !!a.pinned;
      n.updatedAt = c.now;
      return ok(`Updated note “${n.title}”.`);
    }
    case 'focus_save_project': {
      const isNew = !a.id;
      const p = isNew ? { id: c.uid(), name: '', area: d.areas[0].id, status: 'active', order: d.projects.length + 1 } as any : project(d, a.id);
      if (a.name != null) p.name = str(a.name, 200).trim();
      if (!p.name) fail('Give the project a name.');
      if (a.area) p.area = area(d, a.area).id;
      if (a.status) p.status = oneOf(a.status, PROJECT_STATUSES, 'status');
      if (a.notes != null) p.notes = str(a.notes);
      if (a.append_notes) p.notes = (p.notes ? p.notes + '\n\n' : '') + str(a.append_notes);
      if (isNew) d.projects.push(p);
      for (const t of d.tasks) if (t.project === p.id) t.area = p.area;
      return ok(`${isNew ? 'Created' : 'Updated'} project “${p.name}” [${p.id}] in ${areaName(d, p.area)} (${p.status}).`);
    }
    case 'focus_organize': {
      const kind = oneOf(a.kind, ['list', 'tag', 'status', 'priority', 'life_area', 'location'], 'kind');
      const arr = ({ list: d.lists, tag: d.tags, status: d.statuses, priority: d.priorities, life_area: d.spheres, location: d.locations } as any)[kind];
      const name = str(a.name, 60).replace(kind === 'tag' ? /^#/ : /^$/, '').trim(); if (!name) fail('Give it a name.');
      let x: any = a.id ? findRef(arr, a.id, kind, 'name') : null;
      if (!x) {
        if (arr.some((y: any) => low(y.name) === low(name))) fail(`A ${kind} “${name}” already exists.`);
        x = { id: (({ list: 'l_', tag: 'tg_', status: 'st_', priority: 'pr_', life_area: 'sp_', location: 'lo_' } as any)[kind]) + c.uid(), name, builtin: false, order: Math.max(0, ...arr.map((y: any) => y.order || 0)) + 1 };
        if (kind === 'tag' || kind === 'status' || kind === 'priority') x.color = 'gray';
        arr.push(x);
      } else { x.name = name; if (x.short) delete x.short; }
      if (a.color && (kind === 'tag' || kind === 'status' || kind === 'priority')) x.color = oneOf(a.color, COLORS, 'color');
      return ok(`${a.id ? 'Renamed' : 'Created'} ${kind} “${x.name}” [${x.id}].`);
    }
    case 'focus_add_money': {
      const kind = oneOf(a.kind, ['expense', 'income'], 'kind');
      const amount = Math.round(Number(a.amount) * 100) / 100; if (!(amount > 0)) fail('amount must be greater than 0.');
      const date = a.date || T; if (!isYmd(date)) fail('date must be YYYY-MM-DD.');
      const r = { id: c.uid(), kind, type: a.planned ? 'planned' : 'actual', date, amount, currency: str(a.currency || d.settings?.currency || 'USD', 5).toUpperCase(), category: str(a.category || 'Other', 60), note: str(a.note, 500) };
      d.finance.push(r);
      return ok(`Recorded ${r.type} ${kind}: ${r.amount} ${r.currency} · ${r.category} · ${r.date}${r.note ? ' · ' + r.note : ''}.`);
    }
    case 'focus_habit': {
      if (a.create) {
        const nm = str(a.habit, 120).trim(); if (!nm) fail('Give the habit a name.');
        if (d.habits.some((h: any) => low(h.name) === low(nm))) fail(`A habit “${nm}” already exists.`);
        const h = { id: 'hb_' + c.uid(), name: nm, createdAt: c.now, done: {} };
        d.habits.push(h); return ok(`Created habit “${nm}”.`);
      }
      const h = findRef(d.habits, a.habit, 'habit', 'name');
      const date = a.date || T; if (!isYmd(date)) fail('date must be YYYY-MM-DD.');
      h.done = h.done || {};
      if (a.done === false) delete h.done[date]; else h.done[date] = true;
      return ok(`Habit “${h.name}” ${a.done === false ? 'unmarked' : 'marked done'} for ${date}.`);
    }
    case 'focus_journal': {
      const date = a.date || T; if (!isYmd(date)) fail('date must be YYYY-MM-DD.');
      let j = d.journal.find((x: any) => x.date === date);
      if (!j) { j = { id: 'j' + date, date, mood: 0, text: '' }; d.journal.push(j); }
      if (a.text != null) j.text = a.mode === 'replace' || !j.text ? str(a.text) : j.text + '\n\n' + str(a.text);
      if (a.mood != null) { const m = Number(a.mood); if (!(m >= 1 && m <= 5)) fail('mood must be 1–5.'); j.mood = Math.round(m); }
      return ok(`Journal for ${date} saved${j.mood ? ' (mood ' + MOODS[j.mood] + ')' : ''}.`);
    }
    case 'focus_add_item': {
      const type = oneOf(a.type, ['bookmark', 'media', 'purchase', 'friend'], 'type');
      const title = str(a.title, 300).trim(); if (!title) fail('Give it a title.');
      if (type === 'bookmark') {
        const url = str(a.url, 2000).trim(); if (!/^https?:\/\//i.test(url)) fail('A bookmark needs a url starting with http:// or https://.');
        const b = { id: c.uid(), url, title, tag: str(a.tag, 60), note: str(a.note, 2000), createdAt: c.now };
        d.bookmarks.push(b); return ok(`Bookmark saved: ${title}.`);
      }
      if (type === 'media') {
        const m = { id: c.uid(), title, type: a.media_type ? oneOf(a.media_type, MEDIA_TYPES, 'media_type') : 'Movie', link: str(a.url, 2000), by: str(a.by, 200), status: a.status ? oneOf(a.status, MEDIA_STATUS, 'status') : 'To do', note: str(a.note, 2000), createdAt: c.now };
        d.media.push(m); return ok(`Added to Watch·Read·Listen: ${title} (${m.type}).`);
      }
      if (type === 'purchase') {
        const p = { id: 'pu_' + c.uid(), title, amount: Math.round((Number(a.amount) || 0) * 100) / 100, currency: str(a.currency || 'USD', 5).toUpperCase(), saved: 0, priority: a.priority ? oneOf(a.priority, PURCHASE_PRIORITIES, 'priority') : 'medium', status: a.status ? oneOf(a.status, PURCHASE_STATUSES, 'status') : 'Planned', date: '', note: str(a.note, 2000), createdAt: c.now };
        d.purchases.push(p); return ok(`Added purchase: ${title}${p.amount ? ' · ' + p.amount + ' ' + p.currency : ''} (${p.status}).`);
      }
      const f = { id: 'fr_' + c.uid(), name: title, contact: str(a.contact, 200), cadence: Math.max(1, Number(a.cadence_days) || 30), last: '', birthday: '', notes: str(a.note, 2000), createdAt: c.now };
      d.friends.push(f); return ok(`Added friend: ${title} (every ${f.cadence} days).`);
    }
    case 'focus_update_item': {
      const type = oneOf(a.type, ['bookmark', 'media', 'purchase', 'friend'], 'type');
      const arr = { bookmark: d.bookmarks, media: d.media, purchase: d.purchases, friend: d.friends }[type] as any[];
      const nameKey = type === 'friend' ? 'name' : 'title';
      const x = findRef(arr, a.id, type, nameKey);
      if (a.title != null) x[nameKey] = str(a.title, 300);
      if (a.url != null) x[type === 'media' ? 'link' : 'url'] = str(a.url, 2000);
      if (a.tag != null && type === 'bookmark') x.tag = str(a.tag, 60);
      if (a.note != null) x[type === 'friend' ? 'notes' : 'note'] = str(a.note, 2000);
      if (a.status != null) { if (type === 'media') x.status = oneOf(a.status, MEDIA_STATUS, 'status'); else if (type === 'purchase') x.status = oneOf(a.status, PURCHASE_STATUSES, 'status'); }
      if (type === 'purchase') { if (a.amount != null) x.amount = Math.round(Number(a.amount) * 100) / 100; if (a.saved != null) x.saved = Math.max(0, Number(a.saved) || 0); if (a.currency) x.currency = str(a.currency, 5).toUpperCase(); }
      if (type === 'friend' && a.contacted_today) x.last = T;
      return ok(`Updated ${type} “${x[nameKey]}”.`);
    }
  }
  return fail(`Unknown tool ${name}.`);
}
