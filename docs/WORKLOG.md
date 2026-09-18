# Work log

## 2026-09-18 — project bootstrap and implementation planning

User authorized establishing an independent Workboard project with continuity Markdown documents.
Created workspace and planning documents. Existing prototype remains in ERP unchanged.
Reviewed official OWASP authorization, MDN conditional request and PHP PDO/transaction references; links are in implementation_plan.md.
No production code, database schema, external connector or deployment changed.
Next: user review of concrete implementation plan, then Phase 1.

## 2026-09-18 — implementation authorized
User approved Phase 1 continuation and scoped secret links instead of password login.

## 2026-09-18 — Phase 1 local vertical slice

Implemented the independent React/TypeScript/Vite/Tailwind frontend, PHP/PDO API and MySQL `workboard` schema. Added capability invitation links with hashed one-time tokens, seven-day HttpOnly sessions, CSRF checks, per-project admin/editor/viewer authorization and an external-viewer allowlist projection.

Implemented project management, task CRUD, required planned go-live date, separate actual release time, persisted drag-and-drop Kanban, optimistic version conflicts, event history, checklist/details drawer and access management. The compact board owns the main viewport; details open in a right drawer and mobile navigation exposes access/logout without the desktop sidebar.

Validation completed:

- production build passed through `npm run build`
- API integration passed invite redemption, CSRF/session, project scoping, persistence, stale-version conflict, viewer projection/write denial, history and archive
- PHP syntax checks passed for bootstrap and API router
- web checks returned 403 for `.env` and backend bootstrap, 200 for the session endpoint
- browser QA confirmed immediate task display, persisted drag after reload, drawer save and access management

The first local API failure was traced to PHP 7.3's MySQL driver not supporting the account's `caching_sha2_password` method. The local application account now uses `mysql_native_password` with CRUD-only grants. The `access_programs` organization parameter came from the command environment, not Workboard; the build wrapper removes that environment variable before running TypeScript/Vite.

Archived browser QA tasks and revoked all disposable QA/API principals and sessions. Kept the initial administrator invitation unconsumed. No remote, public deployment or Git/FTP/AI connector was created.

## 2026-09-18 — compact access management and multiple projects

Invitation creation now accepts validated project_ids, preserving the legacy project_id input. Admins can select several or all currently existing projects with viewer/editor permissions; future projects are not automatically included. Existing memberships support this without schema changes.

Reduced inherited UI font size to 13px and access controls to 32px. Access page uses one compact invite form; project creation expands from the header. Memberships group by recipient, revoked entries are hidden by default with a toggle, and errors are visible inside this page.

Validation: TypeScript/Vite production build, PHP router syntax, and API integration passed, including multi-project and all-existing-project invitations, excluded-project denial, invalid selection rejection, and token replay rejection. No browser visual check was run in this follow-up.

## 2026-09-18 — restore Variant C and add meeting calendar

Restored the reference's project-index/document report layout with shared compact shell, overview, Kanban, weekly report and calendar. Default entry is weekly report; sidebar and view selector expose all views. All-project task loading follows API cursors and retains project-specific editing rights. Access administration remains admin-only and issues employee links into the same frontend. No prototype records were imported.

Added migration 002 (meetings + meeting_events), applied to local Workboard only. Project-authorized monthly pagination, detailed reads, create/update/archive, required date/title/body, explicit publication, viewer DTO and atomic version/audit writes. Unpublished meetings and participants stay internal; publication exposes title/date/content to authorized project viewers. Calendar shows task go-live dates and meeting entries with a daily agenda and right-side editor/reader.

The local formatter renders user-pasted text/Markdown into headings, paragraphs, lists, checklists, tables, quotes and code without calling AI, executing HTML or changing wording. It does not infer commitments or create tasks.

Validation passed: TypeScript/Vite build; PHP syntax; API integration (including private/published/unpublished meeting visibility, viewer write rejection, project boundaries, invalid dates/months, version conflicts, events and archive); format parser and server rendering tests (HTML escaping, table/headings, empty report, viewer controls). Browser inventory was empty and iab returned Browser is not available, so no visual browser QA or responsive screenshot claim is made.

## 2026-09-18 — browser visual QA and responsive fixes

Playwright browser was available this session. Seeded disposable `[QA]` tasks/meetings through the API with a temporary admin principal, compared against the Variant C prototype and swept overview, board, report, calendar, access and both drawers at 320/375/414/768/1440px, measuring page overflow and control sizes. Afterwards archived all `[QA]` tasks/meetings and revoked the QA principals (21, 22), their invitations and sessions; only the original admin principal remains active and the two pre-existing meetings were not touched.

