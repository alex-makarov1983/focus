# Focus в Claude: голосом добавлять и править задачи

Claude (claude.ai, приложения Claude на iPhone и Mac) подключается к Focus как **коннектор**.
После этого можно сказать или написать: «Добавь в Focus на завтра в 10 позвонить Михаилу»,
«Что у меня сегодня?», «Отметь спортзал», «Перенеси звонок в банк на понедельник» — и изменения
появятся в приложении (в течение минуты или сразу при открытии).

## Как это устроено

- `supabase/functions/focus-mcp` — MCP-сервер, функция Supabase в том же проекте, где хранится Focus.
- Он меняет ту же запись `focus_state`, что и приложение, и увеличивает её версию, как `focus_save()`.
  Приложение видит новую версию и сливает изменения своим трёхсторонним слиянием: правки на телефоне не теряются.
- Сейф (`vault`) сервер не читает и не меняет. Удаления нет: удаляете вы сами в приложении.
- Доступ — по длинному секретному ключу в адресе коннектора. Кто не знает ключ, получает 404.

## Установка (один раз)

1. **GitHub → репозиторий focus → Settings → Secrets and variables → Actions → New repository secret:**
   - `FOCUS_MCP_SECRET` — длинная случайная строка (не меньше 32 символов).
   - `FOCUS_USER_EMAIL` — e-mail вашего аккаунта Focus (нужен, если аккаунтов больше одного).
   `SUPABASE_ACCESS_TOKEN` уже добавлен раньше.
2. **Actions → Claude connector (MCP) → Run workflow.** Он проверит сервер тестами, опубликует его в Supabase
   и проверит живой адрес. Зелёная галочка — всё готово.
3. **Claude → Customize (или Settings) → Connectors → «+» → Add custom connector**, авторизация: без входа (No sign in):
   - Name: `Focus`
   - URL: `https://euwrwoxfgeylgyarrzea.supabase.co/functions/v1/focus-mcp/<FOCUS_MCP_SECRET>`
4. В чате включите Focus в меню инструментов (значок под полем ввода). Коннектор, добавленный на сайте,
   появляется и в приложениях Claude на телефоне.

Если ключ утёк: поменяйте `FOCUS_MCP_SECRET` в GitHub, снова запустите workflow и обновите адрес коннектора.

## Что умеет

| Инструмент | Что делает |
|---|---|
| `focus_overview` | Сегодня, просроченное, Inbox, ближайшие 7 дней, ожидание, делегированное, привычки, проекты |
| `focus_list_tasks` | Любой список: inbox, today, upcoming, someday, followup, delegated, archived, routines, logbook, проект, ваш лист, тег, статус… |
| `focus_search`, `focus_get` | Поиск по всему (кроме Сейфа) и подробности элемента |
| `focus_create_task`, `focus_update_task`, `focus_complete_task` | Задачи: лист (в том числе ваши), дата, время, приоритет, статус, тип, область жизни, проект, теги (недостающий тег создаётся), место, повтор, дедлайн, подзадачи, кому поручено, ссылки, ссылка на AI-чат; повторяющиеся задачи создают следующую, как в приложении |
| `focus_organize` | Создать или переименовать лист, тег, статус, приоритет, область жизни или место (удаляете вы в приложении) |
| `focus_create_note`, `focus_update_note` | Заметки |
| `focus_save_project` | Создать или изменить проект |
| `focus_add_money` | Доход или расход |
| `focus_habit`, `focus_journal` | Отметить привычку, запись в дневник с настроением |
| `focus_add_item`, `focus_update_item` | Закладки, Watch·Read·Listen, покупки, друзья |

## Проверка локально

```
cd supabase/functions/focus-mcp
TEST_DB_URL=postgres://postgres:pw@localhost:5432/postgres deno test -A --config deno.json
```
