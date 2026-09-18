# Work log

## 2026-09-18 — backup cron repair (19:44 +07)

Resumed from scratch/codex-handoff.md; handled urgent backup failure first.
Experiment ledger: SSH inspection found cron active, no log yet, backup script mode 0664 and Git mode 100644. Direct invocation reproduced Permission denied (exit 126 remotely). The identical script invoked through /bin/sh with env -i PATH=/usr/bin:/bin HOME=/root succeeded, isolating script execute permission as the cause. Daily filename reuse also explains why a successful second run adds no new filename.
Added deploy/workboard-backup.cron with explicit /bin/sh and PATH; updated script comments and backup instructions. Following execution approval, installed only the cron configuration on production (root:root 0644); original saved to /opt/backups/workboard/cron-before-shell-fix-20260918. No container restart, app deployment, DB mutation, or Lark message.
Verification: ran the new command in a cron-like environment with log redirection; backup workboard-2026-09-18.sql.gz updated at 19:44:29 +07, 37,330 bytes, mode 0600. gzip -t succeeded; zgrep found one Dump completed marker. Cron remains active; app DEPLOYED_COMMIT remains 7a77bbf. git diff --check passed before documentation updates. No application test suite run (no application behavior changed).
Limitations: actual scheduled execution at 03:15 on Sep 19 and restore into an isolated DB remain unverified. Existing /bin/sh dump pipeline can mask an upstream dump failure; hardening that behavior remains separate work. Local changes not committed/pushed. Next: confirm overnight backup, then review Mini ERP task statuses with the owner before enriching them.

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

## 2026-09-18 — deployed 494acf2 + imported the Lark Base board on production

User asked for deploy + import. Pushed 494acf2. Production before: DEPLOYED_COMMIT 5c6c83a, projects named exactly Mini ERP / Voice Call / HR Connect / Dashboard / PrimaDesk, 0 tasks.
- Backup first: /opt/backups/workboard/pre-004-20260918164501.sql.gz (root dump, 600).
- `git archive` → /opt/workboard (DEPLOYED_COMMIT 494acf2); ran 004_optional_go_live.sql as root (IS_NULLABLE = YES); `docker compose build app && up -d app`.
- Side effect: compose also recreated **workboard-db** because docker-compose.yml gained the 004 initdb mount (service config changed). Data volume untouched — after restart: 5 projects, 2 principals, 1 meeting, 2 links, as before. Brief DB downtime ~16:45. Next time: expect this whenever the db service block changes.
- Import: copied scripts/import-lark-base.php + the backup JSON into workboard-app (the script is not in the image), dry run (0 projects, 99 tasks), then --apply, rerun = 0 new. Temporary copies removed from the container and /tmp.
Result: 99 tasks (Mini ERP 47, Voice Call 17, HR Connect 16, Dashboard 11, PrimaDesk 8; 71 released / 19 รอเปิดใช้ / 9 กำลังทำ), all without go-live date, 99 `imported` events by principal 3 "นำเข้าจาก Lark Base". Site /api/v1/session and / return 200.
Rollback (data): `gunzip -c /opt/backups/workboard/pre-004-20260918164501.sql.gz | docker exec -i workboard-db sh -c 'mariadb -uroot -p"$MARIADB_ROOT_PASSWORD" workboard'`.


## 2026-09-18 — production status inspection
Read-only SSH inspection: DEPLOYED_COMMIT=494acf2; workboard-app Up; workboard-db healthy; HTTPS root HTTP 200; session API ok with user=null (unauthenticated). Backup files present including pre-004-20260918164501.sql.gz. Production admin link file exists at scratch/production-admin-link.txt (token not logged or redeemed). No viewer link file found among scratch filenames containing link; active viewer memberships were not inspected. No integration suite or database recount run; 99 imported tasks remains a prior-session result. Next: use TASKS.md for remaining features; issue viewer links from Access when requested.

