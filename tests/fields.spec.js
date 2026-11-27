// @ts-check
/* Focus 1.11: every task field, editable option lists, longer description, the feature description in Settings. */
const { test, expect } = require('@playwright/test');

async function press(page, locator) { if (test.info().project.use.hasTouch) await locator.tap(); else await locator.click(); }
async function open(page, hash = '') {
  const errors = [], harness = /access control checks|Load failed|Failed to fetch/i;
  page.on('pageerror', (e) => { if (!harness.test(e.message)) errors.push(e.message); });
  await page.route(/coingecko|open-meteo/, (r) => r.fulfill({ json: {} }));
  await page.goto('index.html?demo=1' + hash);
  await page.waitForSelector('html[data-ready="1"]');
  return errors;
}
const h1 = (page) => page.locator('#screen h1').first();
const stored = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('focus.data.v1')));
const todayYmd = (page) => page.evaluate(() => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); });
async function go(page, route) { await page.evaluate((r) => { location.hash = '#/' + r; }, route); await expect(page.locator('#screen')).toHaveAttribute('data-route', route); }

test('Task: title, description, date, priority, status, list (Today, Backlog), type, area, project, tags, location, repeat, delegated to, links, AI chat', async ({ page }) => {
  const errors = await open(page, '#/inbox');
  await press(page, page.locator('#screen .task-body', { hasText: 'Renew insurance documents' }));
  const F = page.locator('#sheet form[data-form=task]');
  const labels = await F.locator('.field > span').allTextContents();
  for (const l of ['Task title', 'Description', 'List', 'Priority', 'Date', 'Time', 'Type', 'Project', 'Area', 'Location', 'Status', 'Repeat', 'Tags', 'Subtasks', 'Delegated to', 'Photos', 'AI research chat']) expect(labels).toContain(l);
  await expect(F.locator('select[name=list] option')).toHaveText(['Inbox', 'Today', 'Anytime', 'Someday', 'Backlog']);
  await expect(F.locator('select[name=status] option')).toHaveText(['Not started', 'In progress', 'Follow-up', 'Paused', 'Done', 'Archive']);
  await expect(F.locator('select[name=priority] option')).toHaveText(['Urgent', 'High', 'Medium', 'Low']);
  await expect(F.locator('select[name=area] option')).toContainText(['Personal', 'Business']);
  await expect(F.locator('select[name=sphere] option')).toContainText(['Health', 'Security', 'Wealth', 'Family', 'Friends & Relatives', 'Household & Assets management', 'Travel, Leisure & Hobbies', 'Routines', 'Self improvement', 'Recognition', 'Self-realization', 'Betterment']);
  await expect(F.locator('select[name=location] option')).toHaveText(['Any', 'Online', 'USA', 'Russia', 'Bali']);
  await expect(F.locator('select[name=delegatedTo] option')).toContainText(['AI assistant', 'Personal assistant', 'Business assistant']);
  await expect(F.locator('.tag-chip')).toHaveText(['Moscow', 'Bali', 'USA']);
  const desc = await F.locator('textarea[name=notes]').boundingBox();
  expect(desc.height).toBeGreaterThan(200);
  await F.locator('textarea[name=notes]').fill('Collect the policy and the passport copy.');
  await F.locator('select[name=list]').selectOption('_today');
  await F.locator('select[name=sphere]').selectOption({ label: 'Security' });
  await F.locator('select[name=location]').selectOption({ label: 'Bali' });
  await F.locator('select[name=status]').selectOption('doing');
  await F.locator('select[name=delegatedTo]').selectOption('Personal assistant');
  await press(page, F.locator('.tag-chip', { hasText: 'Bali' }));
  await F.locator('textarea[name=links]').fill('example.com/policy\nhttps://insurer.example/claims');
  await F.locator('input[name=aiChat]').fill('https://claude.ai/chat/abc');
  await press(page, page.locator('#sheet button[type=submit]'));
  const t = (await stored(page)).tasks.find((x) => x.id === 't5');
  expect(t.list).toBe('anytime');
  expect(t.date).toBe(await todayYmd(page));
  expect(t.notes).toBe('Collect the policy and the passport copy.');
  expect(t.sphere).toBe('sp_security');
  expect(t.location).toBe('lo_bali');
  expect(t.status).toBe('doing');
  expect(t.delegatedTo).toBe('Personal assistant');
  expect(t.tags).toEqual(['bali']);
  expect(t.links).toEqual(['https://example.com/policy', 'https://insurer.example/claims']);
  expect(t.aiChat).toBe('https://claude.ai/chat/abc');
  await go(page, 'today');
  const row = page.locator('#screen .task', { hasText: 'Renew insurance documents' });
  await expect(row).toContainText('📍 Bali');
  await expect(row).toContainText('Security');
  await press(page, row.locator('.task-body'));
  await expect(page.locator('#sheet a', { hasText: 'Open the AI chat' })).toHaveAttribute('href', 'https://claude.ai/chat/abc');
  expect(errors).toEqual([]);
});

