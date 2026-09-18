import { execFile as execFileCallback } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile } from 'node:fs/promises';
import crypto from 'node:crypto';

const execFile = promisify(execFileCallback);
const root = new URL('../', import.meta.url).pathname.replace(/^\/(.:)/, '$1');
const envText = await readFile(new URL('../.env', import.meta.url), 'utf8');
const env = Object.fromEntries(envText.split(/\r?\n/).filter(Boolean).map((line) => {
  const [key, ...rest] = line.split('=');
  return [key, rest.join('=').replace(/^"|"$/g, '')];
}));
const mysql = 'C:/AppServ/MySQL/bin/mysql.exe';
const mysqlArgs = [`-u${env.DB_USER}`, `-p${env.DB_PASSWORD}`, '-hlocalhost', '-N', env.DB_NAME];
const base = 'http://localhost/Workboard/api/v1';

async function sql(statement) {
  return (await execFile(mysql, [...mysqlArgs, '-e', statement], { cwd: root, windowsHide: true })).stdout.trim();
}

async function raw(path, options = {}) {
  return fetch(base + path, { ...options, headers: { Origin: 'http://localhost', ...(options.headers ?? {}) } });
}

async function redeem(label, role, projectId) {
  const token = crypto.randomBytes(32).toString('hex');
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  const admin = role === 'admin' ? 1 : 0;
  const escaped = label.replaceAll("'", "''");
  const id = Number(await sql(`INSERT INTO principals(label,is_admin) VALUES('${escaped}',${admin}); SELECT LAST_INSERT_ID();`));
  if (!admin) await sql(`INSERT INTO memberships(principal_id,project_id,role) VALUES(${id},${projectId},'${role}');`);
  await sql(`INSERT INTO invitations(principal_id,token_hash,expires_at) VALUES(${id},'${hash}',DATE_ADD(UTC_TIMESTAMP(),INTERVAL 1 HOUR));`);
  const response = await raw('/redeem', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) });
  if (!response.ok) throw new Error(`redeem ${response.status}: ${await response.text()}`);
  const cookie = response.headers.getSetCookie()[0].split(';')[0];
  const sessionResponse = await raw('/session', { headers: { Cookie: cookie } });
  const session = await sessionResponse.json();
  return { id, cookie, csrf: session.data.csrf };
}

async function call(actor, path, options = {}) {
  const response = await raw(path, {
    ...options,
    headers: {
      Cookie: actor.cookie,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.method && options.method !== 'GET' ? { 'X-CSRF-Token': actor.csrf } : {}),
      ...(options.headers ?? {}),
    },
  });
  const payload = await response.json();
  return { status: response.status, payload };
}

const marker = Date.now();
const projectId = Number(await sql('SELECT id FROM projects ORDER BY id LIMIT 1;'));
const editor = await redeem(`API editor ${marker}`, 'editor', projectId);
const viewer = await redeem(`API viewer ${marker}`, 'viewer', projectId);
let taskId = 0;

try {
  const taskInput = {
    title: `API integration ${marker}`,
    feature: 'ตรวจสอบระบบ',
    public_summary: 'ข้อความที่ผู้ชมเห็นได้',
    scope: 'ข้อมูลภายในทีม',
    criteria: 'ตรวจ API ผ่าน',
    evidence: 'integration test',
    assignee: 'API test',
    blocked_reason: '',
    checklist: [{ label: 'สร้างงาน', done: true }],
    status: 0,
    planned_go_live_on: '2026-09-30',
  };
  const created = await call(editor, `/projects/${projectId}/tasks`, { method: 'POST', body: JSON.stringify(taskInput) });
  if (created.status !== 201) throw new Error(`create: ${JSON.stringify(created)}`);
  taskId = created.payload.data.id;
  const version = created.payload.data.version;

  const moved = await call(editor, `/tasks/${taskId}`, { method: 'PATCH', body: JSON.stringify({ ...taskInput, status: 1, version }) });
  if (moved.status !== 200 || moved.payload.data.status !== 1 || moved.payload.data.version !== version + 1) throw new Error('move/version failed');

  const stale = await call(editor, `/tasks/${taskId}`, { method: 'PATCH', body: JSON.stringify({ ...taskInput, status: 2, version }) });
  if (stale.status !== 409) throw new Error(`stale update should be 409, got ${stale.status}`);

  const viewerList = await call(viewer, `/projects/${projectId}/tasks`);
  const projected = viewerList.payload.data.items.find((item) => item.id === taskId);
  if (!projected || projected.public_summary !== taskInput.public_summary || 'scope' in projected || 'checklist' in projected) throw new Error('viewer projection failed');

  const denied = await call(viewer, `/tasks/${taskId}`, { method: 'PATCH', body: JSON.stringify({ ...taskInput, status: 2, version: version + 1 }) });
  if (denied.status !== 403) throw new Error(`viewer mutation should be 403, got ${denied.status}`);

  const history = await call(editor, `/tasks/${taskId}/events`);
  if (history.status !== 200 || history.payload.data.length < 2) throw new Error('history failed');

  const archived = await call(editor, `/tasks/${taskId}`, { method: 'DELETE', body: JSON.stringify({ version: version + 1 }) });
  if (archived.status !== 200) throw new Error('archive failed');

  console.log(JSON.stringify({ ok: true, checks: ['one-time invite redemption', 'session + CSRF', 'project-scoped editor', 'create + persisted task', 'optimistic version conflict', 'viewer field projection', 'viewer write denial', 'event history', 'archive'] }, null, 2));
} finally {
  await sql(`UPDATE principals SET revoked_at=UTC_TIMESTAMP() WHERE id IN (${editor.id},${viewer.id}); DELETE FROM access_sessions WHERE principal_id IN (${editor.id},${viewer.id});`);
}
