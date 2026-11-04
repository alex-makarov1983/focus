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
  var AREAS = [['personal', 'Personal'], ['business', 'Business']];
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
  function minOrder() { var m = 0; db.tasks.forEach(function (t) { if (t.order < m) m = t.order; }); return m; }

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
    else if (taskArea(t)) bits.push('<span>' + esc(label(AREAS, taskArea(t))) + '</span>');
    if (t.date && opts.showDate !== false) {
      var od = !t.done && t.date < today();
      bits.push('<span class="chip' + (od ? ' overdue' : '') + '">' + esc(fmtDate(t.date)) + (t.time ? ' ' + esc(t.time) : '') + '</span>');
    } else if (t.time && opts.showTime) bits.push('<span class="chip">' + esc(t.time) + '</span>');
    if (t.status === 'waiting' && !t.done) bits.push('<span class="chip accent">Waiting</span>');
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
    if (w.length) html += section('Waiting for response', w.length) + taskList(w, 'waiting', '', { sortable: false });
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
      '<div class="meta">' + esc(label(AREAS, p.area)) + (p.status !== 'active' ? ' · ' + esc(p.status[0].toUpperCase() + p.status.slice(1)) : '') + ' · ' + s.done + '/' + s.total + ' done</div>' +
      '<div class="bar"><span style="width:' + s.pct + '%"></span></div></button>';
  }
  screens.areas = function () {
    var html = head('Areas', 'Every project belongs to one area.') + '<div class="area-tiles">';
    AREAS.forEach(function (a) {
      var ps = db.projects.filter(function (p) { return p.area === a[0]; });
      var open = db.tasks.filter(function (t) { return isOpen(t) && taskArea(t) === a[0]; }).length;
      html += '<button class="area-tile" data-go="area" data-id="' + a[0] + '"><span class="mark">' + (a[0] === 'personal' ? ICON.person : ICON.briefcase) + '</span><span><h3>' + a[1] + '</h3><span class="muted small">' + ps.length + ' projects · ' + open + ' open tasks</span></span></button>';
    });
    return html + '</div>';
  };
  screens.area = function (id) {
    var a = label(AREAS, id);
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
    html += '<div class="seg" role="group" aria-label="Filter by area">' + [['all', 'All']].concat(AREAS).map(function (x) {
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
    var html = head(p.name, esc(label(AREAS, p.area)) + ' · ' + esc(p.status[0].toUpperCase() + p.status.slice(1)), '<button class="btn plain" data-act="editProject" data-id="' + esc(id) + '">Edit</button>');
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
    if (p) meta.push(p.name); else if (n.area) meta.push(label(AREAS, n.area));
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
    var projOpts = '<option value="">No project</option>' + AREAS.map(function (a) {
      return '<optgroup label="' + a[1] + '">' + db.projects.filter(function (p) { return p.area === a[0]; }).map(function (p) { return '<option value="' + esc(p.id) + '"' + (p.id === n.project ? ' selected' : '') + '>' + esc(p.name) + '</option>'; }).join('') + '</optgroup>';
    }).join('');
    return '<div class="note-editor" data-note="' + esc(id) + '">' +
      '<input class="title-in" data-note-field="title" placeholder="Title" value="' + esc(n.title) + '" aria-label="Note title">' +
      '<div class="note-meta"><select data-note-field="area" aria-label="Area"><option value="">No area</option>' + options(AREAS, n.area) + '</select>' +
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
    var html = head('Income & Expenses', 'Planned vs actual, per currency');
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

  /* ================= Safe Storage (client-side encrypted) ================= */
  var Vault = {
    key: null, records: null, lastActivity: 0, hiddenAt: 0,
    supported: function () { return !!(window.crypto && window.crypto.subtle && window.isSecureContext !== false); },
    exists: function () { try { return !!localStorage.getItem(VAULT_KEY); } catch (e) { return false; } },
    unlocked: function () { return !!this.key; },
    derive: function (pw, salt, iterations) {
      var enc = new TextEncoder();
      return crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveKey']).then(function (base) {
        return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: salt, iterations: iterations, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
      });
    },
    create: function (pw) {
      var self = this; var salt = crypto.getRandomValues(new Uint8Array(16));
      return this.derive(pw, salt, 310000).then(function (key) {
        self.key = key; self.salt = salt; self.iterations = 310000; self.records = [];
        self.touch(); return self.persist();
      });
    },
    unlock: function (pw) {
      var self = this; var blob = JSON.parse(localStorage.getItem(VAULT_KEY));
      var salt = b64d(blob.salt), iv = b64d(blob.iv), ct = b64d(blob.ct);
      return this.derive(pw, salt, blob.iterations).then(function (key) {
        return crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv }, key, ct).then(function (plain) {
          self.records = JSON.parse(new TextDecoder().decode(plain));
          self.key = key; self.salt = salt; self.iterations = blob.iterations; self.touch();
        });
      });
    },
    persist: function () {
      var self = this; var iv = crypto.getRandomValues(new Uint8Array(12));
      var data = new TextEncoder().encode(JSON.stringify(this.records));
      return crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, this.key, data).then(function (ct) {
        localStorage.setItem(VAULT_KEY, JSON.stringify({ v: 1, kdf: 'PBKDF2-SHA256', iterations: self.iterations, salt: b64e(self.salt), iv: b64e(iv), ct: b64e(new Uint8Array(ct)) }));
      });
    },
    lock: function () { this.key = null; this.records = null; this.salt = null; ui.revealed = {}; },
    wipe: function () { this.lock(); try { localStorage.removeItem(VAULT_KEY); } catch (e) { /* ignore */ } },
    touch: function () { this.lastActivity = Date.now(); }
  };
  function b64e(u8) { var s = ''; for (var i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]); return btoa(s); }
  function b64d(str) { var s = atob(str); var u = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; }
  setInterval(function () {
    if (Vault.unlocked() && Date.now() - Vault.lastActivity > 5 * 60 * 1000) { Vault.lock(); if (ui.route.name === 'safe') render(); toast('Safe Storage locked after 5 minutes of inactivity'); }
  }, 15000);
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) Vault.hiddenAt = Date.now();
    else if (Vault.unlocked() && Vault.hiddenAt && Date.now() - Vault.hiddenAt > 60000) { Vault.lock(); if (ui.route.name === 'safe') render(); }
  });

  screens.safe = function () {
    var html = head('Safe Storage', 'Logins, links, contacts and other details you use often.');
    var warn = '<div class="notice">Encrypted on this device with your Safe password (AES-GCM). This is a prototype that has not had a security audit, so keep real passwords and card numbers in a dedicated password manager for now.</div>';
    if (!Vault.supported()) return html + '<div class="empty">Safe Storage needs a secure (https) connection. Open Focus from its https address.</div>';
    if (!Vault.exists()) {
      return html + warn +
        '<form class="card pad" style="margin-top:12px" data-form="safeSetup" autocomplete="off"><h2 style="margin:0 0 4px;font-size:19px">Create a Safe password</h2><p class="muted small" style="margin:0">It never leaves this device. If you forget it, the Safe cannot be recovered.</p>' +
        '<label class="field"><span>Safe password (at least 8 characters)</span><input type="password" name="pw" minlength="8" required autocomplete="new-password"></label>' +
        '<label class="field"><span>Repeat password</span><input type="password" name="pw2" minlength="8" required autocomplete="new-password"></label>' +
        '<p class="hint" id="safeErr" role="alert"></p><button class="btn block" type="submit">Create Safe</button></form>';
    }
    if (!Vault.unlocked()) {
      return html + '<form class="card pad" data-form="safeUnlock" autocomplete="off"><h2 style="margin:0 0 4px;font-size:19px">Safe is locked</h2><p class="muted small" style="margin:0">Enter your Safe password to view records.</p>' +
        '<label class="field"><span>Safe password</span><input type="password" name="pw" required autocomplete="current-password"></label>' +
        '<p class="hint" id="safeErr" role="alert"></p><button class="btn block" type="submit">Unlock</button></form>' +
        '<button class="link-btn" style="margin-top:12px" data-act="safeReset">Forgot password? Erase Safe Storage</button>';
    }
    var q = ui.safeQuery.trim().toLowerCase();
    var recs = Vault.records.filter(function (r) { return !q || (r.title + ' ' + r.type + ' ' + r.link + ' ' + r.login + ' ' + r.note).toLowerCase().indexOf(q) >= 0; })
      .sort(function (a, b) { return a.title.localeCompare(b.title); });
    html += '<div class="btn-row" style="margin-bottom:12px"><button class="btn" data-act="newSafe">+ Add record</button><button class="btn plain" data-act="safeLock">' + ICON.lock + 'Lock</button></div>';
    html += '<input class="input search" type="search" placeholder="Search Safe" data-input="safeQuery" value="' + esc(ui.safeQuery) + '" aria-label="Search Safe Storage">';
    html += recs.length ? recs.map(safeCard).join('') : '<div class="empty">' + (q ? 'No records match.' : 'No records yet. Add a link, login, contact or note.') + '</div>';
    return html + '<p class="muted small" style="margin-top:14px">Locks automatically after 5 minutes without activity.</p>';
  };
  function safeCard(r) {
    var shown = !!ui.revealed[r.id];
    var rows = '';
    if (r.link) rows += '<div class="secret-row"><span class="label">Link</span><span class="val"><a href="' + esc(/^https?:\/\//i.test(r.link) ? r.link : 'https://' + r.link) + '" target="_blank" rel="noopener noreferrer">' + esc(r.link) + '</a></span></div>';
    if (r.login) rows += '<div class="secret-row"><span class="label">Login</span><span class="val">' + esc(r.login) + '</span><button class="tiny-btn" data-act="safeCopy" data-id="' + esc(r.id) + '" data-f="login">Copy</button></div>';
    if (r.secret) rows += '<div class="secret-row"><span class="label">Password</span><span class="val" data-secret="' + esc(r.id) + '">' + (shown ? esc(r.secret) : '••••••••') + '</span><button class="tiny-btn" data-act="safeReveal" data-id="' + esc(r.id) + '" aria-pressed="' + shown + '">' + (shown ? 'Hide' : 'Show') + '</button><button class="tiny-btn" data-act="safeCopy" data-id="' + esc(r.id) + '" data-f="secret">Copy</button></div>';
    if (r.note) rows += '<div class="secret-row"><span class="label">Note</span><span class="val" style="white-space:pre-wrap">' + esc(r.note) + '</span></div>';
    return '<div class="card pad" style="margin-bottom:10px" data-safe="' + esc(r.id) + '"><div class="row between"><h3 style="margin:0;font-size:17px">' + esc(r.title) + '</h3><span class="row"><span class="chip">' + esc(r.type) + '</span><button class="tiny-btn" data-act="editSafe" data-id="' + esc(r.id) + '">Edit</button></span></div>' + rows + '</div>';
  }

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
    return '<option value="">No project</option>' + AREAS.map(function (a) {
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
      '<div class="fields2"><label class="field"><span>Area</span><select name="area"><option value="">None</option>' + options(AREAS, t.area) + '</select></label>' +
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
      '<label class="field"><span>Area</span><select name="area">' + options(AREAS, p.area) + '</select></label>' +
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
  function safeForm(r) {
    var isNew = !r;
    r = r || { title: '', type: 'Login', link: '', login: '', secret: '', note: '' };
    openSheet(isNew ? 'New Safe record' : 'Edit Safe record', '<form data-form="safe" data-id="' + esc(isNew ? '' : r.id) + '" autocomplete="off" novalidate>' +
      '<label class="field"><span>Name</span><input name="title" value="' + esc(r.title) + '" required placeholder="e.g. Bank website"' + (isNew ? ' autofocus' : '') + '></label><p class="hint" id="safeFormErr" role="alert" style="color:var(--bad)"></p>' +
      '<label class="field"><span>Type</span><select name="type">' + options(SAFE_TYPES, r.type) + '</select></label>' +
      '<label class="field"><span>Link</span><input name="link" value="' + esc(r.link) + '" inputmode="url" autocapitalize="off" placeholder="example.com"></label>' +
      '<label class="field"><span>Login, email or phone</span><input name="login" value="' + esc(r.login) + '" autocapitalize="off" autocorrect="off" spellcheck="false"></label>' +
      '<label class="field"><span>Password or secret</span><input name="secret" type="password" value="' + esc(r.secret) + '" autocomplete="new-password"></label>' +
      '<label class="field"><span>Note</span><textarea name="note" rows="3">' + esc(r.note) + '</textarea></label>' +
      '<div class="actions"><button class="btn block" type="submit">' + (isNew ? 'Save record' : 'Save changes') + '</button>' +
      (isNew ? '' : '<button type="button" class="btn danger block" data-act="deleteSafe" data-id="' + esc(r.id) + '">Delete record</button>') + '</div></form>');
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
    var ts = ids.map(task).filter(Boolean);
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
      var t = isNew ? { id: uid(), done: false, completedAt: '', order: minOrder() - 1, createdAt: Date.now(), subtasks: [] } : task(id);
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
      p.name = name; p.area = val(form, 'area') === 'business' ? 'business' : 'personal'; p.status = val(form, 'status') || 'active';
      if (!id) db.projects.push(p);
      db.tasks.forEach(function (t) { if (t.project === p.id) t.area = p.area; });
      save(); closeSheet();
      if (!id) { go('project', p.id); toast('Project created in ' + label(AREAS, p.area)); }
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
        if (ui.kanbanBy === 'status') setTaskStatus(t, key); else t.priority = key;
      }
      reorderIds(ids);
      save(); render();
      if (t && list !== d.from) toast('Moved to ' + (label(STATUSES, key) || label(PRIORITIES, key)));
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
    if (r.name === 'area') return label(AREAS, r.id) || 'Area';
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
    $('#backBtn').hidden = !(ui.stack.length || r.name !== 'home');
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
    ui.route = parseHash();
    if (ROUTES[ui.route.name].sub) {
      var ok = ui.route.name === 'project' ? project(ui.route.id) : ui.route.name === 'note' ? byId(db.notes, ui.route.id) : label(AREAS, ui.route.id);
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
