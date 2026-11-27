# Focus

A mobile-first personal workspace that runs in Safari on iPhone and installs to the Home Screen as an app (PWA). Tasks, projects, notes, calendar, kanban, Safe Storage, income and expenses, and major purchases in one place.

Plain HTML, CSS and JavaScript with no frameworks and no build step, so there is nothing to compile and nothing that can fail to load from a third-party server.

## What's inside

Full description in Russian: [docs/FEATURES.md](docs/FEATURES.md).

Main screens: Home, All tasks, Inbox, Today, Most important & Urgent, Upcoming, Anytime, Someday, your own lists, Follow-up, Delegated, Paused, Archive, Logbook, Calendar, Kanban, Areas, Projects, Notes, Safe Storage, Money, Major Purchases, Habits, Journal, Whole life, Friends, Travel, Bookmarks, Watch · Read · Listen, AI assistant, Settings, and Lists, tags & layout.

- **Navigation.** Hamburger menu on the left of every screen. Sections are grouped (Tasks, Views, Areas & projects, Life, Knowledge, Vault, Money, App); tap a group name to fold it, and the menu remembers. Areas show their projects underneath with a progress ring. Back returns to the previous screen; the iOS swipe-back gesture works too. Bottom bar has Home, Today, **+**, Calendar and Inbox (with a count).
- **Add where you are.** Every task list ends with a one-line field: type a title and press Return. The task lands in the section you're on (Today gets today's date, Most important gets Urgent, Follow-up and Paused set the status, a project or area files it there, Deadlines asks for the date), and the line stays open for the next one. Undo is in the message that appears. The ⋯ button opens the full form, already set to that section.
- **+ button** adds to the screen you're on: a one-line task (or a note, from Notes), with Task, Assistant, Note, Safe, Income, Expense, Balance and Bookmark below it. On Money, Safe, Bookmarks, Watch · Read · Listen, Habits, Friends, Travel, Major Purchases and Journal it opens that section's own form.
- **Tasks.** From Home and Inbox, new tasks go to **Inbox** (or the list you choose in settings). Priorities are Urgent, High, Medium and Low. Each task has a list, date and time, status, tags, area, project, repeat, notes, subtasks and an optional **Hard deadline**. Completing a repeating task creates the next one. Every completion can be undone.
- **Lists (v1.10).** Inbox, Today, Most important & Urgent, Anytime and Someday, plus lists you create (Errands, Calls, a client…). Your lists can be renamed, sorted and deleted (their tasks move to Inbox); built-in ones can be renamed, sorted and hidden. Today and Most important are smart lists: Today shows tasks dated today or earlier, Most important shows Urgent tasks. Every list has its own page, a menu entry with a count and a Home tile.
- **All tasks (v1.10).** Every list on one page. Drag ⋮⋮ to move a task from one list to another, also into an empty list. Dropping into Today sets today's date, into Most important sets Urgent, into Anytime clears today's date and Urgent. Undo is in the message.
- **Statuses and tags (v1.10).** Statuses: Not started, In progress, Done, Paused, Archive, plus your own, each with a colour. Not started and Done can be renamed but not deleted; deleting another status returns its tasks to Not started. Archive takes a task out of every list and keeps it under Archive. Tags: Follow-up, Delegated and your own, picked in the task form and shown on task rows; each tag has its own page. Follow-up used to be a status and is converted automatically; delegating to an assistant adds the Delegated tag.
- **More sections (v1.10).** Places visited (200 countries, 63 US national parks, 50 top destinations), Message inboxes (where to check messages, ticked off each day), Copy-paste data (text to copy in one tap; not encrypted), Shopping lists (Shopping, Groceries, Travel packing and your own), My social media, Feature requests (with “copy the list for Claude”). Home adds EUR and AUD rates, S&P 500 and Dow Jones links, a calculator and Readme mindset. Watch · Read · Listen takes just a title or a link. Pull down to refresh.
- **Lists, tags & layout (v1.10).** Settings → Lists, statuses, tags, Home tiles and menu: create, rename, recolour, reorder and delete lists, statuses and tags; choose and order the Home tiles; hide menu entries you don't use; pick the start page and the list new tasks go to; show or hide empty lists on All tasks, statuses and tags on task rows.
- **Deadlines.** Tasks with a hard due date, grouped into Overdue, Next 7 days and Later, each showing how many days are left. The menu shows when the next one is due; Home lists this week's.
- **Home.** Clocks (LA, New York, Moscow, Bali), weather, sunrise/sunset and a traffic map for where you are, exchange rates, Today's focus (the first three tasks in Today), Most important, a tile with the count for each list (Inbox, Today, Most important, Anytime, Someday, your lists, Follow-up, Delegated, Paused, Done, All; configurable), time left in the day/week/month/year/80 years, Safe, Money (hidden until you tap Show), shortcuts, then My priorities, Habits today and How was today.
- **Assistant.** Tap ✦ and type or dictate several items at once. Pick a type with one tap (Auto, Task, Note, Expense, Income, Link, Habit, Watch/Read) or let it guess. It understands dates (tomorrow, in 3 days, next week, Friday, 25.12), times, “every week”, “someday”, “waiting”, “deadline”, “!” for urgent, #project and @assistant, and amounts like “taxi 1200 руб”. Tasks go to the screen you opened it from. Undo is in the message after Apply.
- **Edits save themselves.** Closing a form with ✕, a swipe or a tap outside saves what you changed. A form with a required field left empty just closes.
- **Location.** Weather, sunrise and the traffic map follow the phone's time zone when the saved position is clearly from somewhere else (for example Moscow while you're on Bali time). Tap the weather tile to refresh your exact position.
- **Search.** The search field at the top of Home (and the 🔍 in the top bar on every screen) finds tasks, projects, notes, links, Watch · Read · Listen, habits, friends, trips, purchases, accounts, money records, the journal and, when unlocked, Safe titles.
- **Regular routines.** Every repeating task in one place, grouped by how often it repeats, with a one-line add and a frequency picker.
- **AI assistant.** A chat that knows your life priorities, tasks, projects, deadlines, habits, journal and money totals (never the Safe). It plans your day, asks you questions, creates and updates tasks and notes, and researches on the web with links. Uses your own Anthropic API key, stored only on the device. “Research this task with AI” is in every task.
- **Journal.** Rate each day with one of five faces and add a note. Today's rating is also at the bottom of Home.
- **Drag and drop.** Hold the ⋮⋮ handle to reorder anything: tasks in every list, Today's focus, projects, areas, notes (in “My order”), bookmarks, Watch · Read · Listen, habits, friends, trips, trip checklists, major purchases, Safe records, accounts (Money → Reorder), subtasks, My priorities and Home shortcuts (tap Edit). On Kanban, drag cards between columns; hold at the screen edge to shift the board one column. Lists sorted by date (Upcoming, Deadlines, Calendar, Logbook, money history, Journal) stay in date order.
- **Forms.** The main button (Save, Add, Apply) sits at the top of every form, next to ✕, so the keyboard never hides it. The one-line add field sits at the top of each task list.
- **Areas.** Exactly two: Personal and Business. Every project belongs to one of them.
- **Calendar.** Month, Week and Day views.
- **Notes.** Autosaved, searchable, pinnable, linkable to an area or project. "Lines → tasks" turns each line into an Inbox task.
- **Income & Expenses.** Add Income and Add Expense buttons. Each record has Planned or Actual, date, amount, currency, category and note. Totals, balance and category bars recalculate from records, per currency, by month or year. Currencies are never mixed.
- **Major Purchases.** Budget, saved amount, currency, priority, status and target date, with totals per currency.
- **Safe Storage.** Link, login, password and note records (plus contacts, cards, documents), encrypted on the device with AES-GCM using a key derived from your Safe password (PBKDF2-SHA256, 310,000 iterations). Auto-locks after 5 minutes. **This has not had a security audit.** Keep real passwords and card numbers in a dedicated password manager until it has.
- **iPad and desktop.** On screens 900 px and wider (iPad in landscape, a laptop or desktop browser) the menu stays open as a sidebar with **New** and **Search** at the top, the bottom bar is hidden, and forms open as dialogs in the middle of the screen. Keyboard: **N** adds, **/** searches, **Esc** closes. iPad in portrait and phones keep the phone layout.
- **Safe in the cloud.** The 4-digit PIN and Face ID only unlock the Safe on the device. The Safe goes to the cloud only after you set a **Safe password** (at least 10 characters; Settings → Safe Storage), and the cloud copy can only be opened with that password. On a new device you enter it once, then choose a PIN for that device.
- **Security.** Strict Content Security Policy (no inline scripts), links that could run code (javascript:, data:) are blocked, the app refuses to run inside another site's frame, no referrer is sent, and the AI assistant treats web pages as data, not instructions.
- **Offline.** After the first visit the app opens without a connection.
- **Data** stays in the browser on your device (localStorage). Export and Import are at the bottom of the menu. There is no server and no account yet.

## Publish on GitHub Pages

1. Create a new **public** repository on github.com, for example `focus`. Don't add a README.
2. Upload this folder. From a terminal inside the folder:

   ```bash
   git init
   git add .
   git commit -m "Focus PWA"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/focus.git
   git push -u origin main
   ```

   (Or use GitHub Desktop: *Add existing repository* → *Publish*. The hidden `.github` folder must be included; it holds the deploy workflow.)
3. In the repository: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
4. Open the **Actions** tab. The workflow runs the browser tests (iPhone WebKit and Chromium), publishes the site, then runs the tests again against the live https address. When it is green, the address is shown on the deploy step, typically `https://YOUR-USERNAME.github.io/focus/`.

Every later `git push` to `main` re-tests and re-deploys. If tests fail, nothing is published.

## Install on iPhone

Open the https address in **Safari** → Share → **Add to Home Screen**. Focus then opens full screen like a native app.

Don't test by opening `index.html` from Files, Mail or a chat attachment: those previews don't run JavaScript, which is why earlier prototypes looked empty and buttons did nothing.

## Run and test locally

```bash
npm install
npx playwright install chromium webkit
npm start            # http://localhost:4173
npm test             # all browser tests
```

Tests live in `tests/focus.spec.js`. They cover every screen, navigation, Back, every button being wired, task capture to Inbox, persistence after reload, Today/Logbook, repeats, notes, finance math, calendar views, touch drag-and-drop (list and Kanban), areas and projects, Safe Storage encryption and locking, purchases, and offline start.

## Privacy

The repository and the public site contain **demo data only**. Your own data never leaves your device unless you export it. Don't commit exported backups or real credentials to this repository.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | App shell |
| `styles.css` | Styles, light and dark mode |
| `app.js` | All app logic |
| `sw.js` | Service worker (offline) |
| `manifest.webmanifest`, `icons/` | Home Screen install |
| `tests/`, `playwright.config.js` | Automated browser tests |
| `.github/workflows/deploy.yml` | Test → deploy → live check |
| `docs/QA.md` | Test report and iPhone checklist |

## Cloud sync (Supabase)

Focus syncs to a private Supabase project when you sign in under **Settings → Cloud** (or ☰ → Cloud & account).

1. In Supabase open **SQL Editor → New query**, paste `supabase/schema.sql`, press **Run**.
2. **Authentication → URL Configuration:** set Site URL to the app address.
3. Create your account in the app, then turn off new sign-ups in **Authentication → Sign In / Providers** so nobody else can register.

Each user sees only their own row and photo folder (row-level security). Safe Storage is uploaded only as ciphertext. Edits from two devices are merged per item; the device that changed an item wins for that item.

## Claude connector (voice and chat)

Claude can read and edit Focus through an MCP server deployed as a Supabase edge function (`supabase/functions/focus-mcp`, workflow `mcp.yml`). Setup and the list of tools: [docs/CLAUDE-CONNECTOR.md](docs/CLAUDE-CONNECTOR.md).

## Sign-in options and app lock (v1.5)

- **Email code.** Cloud & account → Email code: Focus asks Supabase to email a one-time code (`/auth/v1/otp` with `create_user: false`, so it never creates accounts) and verifies it with `/auth/v1/verify`. For the email to contain the code, the Supabase **Magic Link** and **Confirm signup** templates must include `{{ .Token }}`.
- **Email links** (magic link, confirmation, password recovery) that open Focus are read from the URL hash and turned into a session; expired links show a hint to use a code.
- **Change password** in Cloud & account (`PUT /auth/v1/user`).
- **App lock** (per device, stored in `focus.applock.v1`): a 6-digit PIN (PBKDF2-SHA-256, 310k iterations, 5 tries then growing waits) and optional Face ID (platform WebAuthn with user verification). Locks on launch and after leaving the app for the chosen time. A forgotten PIN is reset with an email code to the account the lock belongs to. The lock covers the screen; it doesn't encrypt the data stored in the browser (Safe Storage is encrypted separately).
