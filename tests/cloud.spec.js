// @ts-check
// Cloud sync tested against an in-memory emulator of the Supabase endpoints Focus uses.
const { test, expect } = require('@playwright/test');
// Tests never talk to the real project: the app is pointed at a fake host that only exists in this emulator.
const BASE = 'https://supabase.test';
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEklEQVR4nGP4z8CAFTEMBQkAOz0/wa5LZ1wAAAAASUVORK5CYII=', 'base64');

function fakeSupabase() {
  const users = {}, tokens = {}, rows = {}, files = {}, codes = {};
  let n = 0;
  const issue = (u) => { const t = 'tok' + (++n); tokens[t] = u.id; return { access_token: t, refresh_token: 'r' + t, expires_in: 3600, user: { id: u.id, email: u.email } }; };
  const who = (req) => tokens[(req.headers()['authorization'] || '').replace('Bearer ', '')];
  return {
    rows, codes, users,
    mint(email) { return issue(users[email]); },
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
        if (p === '/auth/v1/otp') { const b = req.postDataJSON(); if (!users[b.email]) return json(422, { code: 'otp_disabled', msg: 'Signups not allowed for otp' }); codes[b.email] = '123456'; return json(200, {}); }
        if (p === '/auth/v1/verify') { const b = req.postDataJSON(); if (b.type !== 'email' || !codes[b.email] || codes[b.email] !== b.token) return json(403, { code: 'otp_expired', msg: 'Token has expired or is invalid' }); delete codes[b.email]; return json(200, issue(users[b.email])); }
        if (p === '/auth/v1/logout') return route.fulfill({ status: 204, headers: cors, body: '' });
        const uid = who(req); if (!uid) return json(401, { message: 'JWT expired' });
        if (p === '/auth/v1/user') { const u = Object.values(users).find((x) => x.id === uid); if (m === 'PUT') u.pw = req.postDataJSON().password; return json(200, { id: u.id, email: u.email }); }
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
  await page.locator('[data-act=authTab][data-v=pw]').first().click();
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

/* ---------- v1.5: email code, email links, app lock ---------- */
async function code(page, text) { await page.locator('input[name=code]').fill(text); await page.locator('form[data-form=cloudCode] button[type=submit]').click(); }
async function tapPin(page, pin) { for (const d of pin) await page.locator(`#appLock [data-lock=digit][data-d="${d}"]`).click(); }
async function setLock(page, pin) {
  await page.evaluate(() => { location.hash = '#/account'; });
  await page.locator('[data-act=lockSetup]').click();
  await page.locator('#sheet input[name=pin]').fill(pin);
  await page.locator('#sheet input[name=pin2]').fill(pin);
  await page.locator('#sheet button[type=submit]').click();
  await expect(page.locator('#toastMsg')).toHaveText('App lock is on');
}
async function reload(page) { await page.reload(); await page.waitForSelector('html[data-ready="1"]'); }

test('login: a code from email signs in on a second device; an unknown email is refused', async ({ browser }) => {
  const sb = fakeSupabase();
  const A = await device(browser, sb); await signIn(A.page, 'up');
  await addTask(A.page, 'From the phone'); await syncNow(A.page);
  const B = await device(browser, sb);
  await B.page.locator('input[name=email]').fill('nobody@example.com');
  await B.page.locator('form[data-form=cloudCode] button[type=submit]').click();
  await expect(B.page.locator('#cloudErr')).toHaveText('No Focus account uses this email.');
  await B.page.locator('input[name=email]').fill('alex@example.com');
  await B.page.locator('form[data-form=cloudCode] button[type=submit]').click();
  await expect(B.page.locator('input[name=code]')).toBeVisible();
  await code(B.page, '000000');
  await expect(B.page.locator('#cloudErr')).toHaveText('That code is wrong or has expired. Send a new one.');
  await code(B.page, '123456');
  await expect(B.page.locator('#cloudEmail')).toHaveText('alex@example.com');
  await B.page.evaluate(() => { location.hash = '#/inbox'; });
  await expect(B.page.locator('#screen .task-title', { hasText: 'From the phone' })).toHaveCount(1);
  await A.context.close(); await B.context.close();
});

test('login: the link in a Supabase email signs in; an expired link explains what to do', async ({ browser }) => {
  const sb = fakeSupabase();
  const A = await device(browser, sb); await signIn(A.page, 'up');
  const B = await device(browser, sb);
  await B.page.goto('index.html#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired');
  await B.page.waitForSelector('html[data-ready="1"]');
  await expect(B.page.locator('#cloudNote')).toContainText('expired');
  const t = sb.mint('alex@example.com');
  await B.page.goto(`index.html#access_token=${t.access_token}&refresh_token=${t.refresh_token}&expires_in=3600&token_type=bearer&type=magiclink`);
  await B.page.waitForSelector('html[data-ready="1"]');
  await expect(B.page.locator('#cloudEmail')).toHaveText('alex@example.com');
  expect(await B.page.evaluate(() => location.hash)).toBe('#/account');
  await A.context.close(); await B.context.close();
});

test('login: password can be changed in the app', async ({ browser }) => {
  const sb = fakeSupabase();
  const A = await device(browser, sb); await signIn(A.page, 'up');
  await A.page.locator('[data-act=changePassword]').click();
  await A.page.locator('#sheet input[name=pw]').fill('brand-new-pass');
  await A.page.locator('#sheet input[name=pw2]').fill('brand-new-pass');
  await A.page.locator('#sheet button[type=submit]').click();
  await expect(A.page.locator('#toastMsg')).toHaveText('Password saved');
  expect(sb.users['alex@example.com'].pw).toBe('brand-new-pass');
  await A.context.close();
});

test('lock: 6-digit PIN is asked on launch and after leaving; wrong PIN is refused', async ({ browser }) => {
  const sb = fakeSupabase();
  const A = await device(browser, sb); await signIn(A.page, 'up');
  await A.page.locator('[data-act=lockSetup]').click();
  await A.page.locator('#sheet input[name=pin]').fill('123456');
  await A.page.locator('#sheet input[name=pin2]').fill('123456');
  await A.page.locator('#sheet button[type=submit]').click();
  await expect(A.page.locator('#lockPinErr')).toContainText('too easy');
  await A.page.locator('[data-act=closeSheet]').click();
  await setLock(A.page, '258014');
  await reload(A.page);
  await expect(A.page.locator('#appLock')).toBeVisible();
  await expect(A.page.locator('#screen')).toHaveAttribute('inert', '');
  await tapPin(A.page, '258015');
  await expect(A.page.locator('#lockErr')).toHaveText('Wrong PIN. Try again.');
  await tapPin(A.page, '258014');
  await expect(A.page.locator('#appLock')).toHaveCount(0);
  await A.page.locator('select[data-lockafter]').selectOption('0');
  await A.page.evaluate(() => { Object.defineProperty(document, 'hidden', { value: true, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
  await expect(A.page.locator('#appLock')).toBeVisible();
  await A.page.keyboard.type('258014');
  await expect(A.page.locator('#appLock')).toHaveCount(0);
  await A.context.close();
});

test('lock: a forgotten PIN is reset with a code from email', async ({ browser }) => {
  const sb = fakeSupabase();
  const A = await device(browser, sb); await signIn(A.page, 'up');
  await setLock(A.page, '470259');
  await reload(A.page);
  await A.page.locator('#appLock [data-lock=forgot]').click();
  await expect(A.page.locator('#appLock')).toContainText('a•••@example.com');
  await A.page.locator('#appLock button[type=submit]').click();
  await A.page.locator('#appLock input[name=code]').fill('123456');
  await A.page.locator('#appLock button[type=submit]').click();
  await expect(A.page.locator('#appLock')).toHaveCount(0);
  await expect(A.page.locator('#toastMsg')).toHaveText('App lock is off. Set a new PIN below.');
  await expect(A.page.locator('[data-act=lockSetup]')).toHaveText('Set up');
  await A.context.close();
});

test('lock: Face ID unlocks (platform authenticator)', async ({ browser, browserName }) => {
  test.skip(browserName !== 'chromium', 'virtual authenticator needs Chromium');
  const sb = fakeSupabase();
  const A = await device(browser, sb);
  const cdp = await A.context.newCDPSession(A.page);
  await cdp.send('WebAuthn.enable');
  await cdp.send('WebAuthn.addVirtualAuthenticator', { options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true } });
  await signIn(A.page, 'up');
  await setLock(A.page, '470259');
  await A.page.locator('[data-act=lockFaceOn]').click();
  await expect(A.page.locator('#toastMsg')).toHaveText('Face ID is on');
  await reload(A.page);
  await A.page.locator('#appLock [data-lock=face]').click();
  await expect(A.page.locator('#appLock')).toHaveCount(0);
  await A.context.close();
});
