# Workboard agent instructions

Read README.md, docs/HANDOFF.md, CONTEXT.md, implementation_plan.md, TASKS.md and docs/CONTINUATION.md before editing.

## Current stage

Implementation approved. User asked to proceed with an independent project and continuity documentation. The supplied source-project rule requires approval of an implementation plan before code for a new system. The concrete plan is now implementation_plan.md; User approval received; proceed with Phase 1 and capability-link access instead of password login. Do not repeat the approval request once it is granted.

## Scope

Work only in C:/AppServ/www/Workboard unless specifically asked. CRM_ERP_V4/docs/prototypes/workboard is a read-only design reference for this project. Do not move/delete the ERP prototype or import its .git/secrets/node_modules. Never claim sample data represents verified project status.

## Development rules

- React/TypeScript/Tailwind UI and PHP/PDO/MySQL backend are proposed, approved.
- Preserve the compact Kanban-first UI and full-height right drawer; no oversized page introductions.
- Required planned go-live date and actual release timestamp are separate fields.
- Validate project membership and field visibility on every API request; external-viewer JSON is an allowlist projection.
- Use prepared SQL, migrations for every schema change, and transactions for atomic task/event updates.
- Use version checks for concurrent edits and idempotency for worker ingestion.
- API responses: {ok,message,data?}; errors must be explicit.
- No hardcoded credentials, no secrets in docs/logs/client bundles, no use of production database credentials locally.
- Git/FTP checks are read-only; AI writes observations/proposals, not autonomous completed status.
- Display source and last-check timestamp for background data.
- No native alert/confirm/prompt; use application components.
- Avoid terminal shell scripts in this Windows environment. Use native filesystem APIs/tools; scripts requiring the application runtime can be accessed through localhost. Existing Node tool orchestration can invoke git as an executable without a shell.
- Do not spawn subagents unless user explicitly requests delegation.
- Deployment target (authorized 2026-09-18): Hostinger VPS srv1851858 (187.77.127.28), stack in /opt/workboard (deploy/), public URL https://larksuite.prima49.com through the shared workspec Caddy. Git remote: https://github.com/PonuoM/larksuite. The VPS also runs ERP, workspec, Jitsi and ASR — never restart or edit their stacks; back up /opt/workspec/Caddyfile before appending and use caddy reload (append in place: the file is a single-file bind mount).

## Continuity

After each work session update TASKS.md and docs/WORKLOG.md: actual changes, checks, limitations, next action. Update docs/CONTINUATION.md when the resumption point changes. Do not duplicate the full plan in handoff docs. Never mark a test passed without running it.
