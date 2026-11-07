// @ts-check
// Cloud sync tested against an in-memory emulator of the Supabase endpoints Focus uses.
const { test, expect } = require('@playwright/test');
// Tests never talk to the real project: the app is pointed at a fake host that only exists in this emulator.
const BASE = 'https://supabase.test';
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEklEQVR4nGP4z8CAFTEMBQkAOz0/wa5LZ1wAAAAASUVORK5CYII=', 'base64');

function fakeSupabase() {
  const users = {}, tokens = {}, rows = {}, files = {};
  let n = 0;
  const issue = (u) => { const t = 'tok' + (++n); tokens[t] = u.id; return { access_token: t, refresh_token: 'r' + t, expires_in: 3600, user: { id: u.id, email: u.email } }; };
  const who = (req) => tokens[(req.headers()['authorization'] || '').replace('Bearer ', '')];
  return {
    rows,
    async install(context) {
      await context.route(BASE + '/**', async (route) => {
        const req = route.request(), url = new URL(req.url()), p = url.pathname, m = req.method();
        const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS', 'Access-Control-Expose-Headers': '*' };
        const json = (status, body) => route.fulfill({ status, headers: cors, contentType: 'application/json', body: JSON.stringify(body) });
        if (m === 'OPTIONS') return route.fulfill({ status: 204, headers: cors, body: '' });
        if (!req.headers()['apikey']) return json(401, { message: 'No API key' });
        if (p === '/auth/v1/signup') { const b = req.postDataJSON(); if (users[b.email]) return json(422, { msg: 'User already registered' }); users[b.email] = { id: 'u-' + Object.keys(users).length, email: b.email, pw: b.password }; return json(200, issue(users[b.email])); }
        if (p === '/auth/v1/token') {
          const b = req.postDataJSON();
          if (url.searchParams.get('grant_type') === 'password') { const u = users[b.email]; if (!u || u.pw !== b.password) return json(400, { error_description: 'Invalid login credentials' }); return json(200, issue(u)); }
          const old = b.refresh_token.slice(1), uid = tokens[old]; const u = Object.values(users).find((x) => x.id === uid); return u ? json(200, issue(u)) : json(400, { error_description: 'Invalid refresh token' });
        }
        if (p === '/auth/v1/logout') return route.fulfill({ status: 204, headers: cors, body: '' });
        const uid = who(req); if (!uid) return json(401, { message: 'JWT expired' });
        if (p === '/rest/v1/focus_state' && m === 'GET') { const r = rows[uid]; return json(200, r ? [{ data: r.data, vault: r.vault, version: r.version }] : []); }
        if (p === '/rest/v1/rpc/focus_save') {
          const b = req.postDataJSON(), cur = rows[uid];
          if (!cur) { rows[uid] = { data: b.p_data, vault: b.p_vault, version: 1 }; return json(200, [{ new_version: 1, conflict: false, remote_data: null, remote_vault: null }]); }
          if (cur.version !== b.p_base) return json(200, [{ new_version: cur.version, conflict: true, remote_data: cur.data, remote_vault: cur.vault }]);
          cur.data = b.p_data; cur.vault = b.p_vault; cur.version++; return json(200, [{ new_version: cur.version, conflict: false, remote_data: null, remote_vault: null }]);
        }
        if (p.startsWith('/storage/v1/object/')) {
          const key = p.replace('/storage/v1/object/authenticated/', '').replace('/storage/v1/object/', '');
          if (!key.startsWith('photos/' + uid + '/')) return json(403, { message: 'new row violates row-level security policy' });
          if (m === 'POST') { files[key] = { body: req.postDataBuffer(), type: req.headers()['content-type'] }; return json(200, { Key: key }); }
          const f = files[key]; return f ? route.fulfill({ status: 200, headers: cors, contentType: f.type, body: f.body }) : json(404, { message: 'Object not found' });
        }
        return json(404, { message: 'not emulated: ' + m + ' ' + p });
      });
      await context.route(/coingecko|open-meteo/, (r) => r.abort());
    }
  };
}
async function device(browser, sb) {
  const context = await browser.newContext({ ...test.info().project.use, serviceWorkers: 'block', bypassCSP: true });
  await context.addInitScript((u) => { window.FOCUS_CLOUD_URL = u; }, BASE);
  await context.route(/euwrwoxfgeylgyarrzea/, (r) => r.abort());
  await sb.install(context);
  const page = await context.newPage();
  await page.goto('index.html#/account'); await page.waitForSelector('html[data-ready="1"]');
  return { context, page };
}
async function signIn(page, mode = 'in') {
  await page.locator('input[name=email]').fill('alex@example.com');
  await page.locator('input[name=pw]').fill('long-password-1');
  if (mode === 'up') await page.locator('[data-act=cloudSignUp]').click(); else await page.locator('form[data-form=cloudAuth] button[type=submit]').click();
  await expect(page.locator('#cloudEmail')).toHaveText('alex@example.com');
}
async function syncNow(page) {
  await page.evaluate(() => window.FocusDebug.cloud.sync());
}
async function addTask(page, title) {
  await page.evaluate((t) => { location.hash = '#/inbox'; }, title);
  await page.locator('[data-act=newTask]').first().click();
  await page.locator('#sheet input[name=title]').fill(title);
  await page.locator('#sheet button[type=submit]').click();
  await expect(page.locator('#screen .task-title', { hasText: title })).toHaveCount(1);
}