Found and fixed:
- Toolbar controls shrank to ~22px at 320–414px (flex-shrink + global min-width:0), the board checkbox inherited 34px input sizing, and toolbars showed their own vertical scrollbar (36px buttons in a 52px border-box). Toolbar items no longer shrink, overflow-y is hidden, buttons are 34px, and below 540px toolbars wrap to a second row.
- `textField` validated length with `strlen` (bytes), so Thai titles were capped at ~80 characters despite VARCHAR(240). Now `mb_strlen(...,'UTF-8')`; API test covers 240 accepted / 241 rejected Thai characters. Remaining edge: `scope` (20,000 chars) in a TEXT column could exceed 65,535 bytes only with mostly 4-byte characters.
- Meeting reader flattened indented list items and showed a bullet plus ☐ on checklists. Formatter keeps list indentation (tab = 2 spaces); renderer adds depth/check classes. Tests extended.
- Sidebar glyph icons replaced by inline line SVGs matching the prototype; report download button is primary; revoke button has a 32px target.

Validation: `node tests/api.mjs`, `node tests/report-format.mjs`, `node tests/presentation.mjs`, PHP lint of bootstrap/meetings/router and production build all passed. Drawer status change at 375px persisted after reload. Invite token is removed from the URL before redemption.
Next: touch/keyboard status control on cards, assignee filter, evidence records (TASKS.md).

## 2026-09-18 — permanent (reusable) links

User asked for one link that never expires and can be closed when wanted. Added migration 003 (applied locally with the root account; app account is CRUD-only): `invitations.reusable`, `invitations.last_used_at`, nullable `expires_at`, and `access_sessions.invitation_id` (FK). Redeem accepts reusable links repeatedly and records last use; sessions store their link and `sessionUser` rejects sessions whose link is closed. New endpoints: `POST /access/{principal}/links` (new link, same scope) and `POST /access/links/{id}/close` (revokes that link and deletes its sessions; closing the link behind the current session is refused). `GET /access` now returns members with nested projects/links. Access page: permanent checkbox (default on), per-member link list with last use, two-step close and two-step member revoke.

Validation: API integration extended (reusable on two devices, listing, close ends both sessions and blocks redeem, replacement keeps project scope, viewer cannot close, current-link close refused, default still one-time) — passed; format/presentation tests, PHP lint and build passed. Browser check at 1280/768/375/320 confirmed create → two contexts redeem → close → both logged out. QA principals revoked afterwards.
Note: tests/api.mjs now redeems ~13 links per run; two runs within 10 minutes hit the 30/10-min redeem limiter (429). Cleared local rate_limits once.
Risk accepted by user: a leaked permanent link grants access until closed.

## 2026-09-18 — calendar redesign (WorkAlljob concept)

User liked the calendar in C:/AppServ/www/WorkAlljob (src/calendar/CalendarPage.tsx, Lark-style) and asked for tasks and meetings on it. Read its code/CSS only (running it needs the production login, not used). User chose: tasks as one item on the planned go-live date (no spans), meetings date-only (no times, no schema change).

New `src/calendar-items.ts` (pure): per-day items, meetings before tasks, released tasks on their Bangkok release date, overdue flag, kind/project filters, six-week Monday-first rows and the months a view touches. `MeetingCalendar` rewritten: side panel (mini month with markers, selected-day agenda, filters persisted in localStorage with try/catch), month grid with ResizeObserver capacity, "+N เพิ่มเติม" week expansion, week view, mobile sheet and agenda under the grid. Fixed the old bug where neighbouring-month days in the grid never showed meetings (only the current month was loaded). Meeting drawer unchanged.

Validation: new tests/calendar-items.mjs (written first, failed, then passed); API, format, presentation tests, tsc, PHP lint and build passed. Browser at 1440/1024/768/375/320 month and week: no page overflow; +N expand, meeting chip → meeting drawer, task chip → task drawer, filter hide + persistence after reload, mobile sheet open/close verified. Found and fixed in browser: wrapped header shrinking under the grid on mobile, week-view chip text hidden on mobile. QA data archived and QA principals revoked; also revoked two API test principals orphaned by an earlier 429-interrupted test run (tests/api.mjs creates principals before its try/finally).

## 2026-09-18 — deployed to the Hostinger VPS (not yet public)

User authorized deploying to VPS srv1851858 (187.77.127.28) with subdomain larksuite.prima49.com and pushing to github.com/PonuoM/larksuite. Inspected the VPS read-only first: shared with ERP standby DB, workspec (WorkAlljob) + its Caddy on 80/443, Jitsi, ASR, listen-relay. Pushed commits ccf7f49 and 5c6c83a, sent HEAD to /opt/workboard with `git archive` (no GitHub credentials on the server).

Server: `docker compose` in /opt/workboard/deploy — workboard-app (PHP 8.3/Apache, built with WORKBOARD_BASE=/, 127.0.0.1:8095 + `edge` network) and workboard-db (MariaDB 10.11, no published port, app account SELECT/INSERT/UPDATE/DELETE only). Secrets generated on the server into deploy/.env (600) and deploy/app.env; the deploy dir is 700. Fixed on the way: `#` comments in app.env broke parse_ini_file (now `;`); a single-file bind mount needs a container restart after the host file is replaced.

Validation: full tests/api.mjs (23 checks) passed against the server over an SSH tunnel on PHP 8.3 + MariaDB with no PHP warnings; /.env, /api/bootstrap.php, /deploy/.env and /public/api/index.php return 403; nosniff and DENY frame headers present. DB volume was then recreated so no test rows remain.

