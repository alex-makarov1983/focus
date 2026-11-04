# Focus — QA report

Date: 2026-11-04 · Version 1.0.0

## Automated results

38 of 38 tests passed on `iphone-chromium` (iPhone 13 profile, real touch events via CDP) and `desktop-chromium`. The full suite also passed twice in a row (76/76) to rule out flakiness.

`iphone-webkit` (the Safari engine) could not be downloaded in the build environment. It runs automatically in GitHub Actions on every push, before deployment and again against the live site.

## Requirement coverage

| # | Requirement | Status | Test |
| --- | --- | --- | --- |
| 1 | Hamburger on the left of every screen | Done | boots…, hamburger reaches all 15 screens |
| 2 | + in bottom nav → Task, Note, Safe, Income, Expense | Done | + opens chooser |
| 3 | New tasks default to Inbox | Done | + opens chooser; a new task lands in Inbox |
| 4 | Exactly two areas: Personal, Business | Done | areas are exactly Personal and Business |
| 5 | Each project in one area | Done | same |
| 6 | Priorities Urgent/High/Medium/Low | Done | priorities use names, never P1–P4 |
| 7 | Calendar Month/Week/Day | Done | calendar: Month, Week and Day views |
| 8 | Single Back returns to previous screen | Done | hamburger…, multi-step Back |
| 9 | Touch drag-and-drop; Kanban across columns; persisted | Done | drag a task…, drag a Kanban card… |
| 10 | Finance: Add Income/Add Expense, Planned/Actual, recalculated | Done | finance: … recalculate |
| 11 | 15 sections | Done | hamburger reaches all 15 screens |
| 12 | Safe Storage: link, login, password, note | Done (not audited) | Safe Storage: create, add, lock… |
| 13 | GitHub Pages deployment | Prepared (needs your GitHub account) | workflow `deploy.yml` |
| 14 | Buttons actually work | Done in Chromium; confirm on iPhone | every button on every screen is wired |

## Bugs found and fixed during testing

1. Opening a screen by direct link sent every second screen back to Home.
2. Full-width buttons rendered pale with a stripe (CSS class clash with calendar blocks).
3. Oversized icons in the Add Income / Add Expense buttons.
4. Kanban drag on a narrow screen overshot the target column; now the board shifts exactly one column per hold at the edge.

## Manual check on a real iPhone (after deployment)

Open the https address in Safari, not from Files or a chat preview.

- [ ] Home loads; no "Focus is starting…" message stays on screen
- [ ] ☰ opens the menu; each of the 15 sections opens
- [ ] Back returns to the previous screen; edge swipe back also works
- [ ] + → Task → save → the task is in Inbox
- [ ] Close Safari fully, reopen: the task is still there
- [ ] Hold ⋮⋮ on a task and drag it up: order changes and stays after reload
- [ ] Kanban: drag a card to the right edge, hold, release in In Progress
- [ ] Add Income and Add Expense: totals and balance change
- [ ] Calendar: Month, Week, Day; tap a day
- [ ] Note: type, go Back, reopen: the text is saved
- [ ] Safe: create password, add a test record, Lock, unlock
- [ ] Share → Add to Home Screen; open from the icon; works in Airplane mode
- [ ] Keyboard doesn't cover the Save button in forms

## Known limits

- Data lives only in this browser on this device. No sync, accounts or assistants yet.
- Safe Storage encryption is unaudited; use demo data only.
- No AI or voice capture yet.