## 2026-09-18 — sub-tasks, progress notes, Lark bots, viewable links (local)
Owner feedback: viewers landed on the weekly report; imported tasks say things like "ทำไปแล้ว 3 จาก 8 ขั้น" with no detail; wants sub-tasks that are easy to keep updating; people and AI agents will read/update tasks from this DB and need a template; meeting reports could not be deleted; merge overview + weekly report; Lark group notices on demand; show the viewer link again in Access.
Decisions (owner, via questions): helpers are both people and AI · permanent links viewable (encrypted) · Lark = manual send + opt-in on save · build the system first, then fill old tasks per project.
- Local DB was missing migration 004 (API test failed with 500 on undated tasks); applied 004 and 005 locally.
- Sub-tasks stay in tasks.checklist JSON, now {id,label,done,note,done_at}; legacy items get "i<n>" ids on read. POST /tasks/{id}/subtasks (add/set/remove) locks the row, needs no version, bumps version, logs a `subtask` event. Viewers get id/label/done only.
- POST /tasks/{id}/notes (event `note`), POST /tasks/{id}/notify, GET /lark/targets; task POST/PATCH accept notify + notify_text. Lark is called after commit; failure returns 502 "บันทึกแล้ว แต่ส่งเข้า Lark ไม่สำเร็จ". Signature: base64(HMAC-SHA256(key=ts+"\n"+secret, "")). Verified once against the test group.
- Meeting "delete" was an archive button hidden at the bottom of the edit tab; moved to the read tab. The API was fine.
- Migration 005 invitations.token_cipher (AES-256-GCM, LINK_KEY). GET /access/links/{id}/url for admins. scripts/seal-link.php stores a pre-005 link read from STDIN.
- scripts/wb.mjs CLI + docs/TASK-GUIDE.md.
Checks: node tests/api.mjs (+ WORKBOARD_LARK_TEST=1 once), report-format, presentation, calendar-items, tsc, build, PHP lint. Browser (Playwright) 1440 + 375: viewer lands on board, deep link ?task=, viewer sub-task list, instant tick keeps unsaved edits, full save without conflict, progress tab, merged overview, meeting delete, task delete, stored link reveal. QA fixtures archived/revoked afterwards.
Not done: production deploy (needs owner go-ahead), filling details of the 99 imported tasks.

## 2026-09-18 — production deploy of 910c5a8
Backup /opt/backups/workboard/pre-005-20260918192133.sql.gz (deploy/backup.sh ran but wrote no new file — check it). git archive → /opt/workboard, DEPLOYED_COMMIT=910c5a8, migration 005 applied as root, `docker compose build app && up -d app`.
Note: `up -d app` also recreated workboard-db because the compose file gained the 005 initdb mount (a few seconds of DB downtime). Volume kept; verified afterwards: 99 tasks, 3 principals, 4 invitations, 2 meetings, columns from 004/005 present. HTTPS 200, /api/v1/session ok, new routes answer 401 unauthenticated, app log clean.
Not done: LINK_KEY and LARK_* were not added to /opt/workboard/deploy/app.env (writing secrets to the server was blocked by the agent permission policy); until then the Lark picker and "ดูลิงก์" stay hidden and the old viewer link is not sealed.
Follow-up (owner authorised): appended LINK_KEY (generated on the server) and LARK_MAIN_*/LARK_TEST_* to app.env (backup app.env.bak.<timestamp>), `docker compose restart app`; sealed the existing viewer link (invitation 4, "ผู้เยี่ยมชม") with scripts/seal-link.php copied into the container and removed afterwards. Checked inside the container: both Lark targets configured, LINK_KEY valid, sealed link decrypts. No Lark message sent from production yet.

