/* Focus PWA — vanilla JS, no dependencies. */
(function () {
  'use strict';

  var APP_VERSION = '1.0.0';
  var STORE_KEY = 'focus.data.v1';
  var VAULT_KEY = 'focus.vault.v1';

  /* ================= utilities ================= */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function parseYmd(s) { var p = String(s).split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function today() { return ymd(new Date()); }
  function addDays(s, n) { var d = parseYmd(s); d.setDate(d.getDate() + n); return ymd(d); }
  function addMonths(s, n) {
    var d = parseYmd(s); var day = d.getDate();
    d.setDate(1); d.setMonth(d.getMonth() + n);
    var last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(day, last)); return ymd(d);
  }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  function fmtDate(s, opts) {
    if (!s) return '';
    var t = today();
    if (!(opts && opts.full)) {
      if (s === t) return 'Today';
      if (s === addDays(t, 1)) return 'Tomorrow';
      if (s === addDays(t, -1)) return 'Yesterday';
    }
    var d = parseYmd(s);
    var str = MONTHS[d.getMonth()].slice(0, 3) + ' ' + d.getDate();
    if (d.getFullYear() !== new Date().getFullYear()) str += ', ' + d.getFullYear();
    if (opts && opts.dow) str = DOW[d.getDay()].slice(0, 3) + ', ' + str;
    return str;
  }
  function fmtMoney(n, cur) {
    var v = Number(n) || 0;
    var digits = (cur === 'IDR' || cur === 'RUB') ? 0 : (Math.round(v) === v ? 0 : 2);
    var s;
    try { s = v.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits }); }
    catch (e) { s = String(v); }
    var sym = { USD: '$', EUR: '€', RUB: '₽', IDR: 'Rp ' }[cur];
    if (cur === 'RUB') return s + ' ₽';
    return (v < 0 ? '−' : '') + (sym || (cur + ' ')) + s.replace('-', '');
  }
  function startOfWeek(s) { var d = parseYmd(s); var wd = (d.getDay() + 6) % 7; d.setDate(d.getDate() - wd); return ymd(d); }
  function debounce(fn, ms) { var t; return function () { var a = arguments, c = this; clearTimeout(t); t = setTimeout(function () { fn.apply(c, a); }, ms); }; }

  var ICON = {
    grip: '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><circle cx="5.5" cy="3.5" r="1.4"/><circle cx="10.5" cy="3.5" r="1.4"/><circle cx="5.5" cy="8" r="1.4"/><circle cx="10.5" cy="8" r="1.4"/><circle cx="5.5" cy="12.5" r="1.4"/><circle cx="10.5" cy="12.5" r="1.4"/></svg>',
    tick: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    task: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="4"/><path d="M8.5 12.2l2.4 2.4 4.6-5"/></svg>',
    note: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3.5h8.5L19 8v12a.5.5 0 0 1-.5.5h-12A.5.5 0 0 1 6 20z"/><path d="M14 3.5V8h5M9 12.5h6M9 16h4"/></svg>',
    lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/></svg>',
    income: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6"/></svg>',
    expense: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14M6 13l6 6 6-6"/></svg>',
    person: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20c1.3-3.6 4.2-5.3 7.5-5.3s6.2 1.7 7.5 5.3"/></svg>',
    briefcase: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="7.5" width="17" height="12" rx="2.5"/><path d="M9 7.5V6a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 6v1.5M3.5 12.5h17"/></svg>',
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round" aria-hidden="true"><path d="M4 11l8-6.5L20 11v8.5a1 1 0 0 1-1 1h-4.5V15h-5v5.5H5a1 1 0 0 1-1-1z"/></svg>',
    inbox: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round" aria-hidden="true"><path d="M4 13.5l2.5-8h11l2.5 8v5a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5z"/><path d="M4 13.5h4.5l1 2.5h5l1-2.5H20"/></svg>',
    today: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"/></svg>',
    upcoming: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4M8 14h3"/></svg>',
    anytime: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round" aria-hidden="true"><path d="M5 5h14v4H5zM5 11h14v4H5zM5 17h9"/></svg>',
    someday: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="6" width="17" height="4" rx="1"/><path d="M5 10v8.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V10M10 13.5h4"/></svg>',
    logbook: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 4h12v16.5l-6-3.5-6 3.5z"/><path d="M9.5 10l2 2 3.5-4"/></svg>',
    calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>',
    kanban: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="4.5" width="5" height="15" rx="1.5"/><rect x="9.5" y="4.5" width="5" height="10" rx="1.5"/><rect x="15.5" y="4.5" width="5" height="12.5" rx="1.5"/></svg>',
    areas: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/></svg>',
    projects: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2.5h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/></svg>',
    finance: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 19.5h16M6.5 16V11M11 16V7M15.5 16v-6M20 16V5"/></svg>',
    purchases: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5h2l2.2 10.2a1 1 0 0 0 1 .8h8.6a1 1 0 0 0 1-.8L20.5 8H7"/><circle cx="10" cy="19.5" r="1.3"/><circle cx="17" cy="19.5" r="1.3"/></svg>'
  };

  /* ================= constants ================= */
  var PRIORITIES = [['urgent', 'Urgent'], ['high', 'High'], ['medium', 'Medium'], ['low', 'Low']];
  var PRIORITY_RANK = { urgent: 0, high: 1, medium: 2, low: 3 };
  var STATUSES = [['todo', 'To Do'], ['doing', 'In Progress'], ['waiting', 'Waiting'], ['done', 'Done']];
  var LISTS = [['inbox', 'Inbox'], ['anytime', 'Anytime'], ['someday', 'Someday']];
  function areasList() { return db.areas.map(function (a) { return [a.id, a.name]; }); }
  var REPEATS = [['', 'Does not repeat'], ['daily', 'Every day'], ['weekly', 'Every week'], ['monthly', 'Every month'], ['yearly', 'Every year']];
  var CURRENCIES = ['USD', 'EUR', 'RUB', 'IDR'];
  var INCOME_CATS = ['Salary', 'Business', 'Rental', 'Investments', 'Other'];
  var EXPENSE_CATS = ['Housing', 'Family living', 'Utilities', 'Transport', 'Health', 'Education', 'Travel', 'Business', 'Other'];
  var PURCHASE_STATUSES = ['Wishlist', 'Researching', 'Planned', 'Saving', 'Bought'];
  var SAFE_TYPES = ['Login', 'Link', 'Contact', 'Card', 'Document', 'Note'];

  function label(pairs, key) { for (var i = 0; i < pairs.length; i++) if (pairs[i][0] === key) return pairs[i][1]; return ''; }
  function options(pairs, selected) {
    return pairs.map(function (p) {
      var v = Array.isArray(p) ? p[0] : p, l = Array.isArray(p) ? p[1] : p;
      return '<option value="' + esc(v) + '"' + (String(v) === String(selected) ? ' selected' : '') + '>' + esc(l) + '</option>';
    }).join('');
  }

  /* ================= routes ================= */
  var ROUTES = {
    home: { title: 'Home', icon: 'home' },
    inbox: { title: 'Inbox', icon: 'inbox' },
    today: { title: 'Today', icon: 'today' },
    upcoming: { title: 'Upcoming', icon: 'upcoming' },
    anytime: { title: 'Anytime', icon: 'anytime' },
    someday: { title: 'Someday', icon: 'someday' },
    logbook: { title: 'Logbook', icon: 'logbook' },
    calendar: { title: 'Calendar', icon: 'calendar' },
    kanban: { title: 'Kanban', icon: 'kanban' },
    areas: { title: 'Areas', icon: 'areas' },
    projects: { title: 'Projects', icon: 'projects' },
    notes: { title: 'Notes', icon: 'note' },
    safe: { title: 'Safe Storage', icon: 'lock' },
    finance: { title: 'Income & Expenses', icon: 'finance' },
    purchases: { title: 'Major Purchases', icon: 'purchases' },
    area: { title: 'Area', sub: true },
    project: { title: 'Project', sub: true },
    note: { title: 'Note', sub: true }
  };
  var DRAWER_GROUPS = [
    ['Plan', ['home', 'inbox', 'today', 'upcoming', 'anytime', 'someday', 'logbook']],
    ['Views', ['calendar', 'kanban']],
    ['Organize', ['areas', 'projects', 'notes']],
    ['Private', ['safe']],
    ['Money', ['finance', 'purchases']]
  ];

  /* ================= data ================= */
  function seedData() {
    var t = today();
    var p1 = 'p_web', p2 = 'p_launch', p3 = 'p_home', p4 = 'p_trip';
    var tasks = [
      { title: 'Review quarterly growth plan', list: 'anytime', date: t, time: '10:00', priority: 'urgent', status: 'doing', project: p1 },
      { title: 'Approve renovation budget', list: 'anytime', date: t, time: '', priority: 'high', status: 'todo', project: p3 },
      { title: 'Call the contractor about roof quote', list: 'anytime', date: addDays(t, -1), time: '', priority: 'high', status: 'waiting', project: p3 },
      { title: 'Draft launch announcement', list: 'anytime', date: addDays(t, 2), time: '14:00', priority: 'medium', status: 'todo', project: p2 },
      { title: 'Renew insurance documents', list: 'inbox', date: '', time: '', priority: 'medium', status: 'todo', area: 'personal' },
      { title: 'Pick a CRM for the sales team', list: 'inbox', date: '', time: '', priority: 'low', status: 'todo', area: 'business' },
      { title: 'Research new supplier options', list: 'anytime', date: '', time: '', priority: 'medium', status: 'todo', project: p2 },
      { title: 'Plan weekend hike route', list: 'anytime', date: addDays(t, 5), time: '', priority: 'low', status: 'todo', project: p4 },
      { title: 'Learn to sail', list: 'someday', date: '', time: '', priority: 'low', status: 'todo', area: 'personal' },
      { title: 'Book dentist appointment', list: 'anytime', date: addDays(t, 8), time: '09:30', priority: 'medium', status: 'todo', area: 'personal', repeat: '' },
      { title: 'Weekly review', list: 'anytime', date: addDays(t, 3), time: '17:00', priority: 'high', status: 'todo', area: 'business', repeat: 'weekly' },
      { title: 'Send measurements to designer', list: 'anytime', date: addDays(t, -2), time: '', priority: 'medium', status: 'done', done: true, completedAt: addDays(t, -1), project: p3 }
    ].map(function (x, i) {
      return {
        id: 't' + (i + 1), title: x.title, notes: '', list: x.list, date: x.date, time: x.time,
        priority: x.priority, status: x.status, done: !!x.done, completedAt: x.completedAt || '',
        area: x.area || '', project: x.project || '', repeat: x.repeat || '', subtasks: [], order: i + 1, createdAt: Date.now()
      };
    });
    tasks[1].subtasks = [{ id: 's1', title: 'Compare three quotes', done: true }, { id: 's2', title: 'Check contingency reserve', done: false }];
    var month = t.slice(0, 7);
    function fin(kind, type, day, amount, category, note) {
      return { id: uid(), kind: kind, type: type, date: month + '-' + pad(day), amount: amount, currency: 'USD', category: category, note: note || '' };
    }
    return {
      v: 1,
      tasks: tasks,
      projects: [
        { id: p1, name: 'Website relaunch', area: 'business', status: 'active', order: 1 },
        { id: p2, name: 'Product launch', area: 'business', status: 'active', order: 2 },
        { id: p3, name: 'Home renovation', area: 'personal', status: 'active', order: 3 },
        { id: p4, name: 'Family trip', area: 'personal', status: 'active', order: 4 }
      ],
      notes: [
        { id: 'n1', title: 'Growth priorities', body: 'Increase qualified leads.\nImprove conversion on the pricing page.\nShip the new onboarding emails.', area: 'business', project: p1, pinned: true, updatedAt: Date.now() - 5000 },
        { id: 'n2', title: 'Renovation checklist', body: 'Roof\nElectrical\nPlumbing\nFlooring\nLandscaping', area: 'personal', project: p3, pinned: false, updatedAt: Date.now() - 9000 },
        { id: 'n3', title: 'Trip ideas', body: 'Mountain cabin, lake kayaking, national park.', area: 'personal', project: p4, pinned: false, updatedAt: Date.now() - 20000 }
      ],
      finance: [
        fin('income', 'planned', 1, 9000, 'Salary'),
        fin('income', 'actual', 1, 9000, 'Salary'),
        fin('income', 'planned', 5, 2500, 'Rental'),
        fin('income', 'actual', 6, 2300, 'Rental'),
        fin('expense', 'planned', 1, 3200, 'Housing'),
        fin('expense', 'actual', 1, 3200, 'Housing'),
        fin('expense', 'planned', 1, 2500, 'Family living'),
        fin('expense', 'actual', 3, 1840, 'Family living', 'Groceries and school'),
        fin('expense', 'planned', 1, 600, 'Transport'),
        fin('expense', 'actual', 4, 720, 'Transport', 'Car service')
      ],
      purchases: [
        { id: 'b1', title: 'Kitchen remodel', amount: 18000, saved: 7000, currency: 'USD', priority: 'high', status: 'Saving', date: addMonths(t, 6), note: '' },
        { id: 'b2', title: 'New laptop', amount: 2400, saved: 2400, currency: 'USD', priority: 'medium', status: 'Planned', date: addMonths(t, 1), note: '' },
        { id: 'b3', title: 'Sailing course', amount: 1500, saved: 0, currency: 'EUR', priority: 'low', status: 'Wishlist', date: '', note: '' }
      ]
    };
  }

  var db;
  function load() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && parsed.v === 1 && Array.isArray(parsed.tasks)) return normalize(parsed);
      }
    } catch (e) { /* fall through */ }
    return seedData();
  }
  function normalize(d) {
    ['tasks', 'projects', 'notes', 'finance', 'purchases'].forEach(function (k) { if (!Array.isArray(d[k])) d[k] = []; });
    d.tasks.forEach(function (t, i) {
      if (!t.subtasks) t.subtasks = [];
      if (typeof t.order !== 'number') t.order = i + 1;
      if (!t.list) t.list = 'inbox';
      if (!t.status) t.status = t.done ? 'done' : 'todo';
      if (!t.priority) t.priority = 'medium';
    });
    return d;
  }
  var storageOk = true;
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(db)); storageOk = true; }
    catch (e) {
      if (storageOk) toast('Could not save on this device. Private browsing may block storage.');
      storageOk = false;
    }
  }

  /* ================= selectors ================= */
  function byId(arr, id) { for (var i = 0; i < arr.length; i++) if (arr[i].id === id) return arr[i]; return null; }
  function task(id) { return byId(db.tasks, id); }
  function project(id) { return byId(db.projects, id); }
  function taskArea(t) { var p = t.project && project(t.project); return p ? p.area : (t.area || ''); }
  function isOpen(t) { return !t.done; }
  function byOrder(a, b) { return a.order - b.order; }
  var sel = {
    inbox: function () { return db.tasks.filter(function (t) { return isOpen(t) && t.list === 'inbox'; }).sort(byOrder); },
    today: function () { var d = today(); return db.tasks.filter(function (t) { return isOpen(t) && t.list === 'anytime' && t.date && t.date <= d; }).sort(byOrder); },
    upcoming: function () { var d = today(); return db.tasks.filter(function (t) { return isOpen(t) && t.list === 'anytime' && t.date && t.date > d; }).sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : a.order - b.order; }); },
    anytime: function () { return db.tasks.filter(function (t) { return isOpen(t) && t.list === 'anytime' && !t.date; }).sort(byOrder); },
    someday: function () { return db.tasks.filter(function (t) { return isOpen(t) && t.list === 'someday'; }).sort(byOrder); },
    logbook: function () { return db.tasks.filter(function (t) { return t.done; }).sort(function (a, b) { return (b.completedAt || '') < (a.completedAt || '') ? -1 : 1; }); },
    overdue: function () { var d = today(); return db.tasks.filter(function (t) { return isOpen(t) && t.list !== 'someday' && t.date && t.date < d; }); },
    waiting: function () { return db.tasks.filter(function (t) { return isOpen(t) && t.status === 'waiting'; }).sort(byOrder); },
    onDate: function (d) { return db.tasks.filter(function (t) { return t.date === d; }).sort(function (a, b) { return (a.time || '99') < (b.time || '99') ? -1 : (a.time || '99') > (b.time || '99') ? 1 : a.order - b.order; }); }
  };
  function minOrder() { var m = 0; db.tasks.concat(db.headings || []).forEach(function (t) { if (t.order < m) m = t.order; }); return m; }

  /* ================= UI state & navigation ================= */
  var ui = {
    route: { name: 'home', id: '' },
    stack: [],
    calView: 'month',
    calDate: today(),
    projFilter: 'all',
    kanbanBy: 'status',
    finPeriod: 'month',
    finMonth: today().slice(0, 7),
    noteQuery: '',
    logQuery: '',
    safeQuery: '',
    revealed: {}
  };

  function routeHash(r) { return '#/' + r.name + (r.id ? '/' + encodeURIComponent(r.id) : ''); }
  function parseHash() {
    var h = (location.hash || '').replace(/^#\/?/, '');
    var parts = h.split('/');
    var name = parts[0] || 'home';
    if (!ROUTES[name]) name = 'home';
    var id = parts[1] ? decodeURIComponent(parts[1]) : '';
    if (ROUTES[name].sub && !id) name = name === 'note' ? 'notes' : name === 'area' ? 'areas' : 'projects';
    return { name: name, id: id };
  }
  function sameRoute(a, b) { return a.name === b.name && (a.id || '') === (b.id || ''); }

  function go(name, id) {
    var next = { name: name, id: id || '' };
    closeMenu();
    if (sheetOpen()) closeSheet(true);
    if (sameRoute(next, ui.route)) { render(); return; }
    leaveRoute();
    ui.stack.push(ui.route);
    ui.route = next;
    try { history.pushState({ depth: ui.stack.length }, '', routeHash(next)); } catch (e) { /* file:// etc */ }
    render(true);
  }
  function back() {
    if (sheetOpen()) { closeSheet(); return; }
    if (ui.stack.length) {
      var usedHistory = false;
      try { if (history.state && history.state.depth === ui.stack.length) { history.back(); usedHistory = true; } } catch (e) { /* ignore */ }
      if (!usedHistory) { leaveRoute(); ui.route = ui.stack.pop(); render(true); }
      return;
    }
    if (ui.route.name !== 'home') {
      leaveRoute();
      var parent = ROUTES[ui.route.name].sub ? { name: ui.route.name === 'note' ? 'notes' : ui.route.name === 'area' ? 'areas' : 'projects', id: '' } : { name: 'home', id: '' };
      ui.route = parent;
      try { history.replaceState({ depth: 0 }, '', routeHash(parent)); } catch (e) { /* ignore */ }
      render(true);
    }
  }
  window.addEventListener('popstate', function (e) {
    var hasDepth = !!(e.state && typeof e.state.depth === 'number');
    var depth = hasDepth ? e.state.depth : -1;
    closeMenu();
    if (sheetOpen()) closeSheet(true);
    var target = parseHash();
    if (!hasDepth) {
      /* A link, bookmark or typed URL: treat it as moving forward to a new screen. */
      if (!sameRoute(target, ui.route)) { leaveRoute(); ui.stack.push(ui.route); ui.route = target; }
      try { history.replaceState({ depth: ui.stack.length }, '', routeHash(ui.route)); } catch (err) { /* ignore */ }
      render(true);
      return;
    }
    leaveRoute();
    if (depth < ui.stack.length) {
      var r = ui.route;
      while (ui.stack.length > depth) r = ui.stack.pop();
      ui.route = r;
    } else {
      ui.stack.push(ui.route);
      ui.route = target;
    }
    render(true);
  });

  /* Hook for leaving a screen (cleanup empty notes) */
  function leaveRoute() {
    var r = ui.route;
    if (r.name === 'note') {
      var n = byId(db.notes, r.id);
      if (n && !n.title.trim() && !n.body.trim()) {
        db.notes = db.notes.filter(function (x) { return x.id !== n.id; });
        save();
      }
    }
  }

  /* ================= task rendering ================= */
  function priorityChip(p) { return '<span class="chip ' + esc(p) + '">' + esc(label(PRIORITIES, p)) + '</span>'; }
  function taskMeta(t, opts) {
    opts = opts || {};
    var bits = [];
    bits.push(priorityChip(t.priority));
    var p = t.project && project(t.project);
    if (p) bits.push('<span>' + esc(p.name) + '</span>');
    else if (taskArea(t)) bits.push('<span>' + esc(label(areasList(), taskArea(t))) + '</span>');
    if (t.date && opts.showDate !== false) {
      var od = !t.done && t.date < today();
      bits.push('<span class="chip' + (od ? ' overdue' : '') + '">' + esc(fmtDate(t.date)) + (t.time ? ' ' + esc(t.time) : '') + '</span>');
    } else if (t.time && opts.showTime) bits.push('<span class="chip">' + esc(t.time) + '</span>');
    if (t.status === 'waiting' && !t.done) bits.push('<span class="chip accent">Follow-up</span>');
    if (t.status === 'doing' && !t.done) bits.push('<span class="chip accent">In progress</span>');
    if (t.repeat) bits.push('<span title="Repeats">↻ ' + esc(label(REPEATS, t.repeat).replace('Every ', '')) + '</span>');
    if (t.subtasks && t.subtasks.length) {
      var dn = t.subtasks.filter(function (s) { return s.done; }).length;
      bits.push('<span>' + dn + '/' + t.subtasks.length + '</span>');
    }
    if (t.done && t.completedAt && opts.showCompleted) bits.push('<span>Done ' + esc(fmtDate(t.completedAt)) + '</span>');
    return '<span class="meta">' + bits.join('') + '</span>';
  }
  function taskRow(t, opts) {
    opts = opts || {};
    var sortable = opts.sortable !== false && !t.done;
    return '<div class="task' + (t.done ? ' done' : '') + '" data-sort-item="' + esc(t.id) + '">' +
      (sortable ? '<button class="grip" data-drag aria-label="Drag to reorder ' + esc(t.title) + '">' + ICON.grip + '</button>' : '<span style="width:12px"></span>') +
      '<button class="check p-' + esc(t.priority) + '" role="checkbox" aria-checked="' + (t.done ? 'true' : 'false') + '" data-act="toggleTask" data-id="' + esc(t.id) + '" aria-label="Complete ' + esc(t.title) + '"><span class="box">' + ICON.tick + '</span></button>' +
      '<button class="task-body" data-act="editTask" data-id="' + esc(t.id) + '"><span class="task-title">' + esc(t.title) + '</span>' + taskMeta(t, opts) + '</button>' +
      '</div>';
  }
  function taskList(tasks, key, emptyText, opts) {
    if (!tasks.length) return '<div class="empty">' + esc(emptyText) + '</div>';
    return '<div class="list" data-sort-list="' + esc(key) + '" data-sort-group="tasks">' + tasks.map(function (t) { return taskRow(t, opts); }).join('') + '</div>';
  }
  function head(title, sub, right) {
    return '<div class="page-head"><div><h1>' + esc(title) + '</h1>' + (sub ? '<div class="sub">' + sub + '</div>' : '') + '</div>' + (right || '') + '</div>';
  }
  function section(title, count, right) {
    return '<div class="section"><h2>' + esc(title) + (count != null ? '<span class="count">' + count + '</span>' : '') + '</h2>' + (right || '') + '</div>';
  }
  function addTaskBtn(ctx, text) {
    return '<button class="btn ghost block" style="margin-top:12px" data-act="newTask" data-ctx="' + esc(JSON.stringify(ctx || {})) + '">+ ' + esc(text || 'Add task') + '</button>';
  }

  /* ================= screens ================= */
  var screens = {};

  screens.home = function () {
    var d = new Date();
    var t = today();
    var todays = sel.today(), inbox = sel.inbox(), overdue = sel.overdue(), waiting = sel.waiting();
    var top = db.tasks.filter(function (x) {
      return isOpen(x) && x.list !== 'someday' && (x.priority === 'urgent' || x.priority === 'high') && (!x.date || x.date <= addDays(t, 2));
    }).sort(function (a, b) { return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || ((a.date || '9') < (b.date || '9') ? -1 : 1); }).slice(0, 5);
    var timed = sel.onDate(t).filter(function (x) { return x.time; });
    var html = head('Home', esc(DOW[d.getDay()] + ', ' + MONTHS[d.getMonth()] + ' ' + d.getDate()));
    html += '<div class="tiles">' +
      tile('today', 'Today', todays.length) + tile('inbox', 'Inbox', inbox.length) +
      tile('today', 'Overdue', overdue.length, overdue.length > 0) + tile('kanban', 'Waiting on others', waiting.length) + '</div>';
    html += section('Top priorities', top.length);
    html += taskList(top, 'home-top', 'No urgent or high-priority tasks. Nice.', { sortable: false });
    html += section('Daily planner', null, '<button class="link-btn" data-go="calendar">View calendar</button>');
    if (timed.length) {
      html += '<div class="card pad stack">' + timed.map(function (x) {
        return '<button class="tblock' + (x.done ? ' done' : '') + '" data-act="editTask" data-id="' + esc(x.id) + '"><div class="t">' + esc(x.time) + '</div>' + esc(x.title) + '</button>';
      }).join('') + '</div>';
    } else html += '<div class="empty">Nothing scheduled with a time today.</div>';
    html += section('Money this month', null, '<button class="link-btn" data-go="finance">Open</button>');
    var sums = financeSums(t.slice(0, 7), 'month');
    var curs = Object.keys(sums);
    if (!curs.length) html += '<div class="empty">No income or expenses this month.</div>';
    curs.forEach(function (c) {
      var s = sums[c]; var bal = s.income.actual - s.expense.actual;
      html += '<div class="card pad" style="margin-bottom:10px"><div class="row between"><span class="muted">Actual balance · ' + esc(c) + '</span><strong class="money ' + (bal >= 0 ? 'pos' : 'neg') + '">' + esc(fmtMoney(bal, c)) + '</strong></div>' +
        '<div class="row between small" style="margin-top:6px"><span class="muted">Spent ' + esc(fmtMoney(s.expense.actual, c)) + ' of ' + esc(fmtMoney(s.expense.planned, c)) + ' planned</span></div></div>';
    });
    return html;
  };
  function tile(route, l, n, alert) {
    return '<button class="tile' + (alert ? ' alert' : '') + '" data-go="' + route + '"><div class="l">' + esc(l) + '</div><div class="n">' + n + '</div></button>';
  }

  screens.inbox = function () {
    var ts = sel.inbox();
    return head('Inbox', 'New tasks land here until you assign a list.') +
      taskList(ts, 'inbox', 'Inbox is empty. Tap + to capture a task.') + addTaskBtn({}, 'Add to Inbox');
  };
  screens.today = function () {
    var t = today();
    var all = sel.today();
    var over = all.filter(function (x) { return x.date < t; });
    var now = all.filter(function (x) { return x.date === t; });
    var html = head('Today', esc(fmtDate(t, { full: true, dow: true })));
    if (over.length) html += section('Overdue', over.length) + taskList(over, 'today-over', '');
    html += section(over.length ? 'Due today' : 'Focus today', now.length) + taskList(now, 'today', 'Nothing planned for today.');
    var w = sel.waiting();
    if (w.length) html += section('Follow-up', w.length) + taskList(w, 'waiting', '', { sortable: false });
    return html + addTaskBtn({ list: 'anytime', date: t }, 'Add task for today');
  };
  screens.upcoming = function () {
    var t = today(); var all = sel.upcoming(); var html = head('Upcoming', 'Next 14 days');
    var end = addDays(t, 14); var any = false;
    for (var i = 1; i <= 14; i++) {
      var d = addDays(t, i);
      var ts = all.filter(function (x) { return x.date === d; });
      if (!ts.length) continue;
      any = true;
      html += section(fmtDate(d, { dow: true }), ts.length) + taskList(ts, 'up-' + d, '', { showDate: false, showTime: true });
    }
    var later = all.filter(function (x) { return x.date > end; });
    if (later.length) { any = true; html += section('Later', later.length) + taskList(later, 'up-later', '', { sortable: false }); }
    if (!any) html += '<div class="empty">Nothing scheduled in the next two weeks.</div>';
    return html + addTaskBtn({ list: 'anytime', date: addDays(t, 1) }, 'Add task for tomorrow');
  };
  screens.anytime = function () {
    return head('Anytime', 'Active tasks with no date.') + taskList(sel.anytime(), 'anytime', 'No undated active tasks.') + addTaskBtn({ list: 'anytime' }, 'Add to Anytime');
  };
  screens.someday = function () {
    return head('Someday', 'Ideas and tasks for later.') + taskList(sel.someday(), 'someday', 'Nothing parked for someday.') + addTaskBtn({ list: 'someday' }, 'Add to Someday');
  };
  screens.logbook = function () {
    var q = ui.logQuery.trim().toLowerCase();
    var ts = sel.logbook().filter(function (t) { return !q || t.title.toLowerCase().indexOf(q) >= 0; });
    return head('Logbook', 'Completed tasks. Tap the box to restore.') +
      '<input class="input search" type="search" placeholder="Search completed tasks" data-input="logQuery" value="' + esc(ui.logQuery) + '" aria-label="Search completed tasks">' +
      taskList(ts, 'logbook', q ? 'No completed tasks match.' : 'Completed tasks will appear here.', { sortable: false, showCompleted: true });
  };

  /* ----- calendar ----- */
  screens.calendar = function () {
    var v = ui.calView, d = ui.calDate, label2;
    var pd = parseYmd(d);
    if (v === 'month') label2 = MONTHS[pd.getMonth()] + ' ' + pd.getFullYear();
    else if (v === 'week') { var ws = startOfWeek(d); label2 = fmtDate(ws, { full: true }) + ' – ' + fmtDate(addDays(ws, 6), { full: true }); }
    else label2 = fmtDate(d, { full: true, dow: true });
    var html = head('Calendar');
    html += '<div class="seg" role="group" aria-label="Calendar view">' +
      [['month', 'Month'], ['week', 'Week'], ['day', 'Day']].map(function (x) { return '<button data-act="calView" data-v="' + x[0] + '" aria-pressed="' + (v === x[0]) + '">' + x[1] + '</button>'; }).join('') + '</div>';
    html += '<div class="cal-nav"><button class="icon-btn" data-act="calShift" data-n="-1" aria-label="Previous">‹</button><span class="label" id="calLabel">' + esc(label2) + '</span><button class="icon-btn" data-act="calShift" data-n="1" aria-label="Next">›</button><button class="tiny-btn" data-act="calToday">Today</button></div>';
    if (v === 'month') html += calMonth(d);
    else if (v === 'week') html += calWeek(d);
    else html += calDay(d);
    return html;
  };
  function calMonth(d) {
    var pd = parseYmd(d); var first = new Date(pd.getFullYear(), pd.getMonth(), 1);
    var start = startOfWeek(ymd(first)); var t = today();
    var counts = {}; db.tasks.forEach(function (x) { if (x.date && !x.done) counts[x.date] = (counts[x.date] || 0) + 1; });
    var cells = '';
    for (var i = 0; i < 42; i++) {
      var cd = addDays(start, i); var c = parseYmd(cd);
      if (i >= 35 && c.getMonth() !== pd.getMonth()) break;
      var n = Math.min(counts[cd] || 0, 3), dots = '';
      for (var k = 0; k < n; k++) dots += '<i></i>';
      cells += '<button class="day-cell' + (c.getMonth() !== pd.getMonth() ? ' other' : '') + (cd === t ? ' today' : '') + '" data-act="calPick" data-date="' + cd + '" aria-pressed="' + (cd === d) + '" aria-label="' + esc(fmtDate(cd, { full: true, dow: true })) + (counts[cd] ? ', ' + counts[cd] + ' tasks' : '') + '">' + c.getDate() + '<span class="dots">' + dots + '</span></button>';
    }
    var html = '<div class="card month"><div class="dow">' + ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map(function (x) { return '<span>' + x + '</span>'; }).join('') + '</div><div class="days">' + cells + '</div></div>';
    var ts = sel.onDate(d);
    html += section(fmtDate(d, { dow: true }), ts.length, '<button class="link-btn" data-act="calView" data-v="day">Day view</button>');
    html += taskList(ts, 'cal-' + d, 'No tasks on this day.', { sortable: false, showDate: false, showTime: true });
    return html + addTaskBtn({ list: 'anytime', date: d }, 'Add task on ' + fmtDate(d, { full: true }));
  }
  function calWeek(d) {
    var ws = startOfWeek(d), t = today(), html = '';
    for (var i = 0; i < 7; i++) {
      var cd = addDays(ws, i); var ts = sel.onDate(cd);
      html += '<div class="week-day' + (cd === t ? ' is-today' : '') + '"><div class="wd-head"><button data-act="openDay" data-date="' + cd + '">' + esc(fmtDate(cd, { dow: true, full: true })) + '</button><span class="muted small">' + (ts.length ? ts.length + ' tasks' : '') + '</span></div>' +
        (ts.length ? taskList(ts, 'wk-' + cd, '', { sortable: false, showDate: false, showTime: true }) : '<div class="empty" style="padding:12px">Free</div>') + '</div>';
    }
    return html;
  }
  function calDay(d) {
    var ts = sel.onDate(d);
    var allDay = ts.filter(function (x) { return !x.time; });
    var timed = ts.filter(function (x) { return x.time; });
    var html = section('All day', allDay.length) + taskList(allDay, 'day-' + d, 'No all-day tasks.', { sortable: false, showDate: false });
    html += section('Schedule', timed.length);
    var minH = 7, maxH = 21;
    timed.forEach(function (x) { var h = parseInt(x.time, 10); if (h < minH) minH = h; if (h > maxH) maxH = h; });
    var rows = '';
    for (var h = minH; h <= maxH; h++) {
      var inHour = timed.filter(function (x) { return parseInt(x.time, 10) === h; });
      rows += '<div class="hour"><span class="h">' + pad(h) + ':00</span><div class="slot">' + inHour.map(function (x) {
        return '<button class="tblock' + (x.done ? ' done' : '') + '" data-act="editTask" data-id="' + esc(x.id) + '"><div class="t">' + esc(x.time) + '</div>' + esc(x.title) + '</button>';
      }).join('') + '</div></div>';
    }
    html += '<div class="card timeline">' + rows + '</div>';
    return html + addTaskBtn({ list: 'anytime', date: d }, 'Add task on ' + fmtDate(d, { full: true }));
  }

  /* ----- kanban ----- */
  screens.kanban = function () {
    var by = ui.kanbanBy;
    var cols = by === 'status' ? STATUSES : PRIORITIES;
    var html = head('Kanban', 'Drag cards by the handle to move them.');
    html += '<div class="seg" role="group" aria-label="Group by"><button data-act="kanbanBy" data-v="status" aria-pressed="' + (by === 'status') + '">By status</button><button data-act="kanbanBy" data-v="priority" aria-pressed="' + (by === 'priority') + '">By priority</button></div>';
    html += '<div class="board" id="board">';
    cols.forEach(function (c) {
      var ts = db.tasks.filter(function (t) {
        if (by === 'status') return c[0] === 'done' ? (t.done && t.completedAt >= addDays(today(), -14)) : (!t.done && t.status === c[0]);
        return !t.done && t.priority === c[0];
      }).sort(byOrder);
      html += '<section class="column" aria-label="' + esc(c[1]) + '"><h3>' + esc(c[1]) + '<span class="muted">' + ts.length + '</span></h3><div class="cards" data-sort-list="' + esc(c[0]) + '" data-sort-group="kanban">' +
        ts.map(function (t) {
          return '<div class="kcard" data-sort-item="' + esc(t.id) + '"><button class="grip" data-drag aria-label="Drag ' + esc(t.title) + '">' + ICON.grip + '</button><button class="task-body" data-act="editTask" data-id="' + esc(t.id) + '"><span class="task-title">' + esc(t.title) + '</span>' + taskMeta(t) + '</button></div>';
        }).join('') + '</div></section>';
    });
    return html + '</div>';
  };

  /* ----- areas & projects ----- */
  function projectStats(pid) {
    var ts = db.tasks.filter(function (t) { return t.project === pid; });
    var done = ts.filter(function (t) { return t.done; }).length;
    return { total: ts.length, done: done, open: ts.length - done, pct: ts.length ? Math.round(done * 100 / ts.length) : 0 };
  }
  function projectCard(p) {
    var s = projectStats(p.id);
    return '<button class="item-card" data-go="project" data-id="' + esc(p.id) + '"><div class="row between"><h3>' + esc(p.name) + '</h3><span class="chip accent">' + s.open + ' open</span></div>' +
      '<div class="meta">' + esc(label(areasList(), p.area)) + (p.status !== 'active' ? ' · ' + esc(p.status[0].toUpperCase() + p.status.slice(1)) : '') + ' · ' + s.done + '/' + s.total + ' done</div>' +
      '<div class="bar"><span style="width:' + s.pct + '%"></span></div></button>';
  }
  screens.areas = function () {
    var html = head('Areas', 'Every project belongs to one area.') + '<div class="area-tiles">';
    areasList().forEach(function (a) {
      var ps = db.projects.filter(function (p) { return p.area === a[0]; });
      var open = db.tasks.filter(function (t) { return isOpen(t) && taskArea(t) === a[0]; }).length;
      html += '<button class="area-tile" data-go="area" data-id="' + a[0] + '"><span class="mark">' + (a[0] === 'personal' ? ICON.person : a[0] === 'business' ? ICON.briefcase : ICON.areas) + '</span><span><h3>' + a[1] + '</h3><span class="muted small">' + ps.length + ' projects · ' + open + ' open tasks</span></span></button>';
    });
    return html + '</div>';
  };
  screens.area = function (id) {
    var a = label(areasList(), id);
    if (!a) return notFound('This area does not exist.');
    var ps = db.projects.filter(function (p) { return p.area === id; }).sort(byOrder);
    var loose = db.tasks.filter(function (t) { return isOpen(t) && !t.project && t.area === id && t.list !== 'inbox'; }).sort(byOrder);
    var notes = db.notes.filter(function (n) { return n.area === id; });
    var html = head(a, ps.length + ' projects');
    html += section('Projects', ps.length, '<button class="link-btn" data-act="newProject" data-area="' + id + '">+ New project</button>');
    html += ps.length ? ps.map(projectCard).join('') : '<div class="empty">No projects yet.</div>';
    html += section('Tasks without a project', loose.length) + taskList(loose, 'area-' + id, 'None.');
    html += addTaskBtn({ area: id, list: 'anytime' }, 'Add task to ' + a);
    html += section('Notes', notes.length) + (notes.length ? notes.map(noteCard).join('') : '<div class="empty">No notes in this area.</div>');
    return html;
  };
  screens.projects = function () {
    var f = ui.projFilter;
    var ps = db.projects.filter(function (p) { return f === 'all' || p.area === f; }).sort(byOrder);
    var html = head('Projects', db.projects.length + ' total', '<button class="btn ghost" data-act="newProject" data-area="' + (f === 'all' ? '' : f) + '">+ New</button>');
    html += '<div class="seg" role="group" aria-label="Filter by area">' + [['all', 'All']].concat(areasList()).map(function (x) {
      return '<button data-act="projFilter" data-v="' + x[0] + '" aria-pressed="' + (f === x[0]) + '">' + x[1] + '</button>';
    }).join('') + '</div>';
    return html + (ps.length ? ps.map(projectCard).join('') : '<div class="empty">No projects here. Tap + New to create one.</div>');
  };
  screens.project = function (id) {
    var p = project(id);
    if (!p) return notFound('This project was deleted.');
    var s = projectStats(id);
    var open = db.tasks.filter(function (t) { return t.project === id && !t.done; }).sort(byOrder);
    var done = db.tasks.filter(function (t) { return t.project === id && t.done; });
    var notes = db.notes.filter(function (n) { return n.project === id; });
    var html = head(p.name, esc(label(areasList(), p.area)) + ' · ' + esc(p.status[0].toUpperCase() + p.status.slice(1)), '<button class="btn plain" data-act="editProject" data-id="' + esc(id) + '">Edit</button>');
    html += '<div class="card pad"><div class="row between"><span class="muted">Progress</span><strong>' + s.pct + '%</strong></div><div class="bar"><span style="width:' + s.pct + '%"></span></div><div class="muted small" style="margin-top:8px">' + s.done + ' of ' + s.total + ' tasks done</div></div>';
    html += section('Tasks', open.length) + taskList(open, 'proj-' + id, 'No open tasks.');
    html += addTaskBtn({ project: id, area: p.area }, 'Add task to project');
    if (done.length) html += section('Completed', done.length) + taskList(done, 'projdone-' + id, '', { sortable: false });
    html += section('Notes', notes.length, '<button class="link-btn" data-act="newNote" data-project="' + esc(id) + '">+ Note</button>') + (notes.length ? notes.map(noteCard).join('') : '<div class="empty">No notes linked.</div>');
    return html;
  };
  function notFound(msg) { return head('Not found') + '<div class="empty">' + esc(msg) + '</div><button class="btn block" style="margin-top:12px" data-go="home">Go to Home</button>'; }

  /* ----- notes ----- */
  function noteCard(n) {
    var meta = [];
    if (n.pinned) meta.push('Pinned');
    var p = n.project && project(n.project);
    if (p) meta.push(p.name); else if (n.area) meta.push(label(areasList(), n.area));
    meta.push(fmtDate(ymd(new Date(n.updatedAt || Date.now()))));
    return '<button class="item-card" data-go="note" data-id="' + esc(n.id) + '"><h3>' + esc(n.title || 'Untitled') + '</h3><div class="meta">' + esc(meta.join(' · ')) + '</div>' + (n.body ? '<p>' + esc(n.body) + '</p>' : '') + '</button>';
  }
  screens.notes = function () {
    var q = ui.noteQuery.trim().toLowerCase();
    var ns = db.notes.filter(function (n) { return !q || (n.title + ' ' + n.body).toLowerCase().indexOf(q) >= 0; })
      .sort(function (a, b) { return (b.pinned - a.pinned) || ((b.updatedAt || 0) - (a.updatedAt || 0)); });
    return head('Notes', db.notes.length + ' notes', '<button class="btn ghost" data-act="newNote">+ New note</button>') +
      '<input class="input search" type="search" placeholder="Search notes" data-input="noteQuery" value="' + esc(ui.noteQuery) + '" aria-label="Search notes">' +
      '<div id="noteResults">' + (ns.length ? ns.map(noteCard).join('') : '<div class="empty">' + (q ? 'No notes match.' : 'No notes yet. Tap + New note.') + '</div>') + '</div>';
  };
  screens.note = function (id) {
    var n = byId(db.notes, id);
    if (!n) return notFound('This note was deleted.');
    var projOpts = '<option value="">No project</option>' + areasList().map(function (a) {
      return '<optgroup label="' + a[1] + '">' + db.projects.filter(function (p) { return p.area === a[0]; }).map(function (p) { return '<option value="' + esc(p.id) + '"' + (p.id === n.project ? ' selected' : '') + '>' + esc(p.name) + '</option>'; }).join('') + '</optgroup>';
    }).join('');
    return '<div class="note-editor" data-note="' + esc(id) + '">' +
      '<input class="title-in" data-note-field="title" placeholder="Title" value="' + esc(n.title) + '" aria-label="Note title">' +
      '<div class="note-meta"><select data-note-field="area" aria-label="Area"><option value="">No area</option>' + options(areasList(), n.area) + '</select>' +
      '<select data-note-field="project" aria-label="Project">' + projOpts + '</select>' +
      '<button class="tiny-btn" data-act="pinNote" data-id="' + esc(id) + '" aria-pressed="' + (!!n.pinned) + '">' + (n.pinned ? 'Unpin' : 'Pin') + '</button>' +
      '<button class="tiny-btn" data-act="noteToTasks" data-id="' + esc(id) + '">Lines → tasks</button>' +
      '<button class="tiny-btn" style="color:var(--bad)" data-act="deleteNote" data-id="' + esc(id) + '">Delete</button></div>' +
      '<textarea class="body-in" data-note-field="body" placeholder="Start writing…" aria-label="Note text">' + esc(n.body) + '</textarea>' +
      '<div class="muted small" id="noteSaved">Saved automatically</div></div>';
  };

  /* ----- finance ----- */
  function inPeriod(date, period, key) { return period === 'year' ? date.slice(0, 4) === key.slice(0, 4) : date.slice(0, 7) === key; }
  function financeSums(key, period) {
    var out = {};
    db.finance.forEach(function (r) {
      if (!r.date || !inPeriod(r.date, period, key)) return;
      var c = r.currency || 'USD';
      if (!out[c]) out[c] = { income: { planned: 0, actual: 0 }, expense: { planned: 0, actual: 0 }, cats: {} };
      out[c][r.kind][r.type] += Number(r.amount) || 0;
      if (r.kind === 'expense') {
        var k = r.category || 'Other';
        if (!out[c].cats[k]) out[c].cats[k] = { planned: 0, actual: 0 };
        out[c].cats[k][r.type] += Number(r.amount) || 0;
      }
    });
    return out;
  }
  screens.finance = function () {
    var period = ui.finPeriod, key = ui.finMonth;
    var y = +key.slice(0, 4), m = +key.slice(5, 7);
    var lbl = period === 'year' ? String(y) : MONTHS[m - 1] + ' ' + y;
    var html = '';
    html += '<div class="btn-row" style="margin-bottom:14px"><button class="btn" data-act="newFinance" data-kind="income">' + ICON.income + 'Add Income</button><button class="btn" data-act="newFinance" data-kind="expense">' + ICON.expense + 'Add Expense</button></div>';
    html += '<div class="seg" role="group" aria-label="Period"><button data-act="finPeriod" data-v="month" aria-pressed="' + (period === 'month') + '">Month</button><button data-act="finPeriod" data-v="year" aria-pressed="' + (period === 'year') + '">Year</button></div>';
    html += '<div class="cal-nav"><button class="icon-btn" data-act="finShift" data-n="-1" aria-label="Previous period">‹</button><span class="label" id="finLabel">' + esc(lbl) + '</span><button class="icon-btn" data-act="finShift" data-n="1" aria-label="Next period">›</button></div>';
    var sums = financeSums(key, period); var curs = Object.keys(sums).sort();
    if (!curs.length) html += '<div class="empty">No records for ' + esc(lbl) + '. Add income or an expense to see totals.</div>';
    curs.forEach(function (c) {
      var s = sums[c];
      var balA = s.income.actual - s.expense.actual, balP = s.income.planned - s.expense.planned;
      html += '<div class="card pad" style="margin-bottom:10px" data-fin-cur="' + esc(c) + '"><div class="row between" style="margin-bottom:10px"><strong>' + esc(c) + '</strong><span class="muted small">' + esc(lbl) + '</span></div>' +
        '<div class="fin-grid money"><span></span><span class="h">Planned</span><span class="h">Actual</span>' +
        '<span class="k">Income</span><span class="v" data-k="income-planned">' + esc(fmtMoney(s.income.planned, c)) + '</span><span class="v pos" data-k="income-actual">' + esc(fmtMoney(s.income.actual, c)) + '</span>' +
        '<span class="k">Expenses</span><span class="v" data-k="expense-planned">' + esc(fmtMoney(s.expense.planned, c)) + '</span><span class="v" data-k="expense-actual">' + esc(fmtMoney(s.expense.actual, c)) + '</span></div>' +
        '<div class="fin-grid money fin-balance"><span class="k">Balance</span><span class="v ' + (balP >= 0 ? 'pos' : 'neg') + '" data-k="balance-planned">' + esc(fmtMoney(balP, c)) + '</span><span class="v ' + (balA >= 0 ? 'pos' : 'neg') + '" data-k="balance-actual">' + esc(fmtMoney(balA, c)) + '</span></div></div>';
      var cats = Object.keys(s.cats);
      if (cats.length) {
        html += '<div class="card pad" style="margin-bottom:10px"><div class="muted small" style="margin-bottom:10px">Expenses by category · ' + esc(c) + '</div>' + cats.map(function (k) {
          var v = s.cats[k]; var pct = v.planned ? Math.min(100, Math.round(v.actual * 100 / v.planned)) : (v.actual ? 100 : 0);
          var over = v.planned && v.actual > v.planned;
          return '<div class="cat-row"><div class="row between small"><strong>' + esc(k) + '</strong><span class="money muted">' + esc(fmtMoney(v.actual, c)) + ' / ' + esc(fmtMoney(v.planned, c)) + '</span></div><div class="bar' + (over ? ' over' : '') + '"><span style="width:' + pct + '%"></span></div></div>';
        }).join('') + '</div>';
      }
    });
    var recs = db.finance.filter(function (r) { return r.date && inPeriod(r.date, period, key); }).sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    html += section('Records', recs.length);
    html += recs.length ? '<div class="list">' + recs.map(function (r) {
      return '<button class="rec" data-act="editFinance" data-id="' + esc(r.id) + '"><span><strong>' + esc(r.category || (r.kind === 'income' ? 'Income' : 'Expense')) + '</strong><span class="meta"><span class="chip ' + (r.kind === 'income' ? 'good' : '') + '">' + (r.kind === 'income' ? 'Income' : 'Expense') + '</span><span class="chip">' + (r.type === 'planned' ? 'Planned' : 'Actual') + '</span><span>' + esc(fmtDate(r.date, { full: true })) + '</span></span>' + (r.note ? '<span class="muted small">' + esc(r.note) + '</span>' : '') + '</span><span class="amt money ' + (r.kind === 'income' ? 'pos' : '') + '">' + (r.kind === 'income' ? '+' : '−') + esc(fmtMoney(r.amount, r.currency)) + '</span></button>';
    }).join('') + '</div>' : '<div class="empty">No records in this period.</div>';
    return html;
  };

  /* ----- purchases ----- */
  screens.purchases = function () {
    var totals = {};
    db.purchases.forEach(function (p) {
      if (p.status === 'Bought') return;
      var c = p.currency || 'USD';
      if (!totals[c]) totals[c] = { amount: 0, saved: 0 };
      totals[c].amount += Number(p.amount) || 0; totals[c].saved += Math.min(Number(p.saved) || 0, Number(p.amount) || 0);
    });
    var html = head('Major Purchases', 'Planned big-ticket items');
    var cs = Object.keys(totals).sort();
    html += cs.length ? cs.map(function (c) {
      var t = totals[c]; var pct = t.amount ? Math.round(t.saved * 100 / t.amount) : 0;
      return '<div class="card pad" style="margin-bottom:10px" data-pur-cur="' + esc(c) + '"><div class="muted small">Total planned budget · ' + esc(c) + '</div><div class="money" style="font-size:28px;font-weight:750;margin-top:2px" data-k="budget">' + esc(fmtMoney(t.amount, c)) + '</div><div class="muted small">Saved ' + esc(fmtMoney(t.saved, c)) + ' (' + pct + '%)</div><div class="bar"><span style="width:' + pct + '%"></span></div></div>';
    }).join('') : '';
    html += '<button class="btn block" data-act="newPurchase" style="margin:4px 0 14px">+ Add purchase</button>';
    var sorted = db.purchases.slice().sort(function (a, b) { return (a.status === 'Bought') - (b.status === 'Bought') || PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]; });
    html += sorted.length ? sorted.map(function (p) {
      var pct = p.amount ? Math.min(100, Math.round((Number(p.saved) || 0) * 100 / p.amount)) : 0;
      return '<button class="item-card" data-act="editPurchase" data-id="' + esc(p.id) + '"><div class="row between"><h3>' + esc(p.title) + '</h3><strong class="money">' + esc(fmtMoney(p.amount, p.currency)) + '</strong></div><div class="meta">' + priorityChip(p.priority) + '<span class="chip' + (p.status === 'Bought' ? ' good' : '') + '">' + esc(p.status) + '</span>' + (p.date ? '<span>Target ' + esc(fmtDate(p.date, { full: true })) + '</span>' : '') + '</div><div class="bar"><span style="width:' + pct + '%"></span></div><div class="muted small" style="margin-top:6px">Saved ' + esc(fmtMoney(p.saved || 0, p.currency)) + '</div></button>';
    }).join('') : '<div class="empty">No purchases planned yet.</div>';
    return html;
  };

  /* ================= sheets & forms ================= */
  var sheetWrap, sheetEl, lastFocus;
  function sheetOpen() { return sheetWrap && sheetWrap.classList.contains('on'); }
  function openSheet(title, body) {
    lastFocus = document.activeElement;
    sheetEl.innerHTML = '<div class="sheet-grab"></div><div class="sheet-head"><h2 id="sheetTitle">' + esc(title) + '</h2><button class="icon-btn" type="button" data-act="closeSheet" aria-label="Close">' + ICON.close + '</button></div>' + body;
    sheetWrap.classList.add('on'); sheetWrap.setAttribute('aria-hidden', 'false');
    sheetEl.scrollTop = 0;
    var first = sheetEl.querySelector('[autofocus]');
    if (first) { try { first.focus({ preventScroll: true }); } catch (e) { first.focus(); } }
  }
  function closeSheet(silent) {
    if (!sheetWrap) return;
    sheetWrap.classList.remove('on'); sheetWrap.setAttribute('aria-hidden', 'true');
    if (document.activeElement && sheetEl.contains(document.activeElement)) document.activeElement.blur();
    setTimeout(function () { if (!sheetOpen()) sheetEl.innerHTML = ''; }, 250);
    if (!silent && lastFocus && document.contains(lastFocus)) { try { lastFocus.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
  }

  function chooser() {
    var items = [['task', 'Task', ICON.task], ['note', 'Note', ICON.note], ['safe', 'Safe', ICON.lock], ['income', 'Income', ICON.income], ['expense', 'Expense', ICON.expense]];
    openSheet('Add new', '<div class="chooser">' + items.map(function (x, i) {
      return '<button type="button" class="choice' + (i === 0 ? ' wide' : '') + '" data-act="choose" data-kind="' + x[0] + '">' + x[2] + x[1] + '</button>';
    }).join('') + '</div>');
  }

  function projectOptions(selected) {
    return '<option value="">No project</option>' + areasList().map(function (a) {
      var ps = db.projects.filter(function (p) { return p.area === a[0] && p.status !== 'completed' || p.id === selected; }).filter(function (p) { return p.area === a[0]; });
      return ps.length ? '<optgroup label="' + a[1] + '">' + ps.map(function (p) { return '<option value="' + esc(p.id) + '"' + (p.id === selected ? ' selected' : '') + '>' + esc(p.name) + '</option>'; }).join('') + '</optgroup>' : '';
    }).join('');
  }
  function subRow(s) {
    return '<div class="sub-row" data-sub><input type="checkbox" aria-label="Done"' + (s.done ? ' checked' : '') + '><input type="text" class="input" value="' + esc(s.title) + '" aria-label="Subtask" placeholder="Subtask"><button type="button" class="tiny-btn" data-act="removeSub" aria-label="Remove subtask">✕</button></div>';
  }
  function taskForm(t, ctx) {
    var isNew = !t;
    t = t || { title: '', notes: '', list: ctx.list || 'inbox', date: ctx.date || '', time: '', priority: 'medium', status: 'todo', area: ctx.area || '', project: ctx.project || '', repeat: '', subtasks: [] };
    var body = '<form data-form="task" data-id="' + esc(isNew ? '' : t.id) + '" novalidate>' +
      '<label class="field"><span>Task title</span><input name="title" value="' + esc(t.title) + '" required maxlength="300" placeholder="What needs doing?"' + (isNew ? ' autofocus' : '') + ' enterkeyhint="done"></label>' +
      '<p class="hint" id="taskErr" role="alert" style="color:var(--bad)"></p>' +
      '<div class="fields2"><label class="field"><span>List</span><select name="list">' + options(LISTS, t.list) + '</select></label>' +
      '<label class="field"><span>Priority</span><select name="priority">' + options(PRIORITIES, t.priority) + '</select></label></div>' +
      (isNew && t.list === 'inbox' ? '<p class="hint">New tasks go to Inbox. Choose Anytime with a date to plan it.</p>' : '') +
      '<div class="fields2"><label class="field"><span>Date</span><input type="date" name="date" value="' + esc(t.date) + '"></label>' +
      '<label class="field"><span>Time</span><input type="time" name="time" value="' + esc(t.time) + '"></label></div>' +
      '<div class="btn-row" style="margin-top:8px"><button type="button" class="tiny-btn" data-act="formDate" data-n="0">Today</button><button type="button" class="tiny-btn" data-act="formDate" data-n="1">Tomorrow</button><button type="button" class="tiny-btn" data-act="formDate" data-n="7">Next week</button><button type="button" class="tiny-btn" data-act="formDate" data-n="">No date</button></div>' +
      '<div class="fields2"><label class="field"><span>Area</span><select name="area"><option value="">None</option>' + options(areasList(), t.area) + '</select></label>' +
      '<label class="field"><span>Project</span><select name="project">' + projectOptions(t.project) + '</select></label></div>' +
      '<div class="fields2"><label class="field"><span>Status</span><select name="status">' + options(STATUSES, t.done ? 'done' : t.status) + '</select></label>' +
      '<label class="field"><span>Repeat</span><select name="repeat">' + options(REPEATS, t.repeat) + '</select></label></div>' +
      '<label class="field"><span>Notes</span><textarea name="notes" rows="3" placeholder="Details, links…">' + esc(t.notes) + '</textarea></label>' +
      '<div class="field"><span>Subtasks</span><div id="subs">' + (t.subtasks || []).map(subRow).join('') + '</div>' +
      '<div class="inline-btn" style="margin-top:8px"><input class="input" id="newSub" placeholder="Add a subtask" aria-label="New subtask" enterkeyhint="done"><button type="button" class="tiny-btn" data-act="addSub">Add</button></div></div>' +
      '<div class="actions"><button class="btn block" type="submit">' + (isNew ? 'Save task' : 'Save changes') + '</button>' +
      (isNew ? '' : '<button type="button" class="btn ghost block" data-act="toggleTask" data-id="' + esc(t.id) + '" data-close="1">' + (t.done ? 'Mark as not done' : 'Mark as done') + '</button><button type="button" class="btn danger block" data-act="deleteTask" data-id="' + esc(t.id) + '">Delete task</button>') +
      '</div></form>';
    openSheet(isNew ? 'New task' : 'Edit task', body);
  }
  function projectForm(p, area) {
    var isNew = !p;
    p = p || { name: '', area: area || 'personal', status: 'active' };
    openSheet(isNew ? 'New project' : 'Edit project', '<form data-form="project" data-id="' + esc(isNew ? '' : p.id) + '" novalidate>' +
      '<label class="field"><span>Project name</span><input name="name" value="' + esc(p.name) + '" required maxlength="120"' + (isNew ? ' autofocus' : '') + '></label><p class="hint" id="projErr" role="alert" style="color:var(--bad)"></p>' +
      '<label class="field"><span>Area</span><select name="area">' + options(areasList(), p.area) + '</select></label>' +
      '<label class="field"><span>Status</span><select name="status">' + options([['active', 'Active'], ['paused', 'Paused'], ['completed', 'Completed']], p.status) + '</select></label>' +
      '<div class="actions"><button class="btn block" type="submit">' + (isNew ? 'Create project' : 'Save changes') + '</button>' +
      (isNew ? '' : '<button type="button" class="btn danger block" data-act="deleteProject" data-id="' + esc(p.id) + '">Delete project</button>') + '</div></form>');
  }
  function financeForm(r, kind) {
    var isNew = !r;
    r = r || { kind: kind, type: 'actual', date: today(), amount: '', currency: lastCurrency(), category: '', note: '' };
    var cats = r.kind === 'income' ? INCOME_CATS : EXPENSE_CATS;
    var title = (isNew ? 'Add ' : 'Edit ') + (r.kind === 'income' ? 'income' : 'expense');
    openSheet(title, '<form data-form="finance" data-id="' + esc(isNew ? '' : r.id) + '" data-kind="' + r.kind + '" novalidate>' +
      '<div class="seg" role="radiogroup" aria-label="Planned or actual" style="margin-top:6px">' +
      '<button type="button" data-act="finType" data-v="planned" aria-pressed="' + (r.type === 'planned') + '">Planned</button><button type="button" data-act="finType" data-v="actual" aria-pressed="' + (r.type === 'actual') + '">Actual</button></div>' +
      '<input type="hidden" name="type" value="' + r.type + '">' +
      '<div class="fields2"><label class="field"><span>Amount</span><input name="amount" type="number" inputmode="decimal" min="0" step="0.01" value="' + esc(r.amount) + '" required' + (isNew ? ' autofocus' : '') + '></label>' +
      '<label class="field"><span>Currency</span><select name="currency">' + options(CURRENCIES, r.currency) + '</select></label></div>' +
      '<p class="hint" id="finErr" role="alert" style="color:var(--bad)"></p>' +
      '<div class="fields2"><label class="field"><span>Date</span><input type="date" name="date" value="' + esc(r.date) + '" required></label>' +
      '<label class="field"><span>Category</span><input name="category" list="catList" value="' + esc(r.category) + '" placeholder="' + esc(cats[0]) + '"></label></div>' +
      '<datalist id="catList">' + cats.map(function (c) { return '<option value="' + esc(c) + '">'; }).join('') + '</datalist>' +
      '<label class="field"><span>Note</span><input name="note" value="' + esc(r.note) + '" placeholder="Optional"></label>' +
      '<div class="actions"><button class="btn block" type="submit">' + (isNew ? 'Save ' + (r.kind === 'income' ? 'income' : 'expense') : 'Save changes') + '</button>' +
      (isNew ? '' : '<button type="button" class="btn danger block" data-act="deleteFinance" data-id="' + esc(r.id) + '">Delete record</button>') + '</div></form>');
  }
  function lastCurrency() { var r = db.finance[db.finance.length - 1]; return r ? r.currency : 'USD'; }
  function purchaseForm(p) {
    var isNew = !p;
    p = p || { title: '', amount: '', saved: 0, currency: 'USD', priority: 'medium', status: 'Planned', date: '', note: '' };
    openSheet(isNew ? 'Add purchase' : 'Edit purchase', '<form data-form="purchase" data-id="' + esc(isNew ? '' : p.id) + '" novalidate>' +
      '<label class="field"><span>Purchase</span><input name="title" value="' + esc(p.title) + '" required' + (isNew ? ' autofocus' : '') + '></label>' +
      '<div class="fields2"><label class="field"><span>Budget</span><input name="amount" type="number" inputmode="decimal" min="0" step="0.01" value="' + esc(p.amount) + '" required></label>' +
      '<label class="field"><span>Currency</span><select name="currency">' + options(CURRENCIES, p.currency) + '</select></label></div>' +
      '<p class="hint" id="purErr" role="alert" style="color:var(--bad)"></p>' +
      '<div class="fields2"><label class="field"><span>Saved so far</span><input name="saved" type="number" inputmode="decimal" min="0" step="0.01" value="' + esc(p.saved) + '"></label>' +
      '<label class="field"><span>Target date</span><input type="date" name="date" value="' + esc(p.date) + '"></label></div>' +
      '<div class="fields2"><label class="field"><span>Priority</span><select name="priority">' + options(PRIORITIES, p.priority) + '</select></label>' +
      '<label class="field"><span>Status</span><select name="status">' + options(PURCHASE_STATUSES, p.status) + '</select></label></div>' +
      '<label class="field"><span>Note</span><input name="note" value="' + esc(p.note) + '"></label>' +
      '<div class="actions"><button class="btn block" type="submit">' + (isNew ? 'Add purchase' : 'Save changes') + '</button>' +
      (isNew ? '' : '<button type="button" class="btn danger block" data-act="deletePurchase" data-id="' + esc(p.id) + '">Delete purchase</button>') + '</div></form>');
  }
  /* ================= task operations ================= */
  function nextDate(d, rep) {
    if (rep === 'daily') return addDays(d, 1);
    if (rep === 'weekly') return addDays(d, 7);
    if (rep === 'monthly') return addMonths(d, 1);
    if (rep === 'yearly') return addMonths(d, 12);
    return d;
  }
  function completeTask(t) {
    t.done = true; t.status = 'done'; t.completedAt = today();
    if (t.repeat) {
      var base = t.date || today(); var nd = nextDate(base, t.repeat); var guard = 0;
      while (nd < today() && guard++ < 1000) nd = nextDate(nd, t.repeat);
      var copy = JSON.parse(JSON.stringify(t));
      copy.id = uid(); copy.done = false; copy.status = 'todo'; copy.completedAt = ''; copy.date = nd; copy.createdAt = Date.now();
      copy.subtasks = copy.subtasks.map(function (s) { return { id: uid(), title: s.title, done: false }; });
      if (copy.list === 'inbox') copy.list = 'anytime';
      t.repeat = ''; // the completed instance stops repeating; the new copy carries it on
      db.tasks.push(copy);
      return copy;
    }
    return null;
  }
  function reopenTask(t) { t.done = false; t.completedAt = ''; if (t.status === 'done') t.status = 'todo'; }
  function toggleTask(id) {
    var t = task(id); if (!t) return;
    if (!t.done) {
      var snapshot = JSON.parse(JSON.stringify(t));
      var spawned = completeTask(t);
      save(); render();
      toast(spawned ? 'Done. Next one on ' + fmtDate(spawned.date) : 'Completed', 'Undo', function () {
        var cur = task(id); if (cur) { Object.keys(snapshot).forEach(function (k) { cur[k] = snapshot[k]; }); }
        if (spawned) db.tasks = db.tasks.filter(function (x) { return x.id !== spawned.id; });
        save(); render();
      });
    } else {
      reopenTask(t); save(); render(); toast('Restored to ' + whereLabel(t));
    }
  }
  function whereRoute(t) {
    if (t.done) return 'logbook';
    if (t.list === 'inbox') return 'inbox';
    if (t.list === 'someday') return 'someday';
    if (t.date && t.date <= today()) return 'today';
    if (t.date) return 'upcoming';
    return 'anytime';
  }
  function whereLabel(t) { return ROUTES[whereRoute(t)].title; }
  function reorderIds(ids) {
    var ts = ids.map(function (i) { return task(i) || byId(db.headings, i); }).filter(Boolean);
    var orders = ts.map(function (t) { return t.order; }).sort(function (a, b) { return a - b; });
    for (var i = 1; i < orders.length; i++) if (orders[i] <= orders[i - 1]) orders[i] = orders[i - 1] + 0.001;
    ts.forEach(function (t, i) { t.order = orders[i]; });
  }
  function setTaskStatus(t, s) {
    if (s === 'done') { if (!t.done) completeTask(t); return; }
    if (t.done) reopenTask(t);
    t.status = s;
  }

  /* ================= form submissions ================= */
  function val(form, name) { var el = form.elements[name]; return el ? String(el.value || '').trim() : ''; }
  var submitters = {
    task: function (form) {
      var title = val(form, 'title');
      if (!title) { $('#taskErr').textContent = 'Give the task a title.'; form.elements.title.focus(); return; }
      var id = form.dataset.id; var isNew = !id;
      var t = isNew ? { id: form.dataset.preId || uid(), done: false, completedAt: '', order: minOrder() - 1, createdAt: Date.now(), subtasks: [] } : task(id);
      if (!t) { closeSheet(); return; }
      t.title = title; t.notes = val(form, 'notes'); t.list = val(form, 'list') || 'inbox';
      t.date = val(form, 'date'); t.time = val(form, 'time'); t.priority = val(form, 'priority') || 'medium';
      t.project = val(form, 'project'); t.repeat = val(form, 'repeat');
      var p = t.project && project(t.project);
      t.area = p ? p.area : val(form, 'area');
      t.subtasks = $all('[data-sub]', form).map(function (row, i) {
        var inputs = row.querySelectorAll('input');
        var prev = (t.subtasks || [])[i];
        return { id: prev ? prev.id : uid(), title: inputs[1].value.trim(), done: inputs[0].checked };
      }).filter(function (s) { return s.title; });
      var pending = val(form, 'newSub') || ($('#newSub', form) && $('#newSub', form).value.trim());
      if (pending) t.subtasks.push({ id: uid(), title: pending, done: false });
      var status = val(form, 'status') || 'todo';
      if (isNew) { t.status = 'todo'; db.tasks.push(t); }
      setTaskStatus(t, status);
      save(); closeSheet(); render();
      var r = whereRoute(t);
      if (isNew) {
        toast('Added to ' + ROUTES[r].title, ui.route.name === r ? '' : 'View', function () { go(r); });
      } else toast('Saved');
    },
    project: function (form) {
      var name = val(form, 'name');
      if (!name) { $('#projErr').textContent = 'Give the project a name.'; return; }
      var id = form.dataset.id;
      var p = id ? project(id) : { id: uid(), order: db.projects.length + 1 };
      if (!p) { closeSheet(); return; }
      p.name = name; p.area = byId(db.areas, val(form, 'area')) ? val(form, 'area') : db.areas[0].id; p.status = val(form, 'status') || 'active';
      if (!id) db.projects.push(p);
      db.tasks.forEach(function (t) { if (t.project === p.id) t.area = p.area; });
      save(); closeSheet();
      if (!id) { go('project', p.id); toast('Project created in ' + label(areasList(), p.area)); }
      else { render(); toast('Saved'); }
    },
    finance: function (form) {
      var amount = parseFloat(val(form, 'amount'));
      if (!(amount > 0)) { $('#finErr').textContent = 'Enter an amount greater than 0.'; return; }
      var date = val(form, 'date');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { $('#finErr').textContent = 'Choose a date.'; return; }
      var id = form.dataset.id;
      var r = id ? byId(db.finance, id) : { id: uid(), kind: form.dataset.kind };
      if (!r) { closeSheet(); return; }
      r.type = val(form, 'type') === 'planned' ? 'planned' : 'actual';
      r.amount = Math.round(amount * 100) / 100; r.currency = val(form, 'currency') || 'USD'; r.date = date;
      r.category = val(form, 'category') || 'Other'; r.note = val(form, 'note');
      if (!id) db.finance.push(r);
      save(); closeSheet();
      ui.finPeriod = 'month'; ui.finMonth = date.slice(0, 7);
      if (ui.route.name !== 'finance') go('finance'); else render();
      toast((r.kind === 'income' ? 'Income' : 'Expense') + ' saved');
    },
    purchase: function (form) {
      var title = val(form, 'title'); var amount = parseFloat(val(form, 'amount'));
      if (!title || !(amount >= 0) || val(form, 'amount') === '') { $('#purErr').textContent = 'Add a name and a budget.'; return; }
      var id = form.dataset.id;
      var p = id ? byId(db.purchases, id) : { id: uid() };
      if (!p) { closeSheet(); return; }
      p.title = title; p.amount = Math.round(amount * 100) / 100; p.saved = Math.max(0, parseFloat(val(form, 'saved')) || 0);
      p.currency = val(form, 'currency') || 'USD'; p.priority = val(form, 'priority') || 'medium';
      p.status = val(form, 'status') || 'Planned'; p.date = val(form, 'date'); p.note = val(form, 'note');
      if (!id) db.purchases.push(p);
      save(); closeSheet(); render(); toast(id ? 'Saved' : 'Purchase added');
    },
    safeSetup: function (form) {
      var pw = form.elements.pw.value, pw2 = form.elements.pw2.value;
      if (pw.length < 8) { $('#safeErr').textContent = 'Use at least 8 characters.'; return; }
      if (pw !== pw2) { $('#safeErr').textContent = 'Passwords do not match.'; return; }
      busy(form, true);
      Vault.create(pw).then(function () { render(); toast('Safe created'); afterUnlock(); }).catch(function (e) { busy(form, false); $('#safeErr').textContent = 'Could not create Safe: ' + e.message; });
    },
    safeUnlock: function (form) {
      busy(form, true);
      Vault.unlock(form.elements.pw.value).then(function () { render(); afterUnlock(); })
        .catch(function () { busy(form, false); $('#safeErr').textContent = 'Wrong password.'; form.elements.pw.select(); });
    },
    safe: function (form) {
      if (!Vault.unlocked()) { closeSheet(); render(); return; }
      var title = val(form, 'title');
      if (!title) { $('#safeFormErr').textContent = 'Give the record a name.'; return; }
      var id = form.dataset.id;
      var r = id ? byId(Vault.records, id) : { id: uid() };
      if (!r) { closeSheet(); return; }
      r.title = title; r.type = val(form, 'type'); r.link = val(form, 'link'); r.login = val(form, 'login');
      r.secret = form.elements.secret.value; r.note = val(form, 'note');
      if (!id) Vault.records.push(r);
      busy(form, true);
      Vault.persist().then(function () { closeSheet(); render(); toast('Saved to Safe'); })
        .catch(function (e) { busy(form, false); toast('Could not save: ' + e.message); });
    }
  };
  function busy(form, on) { var b = form.querySelector('[type=submit]'); if (b) { b.disabled = on; b.style.opacity = on ? 0.6 : 1; } }
  function afterUnlock() { if (ui.safePendingAdd) { ui.safePendingAdd = false; safeForm(null); } }

  /* ================= actions ================= */
  function ctxOf(el) { try { return JSON.parse(el.dataset.ctx || '{}'); } catch (e) { return {}; } }
  var actions = {
    openMenu: openMenu, closeMenu: closeMenu, back: back,
    openAdd: function () { closeMenu(); chooser(); },
    closeSheet: function () { closeSheet(); },
    choose: function (el) {
      var k = el.dataset.kind; closeSheet(true);
      if (k === 'task') taskForm(null, {});
      else if (k === 'note') newNote({});
      else if (k === 'safe') {
        if (Vault.unlocked()) safeForm(null);
        else { ui.safePendingAdd = Vault.exists(); go('safe'); toast(Vault.exists() ? 'Unlock Safe Storage to add a record' : 'Create a Safe password first'); }
      } else financeForm(null, k);
    },
    newTask: function (el) { taskForm(null, ctxOf(el)); },
    editTask: function (el) { var t = task(el.dataset.id); if (t) taskForm(t, {}); },
    toggleTask: function (el) { if (el.dataset.close) closeSheet(true); toggleTask(el.dataset.id); },
    deleteTask: function (el) {
      var t = task(el.dataset.id); if (!t || !confirm('Delete "' + t.title + '"?')) return;
      var idx = db.tasks.indexOf(t); db.tasks.splice(idx, 1); save(); closeSheet(); render();
      toast('Task deleted', 'Undo', function () { db.tasks.splice(idx, 0, t); save(); render(); });
    },
    formDate: function (el) {
      var form = el.closest('form'); var n = el.dataset.n;
      form.elements.date.value = n === '' ? '' : addDays(today(), +n);
      if (n !== '' && form.elements.list.value === 'inbox') form.elements.list.value = 'anytime';
    },
    addSub: function (el) {
      var form = el.closest('form'); var inp = $('#newSub', form); var v = inp.value.trim(); if (!v) { inp.focus(); return; }
      $('#subs', form).insertAdjacentHTML('beforeend', subRow({ title: v, done: false })); inp.value = ''; inp.focus();
    },
    removeSub: function (el) { var row = el.closest('[data-sub]'); if (row) row.remove(); },
    calView: function (el) { ui.calView = el.dataset.v; render(); },
    calShift: function (el) {
      var n = +el.dataset.n;
      ui.calDate = ui.calView === 'month' ? addMonths(ui.calDate, n) : addDays(ui.calDate, ui.calView === 'week' ? 7 * n : n);
      render();
    },
    calToday: function () { ui.calDate = today(); render(); },
    calPick: function (el) { ui.calDate = el.dataset.date; render(); },
    openDay: function (el) { ui.calDate = el.dataset.date; ui.calView = 'day'; render(); },
    kanbanBy: function (el) { ui.kanbanBy = el.dataset.v; render(); },
    projFilter: function (el) { ui.projFilter = el.dataset.v; render(); },
    newProject: function (el) { projectForm(null, el.dataset.area || (ui.projFilter !== 'all' ? ui.projFilter : 'personal')); },
    editProject: function (el) { var p = project(el.dataset.id); if (p) projectForm(p); },
    deleteProject: function (el) {
      var p = project(el.dataset.id); if (!p) return;
      var n = db.tasks.filter(function (t) { return t.project === p.id; }).length;
      if (!confirm('Delete project "' + p.name + '"?' + (n ? ' Its ' + n + ' tasks will be kept without a project.' : ''))) return;
      db.tasks.forEach(function (t) { if (t.project === p.id) { t.project = ''; t.area = p.area; } });
      db.notes.forEach(function (x) { if (x.project === p.id) x.project = ''; });
      db.projects = db.projects.filter(function (x) { return x.id !== p.id; });
      save(); closeSheet(); toast('Project deleted');
      if (ui.route.name === 'project') back(); else render();
    },
    newNote: function (el) { newNote({ project: el.dataset.project || '' }); },
    pinNote: function (el) { var n = byId(db.notes, el.dataset.id); if (!n) return; n.pinned = !n.pinned; save(); el.textContent = n.pinned ? 'Unpin' : 'Pin'; el.setAttribute('aria-pressed', String(n.pinned)); },
    deleteNote: function (el) {
      var n = byId(db.notes, el.dataset.id); if (!n || !confirm('Delete this note?')) return;
      db.notes = db.notes.filter(function (x) { return x.id !== n.id; }); save(); toast('Note deleted'); back();
    },
    noteToTasks: function (el) {
      var n = byId(db.notes, el.dataset.id); if (!n) return;
      var lines = n.body.split('\n').map(function (l) { return l.replace(/^\s*([-*•]|\d+[.)]|\[\s?\])\s*/, '').trim(); }).filter(Boolean);
      if (!lines.length) { toast('Write some lines first'); return; }
      if (!confirm('Create ' + lines.length + ' Inbox task' + (lines.length > 1 ? 's' : '') + ' from this note?')) return;
      var o = minOrder();
      lines.forEach(function (l, i) {
        db.tasks.push({ id: uid(), title: l.slice(0, 300), notes: 'From note: ' + (n.title || 'Untitled'), list: 'inbox', date: '', time: '', priority: 'medium', status: 'todo', done: false, completedAt: '', area: n.area || '', project: n.project || '', repeat: '', subtasks: [], order: o - lines.length + i, createdAt: Date.now() });
      });
      save(); toast(lines.length + ' tasks added to Inbox', 'View', function () { go('inbox'); });
    },
    newFinance: function (el) { financeForm(null, el.dataset.kind); },
    editFinance: function (el) { var r = byId(db.finance, el.dataset.id); if (r) financeForm(r); },
    deleteFinance: function (el) {
      if (!confirm('Delete this record?')) return;
      db.finance = db.finance.filter(function (x) { return x.id !== el.dataset.id; }); save(); closeSheet(); render(); toast('Record deleted');
    },
    finType: function (el) {
      var form = el.closest('form'); form.elements.type.value = el.dataset.v;
      $all('[data-act=finType]', form).forEach(function (b) { b.setAttribute('aria-pressed', String(b === el)); });
    },
    finPeriod: function (el) { ui.finPeriod = el.dataset.v; render(); },
    finShift: function (el) {
      var n = +el.dataset.n; var d = ui.finMonth + '-01';
      ui.finMonth = addMonths(d, ui.finPeriod === 'year' ? 12 * n : n).slice(0, 7); render();
    },
    newPurchase: function () { purchaseForm(null); },
    editPurchase: function (el) { var p = byId(db.purchases, el.dataset.id); if (p) purchaseForm(p); },
    deletePurchase: function (el) {
      if (!confirm('Delete this purchase?')) return;
      db.purchases = db.purchases.filter(function (x) { return x.id !== el.dataset.id; }); save(); closeSheet(); render(); toast('Purchase deleted');
    },
    newSafe: function () { if (Vault.unlocked()) safeForm(null); },
    editSafe: function (el) { if (!Vault.unlocked()) return; var r = byId(Vault.records, el.dataset.id); if (r) safeForm(r); },
    deleteSafe: function (el) {
      if (!Vault.unlocked() || !confirm('Delete this record?')) return;
      Vault.records = Vault.records.filter(function (x) { return x.id !== el.dataset.id; });
      Vault.persist().then(function () { closeSheet(); render(); toast('Record deleted'); });
    },
    safeReveal: function (el) { ui.revealed[el.dataset.id] = !ui.revealed[el.dataset.id]; render(); },
    safeCopy: function (el) {
      var r = Vault.unlocked() && byId(Vault.records, el.dataset.id); if (!r) return;
      copyText(r[el.dataset.f] || '').then(function () { toast('Copied. Clipboard clears in 30 s'); setTimeout(function () { copyText(' ').catch(function () {}); }, 30000); })
        .catch(function () { toast('Copy failed. Tap Show and copy manually.'); });
    },
    safeLock: function () { Vault.lock(); render(); toast('Safe locked'); },
    safeReset: function () {
      if (!confirm('Erase all Safe Storage records on this device? This cannot be undone.')) return;
      Vault.wipe(); render(); toast('Safe Storage erased');
    },
    exportData: function () {
      var blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' });
      var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'focus-backup-' + today() + '.json';
      document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
      toast('Backup exported (Safe Storage is not included)');
    },
    importData: function () { $('#importFile').click(); },
    resetDemo: function () {
      if (!confirm('Replace all tasks, projects, notes and money records with demo data?')) return;
      db = seedData(); save(); closeMenu(); ui.stack = []; ui.route = { name: 'home', id: '' };
      try { history.replaceState({ depth: 0 }, '', routeHash(ui.route)); } catch (e) { /* ignore */ }
      render(true); toast('Demo data restored');
    }
  };
  function newNote(opts) {
    var p = opts.project && project(opts.project);
    var n = { id: uid(), title: '', body: '', area: p ? p.area : '', project: opts.project || '', pinned: false, updatedAt: Date.now() };
    db.notes.push(n); save(); go('note', n.id);
    setTimeout(function () { var el = $('.title-in'); if (el) el.focus(); }, 30);
  }
  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text);
    return new Promise(function (res, rej) {
      var ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy') ? res() : rej(new Error('copy')); } catch (e) { rej(e); }
      ta.remove();
    });
  }

  /* ================= event wiring ================= */
  document.addEventListener('click', function (e) {
    if (dragJustEnded) { dragJustEnded = false; if (e.target.closest('[data-drag]')) return; }
    var el = e.target.closest('[data-act],[data-go]');
    if (!el) {
      if (e.target === sheetWrap) closeSheet();
      return;
    }
    if (el.disabled) return;
    if (Vault.unlocked()) Vault.touch();
    if (el.hasAttribute('data-go')) { e.preventDefault(); go(el.dataset.go, el.dataset.id || ''); return; }
    var fn = actions[el.dataset.act];
    if (fn) { e.preventDefault(); fn(el, e); }
  });
  document.addEventListener('submit', function (e) {
    var form = e.target; var fn = submitters[form.dataset.form];
    if (fn) { e.preventDefault(); fn(form); }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { if (sheetOpen()) closeSheet(); else if ($('#drawer').classList.contains('on')) closeMenu(); }
    if (e.key === 'Enter' && e.target.id === 'newSub') { e.preventDefault(); actions.addSub(e.target); }
  });
  var saveNoteSoon = debounce(function () { save(); var s = $('#noteSaved'); if (s) s.textContent = 'Saved'; }, 400);
  document.addEventListener('input', function (e) {
    var t = e.target;
    if (t.dataset.input) {
      ui[t.dataset.input] = t.value;
      if (t.dataset.input === 'noteQuery') { var tmp = document.createElement('div'); tmp.innerHTML = screens.notes(); $('#noteResults').innerHTML = $('#noteResults', tmp).innerHTML; }
      else render();
      return;
    }
    if (t.dataset.noteField) {
      var n = byId(db.notes, ui.route.id); if (!n) return;
      n[t.dataset.noteField] = t.value; n.updatedAt = Date.now();
      if (t.tagName === 'TEXTAREA') autosize(t);
      var s = $('#noteSaved'); if (s) s.textContent = 'Saving…';
      saveNoteSoon();
    }
  });
  document.addEventListener('change', function (e) {
    var t = e.target;
    if (t.dataset.noteField && t.tagName === 'SELECT') {
      var n = byId(db.notes, ui.route.id); if (!n) return;
      n[t.dataset.noteField] = t.value;
      if (t.dataset.noteField === 'project' && t.value) { var p = project(t.value); if (p) { n.area = p.area; var a = $('[data-note-field=area]'); if (a) a.value = p.area; } }
      n.updatedAt = Date.now(); save();
    }
    if (t.name === 'project' && t.form && t.form.dataset.form === 'task' && t.value) {
      var pr = project(t.value); if (pr) t.form.elements.area.value = pr.area;
    }
  });
  function autosize(ta) { ta.style.height = 'auto'; ta.style.height = Math.max(ta.scrollHeight, window.innerHeight * 0.5) + 'px'; }

  /* ================= drag & drop (pointer events: touch, pen, mouse) ================= */
  var drag = null, dragJustEnded = false;
  document.addEventListener('pointerdown', function (e) {
    var grip = e.target.closest('[data-drag]');
    if (!grip || (e.pointerType === 'mouse' && e.button !== 0)) return;
    var item = grip.closest('[data-sort-item]'); var list = item && item.parentElement;
    if (!item || !list || !list.hasAttribute('data-sort-list')) return;
    e.preventDefault();
    var rect = item.getBoundingClientRect();
    var ghost = item.cloneNode(true);
    ghost.classList.add('drag-ghost'); ghost.removeAttribute('data-sort-item');
    ghost.style.width = rect.width + 'px'; ghost.style.left = rect.left + 'px'; ghost.style.top = rect.top + 'px';
    document.body.appendChild(ghost);
    item.classList.add('drag-placeholder');
    item.style.opacity = '0.35';
    document.body.classList.add('dragging');
    drag = { id: item.dataset.sortItem, item: item, ghost: ghost, group: list.dataset.sortGroup, from: list, offY: e.clientY - rect.top, offX: e.clientX - rect.left, x: e.clientX, y: e.clientY, pid: e.pointerId, moved: false, startY: e.clientY, startX: e.clientX };
    if (navigator.vibrate) { try { navigator.vibrate(10); } catch (err) { /* ignore */ } }
    requestAnimationFrame(autoScroll);
  });
  document.addEventListener('pointermove', function (e) {
    if (!drag || e.pointerId !== drag.pid) return;
    e.preventDefault();
    drag.x = e.clientX; drag.y = e.clientY;
    if (Math.abs(drag.y - drag.startY) > 3 || Math.abs(drag.x - drag.startX) > 3) drag.moved = true;
    placeGhost(); placeItem();
  }, { passive: false });
  document.addEventListener('touchmove', function (e) { if (drag) e.preventDefault(); }, { passive: false });
  function placeGhost() { drag.ghost.style.left = (drag.x - drag.offX) + 'px'; drag.ghost.style.top = (drag.y - drag.offY) + 'px'; }
  function placeItem() {
    var under = document.elementFromPoint(drag.x, drag.y);
    if (!under) return;
    var list = under.closest('[data-sort-list]');
    if (!list || list.dataset.sortGroup !== drag.group) return;
    if (drag.group === 'tasks' && list !== drag.from) return;
    var kids = Array.prototype.filter.call(list.children, function (c) { return c.hasAttribute('data-sort-item') && c !== drag.item; });
    var before = null;
    for (var i = 0; i < kids.length; i++) { var r = kids[i].getBoundingClientRect(); if (drag.y < r.top + r.height / 2) { before = kids[i]; break; } }
    if (before) { if (drag.item.nextSibling !== before || drag.item.parentElement !== list) list.insertBefore(drag.item, before); }
    else if (list.lastElementChild !== drag.item) list.appendChild(drag.item);
  }
  function autoScroll() {
    if (!drag) return;
    var edge = 80, speed = 0;
    if (drag.y < edge + 50) speed = -Math.ceil((edge + 50 - drag.y) / 6);
    else if (drag.y > window.innerHeight - edge - 70) speed = Math.ceil((drag.y - (window.innerHeight - edge - 70)) / 6);
    if (speed) window.scrollBy(0, speed);
    if (drag.group === 'kanban') {
      var board = $('#board');
      if (board) {
        /* Hold at an edge to move the board one column at a time (predictable on narrow screens). */
        var zone = 44, dir = drag.x < zone ? -1 : drag.x > window.innerWidth - zone ? 1 : 0;
        var now = Date.now();
        if (!dir) drag.edgeSince = 0;
        else {
          if (!drag.edgeSince) drag.edgeSince = now;
          if (now - drag.edgeSince > 380 && now - (drag.lastJump || 0) > 1000) {
            var col = board.querySelector('.column');
            var step = col ? col.getBoundingClientRect().width + 12 : 300;
            try { board.scrollBy({ left: dir * step, behavior: 'smooth' }); } catch (e) { board.scrollLeft += dir * step; }
            drag.lastJump = now;
          }
        }
      }
    }
    if (speed || drag.group === 'kanban') placeItem();
    requestAnimationFrame(autoScroll);
  }
  function endDrag(e, cancelled) {
    if (!drag || (e && e.pointerId !== drag.pid)) return;
    var d = drag; drag = null;
    d.ghost.remove(); d.item.classList.remove('drag-placeholder'); d.item.style.opacity = '';
    document.body.classList.remove('dragging');
    dragJustEnded = true; setTimeout(function () { dragJustEnded = false; }, 350);
    if (cancelled || !d.moved) { render(); return; }
    var list = d.item.parentElement;
    var ids = Array.prototype.filter.call(list.children, function (c) { return c.hasAttribute('data-sort-item'); }).map(function (c) { return c.dataset.sortItem; });
    if (d.group === 'kanban') {
      var t = task(d.id); var key = list.dataset.sortList;
      if (t) {
        applyKanbanKey(t, key);
      }
      reorderIds(ids);
      save(); render();
      if (t && list !== d.from) toast('Moved to ' + label(kanbanCols(), key));
    } else {
      reorderIds(ids); save(); render();
    }
  }
  document.addEventListener('pointerup', function (e) { endDrag(e, false); });
  document.addEventListener('pointercancel', function (e) { endDrag(e, true); });

  /* ================= menu, toast, render ================= */
  function openMenu() {
    renderDrawer();
    $('#drawer').classList.add('on'); $('#shade').classList.add('on');
    $('#drawer').setAttribute('aria-hidden', 'false'); $('#menuBtn').setAttribute('aria-expanded', 'true');
    var cur = $('#drawer [aria-current="page"]') || $('#drawer .nav-link'); if (cur) { try { cur.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
  }
  function closeMenu() {
    var d = $('#drawer'); if (!d || !d.classList.contains('on')) return;
    d.classList.remove('on'); $('#shade').classList.remove('on');
    d.setAttribute('aria-hidden', 'true'); $('#menuBtn').setAttribute('aria-expanded', 'false');
  }
  function renderDrawer() {
    var counts = { inbox: sel.inbox().length, today: sel.today().length, upcoming: sel.upcoming().length, anytime: sel.anytime().length, someday: sel.someday().length };
    var active = ROUTES[ui.route.name].sub ? { note: 'notes', area: 'areas', project: 'projects' }[ui.route.name] : ui.route.name;
    $('#drawerNav').innerHTML = DRAWER_GROUPS.map(function (g) {
      return '<div class="group">' + g[0] + '</div>' + g[1].map(function (r) {
        return '<button class="nav-link" data-go="' + r + '"' + (r === active ? ' aria-current="page"' : '') + '>' + ICON[ROUTES[r].icon] + '<span>' + esc(ROUTES[r].title) + '</span>' + (counts[r] ? '<span class="badge">' + counts[r] + '</span>' : '') + '</button>';
      }).join('');
    }).join('');
  }
  var toastTimer, toastFn;
  function toast(msg, btnText, fn) {
    var el = $('#toast'); if (!el) return;
    $('#toastMsg').textContent = msg;
    var b = $('#toastBtn');
    if (btnText && fn) { b.hidden = false; b.textContent = btnText; toastFn = fn; } else { b.hidden = true; toastFn = null; }
    el.classList.add('on');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { el.classList.remove('on'); toastFn = null; }, btnText ? 5000 : 2600);
  }

  function routeTitle(r) {
    if (r.name === 'project') { var p = project(r.id); return p ? p.name : 'Project'; }
    if (r.name === 'note') { var n = byId(db.notes, r.id); return n && n.title ? n.title : 'Note'; }
    if (r.name === 'area') return label(areasList(), r.id) || 'Area';
    return ROUTES[r.name].title;
  }
  function render(resetScroll) {
    var r = ui.route; var main = $('#screen');
    var focusKey = document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.input : null;
    var caret = focusKey ? document.activeElement.selectionStart : 0;
    var html;
    try { html = screens[r.name](r.id); }
    catch (err) { console.error(err); html = head('Something went wrong') + '<div class="empty">' + esc(err.message) + '</div><button class="btn block" style="margin-top:12px" data-act="resetDemo">Reset demo data</button>'; }
    main.innerHTML = html;
    main.setAttribute('data-route', r.name);
    $('#backBtn').disabled = !(ui.stack.length || r.name !== 'home');
    var tabRoute = ROUTES[r.name].sub ? { project: 'projects' }[r.name] : r.name;
    $all('.tab[data-go]').forEach(function (b) { if (b.dataset.go === tabRoute) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    var title = routeTitle(r);
    $('#miniTitle').textContent = title;
    document.title = title + ' · Focus';
    if ($('#drawer').classList.contains('on')) renderDrawer();
    if (r.name === 'note') { var ta = $('.body-in'); if (ta) autosize(ta); }
    if (focusKey) { var inp = $('[data-input="' + focusKey + '"]'); if (inp) { inp.focus(); try { inp.setSelectionRange(caret, caret); } catch (e) { /* ignore */ } } }
    if (resetScroll) { window.scrollTo(0, 0); try { main.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
  }
  window.addEventListener('scroll', function () { $('#topbar').classList.toggle('scrolled', window.scrollY > 44); }, { passive: true });


  /* ================= v1.1: data model ================= */
  APP_VERSION = '1.1.0';
  var DEFAULT_SETTINGS = {
    theme: 'system', start: 'home', currency: 'USD', voiceLang: 'ru-RU', autoRates: true,
    rates: { RUB: 95, IDR: 16300, EUR: 0.92 },
    widgets: { clocks: true, rates: true, weather: true, traffic: true },
    assistants: ['Assistant'], safeAutoLock: 0
  };
  function normalize2(d) {
    if (!Array.isArray(d.areas) || !d.areas.length) d.areas = [{ id: 'personal', name: 'Personal' }, { id: 'business', name: 'Business' }];
    ['headings', 'bookmarks', 'accounts', 'balances'].forEach(function (k) { if (!Array.isArray(d[k])) d[k] = []; });
    var s = d.settings || {};
    d.settings = Object.assign({}, DEFAULT_SETTINGS, s);
    d.settings.rates = Object.assign({}, DEFAULT_SETTINGS.rates, s.rates || {});
    d.settings.widgets = Object.assign({}, DEFAULT_SETTINGS.widgets, s.widgets || {});
    if (!Array.isArray(d.settings.assistants)) d.settings.assistants = ['Assistant'];
    d.tasks.forEach(function (t) { if (!Array.isArray(t.photos)) t.photos = []; if (t.delegatedTo == null) t.delegatedTo = ''; });
    return d;
  }
  var _normalize = normalize;
  normalize = function (d) { return normalize2(_normalize(d)); };
  var _seedData = seedData;
  seedData = function () {
    var d = normalize2(_seedData());
    var t = today();
    d.headings = [{ id: 'h1', title: 'Admin', order: 5.5 }];
    d.tasks[3].delegatedTo = 'Assistant';
    d.bookmarks = [
      { id: 'bm1', title: 'Yandex Maps: Moscow traffic', url: 'https://yandex.ru/maps/213/moscow/probki/', tag: 'Moscow', note: '', createdAt: Date.now() },
      { id: 'bm2', title: 'Open-Meteo', url: 'https://open-meteo.com/', tag: 'Tools', note: 'Weather data source', createdAt: Date.now() },
      { id: 'bm3', title: 'GitHub', url: 'https://github.com/', tag: 'Tools', note: '', createdAt: Date.now() }
    ];
    d.accounts = [
      { id: 'a1', name: 'Wallet cash', category: 'cash', currency: 'USD' },
      { id: 'a2', name: 'Main bank (USD)', category: 'bank', currency: 'USD' },
      { id: 'a3', name: 'Bank (RUB)', category: 'bank', currency: 'RUB' },
      { id: 'a4', name: 'Crypto wallet (USDT)', category: 'crypto', currency: 'USD' },
      { id: 'a5', name: 'Credit card', category: 'mydebt', currency: 'USD' },
      { id: 'a6', name: 'Loan to a friend', category: 'theirdebt', currency: 'USD' },
      { id: 'a7', name: 'Apartment', category: 'asset', currency: 'USD' }
    ];
    var m0 = addMonths(t.slice(0, 7) + '-01', -2), m1 = addMonths(t.slice(0, 7) + '-01', -1), m2 = t.slice(0, 7) + '-01';
    var vals = { a1: [900, 1100, 1200], a2: [15000, 16500, 18000], a3: [380000, 420000, 450000], a4: [4000, 4600, 5000], a5: [-3100, -2700, -2300], a6: [1500, 1000, 1000], a7: [240000, 245000, 250000] };
    d.balances = [];
    [m0, m1, m2].forEach(function (date, i) { Object.keys(vals).forEach(function (a) { d.balances.push({ id: uid(), account: a, date: date, amount: vals[a][i] }); }); });
    return d;
  };

  /* ================= routes & icons ================= */
  ICON.urgent = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5l9 16H3z"/><path d="M12 10v4.5M12 17.2v.3"/></svg>';
  ICON.followup = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4.5V9h4.5M12 8v4.5l3 2"/></svg>';
  ICON.delegated = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="3.5"/><path d="M3 19.5c.9-3.2 3.2-4.8 6-4.8 1.6 0 3 .5 4.1 1.5M15.5 13.5h6M18.5 10.5l3 3-3 3"/></svg>';
  ICON.bookmarks = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round" aria-hidden="true"><path d="M6.5 3.5h11v17l-5.5-4-5.5 4z"/></svg>';
  ICON.settings = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2.2"/><circle cx="8" cy="17" r="2.2"/></svg>';
  ICON.mic = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" aria-hidden="true"><rect x="9" y="3.5" width="6" height="11" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v2.5"/></svg>';
  ICON.camera = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round" aria-hidden="true"><path d="M4 8.5a2 2 0 0 1 2-2h2l1.5-2h5L16 6.5h2a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><circle cx="12" cy="13" r="3.5"/></svg>';
  Object.assign(ROUTES, {
    urgent: { title: 'Urgent', icon: 'urgent' }, followup: { title: 'Follow-up', icon: 'followup' },
    delegated: { title: 'Delegated', icon: 'delegated' }, bookmarks: { title: 'Bookmarks', icon: 'bookmarks' },
    settings: { title: 'Settings', icon: 'settings' }
  });
  ROUTES.finance.title = 'Money';
  DRAWER_GROUPS = [
    ['Plan', ['home', 'inbox', 'today', 'urgent', 'upcoming', 'anytime', 'someday', 'followup', 'logbook']],
    ['Views', ['calendar', 'kanban']],
    ['Organize', ['areas', 'projects', 'notes', 'bookmarks', 'delegated']],
    ['Private', ['safe']],
    ['Money', ['finance', 'purchases']],
    ['App', ['settings']]
  ];
  STATUSES[2][1] = 'Follow-up';
  SAFE_TYPES = ['Login', 'Address', 'Document', 'Bank card', 'Bank account', 'Safenote'];
  Object.assign(ui, { moneyTab: 'overview', balCur: '', bmQuery: '', bmTag: '', safeView: 'all', safeTag: '' });
  sel.urgent = function () { return db.tasks.filter(function (t) { return isOpen(t) && t.priority === 'urgent'; }).sort(function (a, b) { return ((a.date || '9') < (b.date || '9') ? -1 : 1) || a.order - b.order; }); };

  /* ================= market & weather (cached) ================= */
  function readCache(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }
  function writeCache(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ } }
  function fetchJson(url) { return fetch(url, { cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }); }
  var FRESH = 10 * 60 * 1000;
  function refreshMarket(force) {
    var c = readCache('focus.market');
    if (!force && c && Date.now() - c.t < FRESH) return Promise.resolve(c);
    return fetchJson('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,tether&vs_currencies=usd,rub,idr,eur').then(function (j) {
      var tu = (j.tether && j.tether.usd) || 1;
      var m = { t: Date.now(), btcUsd: j.bitcoin.usd, usdtRub: j.tether.rub, rates: { RUB: j.tether.rub / tu, IDR: j.tether.idr / tu, EUR: j.tether.eur / tu } };
      writeCache('focus.market', m); return m;
    });
  }
  function refreshWeather(force) {
    var c = readCache('focus.weather');
    if (!force && c && Date.now() - c.t < FRESH) return Promise.resolve(c);
    return fetchJson('https://api.open-meteo.com/v1/forecast?latitude=55.7558&longitude=37.6173&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m&wind_speed_unit=ms&timezone=Europe%2FMoscow').then(function (j) {
      var w = { t: Date.now(), temp: j.current.temperature_2m, feels: j.current.apparent_temperature, code: j.current.weather_code, wind: j.current.wind_speed_10m };
      writeCache('focus.weather', w); return w;
    });
  }
  function weatherText(code) {
    if (code === 0) return 'Clear'; if (code <= 2) return 'Partly cloudy'; if (code === 3) return 'Overcast';
    if (code === 45 || code === 48) return 'Fog'; if (code >= 51 && code <= 57) return 'Drizzle'; if (code >= 61 && code <= 67) return 'Rain';
    if (code >= 71 && code <= 77) return 'Snow'; if (code >= 80 && code <= 82) return 'Showers'; if (code >= 85 && code <= 86) return 'Snow showers';
    if (code >= 95) return 'Thunderstorm'; return '';
  }
  function getRates() {
    var m = readCache('focus.market'), S = db.settings;
    var r = (S.autoRates && m && m.rates) ? m.rates : S.rates;
    return { USD: 1, RUB: +r.RUB || S.rates.RUB, IDR: +r.IDR || S.rates.IDR, EUR: +r.EUR || S.rates.EUR };
  }
  function convert(amount, from, to) { var r = getRates(); return (Number(amount) || 0) / (r[from] || 1) * (r[to] || 1); }
  function ago(t) { var m = Math.round((Date.now() - t) / 60000); return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : Math.round(m / 60) + ' h ago'; }

  /* ================= Home ================= */
  var CLOCKS = [['Bali', 'Asia/Makassar'], ['Moscow', 'Europe/Moscow'], ['New York', 'America/New_York'], ['Los Angeles', 'America/Los_Angeles']];
  function clocksHtml() {
    return CLOCKS.map(function (c) {
      var time = '', day = '';
      try {
        time = new Intl.DateTimeFormat('en-GB', { timeZone: c[1], hour: '2-digit', minute: '2-digit' }).format(new Date());
        day = new Intl.DateTimeFormat('en-US', { timeZone: c[1], weekday: 'short' }).format(new Date());
      } catch (e) { time = '—'; }
      return '<div class="clock"><span class="city">' + esc(c[0]) + '</span><span class="ctime">' + esc(time) + '</span><span class="cday">' + esc(day) + '</span></div>';
    }).join('');
  }
  function widgetsHtml() {
    var W = db.settings.widgets, m = readCache('focus.market'), w = readCache('focus.weather'), out = '';
    if (W.rates) {
      out += '<div class="widget"><span class="wl">USDT → RUB</span><span class="wv" id="wUsdt">' + (m ? esc(m.usdtRub.toFixed(2)) + ' ₽' : '…') + '</span><span class="ws" id="wMarketT">' + (m ? 'CoinGecko · ' + ago(m.t) : 'Loading') + '</span></div>';
      out += '<div class="widget"><span class="wl">BTC → USD</span><span class="wv" id="wBtc">' + (m ? esc(fmtMoney(Math.round(m.btcUsd), 'USD')) : '…') + '</span><span class="ws">Bitcoin price</span></div>';
    }
    if (W.weather) out += '<div class="widget"><span class="wl">Moscow weather</span><span class="wv" id="wTemp">' + (w ? (w.temp > 0 ? '+' : '') + Math.round(w.temp) + '°' : '…') + '</span><span class="ws" id="wCond">' + (w ? esc(weatherText(w.code)) + ' · wind ' + Math.round(w.wind) + ' m/s' : 'Loading') + '</span></div>';
    if (W.traffic) out += '<a class="widget" href="https://yandex.ru/maps/213/moscow/probki/" target="_blank" rel="noopener noreferrer"><span class="wl">Moscow traffic</span><span class="wv">Yandex ↗</span><span class="ws">Opens live score</span></a>';
    return out ? '<div class="widgets">' + out + '</div>' : '';
  }
  function updateWidgets() {
    if (ui.route.name !== 'home') return;
    var W = db.settings.widgets;
    if (W.rates) refreshMarket().then(function (m) {
      var a = $('#wUsdt'), b = $('#wBtc'), c = $('#wMarketT');
      if (a) a.textContent = m.usdtRub.toFixed(2) + ' ₽'; if (b) b.textContent = fmtMoney(Math.round(m.btcUsd), 'USD'); if (c) c.textContent = 'CoinGecko · ' + ago(m.t);
    }).catch(function () { var c = $('#wMarketT'); if (c) c.textContent = 'Offline: rates unavailable'; });
    if (W.weather) refreshWeather().then(function (w) {
      var a = $('#wTemp'), b = $('#wCond');
      if (a) a.textContent = (w.temp > 0 ? '+' : '') + Math.round(w.temp) + '°'; if (b) b.textContent = weatherText(w.code) + ' · wind ' + Math.round(w.wind) + ' m/s';
    }).catch(function () { var b = $('#wCond'); if (b) b.textContent = 'Offline: weather unavailable'; });
  }
  setInterval(function () { var c = $('#clocks'); if (c) c.innerHTML = clocksHtml(); }, 20000);
  setInterval(function () { if (!document.hidden) updateWidgets(); }, FRESH);

  screens.home = function () {
    var d = new Date(), t = today(), S = db.settings;
    var html = head('Home', esc(DOW[d.getDay()] + ', ' + MONTHS[d.getMonth()] + ' ' + d.getDate()));
    if (S.widgets.clocks) html += '<div class="clocks" id="clocks">' + clocksHtml() + '</div>';
    html += widgetsHtml();
    html += '<div class="tiles five">' + tile('today', 'Today', sel.today().length) + tile('urgent', 'Urgent', sel.urgent().length, sel.urgent().length > 0) +
      tile('inbox', 'Inbox', sel.inbox().length) + tile('someday', 'Someday', sel.someday().length) + tile('followup', 'Follow-up', sel.waiting().length) +
      tile('delegated', 'Delegated', db.tasks.filter(function (x) { return isOpen(x) && x.delegatedTo; }).length) + '</div>';
    html += '<div class="card pad safe-quick"><span class="row">' + ICON.lock + '<span><strong>Safe notes</strong><span class="muted small" style="display:block">' + (Vault.unlocked() ? (Vault.records.length + ' records · unlocked') : (Vault.exists() ? 'Locked' : 'Not set up')) + '</span></span></span><span class="row"><button class="tiny-btn" data-go="safe">Open</button><button class="tiny-btn" data-act="homeSafeAdd">+ Add</button></span></div>';
    var top = db.tasks.filter(function (x) { return isOpen(x) && x.list !== 'someday' && (x.priority === 'urgent' || x.priority === 'high') && (!x.date || x.date <= addDays(t, 2)); })
      .sort(function (a, b) { return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || ((a.date || '9') < (b.date || '9') ? -1 : 1); }).slice(0, 5);
    html += section('Top priorities', top.length) + taskList(top, 'home-top', 'No urgent or high-priority tasks. Nice.', { sortable: false });
    var timed = sel.onDate(t).filter(function (x) { return x.time; });
    html += section('Daily planner', null, '<button class="link-btn" data-go="calendar">View calendar</button>');
    html += timed.length ? '<div class="card pad stack">' + timed.map(function (x) { return '<button class="tblock' + (x.done ? ' done' : '') + '" data-act="editTask" data-id="' + esc(x.id) + '"><div class="t">' + esc(x.time) + '</div>' + esc(x.title) + '</button>'; }).join('') + '</div>' : '<div class="empty">Nothing scheduled with a time today.</div>';
    var es = earnedSpent(); var cur = S.currency;
    html += section('Money this month', null, '<button class="link-btn" data-go="finance">Open</button>');
    html += '<div class="grid2"><div class="tile static"><div class="l">Earned</div><div class="n pos money">' + esc(fmtMoney(es.earned, cur)) + '</div></div><div class="tile static"><div class="l">Spent</div><div class="n money">' + esc(fmtMoney(es.spent, cur)) + '</div></div></div>';
    return html;
  };
  function earnedSpent() {
    var cur = db.settings.currency, m = today().slice(0, 7), e = 0, s = 0;
    db.finance.forEach(function (r) { if (r.type === 'actual' && r.date && r.date.slice(0, 7) === m) { var v = convert(r.amount, r.currency, cur); if (r.kind === 'income') e += v; else s += v; } });
    return { earned: Math.round(e), spent: Math.round(s) };
  }
  screens.urgent = function () { return head('Urgent', 'Every open task marked Urgent.') + taskList(sel.urgent(), 'urgent', 'No urgent tasks.') + addTaskBtn({ list: 'anytime' }, 'Add task'); };
  screens.followup = function () { return head('Follow-up', 'Tasks waiting on someone else.') + taskList(sel.waiting(), 'followup', 'Nothing to follow up on.'); };

  /* ================= Inbox section lines ================= */
  function headingRow(h) {
    return '<div class="heading-row" data-sort-item="' + esc(h.id) + '"><button class="grip" data-drag aria-label="Drag section ' + esc(h.title) + '">' + ICON.grip + '</button><button class="heading-btn" data-act="editHeading" data-id="' + esc(h.id) + '"><span>' + esc(h.title) + '</span></button></div>';
  }
  screens.inbox = function () {
    var items = sel.inbox().map(function (t) { return { o: t.order, html: taskRow(t) }; })
      .concat(db.headings.map(function (h) { return { o: h.order, html: headingRow(h) }; })).sort(function (a, b) { return a.o - b.o; });
    return head('Inbox', 'New tasks land here. Add section lines to group them.') +
      (items.length ? '<div class="list" data-sort-list="inbox" data-sort-group="tasks">' + items.map(function (x) { return x.html; }).join('') + '</div>' : '<div class="empty">Inbox is empty. Tap + to capture a task.</div>') +
      '<div class="btn-row" style="margin-top:12px"><button class="btn ghost" data-act="newTask" data-ctx="{}">+ Task</button><button class="btn ghost" data-act="newHeading">+ Section line</button></div>';
  };
  function headingForm(h) {
    openSheet(h ? 'Edit section line' : 'New section line', '<form data-form="heading" data-id="' + esc(h ? h.id : '') + '" novalidate>' +
      '<label class="field"><span>Section name</span><input name="title" value="' + esc(h ? h.title : '') + '" required maxlength="80" autofocus placeholder="e.g. Calls, Errands"></label><p class="hint" id="headErr" role="alert" style="color:var(--bad)"></p>' +
      '<div class="actions"><button class="btn block" type="submit">Save</button>' + (h ? '<button type="button" class="btn danger block" data-act="deleteHeading" data-id="' + esc(h.id) + '">Delete line (tasks stay)</button>' : '') + '</div></form>');
  }
  submitters.heading = function (form) {
    var title = val(form, 'title'); if (!title) { $('#headErr').textContent = 'Name the section.'; return; }
    var h = form.dataset.id ? byId(db.headings, form.dataset.id) : null;
    if (h) h.title = title; else db.headings.push({ id: uid(), title: title, order: minOrder() - 1 });
    save(); closeSheet(); render(); toast(h ? 'Saved' : 'Section line added. Drag it into place.');
  };
  actions.newHeading = function () { headingForm(null); };
  actions.editHeading = function (el) { var h = byId(db.headings, el.dataset.id); if (h) headingForm(h); };
  actions.deleteHeading = function (el) { db.headings = db.headings.filter(function (x) { return x.id !== el.dataset.id; }); save(); closeSheet(); render(); toast('Section line deleted'); };

  /* ================= Areas: create, rename, delete ================= */
  var _areas = screens.areas;
  screens.areas = function () { return _areas() + '<button class="btn ghost block" style="margin-top:12px" data-act="newArea">+ New area</button>'; };
  var _area = screens.area;
  screens.area = function (id) {
    var html = _area(id);
    if (!byId(db.areas, id)) return html;
    return html + '<div class="btn-row" style="margin-top:18px"><button class="btn plain" data-act="editArea" data-id="' + esc(id) + '">Rename area</button><button class="btn danger" data-act="deleteArea" data-id="' + esc(id) + '">Delete area</button></div>';
  };
  function areaForm(a) {
    openSheet(a ? 'Rename area' : 'New area', '<form data-form="area" data-id="' + esc(a ? a.id : '') + '" novalidate><label class="field"><span>Area name</span><input name="name" value="' + esc(a ? a.name : '') + '" required maxlength="40" autofocus placeholder="e.g. Family, Health"></label><p class="hint" id="areaErr" role="alert" style="color:var(--bad)"></p><div class="actions"><button class="btn block" type="submit">Save</button></div></form>');
  }
  submitters.area = function (form) {
    var name = val(form, 'name'); if (!name) { $('#areaErr').textContent = 'Name the area.'; return; }
    var a = form.dataset.id ? byId(db.areas, form.dataset.id) : null;
    if (a) a.name = name; else { a = { id: 'area_' + uid(), name: name }; db.areas.push(a); }
    save(); closeSheet(); render(); toast('Area saved');
  };
  actions.newArea = function () { areaForm(null); };
  actions.editArea = function (el) { var a = byId(db.areas, el.dataset.id); if (a) areaForm(a); };
  actions.deleteArea = function (el) {
    var id = el.dataset.id;
    if (db.areas.length <= 1) { toast('Keep at least one area'); return; }
    if (db.projects.some(function (p) { return p.area === id; })) { toast('Move or delete this area’s projects first'); return; }
    if (!confirm('Delete this area? Its tasks and notes will have no area.')) return;
    db.areas = db.areas.filter(function (a) { return a.id !== id; });
    db.tasks.forEach(function (t) { if (t.area === id) t.area = ''; }); db.notes.forEach(function (n) { if (n.area === id) n.area = ''; });
    save(); toast('Area deleted'); back();
  };

  /* ================= Kanban: status, priority, area, project ================= */
  function kanbanCols() {
    var by = ui.kanbanBy;
    if (by === 'status') return STATUSES;
    if (by === 'priority') return PRIORITIES;
    if (by === 'area') return areasList().concat([['_none', 'No area']]);
    return db.projects.filter(function (p) { return p.status !== 'completed'; }).sort(byOrder).map(function (p) { return [p.id, p.name]; }).concat([['_none', 'No project']]);
  }
  function kanbanMatch(t, key) {
    var by = ui.kanbanBy;
    if (by === 'status') return key === 'done' ? (t.done && t.completedAt >= addDays(today(), -14)) : (!t.done && t.status === key);
    if (t.done) return false;
    if (by === 'priority') return t.priority === key;
    if (by === 'area') return (taskArea(t) || '_none') === key;
    return (t.project || '_none') === key;
  }
  function applyKanbanKey(t, key) {
    var by = ui.kanbanBy;
    if (by === 'status') setTaskStatus(t, key);
    else if (by === 'priority') t.priority = key;
    else if (by === 'area') { var a = key === '_none' ? '' : key; var p = t.project && project(t.project); if (p && p.area !== a) t.project = ''; t.area = a; }
    else if (key === '_none') { if (t.project) { t.area = taskArea(t); t.project = ''; } }
    else { var pr = project(key); if (pr) { t.project = key; t.area = pr.area; } }
  }
  screens.kanban = function () {
    var by = ui.kanbanBy;
    var html = head('Kanban', 'Drag cards by the handle. Hold at the edge to scroll.');
    html += '<div class="seg" role="group" aria-label="Group by">' + [['status', 'Status'], ['priority', 'Priority'], ['area', 'Area'], ['project', 'Project']].map(function (x) {
      return '<button data-act="kanbanBy" data-v="' + x[0] + '" aria-pressed="' + (by === x[0]) + '">' + x[1] + '</button>';
    }).join('') + '</div><div class="board" id="board">';
    kanbanCols().forEach(function (c) {
      var ts = db.tasks.filter(function (t) { return kanbanMatch(t, c[0]); }).sort(byOrder);
      html += '<section class="column" aria-label="' + esc(c[1]) + '"><h3>' + esc(c[1]) + '<span class="muted">' + ts.length + '</span></h3><div class="cards" data-sort-list="' + esc(c[0]) + '" data-sort-group="kanban">' +
        ts.map(function (t) { return '<div class="kcard" data-sort-item="' + esc(t.id) + '"><button class="grip" data-drag aria-label="Drag ' + esc(t.title) + '">' + ICON.grip + '</button><button class="task-body" data-act="editTask" data-id="' + esc(t.id) + '"><span class="task-title">' + esc(t.title) + '</span>' + taskMeta(t) + '</button></div>'; }).join('') + '</div></section>';
    });
    return html + '</div>';
  };

  /* ================= task meta: photos & delegation ================= */
  var _taskMeta = taskMeta;
  taskMeta = function (t, opts) {
    var h = _taskMeta(t, opts), extra = '';
    if (t.delegatedTo) extra += '<span class="chip accent">→ ' + esc(t.delegatedTo) + '</span>';
    if (t.photos && t.photos.length) extra += '<span>📷 ' + t.photos.length + '</span>';
    return extra ? h.replace(/<\/span>$/, extra + '</span>') : h;
  };

  /* ================= photos (IndexedDB) ================= */
  var PhotoDB = {
    open: function () {
      if (this.p) return this.p;
      this.p = new Promise(function (res, rej) {
        var r = indexedDB.open('focus-photos', 1);
        r.onupgradeneeded = function () { r.result.createObjectStore('photos'); };
        r.onsuccess = function () { res(r.result); }; r.onerror = function () { rej(r.error); };
      });
      return this.p;
    },
    tx: function (mode, fn) {
      return this.open().then(function (d) {
        return new Promise(function (res, rej) {
          var tx = d.transaction('photos', mode); var req = fn(tx.objectStore('photos'));
          tx.oncomplete = function () { res(req && req.result); }; tx.onerror = function () { rej(tx.error); };
        });
      });
    },
    /* Bytes, not Blob: Safari can't keep Blobs in IndexedDB in private mode. */
    put: function (id, blob) {
      var self = this;
      var bytes = blob.arrayBuffer ? blob.arrayBuffer() : new Promise(function (res, rej) { var fr = new FileReader(); fr.onload = function () { res(fr.result); }; fr.onerror = function () { rej(fr.error); }; fr.readAsArrayBuffer(blob); });
      return bytes.then(function (buf) { return self.tx('readwrite', function (s) { return s.put({ type: blob.type || 'image/jpeg', bytes: buf }, id); }); });
    },
    get: function (id) {
      return this.tx('readonly', function (s) { return s.get(id); }).then(function (v) {
        if (!v) return null; if (v instanceof Blob) return v; return new Blob([v.bytes], { type: v.type });
      });
    },
    del: function (id) { return this.tx('readwrite', function (s) { return s.delete(id); }); },
    keys: function () { return this.tx('readonly', function (s) { return s.getAllKeys(); }); }
  };
  function resizeImage(file) {
    return new Promise(function (res, rej) {
      var img = new Image(), url = URL.createObjectURL(file);
      img.onload = function () {
        var max = 1600, w = img.naturalWidth, h = img.naturalHeight, k = Math.min(1, max / Math.max(w, h));
        var c = document.createElement('canvas'); c.width = Math.round(w * k); c.height = Math.round(h * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
        c.toBlob(function (b) { if (b) res(b); else rej(new Error('Could not process photo')); }, 'image/jpeg', 0.82);
      };
      img.onerror = function () { URL.revokeObjectURL(url); rej(new Error('Not an image')); };
      img.src = url;
    });
  }
  function appendThumb(container, id) {
    container.insertAdjacentHTML('beforeend', '<div class="thumb" data-photo="' + esc(id) + '"><button type="button" class="thumb-img" data-act="viewPhoto" data-id="' + esc(id) + '" aria-label="View photo"><img alt=""></button><button type="button" class="thumb-x" data-act="removePhoto" aria-label="Remove photo">✕</button></div>');
    var img = container.lastElementChild.querySelector('img');
    PhotoDB.get(id).then(function (b) { if (b) img.src = URL.createObjectURL(b); }).catch(function () { /* ignore */ });
  }
  actions.removePhoto = function (el) { var t = el.closest('[data-photo]'); if (t) t.remove(); };
  actions.viewPhoto = function (el) {
    PhotoDB.get(el.dataset.id).then(function (b) {
      if (!b) return;
      var v = document.createElement('div'); v.className = 'viewer'; v.setAttribute('data-act', 'closeViewer');
      v.innerHTML = '<img alt="Task photo"><span class="viewer-x">Close</span>'; v.querySelector('img').src = URL.createObjectURL(b);
      document.body.appendChild(v);
    });
  };
  actions.closeViewer = function (el) { el.remove(); };
  document.addEventListener('change', function (e) {
    var input = e.target;
    if (!input.matches || !input.matches('[data-photo-input]')) return;
    var box = $('#thumbs'); var files = Array.prototype.slice.call(input.files || []);
    files.reduce(function (p, f) {
      return p.then(function () { return resizeImage(f); }).then(function (blob) { var id = 'ph_' + uid(); return PhotoDB.put(id, blob).then(function () { if (box) appendThumb(box, id); }); });
    }, Promise.resolve()).catch(function (err) { toast('Photo not added: ' + err.message); });
    input.value = '';
  });
  function photoGC() {
    var used = {}; db.tasks.forEach(function (t) { (t.photos || []).forEach(function (p) { used[p] = 1; }); });
    PhotoDB.keys().then(function (keys) { keys.forEach(function (k) { if (!used[k]) PhotoDB.del(k); }); }).catch(function () { /* ignore */ });
  }

  /* ================= task form additions ================= */
  function micBtn(sel) { return '<button type="button" class="mic-btn" data-act="dictate" data-target="' + esc(sel) + '" aria-label="Dictate">' + ICON.mic + '</button>'; }
  var _taskForm = taskForm;
  taskForm = function (t, ctx) {
    ctx = ctx || {};
    _taskForm(t, ctx);
    var form = $('#sheet form[data-form=task]'); if (!form) return;
    var cur = t || { photos: [], delegatedTo: ctx.delegatedTo || '' };
    ['title', 'notes'].forEach(function (n) {
      var el = form.elements[n]; el.id = 'tf_' + n; el.closest('.field').classList.add('has-mic');
      el.insertAdjacentHTML('afterend', micBtn('#tf_' + n));
    });
    var names = db.settings.assistants.slice(); if (cur.delegatedTo && names.indexOf(cur.delegatedTo) < 0) names.push(cur.delegatedTo);
    form.querySelector('.actions').insertAdjacentHTML('beforebegin',
      '<label class="field"><span>Delegated to</span><select name="delegatedTo"><option value="">Not delegated</option>' + options(names, cur.delegatedTo) + '</select></label>' +
      '<div class="field"><span>Photos</span><div class="thumbs" id="thumbs"></div><label class="tiny-btn file-btn">' + ICON.camera + ' Add photo<input type="file" accept="image/*" multiple data-photo-input class="sr-only"></label></div>');
    (cur.photos || []).forEach(function (id) { appendThumb($('#thumbs'), id); });
  };
  var _submitTask = submitters.task;
  submitters.task = function (form) {
    var pre = form.dataset.id || uid(); if (!form.dataset.id) form.dataset.preId = pre;
    var photos = $all('[data-photo]', form).map(function (x) { return x.dataset.photo; });
    var deleg = val(form, 'delegatedTo');
    var before = task(pre); var old = before ? (before.photos || []).slice() : [];
    _submitTask(form);
    var t = task(pre); if (!t) return;
    t.photos = photos; t.delegatedTo = deleg;
    old.forEach(function (p) { if (photos.indexOf(p) < 0) PhotoDB.del(p).catch(function () { /* ignore */ }); });
    save(); render();
  };

  /* ================= voice input ================= */
  var rec = null;
  actions.dictate = function (el) {
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    var field = el.dataset.target ? $(el.dataset.target) : null;
    if (!SR) { toast('Voice input isn’t available here. Tap the mic on the iPhone keyboard instead.'); if (field) field.focus(); return; }
    if (rec) { rec.stop(); return; }
    if (!field) return;
    rec = new SR(); rec.lang = db.settings.voiceLang || 'ru-RU'; rec.interimResults = true; rec.continuous = true;
    var base = field.value ? field.value.replace(/\s*$/, field.tagName === 'TEXTAREA' ? '\n' : ' ') : '', fin = '';
    rec.onresult = function (e) {
      var interim = '';
      for (var i = e.resultIndex; i < e.results.length; i++) { if (e.results[i].isFinal) fin += e.results[i][0].transcript; else interim += e.results[i][0].transcript; }
      field.value = base + fin + interim; field.dispatchEvent(new Event('input', { bubbles: true }));
    };
    rec.onerror = function (e) { toast(e.error === 'not-allowed' ? 'Allow microphone access to dictate' : 'Voice input stopped (' + e.error + ')'); };
    rec.onend = function () { el.classList.remove('listening'); rec = null; };
    el.classList.add('listening');
    try { rec.start(); toast('Listening… tap the mic again to stop'); } catch (err) { rec = null; el.classList.remove('listening'); toast('Could not start voice input'); }
  };
  function voiceSheet() {
    openSheet('Voice capture', '<form data-form="voice" novalidate><p class="hint">Speak several tasks: each sentence or line becomes an Inbox task. Or save everything as one note.</p>' +
      '<div class="field has-mic"><textarea id="voiceText" name="text" rows="6" placeholder="Tap the mic and speak…"></textarea>' + micBtn('#voiceText') + '</div>' +
      '<div class="actions"><button class="btn block" type="submit">Save as Inbox tasks</button><button type="button" class="btn ghost block" data-act="voiceNote">Save as a note</button></div></form>');
  }
  function splitTasks(text) { return text.split(/\n+|[.!?;]\s+|\s+(?:затем|потом|then|and then)\s+/i).map(function (s) { return s.replace(/[.!?;]+$/, '').trim(); }).filter(Boolean); }
  submitters.voice = function (form) {
    var items = splitTasks(form.elements.text.value);
    if (!items.length) { toast('Nothing to save yet'); return; }
    var o = minOrder();
    items.forEach(function (title, i) {
      db.tasks.push({ id: uid(), title: title.slice(0, 300), notes: '', list: 'inbox', date: '', time: '', priority: 'medium', status: 'todo', done: false, completedAt: '', area: '', project: '', repeat: '', subtasks: [], photos: [], delegatedTo: '', order: o - items.length + i, createdAt: Date.now() });
    });
    save(); closeSheet(); render(); toast(items.length + ' task' + (items.length > 1 ? 's' : '') + ' added to Inbox', 'View', function () { go('inbox'); });
  };
  actions.voiceNote = function (el) {
    var text = el.closest('form').elements.text.value.trim(); if (!text) { toast('Nothing to save yet'); return; }
    var n = { id: uid(), title: text.split('\n')[0].slice(0, 60), body: text, area: '', project: '', pinned: false, updatedAt: Date.now() };
    db.notes.push(n); save(); closeSheet(); go('note', n.id); toast('Note saved');
  };
  var _noteScreen = screens.note;
  screens.note = function (id) {
    return _noteScreen(id).replace('<button class="tiny-btn" data-act="pinNote"', '<button class="tiny-btn mic-inline" data-act="dictate" data-target=".body-in">' + ICON.mic + ' Dictate</button><button class="tiny-btn" data-act="pinNote"');
  };

  /* ================= + chooser and More ================= */
  chooser = function () {
    var items = [['task', 'Task', ICON.task], ['voice', 'Voice', ICON.mic], ['note', 'Note', ICON.note], ['safe', 'Safe', ICON.lock], ['income', 'Income', ICON.income], ['expense', 'Expense', ICON.expense], ['bookmark', 'Bookmark', ICON.bookmarks]];
    openSheet('Add new', '<div class="chooser">' + items.map(function (x, i) {
      return '<button type="button" class="choice' + (i === 0 || i === items.length - 1 ? ' wide' : '') + '" data-act="choose" data-kind="' + x[0] + '">' + x[2] + x[1] + '</button>';
    }).join('') + '</div>');
  };
  var _choose = actions.choose;
  actions.choose = function (el) {
    var k = el.dataset.kind;
    if (k === 'voice') { closeSheet(true); voiceSheet(); return; }
    if (k === 'bookmark') { closeSheet(true); bookmarkForm(null); return; }
    if (k === 'safe') { closeSheet(true); safeAdd(); return; }
    _choose(el);
  };
  function safeAdd() {
    if (Vault.unlocked()) safeForm(null);
    else { ui.safePendingAdd = Vault.exists(); go('safe'); toast(Vault.exists() ? 'Unlock Safe to add a record' : 'Create a PIN first'); }
  }
  actions.homeSafeAdd = safeAdd;
  actions.openMore = function () {
    closeMenu();
    openSheet('More', '<div class="chooser">' + [['projects', 'Projects', ICON.projects], ['notes', 'Notes', ICON.note], ['safe', 'Safe', ICON.lock], ['finance', 'Money', ICON.finance]].map(function (x) {
      return '<button type="button" class="choice" data-go="' + x[0] + '">' + x[2] + x[1] + '</button>';
    }).join('') + '</div>');
  };

  /* ================= Bookmarks ================= */
  function normUrl(u) { u = (u || '').trim(); if (u && !/^[a-z][a-z0-9+.-]*:/i.test(u)) u = 'https://' + u; return u; }
  function host(u) { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return u; } }
  screens.bookmarks = function () {
    var q = ui.bmQuery.trim().toLowerCase(), tag = ui.bmTag;
    var tags = []; db.bookmarks.forEach(function (b) { if (b.tag && tags.indexOf(b.tag) < 0) tags.push(b.tag); }); tags.sort();
    var bs = db.bookmarks.filter(function (b) { return (!q || (b.title + ' ' + b.url + ' ' + b.tag + ' ' + b.note).toLowerCase().indexOf(q) >= 0) && (!tag || b.tag === tag); });
    var html = head('Bookmarks', db.bookmarks.length + ' saved links', '<button class="btn ghost" data-act="newBookmark">+ Add</button>');
    html += '<input class="input search" type="search" placeholder="Search bookmarks" data-input="bmQuery" value="' + esc(ui.bmQuery) + '" aria-label="Search bookmarks">';
    if (tags.length) html += '<div class="chips">' + [''].concat(tags).map(function (t) { return '<button class="chip-btn" data-act="bmTag" data-v="' + esc(t) + '" aria-pressed="' + (tag === t) + '">' + esc(t || 'All') + '</button>'; }).join('') + '</div>';
    if (!bs.length) return html + '<div class="empty">' + (db.bookmarks.length ? 'No bookmarks match.' : 'Save links you open often. Tap + Add.') + '</div>';
    var groups = {}; bs.forEach(function (b) { var g = b.tag || 'Untagged'; (groups[g] = groups[g] || []).push(b); });
    Object.keys(groups).sort().forEach(function (g) {
      html += section(g, groups[g].length) + '<div class="list">' + groups[g].map(function (b) {
        return '<div class="bm"><a href="' + esc(b.url) + '" target="_blank" rel="noopener noreferrer"><strong>' + esc(b.title || host(b.url)) + '</strong><span class="muted small">' + esc(host(b.url)) + (b.note ? ' · ' + esc(b.note) : '') + '</span></a><button class="tiny-btn" data-act="editBookmark" data-id="' + esc(b.id) + '">Edit</button></div>';
      }).join('') + '</div>';
    });
    return html;
  };
  function bookmarkForm(b) {
    var tags = []; db.bookmarks.forEach(function (x) { if (x.tag && tags.indexOf(x.tag) < 0) tags.push(x.tag); });
    openSheet(b ? 'Edit bookmark' : 'New bookmark', '<form data-form="bookmark" data-id="' + esc(b ? b.id : '') + '" novalidate>' +
      '<label class="field"><span>Link</span><input name="url" value="' + esc(b ? b.url : '') + '" inputmode="url" autocapitalize="off" autocorrect="off" required placeholder="example.com" autofocus></label><p class="hint" id="bmErr" role="alert" style="color:var(--bad)"></p>' +
      '<label class="field"><span>Title</span><input name="title" value="' + esc(b ? b.title : '') + '" placeholder="Optional"></label>' +
      '<label class="field"><span>Tag</span><input name="tag" list="bmTags" value="' + esc(b ? b.tag : '') + '" placeholder="e.g. Work"></label><datalist id="bmTags">' + tags.map(function (t) { return '<option value="' + esc(t) + '">'; }).join('') + '</datalist>' +
      '<label class="field"><span>Note</span><input name="note" value="' + esc(b ? b.note : '') + '"></label>' +
      '<div class="actions"><button class="btn block" type="submit">Save bookmark</button>' + (b ? '<button type="button" class="btn danger block" data-act="deleteBookmark" data-id="' + esc(b.id) + '">Delete bookmark</button>' : '') + '</div></form>');
  }
  submitters.bookmark = function (form) {
    var url = normUrl(val(form, 'url'));
    if (!url || !/^https?:\/\/[^\s.]+\.[^\s]+/i.test(url)) { $('#bmErr').textContent = 'Enter a web address.'; return; }
    var b = form.dataset.id ? byId(db.bookmarks, form.dataset.id) : { id: uid(), createdAt: Date.now() };
    b.url = url; b.title = val(form, 'title') || host(url); b.tag = val(form, 'tag'); b.note = val(form, 'note');
    if (!form.dataset.id) db.bookmarks.push(b);
    save(); closeSheet(); if (ui.route.name !== 'bookmarks') go('bookmarks'); else render(); toast('Bookmark saved');
  };
  actions.newBookmark = function () { bookmarkForm(null); };
  actions.editBookmark = function (el) { var b = byId(db.bookmarks, el.dataset.id); if (b) bookmarkForm(b); };
  actions.deleteBookmark = function (el) { if (!confirm('Delete this bookmark?')) return; db.bookmarks = db.bookmarks.filter(function (x) { return x.id !== el.dataset.id; }); save(); closeSheet(); render(); toast('Bookmark deleted'); };
  actions.bmTag = function (el) { ui.bmTag = el.dataset.v; render(); };

  /* ================= Delegated ================= */
  screens.delegated = function () {
    var names = db.settings.assistants.slice();
    db.tasks.forEach(function (t) { if (t.delegatedTo && names.indexOf(t.delegatedTo) < 0) names.push(t.delegatedTo); });
    var html = head('Delegated', 'Tasks handed to assistants.');
    html += '<div class="notice" style="margin-bottom:6px">Assistants will edit and complete these tasks; only you can delete them. Sharing with an assistant’s own phone needs a sync server, which is the next build step. For now this list lives on your device.</div>';
    names.forEach(function (n) {
      var open = db.tasks.filter(function (t) { return t.delegatedTo === n && !t.done; }).sort(byOrder);
      var done = db.tasks.filter(function (t) { return t.delegatedTo === n && t.done; }).length;
      html += section(n, open.length, done ? '<span class="muted small">' + done + ' done</span>' : '') + taskList(open, 'deleg-' + n, 'Nothing delegated to ' + n + '.');
      html += addTaskBtn({ delegatedTo: n, list: 'anytime' }, 'Delegate a task to ' + n);
    });
    return html + '<button class="link-btn" style="margin-top:10px" data-go="settings">Manage assistants in Settings</button>';
  };

  /* ================= Money: overview + My balance ================= */
  var _finance = screens.finance;
  var ACC_CATS = [['cash', 'Cash'], ['bank', 'Banks'], ['crypto', 'Crypto'], ['mydebt', 'My debts'], ['theirdebt', 'Debts to me'], ['asset', 'Assets']];
  var MONEY_CURS = ['USD', 'RUB', 'IDR'];
  screens.finance = function () {
    var tab = ui.moneyTab, cur = db.settings.currency;
    var html = head('Money', tab === 'balance' ? 'Monthly balances and net worth' : 'Income and expenses, planned vs actual');
    html += '<div class="seg" role="group" aria-label="Money section"><button data-act="moneyTab" data-v="overview" aria-pressed="' + (tab !== 'balance') + '">Income & Expenses</button><button data-act="moneyTab" data-v="balance" aria-pressed="' + (tab === 'balance') + '">My balance</button></div>';
    if (tab === 'balance') return html + balanceView();
    var es = earnedSpent();
    html += '<div class="grid2" style="margin-bottom:6px"><div class="tile static"><div class="l">Earned this month</div><div class="n pos money" id="earned">' + esc(fmtMoney(es.earned, cur)) + '</div></div><div class="tile static"><div class="l">Spent this month</div><div class="n money" id="spent">' + esc(fmtMoney(es.spent, cur)) + '</div></div></div>';
    html += '<p class="muted small" style="margin:0 0 14px">Actual records, converted to ' + esc(cur) + ' at current rates.</p>';
    return html + _finance();
  };
  actions.moneyTab = function (el) { ui.moneyTab = el.dataset.v; render(); };
  actions.balCur = function (el) { ui.balCur = el.dataset.v; render(); };
  function latestBalances(onDate) {
    var out = {};
    db.balances.forEach(function (b) { if (onDate && b.date > onDate) return; var c = out[b.account]; if (!c || b.date > c.date) out[b.account] = b; });
    return out;
  }
  function balanceTotals(onDate, cur) {
    var lb = latestBalances(onDate), s = { cash: 0, bank: 0, crypto: 0, mydebt: 0, theirdebt: 0, asset: 0 };
    db.accounts.forEach(function (a) { var b = lb[a.id]; if (b) s[a.category] += convert(b.amount, a.currency, cur); });
    s.liquid = s.cash + s.bank + s.crypto + s.mydebt + s.theirdebt; s.net = s.liquid + s.asset;
    return s;
  }
  function balanceDates() { var d = []; db.balances.forEach(function (b) { if (d.indexOf(b.date) < 0) d.push(b.date); }); return d.sort(); }
  function netChart(cur) {
    var dates = balanceDates(); if (!dates.length) return '';
    var pts = dates.map(function (d) { return balanceTotals(d, cur).net; });
    var W = 340, H = 150, L = 8, R = 8, T = 18, B = 26;
    var mn = Math.min.apply(null, pts), mx = Math.max.apply(null, pts); if (mn === mx) { mn -= 1; mx += 1; }
    var x = function (i) { return dates.length === 1 ? W / 2 : L + i * (W - L - R) / (dates.length - 1); };
    var y = function (v) { return T + (mx - v) * (H - T - B) / (mx - mn); };
    var poly = pts.map(function (v, i) { return x(i).toFixed(1) + ',' + y(v).toFixed(1); }).join(' ');
    var lbl = function (d) { var p = parseYmd(d); return MONTHS[p.getMonth()].slice(0, 3) + ' ' + String(p.getFullYear()).slice(2); };
    return '<div class="card pad chart"><div class="row between"><strong>My net worth</strong><span class="muted small">' + esc(cur) + '</span></div>' +
      '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Net worth over time" id="netChart"><polyline fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linejoin="round" points="' + poly + '"/>' +
      pts.map(function (v, i) { return '<circle cx="' + x(i).toFixed(1) + '" cy="' + y(v).toFixed(1) + '" r="3.5" fill="var(--accent)"><title>' + esc(dates[i] + ': ' + fmtMoney(Math.round(v), cur)) + '</title></circle>'; }).join('') +
      '<text x="' + L + '" y="' + (H - 6) + '" font-size="11" fill="var(--muted)">' + esc(lbl(dates[0])) + '</text><text x="' + (W - R) + '" y="' + (H - 6) + '" font-size="11" fill="var(--muted)" text-anchor="end">' + esc(lbl(dates[dates.length - 1])) + '</text>' +
      '<text x="' + (W - R) + '" y="12" font-size="11" fill="var(--muted)" text-anchor="end">' + esc(fmtMoney(Math.round(pts[pts.length - 1]), cur)) + '</text></svg></div>';
  }
  function balanceView() {
    var cur = MONEY_CURS.indexOf(ui.balCur) >= 0 ? ui.balCur : (MONEY_CURS.indexOf(db.settings.currency) >= 0 ? db.settings.currency : 'USD');
    var html = '<div class="seg" role="group" aria-label="Show amounts in">' + MONEY_CURS.map(function (c) { return '<button data-act="balCur" data-v="' + c + '" aria-pressed="' + (c === cur) + '">' + c + '</button>'; }).join('') + '</div>';
    html += '<div class="btn-row" style="margin-bottom:14px"><button class="btn" data-act="recordBalances">Record balances</button><button class="btn plain" data-act="newAccount">+ Account</button></div>';
    if (!db.accounts.length) return html + '<div class="empty">Add your accounts (cash, banks, crypto, debts, assets), then record their balances once a month.</div>';
    var s = balanceTotals('', cur);
    var row = function (k, l, v, cls) { return '<div class="sum-row' + (cls ? ' ' + cls : '') + '"><span>' + l + '</span><span class="money" data-sum="' + k + '">' + esc(fmtMoney(Math.round(v), cur)) + '</span></div>'; };
    html += '<div class="card pad" id="balSummary">' + row('cash', 'Cash', s.cash) + row('bank', 'Banks', s.bank) + row('crypto', 'Crypto', s.crypto) + row('mydebt', 'My debts', s.mydebt) + row('theirdebt', 'Debts to me', s.theirdebt) +
      row('liquid', 'Total liquid', s.liquid, 'total') + row('asset', 'Assets value', s.asset) + row('net', 'Net worth', s.net, 'total big') + '</div>';
    html += netChart(cur);
    var lb = latestBalances('');
    html += section('Accounts', db.accounts.length) + '<div class="table-wrap"><table class="bal"><thead><tr><th>Record date</th><th>Account</th><th class="num">Amount, ' + esc(cur) + '</th></tr></thead><tbody>';
    ACC_CATS.forEach(function (c) {
      var accs = db.accounts.filter(function (a) { return a.category === c[0]; }); if (!accs.length) return;
      html += '<tr class="grp"><td colspan="3">' + esc(c[1]) + '</td></tr>';
      accs.forEach(function (a) {
        var b = lb[a.id];
        html += '<tr><td>' + (b ? esc(fmtDate(b.date, { full: true })) : '—') + '</td><td><button class="cell-btn" data-act="editAccount" data-id="' + esc(a.id) + '">' + esc(a.name) + '</button></td><td class="num money' + (b && b.amount < 0 ? ' neg' : '') + '">' + (b ? esc(fmtMoney(Math.round(convert(b.amount, a.currency, cur)), cur)) + (a.currency !== cur ? '<span class="orig">' + esc(fmtMoney(b.amount, a.currency)) + '</span>' : '') : '—') + '</td></tr>';
      });
    });
    html += '</tbody></table></div>';
    var dates = balanceDates().reverse();
    html += section('History', dates.length) + '<div class="list">' + dates.map(function (d) {
      return '<button class="rec" data-act="recordBalances" data-date="' + d + '"><span><strong>' + esc(fmtDate(d, { full: true })) + '</strong><span class="muted small" style="display:block">Tap to edit balances</span></span><span class="amt money">' + esc(fmtMoney(Math.round(balanceTotals(d, cur).net), cur)) + '</span></button>';
    }).join('') + '</div>';
    var m = readCache('focus.market');
    html += '<p class="muted small" style="margin-top:12px">Converted at ' + (db.settings.autoRates && m ? 'live rates (' + ago(m.t) + ')' : 'your rates in Settings') + ': 1 USD = ' + getRates().RUB.toFixed(2) + ' RUB = ' + Math.round(getRates().IDR) + ' IDR.</p>';
    return html;
  }
  function accountForm(a) {
    openSheet(a ? 'Edit account' : 'New account', '<form data-form="account" data-id="' + esc(a ? a.id : '') + '" novalidate>' +
      '<label class="field"><span>Account name</span><input name="name" value="' + esc(a ? a.name : '') + '" required autofocus placeholder="e.g. Tinkoff RUB, Cash at home"></label><p class="hint" id="accErr" role="alert" style="color:var(--bad)"></p>' +
      '<div class="fields2"><label class="field"><span>Type</span><select name="category">' + options(ACC_CATS, a ? a.category : 'bank') + '</select></label>' +
      '<label class="field"><span>Currency</span><select name="currency">' + options(CURRENCIES, a ? a.currency : 'USD') + '</select></label></div>' +
      '<p class="hint">Credit cards and loans: choose My debts and record a negative amount.</p>' +
      '<div class="actions"><button class="btn block" type="submit">Save account</button>' + (a ? '<button type="button" class="btn danger block" data-act="deleteAccount" data-id="' + esc(a.id) + '">Delete account and its history</button>' : '') + '</div></form>');
  }
  submitters.account = function (form) {
    var name = val(form, 'name'); if (!name) { $('#accErr').textContent = 'Name the account.'; return; }
    var a = form.dataset.id ? byId(db.accounts, form.dataset.id) : { id: 'acc_' + uid() };
    a.name = name; a.category = val(form, 'category'); a.currency = val(form, 'currency');
    if (!form.dataset.id) db.accounts.push(a);
    save(); closeSheet(); ui.moneyTab = 'balance'; render(); toast('Account saved');
  };
  actions.newAccount = function () { accountForm(null); };
  actions.editAccount = function (el) { var a = byId(db.accounts, el.dataset.id); if (a) accountForm(a); };
  actions.deleteAccount = function (el) {
    if (!confirm('Delete this account and all its recorded balances?')) return;
    db.accounts = db.accounts.filter(function (a) { return a.id !== el.dataset.id; }); db.balances = db.balances.filter(function (b) { return b.account !== el.dataset.id; });
    save(); closeSheet(); render(); toast('Account deleted');
  };
  actions.recordBalances = function (el) {
    if (!db.accounts.length) { toast('Add an account first'); accountForm(null); return; }
    var date = (el && el.dataset.date) || today(), lb = latestBalances(date);
    var rows = ACC_CATS.map(function (c) {
      return db.accounts.filter(function (a) { return a.category === c[0]; }).map(function (a) {
        var b = lb[a.id];
        return '<label class="field"><span>' + esc(a.name) + ' · ' + esc(c[1]) + ' · ' + esc(a.currency) + '</span><input type="number" step="any" name="acc_' + esc(a.id) + '" value="' + (b ? esc(b.amount) : '') + '" placeholder="0"></label>';
      }).join('');
    }).join('');
    openSheet('Record balances', '<form data-form="balances" novalidate><label class="field"><span>Record date</span><input type="date" name="date" value="' + esc(date) + '" required></label>' +
      '<p class="hint">Prefilled with the latest amounts. Use a minus sign for credit cards and debts you owe.</p>' + rows +
      '<div class="actions"><button class="btn block" type="submit">Save balances</button></div></form>');
  };
  submitters.balances = function (form) {
    var date = val(form, 'date'); if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { toast('Choose a date'); return; }
    db.accounts.forEach(function (a) {
      var raw = String((form.elements['acc_' + a.id] || {}).value || '').replace(',', '.').replace(/\s/g, '');
      db.balances = db.balances.filter(function (b) { return !(b.account === a.id && b.date === date); });
      if (raw !== '' && !isNaN(parseFloat(raw))) db.balances.push({ id: uid(), account: a.id, date: date, amount: Math.round(parseFloat(raw) * 100) / 100 });
    });
    save(); closeSheet(); ui.moneyTab = 'balance'; render(); toast('Balances saved for ' + fmtDate(date, { full: true }));
  };

  /* ================= Safe Storage v2: 4-digit PIN or Face ID ================= */
  var VAULT2 = 'focus.vault.v2';
  var enc8 = new TextEncoder(), dec8 = new TextDecoder();
  function b64e(u8) { var s = ''; for (var i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]); return btoa(s); }
  function b64d(str) { var s = atob(str); var u = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; }
  function rnd(n) { return crypto.getRandomValues(new Uint8Array(n)); }
  function aesKey(raw) { return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']); }
  function pinKey(pin, salt, iter) {
    return crypto.subtle.importKey('raw', enc8.encode(pin), 'PBKDF2', false, ['deriveKey']).then(function (base) {
      return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: salt, iterations: iter, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    });
  }
  function seal(key, bytes) { var iv = rnd(12); return crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, key, bytes).then(function (ct) { return { iv: b64e(iv), ct: b64e(new Uint8Array(ct)) }; }); }
  function unseal(key, box) { return crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64d(box.iv) }, key, b64d(box.ct)).then(function (b) { return new Uint8Array(b); }); }
  var Vault = {
    raw: null, key: null, records: null, meta: null, legacy: null, lastActivity: 0,
    supported: function () { return !!(window.crypto && crypto.subtle && window.isSecureContext !== false); },
    blob: function () { try { return JSON.parse(localStorage.getItem(VAULT2) || 'null'); } catch (e) { return null; } },
    exists: function () { return !!this.blob(); },
    hasLegacy: function () { try { return !this.exists() && !!localStorage.getItem(VAULT_KEY); } catch (e) { return false; } },
    unlocked: function () { return !!this.key; },
    touch: function () { this.lastActivity = Date.now(); },
    create: function (pin, records) {
      var self = this, raw = rnd(32), salt = rnd(16), iter = 600000;
      return pinKey(pin, salt, iter).then(function (pk) { return seal(pk, raw); }).then(function (wrapPin) {
        self.meta = { v: 2, salt: b64e(salt), iter: iter, wrapPin: wrapPin, prf: null, fails: 0, lockUntil: 0 };
        self.raw = raw; return aesKey(raw);
      }).then(function (k) { self.key = k; self.records = records || []; self.touch(); return self.persist(); });
    },
    finish: function (raw, b) {
      var self = this;
      return aesKey(raw).then(function (k) {
        return unseal(k, b.data).then(function (bytes) {
          b.fails = 0; b.lockUntil = 0; self.meta = b; self.raw = raw; self.key = k;
          self.records = JSON.parse(dec8.decode(bytes)); self.touch();
          localStorage.setItem(VAULT2, JSON.stringify(b));
        });
      });
    },
    unlockPin: function (pin) {
      var self = this, b = this.blob();
      if (b.lockUntil && Date.now() < b.lockUntil) return Promise.reject(new Error('wait'));
      return pinKey(pin, b64d(b.salt), b.iter).then(function (pk) { return unseal(pk, b.wrapPin); }).then(function (raw) { return self.finish(raw, b); }, function () {
        b.fails = (b.fails || 0) + 1; b.lockUntil = b.fails >= 5 ? Date.now() + 30000 * Math.pow(2, Math.min(b.fails - 5, 6)) : 0;
        localStorage.setItem(VAULT2, JSON.stringify(b)); throw new Error('wrong');
      });
    },
    persist: function () {
      var self = this;
      return seal(this.key, enc8.encode(JSON.stringify(this.records))).then(function (box) { self.meta.data = box; localStorage.setItem(VAULT2, JSON.stringify(self.meta)); });
    },
    changePin: function (pin) {
      var self = this, salt = rnd(16);
      return pinKey(pin, salt, this.meta.iter).then(function (pk) { return seal(pk, self.raw); }).then(function (w) { self.meta.salt = b64e(salt); self.meta.wrapPin = w; return self.persist(); });
    },
    lock: function () { this.raw = null; this.key = null; this.records = null; ui.revealed = {}; },
    wipe: function () { this.lock(); this.meta = null; this.legacy = null; try { localStorage.removeItem(VAULT2); localStorage.removeItem(VAULT_KEY); } catch (e) { /* ignore */ } },
    faceIdCapable: function () { return !!(window.PublicKeyCredential && navigator.credentials && navigator.credentials.create); },
    faceIdOn: function () { var b = this.meta || this.blob(); return !!(b && b.prf); },
    prfGet: function (credId, salt) {
      return navigator.credentials.get({ publicKey: { challenge: rnd(32), allowCredentials: [{ type: 'public-key', id: credId }], userVerification: 'required', timeout: 60000, extensions: { prf: { eval: { first: salt } } } } })
        .then(function (a) { var r = a.getClientExtensionResults() || {}; if (!r.prf || !r.prf.results || !r.prf.results.first) throw new Error('unsupported'); return new Uint8Array(r.prf.results.first); });
    },
    enableFaceId: function () {
      var self = this, salt = rnd(32);
      return navigator.credentials.create({ publicKey: {
        rp: { name: 'Focus' }, user: { id: rnd(16), name: 'focus-safe', displayName: 'Focus Safe' }, challenge: rnd(32),
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
        authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'preferred' },
        timeout: 60000, extensions: { prf: { eval: { first: salt } } } } }).then(function (cred) {
        var ext = cred.getClientExtensionResults() || {};
        if (!ext.prf || ext.prf.enabled === false) throw new Error('unsupported');
        var id = new Uint8Array(cred.rawId);
        var first = ext.prf.results && ext.prf.results.first;
        return (first ? Promise.resolve(new Uint8Array(first)) : self.prfGet(id, salt)).then(aesKey).then(function (k) { return seal(k, self.raw); })
          .then(function (box) { self.meta.prf = { credId: b64e(id), salt: b64e(salt), box: box }; return self.persist(); });
      });
    },
    unlockFaceId: function () {
      var self = this, b = this.blob(), p = b.prf;
      return this.prfGet(b64d(p.credId), b64d(p.salt)).then(aesKey).then(function (k) { return unseal(k, p.box); }).then(function (raw) { return self.finish(raw, b); });
    },
    disableFaceId: function () { this.meta.prf = null; return this.persist(); },
    unlockLegacy: function (pw) {
      var self = this, blob = JSON.parse(localStorage.getItem(VAULT_KEY));
      return crypto.subtle.importKey('raw', enc8.encode(pw), 'PBKDF2', false, ['deriveKey']).then(function (base) {
        return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: b64d(blob.salt), iterations: blob.iterations, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
      }).then(function (k) { return crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64d(blob.iv) }, k, b64d(blob.ct)); })
        .then(function (p) { self.legacy = JSON.parse(dec8.decode(p)).map(function (r) { r.tags = r.tags || []; if (SAFE_TYPES.indexOf(r.type) < 0) r.type = r.type === 'Card' ? 'Bank card' : r.type === 'Note' ? 'Safenote' : 'Login'; return r; }); });
    }
  };
  setInterval(function () {
    var m = db && db.settings && db.settings.safeAutoLock;
    if (m && Vault.unlocked() && Date.now() - Vault.lastActivity > m * 60000) { Vault.lock(); if (ui.route.name === 'safe') render(); toast('Safe locked'); }
  }, 15000);
  function pinInput(name, label, extra) {
    return '<label class="field"><span>' + label + '</span><input class="pin-in" type="password" name="' + name + '" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="off" required' + (extra || '') + '></label>';
  }
  screens.safe = function () {
    var html = head('Safe Storage', 'Logins, addresses, documents, cards and private notes.');
    if (!Vault.supported()) return html + '<div class="empty">Safe Storage needs a secure (https) connection.</div>';
    if (Vault.hasLegacy() && !Vault.legacy) {
      return html + '<form class="card pad" data-form="safeLegacy" autocomplete="off" novalidate><h2 class="form-title">Upgrade your Safe</h2><p class="muted small">Enter your old Safe password once. Next you’ll set a 4-digit PIN.</p><label class="field"><span>Old Safe password</span><input type="password" name="pw" required></label><p class="hint" id="safeErr" role="alert"></p><button class="btn block" type="submit">Continue</button></form>';
    }
    if (!Vault.exists()) {
      return html + '<div class="notice">Encrypted on this device. A 4-digit PIN is quick but easy to guess for someone holding your unlocked phone and its data; Face ID is stronger. This build hasn’t had a security audit, so keep real card numbers in a dedicated password manager for now.</div>' +
        '<form class="card pad" style="margin-top:12px" data-form="safeSetup" autocomplete="off" novalidate><h2 class="form-title">' + (Vault.legacy ? 'Set a PIN to finish the upgrade' : 'Create a 4-digit PIN') + '</h2>' +
        pinInput('pin', 'PIN', ' autofocus') + pinInput('pin2', 'Repeat PIN') + '<p class="hint" id="safeErr" role="alert"></p><button class="btn block" type="submit">Create Safe</button></form>';
    }
    if (!Vault.unlocked()) {
      var b = Vault.blob(), wait = b.lockUntil && Date.now() < b.lockUntil;
      return html + '<form class="card pad" data-form="safeUnlock" autocomplete="off" novalidate><h2 class="form-title">Safe is locked</h2><p class="muted small">You’ll only be asked once per app launch.</p>' +
        pinInput('pin', 'PIN', ' autofocus') + '<p class="hint" id="safeErr" role="alert">' + (wait ? 'Too many attempts. Try again in ' + Math.ceil((b.lockUntil - Date.now()) / 1000) + ' s.' : '') + '</p><button class="btn block" type="submit">Unlock</button>' +
        (b.prf ? '<button type="button" class="btn ghost block" style="margin-top:10px" data-act="safeFaceId">Unlock with Face ID</button>' : '') + '</form>' +
        '<button class="link-btn" style="margin-top:12px" data-act="safeReset">Forgot PIN? Erase Safe Storage</button>';
    }
    var q = ui.safeQuery.trim().toLowerCase(), view = ui.safeView, tag = ui.safeTag;
    var tags = []; Vault.records.forEach(function (r) { (r.tags || []).forEach(function (t) { if (tags.indexOf(t) < 0) tags.push(t); }); }); tags.sort();
    var recs = Vault.records.filter(function (r) {
      return (!q || [r.title, r.type, r.link, r.login, r.note, (r.tags || []).join(' ')].join(' ').toLowerCase().indexOf(q) >= 0) && (!tag || (r.tags || []).indexOf(tag) >= 0);
    }).sort(function (a, b) { return a.title.localeCompare(b.title); });
    html += '<div class="btn-row" style="margin-bottom:12px"><button class="btn" data-act="newSafe">+ Add record</button><button class="btn plain" data-act="safeLock">' + ICON.lock + 'Lock</button></div>';
    if (Vault.faceIdCapable() && !Vault.faceIdOn()) html += '<div class="card pad row between" style="margin-bottom:12px"><span class="small">Unlock with Face ID next time?</span><button class="tiny-btn" data-act="faceIdOn">Turn on</button></div>';
    html += '<div class="seg" role="group" aria-label="Group records"><button data-act="safeView" data-v="all" aria-pressed="' + (view === 'all') + '">All</button><button data-act="safeView" data-v="type" aria-pressed="' + (view === 'type') + '">By type</button><button data-act="safeView" data-v="tag" aria-pressed="' + (view === 'tag') + '">By tag</button></div>';
    html += '<input class="input search" type="search" placeholder="Search Safe" data-input="safeQuery" value="' + esc(ui.safeQuery) + '" aria-label="Search Safe Storage">';
    if (tags.length) html += '<div class="chips">' + [''].concat(tags).map(function (t) { return '<button class="chip-btn" data-act="safeTag" data-v="' + esc(t) + '" aria-pressed="' + (tag === t) + '">' + esc(t ? '#' + t : 'All tags') + '</button>'; }).join('') + '</div>';
    if (!recs.length) return html + '<div class="empty">' + (q || tag ? 'No records match.' : 'No records yet. Add a login, address, document, card or note.') + '</div>';
    if (view === 'all') return html + recs.map(safeCard).join('');
    var groups = {};
    recs.forEach(function (r) {
      var keys = view === 'type' ? [r.type] : ((r.tags && r.tags.length) ? r.tags : ['Untagged']);
      keys.forEach(function (k) { (groups[k] = groups[k] || []).push(r); });
    });
    var order = view === 'type' ? SAFE_TYPES.filter(function (t) { return groups[t]; }) : Object.keys(groups).sort();
    order.forEach(function (k) { html += section(view === 'tag' && k !== 'Untagged' ? '#' + k : k, groups[k].length) + groups[k].map(safeCard).join(''); });
    return html;
  };
  function safeCard(r) {
    var shown = !!ui.revealed[r.id], rows = '';
    if (r.link) rows += '<div class="secret-row"><span class="label">Link</span><span class="val"><a href="' + esc(normUrl(r.link)) + '" target="_blank" rel="noopener noreferrer">' + esc(r.link) + '</a></span></div>';
    if (r.login) rows += '<div class="secret-row"><span class="label">Login</span><span class="val">' + esc(r.login) + '</span><button class="tiny-btn" data-act="safeCopy" data-id="' + esc(r.id) + '" data-f="login">Copy</button></div>';
    if (r.secret) rows += '<div class="secret-row"><span class="label">Pass</span><span class="val">' + (shown ? esc(r.secret) : '••••••••') + '</span><button class="tiny-btn" data-act="safeReveal" data-id="' + esc(r.id) + '" aria-pressed="' + shown + '">' + (shown ? 'Hide' : 'Show') + '</button><button class="tiny-btn" data-act="safeCopy" data-id="' + esc(r.id) + '" data-f="secret">Copy</button></div>';
    if (r.note) rows += '<div class="secret-row"><span class="label">Note</span><span class="val" style="white-space:pre-wrap">' + esc(r.note) + '</span></div>';
    var tags = (r.tags || []).map(function (t) { return '<span class="chip">#' + esc(t) + '</span>'; }).join('');
    return '<div class="card pad" style="margin-bottom:10px" data-safe="' + esc(r.id) + '"><div class="row between"><h3 class="safe-title">' + esc(r.title) + '</h3><button class="tiny-btn" data-act="editSafe" data-id="' + esc(r.id) + '">Edit</button></div><div class="meta" style="margin-top:4px"><span class="chip accent">' + esc(r.type) + '</span>' + tags + '</div>' + rows + '</div>';
  }
  function safeForm(r) {
    var isNew = !r;
    r = r || { title: '', link: '', login: '', secret: '', note: '', type: 'Login', tags: [] };
    var all = []; (Vault.records || []).forEach(function (x) { (x.tags || []).forEach(function (t) { if (all.indexOf(t) < 0) all.push(t); }); });
    openSheet(isNew ? 'New Safe record' : 'Edit Safe record', '<form data-form="safe" data-id="' + esc(isNew ? '' : r.id) + '" autocomplete="off" novalidate>' +
      '<label class="field"><span>Name</span><input name="title" value="' + esc(r.title) + '" required placeholder="e.g. Bank website"' + (isNew ? ' autofocus' : '') + '></label><p class="hint" id="safeFormErr" role="alert" style="color:var(--bad)"></p>' +
      '<label class="field"><span>Link</span><input name="link" value="' + esc(r.link) + '" inputmode="url" autocapitalize="off" autocorrect="off" placeholder="example.com"></label>' +
      '<label class="field"><span>Login</span><input name="login" value="' + esc(r.login) + '" autocapitalize="off" autocorrect="off" spellcheck="false"></label>' +
      '<label class="field"><span>Pass</span><input name="secret" type="password" value="' + esc(r.secret) + '" autocomplete="new-password"></label>' +
      '<label class="field"><span>Note</span><textarea name="note" rows="3">' + esc(r.note) + '</textarea></label>' +
      '<label class="field"><span>Type</span><select name="type">' + options(SAFE_TYPES, r.type) + '</select></label>' +
      '<label class="field"><span>Tag</span><input name="tags" list="safeTags" value="' + esc((r.tags || []).join(', ')) + '" placeholder="e.g. family, bali (comma separated)" autocapitalize="off"></label>' +
      '<datalist id="safeTags">' + all.map(function (t) { return '<option value="' + esc(t) + '">'; }).join('') + '</datalist>' +
      '<div class="actions"><button class="btn block" type="submit">' + (isNew ? 'Save record' : 'Save changes') + '</button>' +
      (isNew ? '' : '<button type="button" class="btn danger block" data-act="deleteSafe" data-id="' + esc(r.id) + '">Delete record</button>') + '</div></form>');
  };
  function pinErr(msg) { var e = $('#safeErr'); if (e) e.textContent = msg; }
  submitters.safeLegacy = function (form) {
    busy(form, true);
    Vault.unlockLegacy(form.elements.pw.value).then(function () { render(); }).catch(function () { busy(form, false); pinErr('Wrong password.'); });
  };
  submitters.safeSetup = function (form) {
    var pin = form.elements.pin.value, pin2 = form.elements.pin2.value;
    if (!/^\d{4}$/.test(pin)) { pinErr('Use exactly 4 digits.'); return; }
    if (pin !== pin2) { pinErr('PINs don’t match.'); return; }
    busy(form, true);
    Vault.create(pin, Vault.legacy || []).then(function () {
      if (Vault.legacy) { try { localStorage.removeItem(VAULT_KEY); } catch (e) { /* ignore */ } Vault.legacy = null; }
      render(); toast('Safe created'); afterUnlock();
    }).catch(function (e) { busy(form, false); pinErr('Could not create Safe: ' + e.message); });
  };
  submitters.safeUnlock = function (form) {
    var pin = form.elements.pin.value;
    if (!/^\d{4}$/.test(pin)) { pinErr('Enter your 4-digit PIN.'); return; }
    busy(form, true);
    Vault.unlockPin(pin).then(function () { render(); afterUnlock(); }).catch(function (e) {
      busy(form, false); render();
      var b = Vault.blob();
      pinErr(e.message === 'wait' || (b.lockUntil && Date.now() < b.lockUntil) ? 'Too many attempts. Try again in ' + Math.ceil((b.lockUntil - Date.now()) / 1000) + ' s.' : 'Wrong PIN.');
    });
  };
  submitters.safe = function (form) {
    if (!Vault.unlocked()) { closeSheet(); render(); return; }
    var title = val(form, 'title'); if (!title) { $('#safeFormErr').textContent = 'Give the record a name.'; return; }
    var r = form.dataset.id ? byId(Vault.records, form.dataset.id) : { id: uid() };
    r.title = title; r.link = val(form, 'link'); r.login = val(form, 'login'); r.secret = form.elements.secret.value; r.note = val(form, 'note');
    r.type = val(form, 'type'); r.tags = val(form, 'tags').split(',').map(function (t) { return t.trim().replace(/^#/, ''); }).filter(Boolean);
    if (!form.dataset.id) Vault.records.push(r);
    busy(form, true);
    Vault.persist().then(function () { closeSheet(); render(); toast('Saved to Safe'); }).catch(function (e) { busy(form, false); toast('Could not save: ' + e.message); });
  };
  function faceIdError(e) {
    toast(e && e.message === 'unsupported' ? 'Face ID unlock needs iOS 18+ with iCloud Keychain. Use your PIN.' : (e && e.name === 'NotAllowedError' ? 'Face ID was cancelled' : 'Face ID failed: ' + ((e && e.message) || 'unknown')));
  }
  actions.safeFaceId = function () { Vault.unlockFaceId().then(function () { render(); afterUnlock(); }).catch(faceIdError); };
  actions.faceIdOn = function () {
    if (!Vault.unlocked()) { go('safe'); toast('Unlock Safe first'); return; }
    Vault.enableFaceId().then(function () { render(); toast('Face ID unlock is on'); }).catch(faceIdError);
  };
  actions.faceIdOff = function () { if (!Vault.unlocked()) { go('safe'); toast('Unlock Safe first'); return; } Vault.disableFaceId().then(function () { render(); toast('Face ID unlock is off'); }); };
  actions.safeView = function (el) { ui.safeView = el.dataset.v; render(); };
  actions.safeTag = function (el) { ui.safeTag = el.dataset.v; render(); };
  actions.changePin = function () {
    if (!Vault.unlocked()) { go('safe'); toast('Unlock Safe first'); return; }
    openSheet('Change PIN', '<form data-form="changePin" autocomplete="off" novalidate>' + pinInput('pin', 'New PIN', ' autofocus') + pinInput('pin2', 'Repeat new PIN') + '<p class="hint" id="safeErr" role="alert"></p><div class="actions"><button class="btn block" type="submit">Save PIN</button></div></form>');
  };
  submitters.changePin = function (form) {
    var pin = form.elements.pin.value;
    if (!/^\d{4}$/.test(pin)) { pinErr('Use exactly 4 digits.'); return; }
    if (pin !== form.elements.pin2.value) { pinErr('PINs don’t match.'); return; }
    busy(form, true); Vault.changePin(pin).then(function () { closeSheet(); toast('PIN changed'); render(); });
  };

  /* ================= Settings ================= */
  function setRow(label, control, hint) { return '<label class="set-row"><span><span class="set-l">' + label + '</span>' + (hint ? '<span class="muted small" style="display:block">' + hint + '</span>' : '') + '</span>' + control + '</label>'; }
  function sel2(path, pairs, v) { return '<select data-setting="' + path + '">' + options(pairs, v) + '</select>'; }
  function chk(path, v) { return '<input type="checkbox" class="switch" data-setting="' + path + '"' + (v ? ' checked' : '') + '>'; }
  screens.settings = function () {
    var S = db.settings, m = readCache('focus.market');
    var html = head('Settings', 'Saved automatically on this device.');
    html += section('Appearance') + '<div class="card set-card">' +
      setRow('Theme', sel2('theme', [['system', 'Match iPhone'], ['light', 'Light'], ['dark', 'Dark']], S.theme)) +
      setRow('Start screen', sel2('start', [['home', 'Home'], ['today', 'Today'], ['inbox', 'Inbox'], ['urgent', 'Urgent']], S.start)) + '</div>';
    html += section('Home widgets') + '<div class="card set-card">' + setRow('City clocks', chk('widgets.clocks', S.widgets.clocks), 'Bali, Moscow, New York, Los Angeles') +
      setRow('USDT and BTC rates', chk('widgets.rates', S.widgets.rates)) + setRow('Moscow weather', chk('widgets.weather', S.widgets.weather)) + setRow('Moscow traffic', chk('widgets.traffic', S.widgets.traffic), 'Opens Yandex: there’s no public API for the score') + '</div>';
    html += section('Money') + '<div class="card set-card">' + setRow('Main currency', sel2('currency', CURRENCIES, S.currency)) +
      setRow('Live exchange rates', chk('autoRates', S.autoRates), m ? 'Updated ' + ago(m.t) : 'Not loaded yet') +
      setRow('USD → RUB (manual)', '<input type="number" step="any" data-setting="rates.RUB" value="' + esc(S.rates.RUB) + '">') +
      setRow('USD → IDR (manual)', '<input type="number" step="any" data-setting="rates.IDR" value="' + esc(S.rates.IDR) + '">') +
      setRow('USD → EUR (manual)', '<input type="number" step="any" data-setting="rates.EUR" value="' + esc(S.rates.EUR) + '">') +
      '<div class="set-row"><span class="muted small">Manual rates are used when live rates are off or offline.</span><button class="tiny-btn" data-act="refreshRates">Update now</button></div></div>';
    html += section('Voice input') + '<div class="card set-card">' + setRow('Dictation language', sel2('voiceLang', [['ru-RU', 'Русский'], ['en-US', 'English']], S.voiceLang)) + '</div>';
    html += section('Safe Storage') + '<div class="card set-card">' +
      setRow('Ask for PIN again', sel2('safeAutoLock', [['0', 'Only when the app restarts'], ['5', 'After 5 min idle'], ['15', 'After 15 min idle']], String(S.safeAutoLock))) +
      '<div class="set-row"><span class="set-l">Face ID</span>' + (Vault.faceIdOn() ? '<button class="tiny-btn" data-act="faceIdOff">Turn off</button>' : '<button class="tiny-btn" data-act="faceIdOn">Turn on</button>') + '</div>' +
      '<div class="set-row"><span class="set-l">PIN</span><button class="tiny-btn" data-act="changePin">Change PIN</button></div></div>';
    html += section('Assistants') + '<div class="card set-card">' + setRow('Names', '<input data-setting="assistants" value="' + esc(S.assistants.join(', ')) + '" placeholder="Comma separated">', 'Used in Delegated and the task form') + '</div>';
    html += section('Organize') + '<div class="card set-card"><div class="set-row"><span class="set-l">Areas</span><button class="tiny-btn" data-go="areas">Manage</button></div></div>';
    html += section('Data') + '<div class="card set-card"><div class="set-row"><span class="muted small">Everything stays on this device. Photos and Safe are not in the backup file.</span></div><div class="btn-row" style="padding:0 14px 14px"><button class="btn plain" data-act="exportData">Export</button><button class="btn plain" data-act="importData">Import</button><button class="btn danger" data-act="resetDemo">Reset demo</button></div></div>';
    return html + '<p class="muted small" style="margin-top:14px">Focus ' + APP_VERSION + '</p>';
  };
  document.addEventListener('change', function (e) {
    var t = e.target, path = t.dataset && t.dataset.setting; if (!path) return;
    var v = t.type === 'checkbox' ? t.checked : t.value;
    if (path === 'assistants') v = String(v).split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    if (path === 'safeAutoLock') v = +v;
    if (path.indexOf('rates.') === 0) { v = parseFloat(v); if (!(v > 0)) { toast('Enter a positive number'); return; } }
    var parts = path.split('.'), obj = db.settings;
    while (parts.length > 1) obj = obj[parts.shift()];
    obj[parts[0]] = v;
    save(); applyTheme(); toast('Saved');
  });
  actions.refreshRates = function () { refreshMarket(true).then(function () { toast('Rates updated'); render(); }).catch(function () { toast('Could not load rates (offline?)'); }); };
  function applyTheme() { var t = db.settings.theme; if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t); else document.documentElement.removeAttribute('data-theme'); }

  /* ================= render hook ================= */
  var MORE_ROUTES = ['projects', 'project', 'notes', 'note', 'safe', 'finance'];
  var _render = render;
  render = function (resetScroll) {
    _render(resetScroll);
    var more = $('#moreTab'); if (more) { if (MORE_ROUTES.indexOf(ui.route.name) >= 0) more.setAttribute('aria-current', 'page'); else more.removeAttribute('aria-current'); }
    if (ui.route.name === 'home') updateWidgets();
  };
  var _boot = boot;
  boot = function () { _boot(); applyTheme(); setTimeout(photoGC, 4000); };


  /* ================= v1.2: no demo data, habits, whole life ================= */
  APP_VERSION = '1.2.0';
  var DEMO_FLAG = /[?&]demo=1\b/.test(location.search);
  CLOCKS = [['Los Angeles', 'America/Los_Angeles'], ['New York', 'America/New_York'], ['Moscow', 'Europe/Moscow'], ['Bali', 'Asia/Makassar']];
  Object.assign(ROUTES, { habits: { title: 'Habits', icon: 'habits' }, life: { title: 'Whole life', icon: 'life' } });
  ICON.habits = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="4.5" width="17" height="16" rx="3"/><path d="M8 3v3M16 3v3M8.5 13l2.5 2.5 4.5-5"/></svg>';
  ICON.life = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="4" y="4" width="4" height="4" rx="1"/><rect x="10" y="4" width="4" height="4" rx="1"/><rect x="16" y="4" width="4" height="4" rx="1"/><rect x="4" y="10" width="4" height="4" rx="1"/><rect x="10" y="10" width="4" height="4" rx="1" opacity=".35"/><rect x="16" y="10" width="4" height="4" rx="1" opacity=".35"/><rect x="4" y="16" width="4" height="4" rx="1" opacity=".35"/><rect x="10" y="16" width="4" height="4" rx="1" opacity=".35"/><rect x="16" y="16" width="4" height="4" rx="1" opacity=".35"/></svg>';
  DRAWER_GROUPS.splice(2, 0, ['Life', ['habits', 'life']]);

  var _normalize2b = normalize;
  normalize = function (d) {
    d = _normalize2b(d);
    if (!Array.isArray(d.habits)) d.habits = [];
    d.habits.forEach(function (h) { if (!h.done || typeof h.done !== 'object') h.done = {}; });
    if (d.settings.birthDate == null) d.settings.birthDate = '';
    return d;
  };
  function emptyData() {
    var d = normalize({ v: 1, tasks: [], projects: [], notes: [], finance: [], purchases: [] });
    d.settings.demoPurged = true; return d;
  }
  var _seedData2 = seedData;
  seedData = function () {
    var d = normalize(_seedData2());
    d.habits = [{ id: 'hb1', name: 'Morning workout', createdAt: Date.now(), done: {} }, { id: 'hb2', name: 'Read 20 pages', createdAt: Date.now(), done: {} }];
    d.habits[0].done[addDays(today(), -1)] = true; d.habits[0].done[addDays(today(), -2)] = true;
    d.settings.demoPurged = true; return d;
  };

  /* One-time cleanup: remove the demo items earlier versions created, keep everything the user added. */
  var DEMO = {
    tasks: ['t1', 't2', 't3', 't4', 't5', 't6', 't7', 't8', 't9', 't10', 't11', 't12'],
    taskTitles: ['Review quarterly growth plan', 'Approve renovation budget', 'Call the contractor about roof quote', 'Draft launch announcement', 'Renew insurance documents', 'Pick a CRM for the sales team', 'Research new supplier options', 'Plan weekend hike route', 'Learn to sail', 'Book dentist appointment', 'Weekly review', 'Send measurements to designer'],
    projects: ['p_web', 'p_launch', 'p_home', 'p_trip'], notes: ['n1', 'n2', 'n3'], purchases: ['b1', 'b2', 'b3'],
    bookmarks: ['bm1', 'bm2', 'bm3'], accounts: ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7'], headings: ['h1'],
    finance: ['income|planned|9000|Salary', 'income|actual|9000|Salary', 'income|planned|2500|Rental', 'income|actual|2300|Rental', 'expense|planned|3200|Housing', 'expense|actual|3200|Housing', 'expense|planned|2500|Family living', 'expense|actual|1840|Family living', 'expense|planned|600|Transport', 'expense|actual|720|Transport']
  };
  function purgeDemo(d) {
    function keep(list, ids) { return list.filter(function (x) { return ids.indexOf(x.id) < 0; }); }
    d.tasks = d.tasks.filter(function (t) { return DEMO.tasks.indexOf(t.id) < 0 && DEMO.taskTitles.indexOf(t.title) < 0; });
    d.projects = keep(d.projects, DEMO.projects);
    d.tasks.forEach(function (t) { if (DEMO.projects.indexOf(t.project) >= 0) t.project = ''; });
    d.notes = keep(d.notes, DEMO.notes); d.notes.forEach(function (n) { if (DEMO.projects.indexOf(n.project) >= 0) n.project = ''; });
    d.purchases = keep(d.purchases, DEMO.purchases); d.bookmarks = keep(d.bookmarks, DEMO.bookmarks);
    d.headings = keep(d.headings, DEMO.headings); d.accounts = keep(d.accounts, DEMO.accounts);
    d.balances = d.balances.filter(function (b) { return DEMO.accounts.indexOf(b.account) < 0; });
    d.finance = d.finance.filter(function (r) { return DEMO.finance.indexOf([r.kind, r.type, r.amount, r.category].join('|')) < 0; });
    return d;
  }
  var _load = load;
  load = function () {
    var raw = null; try { raw = localStorage.getItem(STORE_KEY); } catch (e) { /* ignore */ }
    if (!raw) return DEMO_FLAG ? seedData() : emptyData();
    var d = _load();
    if (!d.settings.demoPurged) { if (!DEMO_FLAG) purgeDemo(d); d.settings.demoPurged = true; }
    return d;
  };
  actions.resetDemo = function () {
    if (!confirm('Erase all tasks, projects, notes, habits and money records on this device? This can’t be undone.')) return;
    var keepBirth = db.settings.birthDate;
    db = DEMO_FLAG ? seedData() : emptyData(); db.settings.birthDate = keepBirth;
    save(); closeMenu(); ui.stack = []; ui.route = { name: 'home', id: '' };
    try { history.replaceState({ depth: 0 }, '', routeHash(ui.route)); } catch (e) { /* ignore */ }
    render(true); toast('All data erased');
  };

  /* ================= Habits ================= */
  function habitStreak(h) {
    var d = today(), n = 0;
    if (!h.done[d]) d = addDays(d, -1);
    while (h.done[d]) { n++; d = addDays(d, -1); }
    return n;
  }
  function habitDays(h, days, big) {
    var t = today();
    return '<div class="habit-days">' + days.map(function (d) {
      var p = parseYmd(d), on = !!h.done[d];
      return '<button class="hday' + (d === t ? ' is-today' : '') + '" data-act="toggleHabit" data-id="' + esc(h.id) + '" data-date="' + d + '" aria-pressed="' + on + '" aria-label="' + esc(h.name + ', ' + fmtDate(d, { full: true, dow: true }) + (on ? ', done' : ', not done')) + '">' +
        (big ? '<span class="hd-l">' + DOW[p.getDay()].charAt(0) + '</span>' : '') + '<span class="hd-n">' + (on ? '✓' : p.getDate()) + '</span></button>';
    }).join('') + '</div>';
  }
  screens.habits = function () {
    var t = today(), days = []; for (var i = 6; i >= 0; i--) days.push(addDays(t, -i));
    var html = head('Habits', 'Tap a day to mark it done.', '<button class="btn ghost" data-act="newHabit">+ Habit</button>');
    if (!db.habits.length) return html + '<div class="empty">Add a habit you want to keep, then tick it off every day.</div>';
    var month = t.slice(0, 7), dayOfMonth = +t.slice(8, 10);
    return html + db.habits.map(function (h) {
      var s = habitStreak(h), m = 0; Object.keys(h.done).forEach(function (d) { if (h.done[d] && d.slice(0, 7) === month) m++; });
      return '<div class="card pad habit" data-habit="' + esc(h.id) + '"><div class="row between"><button class="habit-name" data-act="editHabit" data-id="' + esc(h.id) + '">' + esc(h.name) + '</button><span class="chip' + (s ? ' accent' : '') + '" data-streak>' + (s ? '🔥 ' + s + ' day' + (s > 1 ? 's' : '') : 'No streak') + '</span></div>' +
        habitDays(h, days, true) + '<div class="muted small">This month: ' + m + ' of ' + dayOfMonth + ' days</div></div>';
    }).join('');
  };
  function habitForm(h) {
    openSheet(h ? 'Edit habit' : 'New habit', '<form data-form="habit" data-id="' + esc(h ? h.id : '') + '" novalidate><label class="field has-mic"><span>Habit</span><input id="hb_name" name="name" value="' + esc(h ? h.name : '') + '" required maxlength="80" autofocus placeholder="e.g. Workout, No sugar, Read 20 pages">' + micBtn('#hb_name') + '</label><p class="hint" id="habitErr" role="alert" style="color:var(--bad)"></p>' +
      '<div class="actions"><button class="btn block" type="submit">Save habit</button>' + (h ? '<button type="button" class="btn danger block" data-act="deleteHabit" data-id="' + esc(h.id) + '">Delete habit</button>' : '') + '</div></form>');
  }
  submitters.habit = function (form) {
    var name = val(form, 'name'); if (!name) { $('#habitErr').textContent = 'Name the habit.'; return; }
    var h = form.dataset.id ? byId(db.habits, form.dataset.id) : null;
    if (h) h.name = name; else db.habits.push({ id: 'hb_' + uid(), name: name, createdAt: Date.now(), done: {} });
    save(); closeSheet(); if (ui.route.name !== 'habits') go('habits'); else render(); toast('Habit saved');
  };
  actions.newHabit = function () { habitForm(null); };
  actions.editHabit = function (el) { var h = byId(db.habits, el.dataset.id); if (h) habitForm(h); };
  actions.deleteHabit = function (el) {
    if (!confirm('Delete this habit and its history?')) return;
    db.habits = db.habits.filter(function (h) { return h.id !== el.dataset.id; }); save(); closeSheet(); render(); toast('Habit deleted');
  };
  actions.toggleHabit = function (el) {
    var h = byId(db.habits, el.dataset.id); if (!h) return;
    var d = el.dataset.date;
    if (h.done[d]) delete h.done[d]; else h.done[d] = true;
    save(); render();
  };

  /* ================= Whole life: 80 years × 52 weeks ================= */
  function utcDay(s) { var p = String(s).split('-'); return Date.UTC(+p[0], +p[1] - 1, +p[2]); }
  function lifePosition(birth, on) {
    var b = String(birth).split('-').map(Number), t = String(on).split('-').map(Number);
    var years = t[0] - b[0]; if (t[1] < b[1] || (t[1] === b[1] && t[2] < b[2])) years--;
    if (years < 0) return null;
    var last = Date.UTC(b[0] + years, b[1] - 1, b[2]);
    var days = Math.floor((utcDay(on) - last) / 86400000);
    var week = Math.min(51, Math.floor(days / 7));
    var next = Date.UTC(b[0] + years + 1, b[1] - 1, b[2]);
    return { years: years, week: week, lived: years * 52 + week, toBirthday: Math.round((next - utcDay(on)) / 86400000) };
  }
  screens.life = function () {
    var birth = db.settings.birthDate;
    var html = head('Whole life', '80 × 52 = 4,160 weeks');
    html += '<label class="card set-row" style="margin-bottom:12px"><span class="set-l">Birth date</span><input type="date" data-setting="birthDate" value="' + esc(birth) + '" max="' + today() + '"></label>';
    if (!birth) return html + '<div class="empty">Enter your birth date to see which week of your life you’re in.</div>';
    var pos = lifePosition(birth, today());
    if (!pos) return html + '<div class="empty">The birth date is in the future.</div>';
    var lived = Math.min(pos.lived, 4160), step = 7.6, cell = 6, L = 24, T = 6, W = L + 52 * step, H = T + 80 * step + 2;
    var cur = lived < 4160 ? { r: Math.floor(lived / 52), c: lived % 52 } : null;
    var svg = '<svg class="life-grid" viewBox="0 0 ' + W.toFixed(1) + ' ' + H.toFixed(1) + '" role="img" aria-label="Life in weeks: ' + lived + ' of 4160 weeks lived" data-lived="' + lived + '">' +
      '<defs><pattern id="lp" x="' + L + '" y="' + T + '" width="' + step + '" height="' + step + '" patternUnits="userSpaceOnUse"><rect width="' + cell + '" height="' + cell + '" rx="1" style="fill:var(--accent)"/></pattern>' +
      '<pattern id="fp" x="' + L + '" y="' + T + '" width="' + step + '" height="' + step + '" patternUnits="userSpaceOnUse"><rect width="' + cell + '" height="' + cell + '" rx="1" style="fill:var(--life-future)"/></pattern></defs>';
    for (var a = 0; a <= 80; a += 10) svg += '<text x="' + (L - 5) + '" y="' + (T + Math.min(a, 79.4) * step + 5) + '" text-anchor="end" font-size="8" style="fill:var(--muted)">' + a + '</text>';
    var fullRows = cur ? cur.r : 80;
    if (fullRows) svg += '<rect x="' + L + '" y="' + T + '" width="' + (52 * step) + '" height="' + (fullRows * step) + '" fill="url(#lp)"/>';
    if (cur) {
      var y = T + cur.r * step;
      for (var c = 0; c < 52; c++) {
        var x = L + c * step;
        if (c === cur.c) continue;
        svg += '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + cell + '" height="' + cell + '" rx="1" style="fill:' + (c < cur.c ? 'var(--accent)' : 'var(--life-future)') + '"/>';
      }
      if (cur.r < 79) svg += '<rect x="' + L + '" y="' + (T + (cur.r + 1) * step).toFixed(1) + '" width="' + (52 * step) + '" height="' + ((79 - cur.r) * step).toFixed(1) + '" fill="url(#fp)"/>';
      var cx = L + cur.c * step, labelLeft = cur.c > 30;
      var lx = labelLeft ? cx - 64 : cx + 22, ly = y - 26 < 4 ? y + 18 : y - 26;
      svg += '<line x1="' + (cx + cell / 2) + '" y1="' + (y + cell / 2) + '" x2="' + (lx + 30) + '" y2="' + (ly + 8) + '" stroke="#F5C518" stroke-width="1.2"/>' +
        '<rect x="' + lx + '" y="' + ly + '" width="60" height="16" rx="8" fill="#1a1d2b" stroke="#F5C518" stroke-width="1"/>' +
        '<text x="' + (lx + 30) + '" y="' + (ly + 11.5) + '" text-anchor="middle" font-size="8.5" font-weight="700" fill="#F5C518">You are here</text>' +
        '<rect id="youAreHere" class="life-now" x="' + (cx - 1.5) + '" y="' + (y - 1.5) + '" width="' + (cell + 3) + '" height="' + (cell + 3) + '" rx="1.5" fill="#F5C518"/>';
    }
    svg += '</svg>';
    var pct = (lived / 4160 * 100).toFixed(1);
    html += '<div class="life-stats">' +
      '<div class="tile static"><div class="l">Weeks lived</div><div class="n" data-k="lived">' + lived.toLocaleString('en-US') + '</div><div class="muted small">' + pct + '% of 80 years</div></div>' +
      '<div class="tile static"><div class="l">Weeks left to 80</div><div class="n" data-k="left">' + Math.max(0, 4160 - lived).toLocaleString('en-US') + '</div><div class="muted small">Next birthday in ' + pos.toBirthday + ' days</div></div></div>';
    html += '<p class="life-where" data-k="where">Age ' + pos.years + ', week ' + (pos.week + 1) + ' of 52 · row ' + (pos.years + 1) + ', column ' + (pos.week + 1) + '</p>';
    return html + '<div class="card life-card">' + svg + '<div class="life-legend"><span><i style="background:var(--accent)"></i>Lived</span><span><i style="background:#F5C518"></i>This week</span><span><i style="background:var(--life-future)"></i>Ahead</span></div></div>';
  };
  document.addEventListener('change', function (e) {
    if (e.target.dataset && e.target.dataset.setting === 'birthDate' && ui.route.name === 'life') setTimeout(render, 0);
  });

  /* ================= Home: habits today ================= */
  var _home3 = screens.home;
  screens.home = function () {
    var html = _home3();
    if (!db.habits.length) return html;
    var t = today();
    var card = section('Habits today', db.habits.filter(function (h) { return h.done[t]; }).length + '/' + db.habits.length, '<button class="link-btn" data-go="habits">All habits</button>') +
      '<div class="list">' + db.habits.map(function (h) {
        var on = !!h.done[t];
        return '<div class="task' + (on ? ' done' : '') + '"><span style="width:12px"></span><button class="check" role="checkbox" aria-checked="' + on + '" data-act="toggleHabit" data-id="' + esc(h.id) + '" data-date="' + t + '" aria-label="' + esc(h.name) + ' today"><span class="box">' + ICON.tick + '</span></button><button class="task-body" data-go="habits"><span class="task-title">' + esc(h.name) + '</span><span class="meta"><span>' + (habitStreak(h) ? '🔥 ' + habitStreak(h) + ' day streak' : 'Start a streak') + '</span></span></button></div>';
      }).join('') + '</div>';
    var i = html.indexOf('<div class="section"><h2>Top priorities');
    return i > 0 ? html.slice(0, i) + card + html.slice(i) : html + card;
  };

  /* ================= Settings: personal ================= */
  var _settings3 = screens.settings;
  screens.settings = function () {
    return _settings3().replace('<div class="section"><h2>Appearance', section('Personal') + '<div class="card set-card">' + setRow('Birth date', '<input type="date" data-setting="birthDate" value="' + esc(db.settings.birthDate) + '" max="' + today() + '">', 'Used for Whole life. Stays on this device.') + '</div><div class="section"><h2>Appearance')
      .replace('Reset demo</button>', 'Erase all data</button>');
  };

  /* ================= boot ================= */
  function boot() {
    sheetWrap = $('#sheetWrap'); sheetEl = $('#sheet');
    db = load(); save();
    $('#toastBtn').addEventListener('click', function () { var f = toastFn; $('#toast').classList.remove('on'); toastFn = null; if (f) f(); });
    $('#importFile').addEventListener('change', function (e) {
      var f = e.target.files && e.target.files[0]; if (!f) return;
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var d = JSON.parse(reader.result);
          if (!d || d.v !== 1 || !Array.isArray(d.tasks)) throw new Error('Not a Focus backup file');
          if (!confirm('Replace current data with this backup?')) return;
          db = normalize(d); save(); closeMenu(); render(true); toast('Backup imported');
        } catch (err) { toast('Import failed: ' + err.message); }
        e.target.value = '';
      };
      reader.readAsText(f);
    });
    $('#ver').textContent = 'Version ' + APP_VERSION + ' · data stays on this device';
    ui.route = (location.hash && location.hash.length > 2) ? parseHash() : { name: ROUTES[db.settings.start] ? db.settings.start : 'home', id: '' };
    if (ROUTES[ui.route.name].sub) {
      var ok = ui.route.name === 'project' ? project(ui.route.id) : ui.route.name === 'note' ? byId(db.notes, ui.route.id) : label(areasList(), ui.route.id);
      if (!ok) ui.route = { name: 'home', id: '' };
    }
    try { history.replaceState({ depth: 0 }, '', routeHash(ui.route)); } catch (e) { /* ignore */ }
    render(true);
    window.FocusDebug = { version: APP_VERSION, actionNames: Object.keys(actions), routes: Object.keys(ROUTES) };
    document.documentElement.setAttribute('data-ready', '1');
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
      navigator.serviceWorker.register('sw.js').catch(function () { /* offline support unavailable */ });
    }
  }
  window.addEventListener('error', function (e) { toast('Error: ' + (e.message || 'unknown')); });
  window.addEventListener('unhandledrejection', function (e) { toast('Error: ' + ((e.reason && e.reason.message) || 'unknown')); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
