# Focus

A mobile-first personal workspace that runs in Safari on iPhone and installs to the Home Screen as an app (PWA). Tasks, projects, notes, calendar, kanban, Safe Storage, income and expenses, and major purchases in one place.

Plain HTML, CSS and JavaScript with no frameworks and no build step, so there is nothing to compile and nothing that can fail to load from a third-party server.

## What's inside

15 screens: Home, Inbox, Today, Upcoming, Anytime, Someday, Logbook, Calendar, Kanban, Areas, Projects, Notes, Safe Storage, Income & Expenses, Major Purchases.

- **Navigation.** Hamburger menu on the left of every screen with all 15 sections. Back button returns to the previous screen; the iOS swipe-back gesture works too. Bottom bar has Home, Today, **+**, Calendar and Projects.
- **+ button** opens a chooser: Task, Note, Safe, Income, Expense.
- **Tasks.** New tasks always land in **Inbox** unless you pick another list. Priorities are Urgent, High, Medium and Low. Each task has a date and time, status (To Do, In Progress, Waiting, Done), area, project, repeat, notes and subtasks. Completing a repeating task creates the next one. Every completion can be undone.
- **Drag and drop.** Hold the ⋮⋮ handle to reorder tasks with your finger. On Kanban, drag cards between columns; hold at the screen edge to shift the board one column. Order and status are saved.
- **Areas.** Exactly two: Personal and Business. Every project belongs to one of them.
- **Calendar.** Month, Week and Day views.
- **Notes.** Autosaved, searchable, pinnable, linkable to an area or project. "Lines → tasks" turns each line into an Inbox task.
- **Income & Expenses.** Add Income and Add Expense buttons. Each record has Planned or Actual, date, amount, currency, category and note. Totals, balance and category bars recalculate from records, per currency, by month or year. Currencies are never mixed.
- **Major Purchases.** Budget, saved amount, currency, priority, status and target date, with totals per currency.
- **Safe Storage.** Link, login, password and note records (plus contacts, cards, documents), encrypted on the device with AES-GCM using a key derived from your Safe password (PBKDF2-SHA256, 310,000 iterations). Auto-locks after 5 minutes. **This has not had a security audit.** Keep real passwords and card numbers in a dedicated password manager until it has.
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