## 2026-09-18 — actions not visible until F5 (local only, not committed/deployed)
Evidence first: production meeting_events has no `archived` event ever (the owner's two same-title meetings 2 and 3 are still live), so the reported delete never reached the DB there; Caddy keeps no access log. Reproduced locally in the browser instead.
Root causes (confirmed in browser):
1. MeetingCalendar ignored write responses: onSaved/onArchived only bumped `revision`, which reloaded every project×month with Promise.all; the item stayed until all ~15 requests finished, and forever (until F5) if any one failed. Repro: 700 ms delay + one 500 → deleted meeting still shown at 4 s while DB had archived=1.
2. Save succeeded but Lark failed → API 502 → UI treated it as unsaved: new-task drawer stayed "งานใหม่" and a second click created a duplicate task (reproduced: 2 cards); a note stayed in the box and was re-sendable.
3. Two quick drags of one card: second PATCH carried the pre-first-move version → false 409 "มีคนแก้งานนี้แล้ว" (reproduced).
4. createProject and the mobile "กลับบอร์ด" used location.reload() (code evidence; not reproduced to avoid leaving a project behind until the fix was tested).
Fix: meeting writes applied from the response (upsert/remove) with sequence numbers so earlier reloads cannot undo them; reloads use allSettled and keep only failed project-months; 2xx + lark_warning contract (api/task-updates.php notifyAfterCommit/withLarkWarning, public/api/index.php); per-task move lock + targeted rollback + latest-load-wins in main.tsx; loadProjects() instead of reload; notify picker reset after save.
Checks: tsc, build, tests/api.mjs (normal and WORKBOARD_LARK_BROKEN=1 with an unreachable local test webhook — old PHP fails it with 502, new passes), meeting-state/report-format/presentation/calendar-items, PHP lint. Browser (Playwright, local): meeting delete under 700 ms delay + failing reload gone at 200 ms and still gone after reload; DELETE 500 keeps item + drawer error; create/edit/publish/move month; task create with failing Lark → drawer becomes #id, one card after pressing save again, search filter kept; note with failing Lark → box cleared, warning; double drag → one PATCH, no 409; failed move rolls back; sub-task tick → card count; task delete; project create / link close / member revoke without reload; 375 px meeting delete. Local .env restored, QA data archived/revoked, QA project removed.
Limits: other people's changes still need F5 (or month change for meetings); a 409 on the drawer reloads the list but the open drawer keeps the stale version (reopen); Lark is called synchronously (a dead webhook delays the save response up to the 8 s timeout, ~2 s observed locally).
Options for seeing others' edits (not built): A) refetch on window focus/visibility (smallest), B) poll a cheap "changed since" endpoint every 30–60 s, C) SSE/WebSocket (new infrastructure).
Deployed 445c096 (owner approved): git archive → /opt/workboard, `docker compose build app && up -d app`; DB container untouched (compose unchanged). Checks: HTTPS 200, /api/v1/session ok, served bundle contains the new calendar/lark_warning code, app log clean, PHP lint in container, backup.sh `sh -n` ok and identical to the committed file, cron entry unchanged. The Lark-failure path was not exercised on production (no messages sent). c0baf3f commits the earlier backup/cron fix separately.

## 2026-09-18 — delete confirmation was off-screen for long reports
Owner: "ลบรายงาน" did nothing on a long meeting report (network showed no DELETE). Reproduced locally with a 30-item report at 1440×900: the confirmation box was appended after the report text at y=1279 (viewport 900), below the fold, so the click looked like a no-op. Short test reports had hidden it. Same layout in the task drawer.
Fix: the confirmation replaces the buttons inside the sticky action bar (meeting read + edit tabs, task drawer); `.drawer-actions button.danger` keeps the confirm button red (the generic drawer button style had made it white-on-white).
Checks: browser 1440×900 long report → box at y=827–888, confirm → gone immediately; task drawer desktop + 375 px; tsc, tests/api.mjs, unit tests.

## 2026-09-18 — task content drafted from all sources (production data, via API)
Owner asked to make every task detailed and to add all findable work, including items from the three September meetings (ids 3, 4, 5).
Sources read: production tasks/meetings (read-only SQL), CRM_ERP_V4 git log since 1 Aug (303 commits), docs/meetings/MASTER_BACKLOG.md + 2026-07-31.md, .agents/workflows/android-project-status.md, primacom-dialer-design/handoff-v6/PROMPTS.md, primadesk/HANDOFF_2026-09-03.md, voicecall git + DEPLOY_MANIFEST_026.md + docs/PRODUCTION_REVIEW_2026-09-08.md + unmerged branch worktree-erp-asr-quality, hr-mobile-connect and Dashboard git, Claude project memories (ERP, voicecall, HR, Dashboard). Code checks: ScoringService still floatval(area_size) ("100 ต้น" = 100 ไร่); no "ไม่มีหมายเลข" status; VIP tiers are Topaz–Diamond from 10,000 (18 Sep meeting says Silver–Black Diamond from 20,000); blocked-distribution guard only in wip-blocked-port-20260720; feat/vip-system-toggle unmerged.
Applied through the API as a new editor principal "Claude (AI) ร่างงาน" (projects 1–5, permanent link in Workboard/scratch/claude-editor-link.txt, gitignored), created with the old admin link: 28 open tasks got scope/criteria/sub-tasks/evidence (+ public summary for #070), statuses untouched; 36 new tasks (31 Mini ERP incl. VIP, pullback rules, LINE OA, B2B backlog; 4 Voice Call; 1 Dashboard; 1 PrimaDesk rollout), 16 with blocked_reason naming the decision needed. Each write has a progress note naming its sources. Idempotent script (skips existing titles / filled fields); re-run = 0 changes. No Lark messages. Not created: work found already done (One Call page-2 paging fix 15 Sep, dirty-lead cleanup 31 Aug, Workboard itself).

## 2026-09-18 — decision and approval columns (local)
Owner wants two more board columns: รอตัดสินใจ and รออนุมัติ, where the CEO ticks approval. Also: the two open decisions (VIP discount %, appointment policy) stay in รอทำ (Lark's "รอดำเนินการ" was imported as รอทำ).
Design: codes appended (5 รอตัดสินใจ, 6 รออนุมัติ) so 0–4 keep their meaning; board order 5,0,1,2,6,3,4. Approval is a per-person right (principals.can_approve, admin toggles it in Access) independent of project role, so a view-only CEO link can approve. POST /tasks/{id}/approve {decision: approve|reject, note} under a row lock: approve → status 3 + approved_by/at, reject (reason required) → status 1; events approved/rejected. PATCH refuses 6 → 3/4; entering 6 clears an older approval. Overview: รออนุมัติ list in the aside, รอตัดสินใจ counted with blocked tasks. CLI accepts 0–6; guide: agents may move up to 2 or 6, never 3/4.
Checks: tsc, build, tests/api.mjs (+ approval block: status 5/7, 6→3 refused, non-approver 403, view-only approver approves, reject needs reason, double approve 409, re-entry clears approval, history), unit tests. Browser 1440: 7 columns fit (164 px each), card tick approves → รอเปิดใช้ with notice, drawer panel, disabled 3/4 options, reject with reason → กำลังทำ. QA data archived/revoked.
Known gap: granting the approver right to yourself shows the tick only after reloading (session flag is read at page load); granting it to someone else is unaffected.
Deployed 9be01a2 (owner approved): backup pre-006-20260918211303.sql.gz (gzip -t ok), git archive, migration 006 as root, build + up -d app (DB container recreated for the new initdb mount, back healthy in seconds). After: 135 active tasks, 5 principals, 3 active meetings, HTTPS 200, session ok. Created principal "CEO" (id 6): viewer on projects 1–5, can_approve=1, permanent link stored encrypted — copy it from Access. Moved 11 decision-blocked tasks (#114 #115 #118 #121 #124–#127 #132–#134) to รอตัดสินใจ with a note each; VIP discount and appointment-policy tasks stay in รอทำ as the owner asked.