test('Edit the option lists: priorities, types, areas, locations, delegated to', async ({ page }) => {
  await open(page, '#/structure');
  page.on('dialog', (d) => d.accept());
  /* priorities: rename, add, delete (tasks move to Medium); Urgent and Medium stay */
  await press(page, page.locator('[data-act=editOpt][data-kind=priorities][data-id=high]'));
  await page.locator('#sheet input[name=name]').fill('Important');
  await press(page, page.locator('#sheet button[type=submit]'));
  await press(page, page.locator('[data-act=newOpt][data-kind=priorities]'));
  await page.locator('#sheet input[name=name]').fill('Critical');
  await page.locator('#sheet select[name=color]').selectOption('pink');
  await press(page, page.locator('#sheet button[type=submit]'));
  await press(page, page.locator('[data-act=editOpt][data-kind=priorities][data-id=low]'));
  await press(page, page.locator('#sheet [data-act=deleteOpt]'));
  await press(page, page.locator('[data-act=editOpt][data-kind=priorities][data-id=urgent]'));
  await expect(page.locator('#sheet [data-act=deleteOpt]')).toHaveCount(0);
  await page.locator('#sheet [data-act=closeSheet]').click();
  let d = await stored(page);
  expect(d.tasks.filter((t) => t.priority === 'low')).toHaveLength(0);
  expect(d.tasks.find((t) => t.id === 't6').priority).toBe('medium');
  /* locations and areas */
  await press(page, page.locator('[data-act=newOpt][data-kind=locations]'));
  await page.locator('#sheet input[name=name]').fill('Dubai');
  await press(page, page.locator('#sheet button[type=submit]'));
  await press(page, page.locator('[data-act=newOpt][data-kind=spheres]'));
  await page.locator('#sheet input[name=name]').fill('Sport');
  await press(page, page.locator('#sheet button[type=submit]'));
  /* delegated to: add, rename (tasks follow) */
  await press(page, page.locator('[data-act=newAssistant]'));
  await page.locator('#sheet input[name=name]').fill('Wayan');
  await press(page, page.locator('#sheet button[type=submit]'));
  const i = (await stored(page)).settings.assistants.indexOf('Assistant');
  await press(page, page.locator(`[data-act=editAssistant][data-i="${i}"]`));
  await page.locator('#sheet input[name=name]').fill('Ketut');
  await press(page, page.locator('#sheet button[type=submit]'));
  /* types */
  await press(page, page.locator('[data-act=newArea]').first());
  await page.locator('#sheet input[name=name]').fill('Family office');
  await press(page, page.locator('#sheet button[type=submit]'));
  d = await stored(page);
  expect(d.tasks.find((t) => t.id === 't4').delegatedTo).toBe('Ketut');
  expect(d.settings.assistants).toContain('Wayan');
  expect(d.areas.map((a) => a.name)).toContain('Family office');
  /* the form offers all of it */
  await go(page, 'inbox');
  await press(page, page.locator('#screen .task-body').first());
  await expect(page.locator('#sheet select[name=priority] option')).toHaveText(['Urgent', 'Important', 'Medium', 'Critical']);
  await expect(page.locator('#sheet select[name=location] option')).toContainText(['Dubai']);
  await expect(page.locator('#sheet select[name=sphere] option')).toContainText(['Sport']);
  await expect(page.locator('#sheet select[name=delegatedTo] option')).toContainText(['Ketut', 'Wayan']);
  await expect(page.locator('#sheet select[name=area] option')).toContainText(['Family office']);
});

test('Settings: “What Focus can do” shows the feature description; Types in the menu', async ({ page }) => {
  await open(page, '#/settings');
  await press(page, page.locator('#screen [data-go=about]'));
  await expect(h1(page)).toHaveText('What Focus can do');
  await expect(page.locator('#screen .doc h3').first()).toBeVisible();
  await expect(page.locator('#screen .doc')).toContainText('Backlog');
  await expect(page.locator('#screen .doc strong').first()).toBeVisible();
  await go(page, 'areas');
  await expect(h1(page)).toHaveText('Types');
});