Data: migrated 5 projects, admin principal 1, 1 real meeting (+2 events) — SHA-256 of content/titles identical to local. Not migrated: local visitor principal 71 and all links (localhost links cannot work there). A permanent admin link for production was issued; it is only in scratch/production-admin-link.txt (git-ignored).
Backup: /etc/cron.d/workboard-backup 03:15 daily → /opt/backups/workboard (700/600, 14 days); first run verified.

Waiting on: DNS A record `larksuite` → 187.77.127.28 (prima49.com uses nameservers aco1.vps-sun.com / aco2.vps-moon.com; the name currently resolves to 202.183.192.218). Then append deploy/Caddyfile.snippet to /opt/workspec/Caddyfile (backup first, append in place), `caddy validate` + `caddy reload`, and check HTTPS + a browser pass.

## 2026-09-18 — live at https://larksuite.prima49.com

DNS first had two A records (187.77.127.28 and 202.183.192.218, the latter created by the old hosting panel); after the user removed it the authoritative servers (serial 2026091802) return only the VPS. Backed up /opt/workspec/Caddyfile to Caddyfile.bak.20260918160720, validated a candidate inside the Caddy container, appended deploy/Caddyfile.snippet in place and ran `caddy reload`. Let's Encrypt certificate issued (valid to 2026-12-17, auto-renewed); http redirects to https (308).

Checked: workjobs/meet/listen 200 and asr 401 before and after the reload (unchanged); /api/v1/session 200; /.env, /api/bootstrap.php, /deploy/.env, /docs/* 403; nosniff, DENY, no-referrer headers; browser load at 1440/375 with Kanit and no console or network errors. Rollback: remove the larksuite block from /opt/workspec/Caddyfile (or restore the .bak) and `caddy reload`; `docker compose down` in /opt/workboard/deploy.
Next: user signs in with scratch/production-admin-link.txt and recreates member/viewer links on production.

## 2026-09-18 — handoff manual

Wrote docs/HANDOFF.md for the developer taking over (Thai): system overview, code map, local setup, tests, access links, deploy/update steps (Git Bash only: PowerShell 5.1 corrupts the tar pipe), production DB operations (migrations, backup, restore), shared-VPS rules (Caddy single-file mount, INI comments) and options for AI access (recommended: API with a dedicated editor link; MCP wrapper next; read-only SQL via SSH; no direct writes; Phase 3 proposals remain the agreed end state). README rewritten to the current state. Added scripts/issue-admin-link.mjs (tested locally: rejects unknown principal, issues a reusable link; the test link was closed).

## 2026-09-18 — optional go-live date + import from Lark Base (local only)

Owner decision: `planned_go_live_on` becomes optional. The team board kept in Lark Base (CRM_ERP_V4 repo, `.claude/skills/lark-base-update/backup/`) never had agreed dates and a placeholder would show as a fake deadline.
- Migration `004_optional_go_live.sql` (DATE NULL). API `taskData()`: missing/null/'' → null, a malformed date is still 422.
- UI: card shows "ยังไม่กำหนดวันเริ่มใช้" and is never overdue; the date field is no longer required; the calendar skips tasks with no day (and releases with no known date) instead of filing them under "null"; the weekly report text says "ยังไม่กำหนดวันเริ่มใช้".
- `scripts/import-lark-base.php <backup dir> [--apply]`: project → projects, feature → tasks.feature, sub-task → task; status รอทำ/รอ CEO/รอดำเนินการ→0, กำลังดำเนินการ→1, รอเปิดใช้งาน→3, เปิดใช้งาน→4, ยกเลิก skipped. Uses a script, not the API, because the API stamps actual_released_at = now for released tasks; the script keeps the card's live date (5 known) or leaves it null. Reuses taskData() validation, one transaction + `imported` event per task by principal "นำเข้าจาก Lark Base", skips existing project+title (re-run = 0 new).
- Local dev on Laragon without Apache: `php -S 127.0.0.1:8095 scripts/dev-router.php` (serves only /Workboard/api/v1) + `npm run dev` (Vite proxies /Workboard/api, changeOrigin false; .env APP_ORIGIN=http://127.0.0.1:5173). DB `workboard` on Laragon MySQL 8.4 with app account SELECT/INSERT/UPDATE/DELETE. tests/api.mjs and issue-admin-link.mjs take MYSQL_BIN.

Validation: calendar-items (new undated cases), report-format, presentation tests; tsc --noEmit; PHP lint; tests/api.mjs full run passed against the Vite+PHP dev setup with new checks (missing/null/'' go-live accepted as null, 2026-02-30 rejected). Import: 5 projects, 99 tasks (71 released / 19 รอเปิดใช้ / 9 กำลังทำ), 99 events, second run 0 new; admin session reads all 5 projects through the API.
Not done: production — migration 004 and the import were NOT run on the VPS; `npm run build` not run (public/assets unchanged). Feature descriptions from Lark are not carried over (Workboard's feature is a plain name).