test('cloud: data from one device appears on another; edits flow both ways', async ({ browser }) => {
  const sb = fakeSupabase();
  const A = await device(browser, sb);
  await signIn(A.page, 'up');
  await addTask(A.page, 'Made on the phone');
  await syncNow(A.page);
  expect(sb.rows['u-0'].data.tasks.map((t) => t.title)).toContain('Made on the phone');
  const B = await device(browser, sb);
  await signIn(B.page);
  await B.page.evaluate(() => { location.hash = '#/inbox'; });
  await expect(B.page.locator('#screen .task-title', { hasText: 'Made on the phone' })).toHaveCount(1);
  await addTask(B.page, 'Made on the laptop');
  await syncNow(B.page);
  await syncNow(A.page);
  await A.page.evaluate(() => { location.hash = '#/home'; location.hash = '#/inbox'; });
  await expect(A.page.locator('#screen .task-title', { hasText: 'Made on the laptop' })).toHaveCount(1);
  await A.context.close(); await B.context.close();
});

test('cloud: simultaneous edits on two devices are merged, nothing is lost', async ({ browser }) => {
  const sb = fakeSupabase();
  const A = await device(browser, sb); await signIn(A.page, 'up'); await syncNow(A.page);
  const B = await device(browser, sb); await signIn(B.page);
  // both edit before either syncs
  await A.page.evaluate(() => { const C = window.FocusDebug.cloud; clearTimeout(C.timer); C.schedule = () => {}; });
  await B.page.evaluate(() => { const C = window.FocusDebug.cloud; clearTimeout(C.timer); C.schedule = () => {}; });
  await addTask(A.page, 'From A');
  await addTask(B.page, 'From B');
  await syncNow(A.page); await syncNow(B.page); await syncNow(A.page);
  const titles = sb.rows['u-0'].data.tasks.map((t) => t.title);
  expect(titles).toEqual(expect.arrayContaining(['From A', 'From B']));
  const local = await A.page.evaluate(() => JSON.parse(localStorage.getItem('focus.data.v1')).tasks.map((t) => t.title));
  expect(local).toEqual(expect.arrayContaining(['From A', 'From B']));
  await A.context.close(); await B.context.close();
});

test('cloud: Safe travels only as ciphertext and opens with the same PIN on another device', async ({ browser }) => {
  const sb = fakeSupabase();
  const A = await device(browser, sb); await signIn(A.page, 'up');
  await A.page.evaluate(() => { location.hash = '#/safe'; });
  await A.page.locator('input[name=pin]').fill('4821'); await A.page.locator('input[name=pin2]').fill('4821');
  await A.page.locator('form[data-form=safeSetup] button[type=submit]').click();
  await A.page.locator('[data-act=newSafe]').click();
  await A.page.locator('#sheet input[name=title]').fill('Bank login');
  await A.page.locator('#sheet input[name=secret]').fill('cloud-secret-77');
  await A.page.locator('#sheet button[type=submit]').click();
  await expect(A.page.locator('[data-safe]', { hasText: 'Bank login' })).toHaveCount(1);
  await syncNow(A.page);
  const stored = JSON.stringify(sb.rows['u-0']);
  expect(stored).not.toContain('cloud-secret-77');
  expect(stored).not.toContain('Bank login');
  const B = await device(browser, sb); await signIn(B.page);
  await B.page.evaluate(() => { location.hash = '#/safe'; });
  await B.page.locator('input[name=pin]').fill('4821');
  await B.page.locator('form[data-form=safeUnlock] button[type=submit]').click();
  await expect(B.page.locator('[data-safe]', { hasText: 'Bank login' })).toHaveCount(1);
  await A.context.close(); await B.context.close();
});

test('cloud: a task photo uploads and downloads on the other device', async ({ browser }) => {
  const sb = fakeSupabase();
  const A = await device(browser, sb); await signIn(A.page, 'up');
  await addTask(A.page, 'With photo');
  await A.page.locator('#screen .task-body', { hasText: 'With photo' }).click();
  await A.page.locator('#sheet [data-photo-input]').setInputFiles({ name: 'p.png', mimeType: 'image/png', buffer: PNG });
  await expect(A.page.locator('#thumbs .thumb')).toHaveCount(1);
  await A.page.locator('#sheet button[type=submit]').click();
  await A.page.waitForTimeout(500); await syncNow(A.page);
  const B = await device(browser, sb); await signIn(B.page);
  await B.page.evaluate(() => { location.hash = '#/inbox'; });
  await B.page.locator('#screen .task-body', { hasText: 'With photo' }).click();
  await expect(B.page.locator('#thumbs .thumb img')).toHaveAttribute('src', /^blob:/);
  await A.context.close(); await B.context.close();
});

test('cloud: wrong password is reported; signing out keeps local data', async ({ browser }) => {
  const sb = fakeSupabase();
  const A = await device(browser, sb); await signIn(A.page, 'up');
  await addTask(A.page, 'Keep me');
  await A.page.evaluate(() => { location.hash = '#/account'; });
  A.page.once('dialog', (d) => d.accept());
  await A.page.locator('[data-act=cloudSignOut]').click();
  await expect(A.page.locator('form[data-form=cloudAuth]')).toBeVisible();
  await A.page.locator('input[name=email]').fill('alex@example.com');
  await A.page.locator('input[name=pw]').fill('wrong-password');
  await A.page.locator('form[data-form=cloudAuth] button[type=submit]').click();
  await expect(A.page.locator('#cloudErr')).toHaveText('Wrong email or password.');
  const local = await A.page.evaluate(() => JSON.parse(localStorage.getItem('focus.data.v1')).tasks.map((t) => t.title));
  expect(local).toContain('Keep me');
  await A.context.close();
});
