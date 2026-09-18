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
