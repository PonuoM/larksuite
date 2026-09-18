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
