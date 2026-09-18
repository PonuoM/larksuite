#!/usr/bin/env node
// Workboard command line for people and AI agents: read tasks, report progress, tick sub-tasks, notify Lark.
// Talks to the normal API with a permanent *editor* link — it can do exactly what that link can do in the browser.
//
//   set WORKBOARD_LINK=https://larksuite.prima49.com/#invite=…   (a permanent editor link from the Access page)
//   node scripts/wb.mjs help
//
// The session is cached in the OS temp folder (one per link) so the link is redeemed once per 7 days, not per call.
// Full guide: docs/TASK-GUIDE.md
import crypto from 'node:crypto';
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const STATUSES = ['รอทำ', 'กำลังทำ', 'รอทดสอบ', 'รอเปิดใช้', 'เปิดใช้งานแล้ว'];
const FIELDS = ['title', 'feature', 'public_summary', 'scope', 'criteria', 'evidence', 'assignee', 'blocked_reason', 'planned_go_live_on'];
const HELP = `Workboard CLI — node scripts/wb.mjs <command> [...]

อ่าน
  projects                                 รายชื่อโปรเจกต์ที่ลิงก์นี้เข้าถึงได้
  tasks [--project ID|ชื่อ] [--status 0-4] [--open] [--q คำค้น]
                                           รายการงาน (--open = ยังไม่เปิดใช้งาน)
  show TASK                                รายละเอียดเต็ม + งานย่อย (พร้อม id) + ประวัติล่าสุด

อัปเดต (ทุกคำสั่งเติม --notify test|main เพื่อแจ้งกลุ่ม Lark ได้)
  note TASK "ข้อความ"                      บันทึกความคืบหน้า (ต่อท้าย ไม่ทับของเดิม)
  sub-add TASK "งานย่อย" [--note "…"]
  sub-done TASK SUBID [--note "…"]         ติ๊กงานย่อยว่าเสร็จ
  sub-undo TASK SUBID                      เปิดงานย่อยใหม่
  sub-note TASK SUBID "โน้ต"
  sub-rm TASK SUBID
  status TASK 0-4                          ย้ายสถานะ (0 รอทำ · 1 กำลังทำ · 2 รอทดสอบ · 3 รอเปิดใช้ · 4 เปิดใช้งานแล้ว)
  set TASK field=value [field=@file.md ...]
                                           แก้ฟิลด์: ${FIELDS.join(', ')}
  create PROJECT "ชื่องาน" [field=value ...] [--sub "งานย่อย"]...
  notify TASK test|main ["ข้อความ"]         ส่งสถานะงานเข้ากลุ่ม Lark โดยไม่บันทึกอะไร

ตัวเลือก: --json (ผลลัพธ์เป็น JSON สำหรับ agent)`;

// ---- args
const argv = process.argv.slice(2);
const flags = {}; const pos = []; const subs = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--json' || a === '--open') flags[a.slice(2)] = true;
  else if (a === '--sub') subs.push(argv[++i]);
  else if (a.startsWith('--')) flags[a.slice(2)] = argv[++i];
  else pos.push(a);
}
const [command = 'help', ...args] = pos;
const out = (value, text) => console.log(flags.json ? JSON.stringify(value, null, 1) : text);
function fail(msg) { console.error('✗ ' + msg); process.exit(1); }
if (command === 'help' || command === '--help') { console.log(HELP); process.exit(0); }

// ---- session
const link = process.env.WORKBOARD_LINK || '';
const match = link.match(/^(https?:\/\/[^#]+?)\/?#invite=([a-f0-9]{64})$/);
if (!match) fail('ตั้งค่า WORKBOARD_LINK เป็นลิงก์ถาวรสิทธิ์แก้ไข (https://…/#invite=…) ก่อน');
const [, siteRaw, token] = match;
const site = siteRaw.replace(/\/$/, '');
const api = site + '/api/v1';
const cacheFile = join(tmpdir(), 'workboard-' + crypto.createHash('sha256').update(token).digest('hex').slice(0, 12) + '.json');
let session = null;
try { session = JSON.parse(readFileSync(cacheFile, 'utf8')); } catch { /* none yet */ }

async function redeem() {
  const r = await fetch(api + '/redeem', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) });
  if (!r.ok) fail('เปิดลิงก์ไม่ได้: ' + ((await r.json().catch(() => ({}))).message ?? r.status));
  const cookie = r.headers.getSetCookie()[0].split(';')[0];
  const s = await (await fetch(api + '/session', { headers: { Cookie: cookie } })).json();
  session = { cookie, csrf: s.data.csrf, user: s.data.user };
  writeFileSync(cacheFile, JSON.stringify(session), { mode: 0o600 });
}
async function call(path, { method = 'GET', body } = {}, retry = true) {
  if (!session) await redeem();
  const r = await fetch(api + path, { method, headers: { Cookie: session.cookie, ...(method !== 'GET' ? { 'X-CSRF-Token': session.csrf } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const payload = await r.json().catch(() => ({ message: 'ตอบกลับไม่ใช่ JSON (' + r.status + ')' }));
  if ((r.status === 401 || r.status === 403 && /หมดอายุ/.test(payload.message)) && retry) { rmSync(cacheFile, { force: true }); session = null; return call(path, { method, body }, false); }
  if (!r.ok) fail(payload.message + ' (' + r.status + ')');
  return payload;
}

// ---- helpers
const pad = (id) => '#' + String(id).padStart(3, '0');
const prog = (t) => { const l = t.checklist ?? []; return l.length ? ` [${l.filter((c) => c.done).length}/${l.length}]` : ''; };
async function projects() { return (await call('/projects')).data; }
async function allTasks(projectIds) {
  const items = [];
  for (const id of projectIds) { let cursor = null; do { const d = (await call(`/projects/${id}/tasks${cursor ? '?cursor=' + cursor : ''}`)).data; items.push(...d.items); cursor = d.next_cursor; } while (cursor); }
  return items;
}
async function task(id) { if (!/^\d+$/.test(String(id ?? ''))) fail('ระบุเลขงาน เช่น 70'); return (await call('/tasks/' + Number(id))).data; }
function fieldValue(raw) { return raw.startsWith('@') ? readFileSync(raw.slice(1), 'utf8') : raw.replace(/\\n/g, '\n'); }
function parseFields(list) {
  const out = {};
  for (const pair of list) {
    const i = pair.indexOf('='); const key = pair.slice(0, i);
    if (i < 1 || !FIELDS.includes(key)) fail('ฟิลด์ไม่รู้จัก: ' + pair + ' (ใช้ได้: ' + FIELDS.join(', ') + ')');
    out[key] = fieldValue(pair.slice(i + 1));
  }
  return out;
}
const notify = flags.notify ? { notify: flags.notify } : {};
async function patch(t, changes) {
  const body = { ...Object.fromEntries(FIELDS.map((f) => [f, t[f] ?? ''])), status: t.status, checklist: t.checklist ?? [], version: t.version, ...changes, ...notify };
  if (body.planned_go_live_on === '') body.planned_go_live_on = null;
  return (await call('/tasks/' + t.id, { method: 'PATCH', body })).data;
}
function printTask(t, events = []) {
  const lines = [`${pad(t.id)} ${t.title}`, `สถานะ: ${STATUSES[t.status]} (${t.status}) · ฟังก์ชัน: ${t.feature || '-'} · ผู้รับผิดชอบ: ${t.assignee || '-'} · เริ่มใช้: ${t.planned_go_live_on || 'ยังไม่กำหนด'} · version ${t.version}`];
  for (const [label, key] of [['สรุปสำหรับผู้ชม', 'public_summary'], ['รายละเอียดและขอบเขต', 'scope'], ['เกณฑ์ตรวจรับ', 'criteria'], ['หลักฐาน', 'evidence'], ['ติดขัด', 'blocked_reason']]) if (t[key]) lines.push('', `## ${label}`, t[key]);
  if (t.checklist?.length) { lines.push('', `## งานย่อย${prog(t)}`); for (const c of t.checklist) lines.push(`- [${c.done ? 'x' : ' '}] ${c.label}  (id: ${c.id})${c.note ? '\n    โน้ต: ' + c.note : ''}`); }
  if (events.length) { lines.push('', '## ประวัติล่าสุด'); for (const e of events.slice(0, 10)) { let p = {}; try { p = JSON.parse(e.payload); } catch { /* raw */ } lines.push(`- ${e.created_at} ${e.actor}: ${e.action}${p.text ? ' — ' + p.text : p.label ? ' — ' + p.label : ''}`); } }
  lines.push('', `ลิงก์: ${site}/?view=board&task=${t.id}`);
  return lines.join('\n');
}
async function subtask(id, body, label) { const t = (await call(`/tasks/${Number(id)}/subtasks`, { method: 'POST', body: { ...body, ...notify } })).data; out(t, `✓ ${label}${prog(t)} ${pad(t.id)} ${t.title}`); }

// ---- commands
switch (command) {
  case 'projects': { const p = await projects(); out(p, p.map((x) => `${x.id}\t${x.name}\t(${x.role})`).join('\n')); break; }
  case 'tasks': {
    const ps = await projects();
    const want = flags.project ? ps.filter((p) => String(p.id) === flags.project || p.name.toLowerCase() === String(flags.project).toLowerCase()) : ps;
    if (!want.length) fail('ไม่พบโปรเจกต์ ' + flags.project);
    let items = await allTasks(want.map((p) => p.id));
    if (flags.status !== undefined) items = items.filter((t) => t.status === Number(flags.status));
    if (flags.open) items = items.filter((t) => t.status !== 4);
    if (flags.q) items = items.filter((t) => `${t.title} ${t.feature ?? ''} ${t.public_summary}`.toLowerCase().includes(String(flags.q).toLowerCase()));
    const name = (id) => ps.find((p) => p.id === id)?.name;
    out(items, items.map((t) => `${pad(t.id)}  ${STATUSES[t.status].padEnd(14)} ${name(t.project_id)} · ${t.feature || 'ทั่วไป'} · ${t.title}${prog(t)}${t.blocked_reason ? '  ⚠ ' + t.blocked_reason : ''}`).join('\n') + `\n(${items.length} งาน)`);
    break;
  }
  case 'show': { const t = await task(args[0]); const events = (await call(`/tasks/${t.id}/events`)).data; out({ ...t, events }, printTask(t, events)); break; }
  case 'note': { if (!args[1]) fail('ใส่ข้อความ'); const r = await call(`/tasks/${Number(args[0])}/notes`, { method: 'POST', body: { text: fieldValue(args[1]), ...notify } }); out(r.data, '✓ ' + r.message); break; }
  case 'sub-add': await subtask(args[0], { op: 'add', label: args[1], note: flags.note ?? '' }, 'เพิ่มงานย่อย'); break;
  case 'sub-done': await subtask(args[0], { op: 'set', id: args[1], done: true, ...(flags.note !== undefined ? { note: flags.note } : {}) }, 'งานย่อยเสร็จ'); break;
  case 'sub-undo': await subtask(args[0], { op: 'set', id: args[1], done: false }, 'เปิดงานย่อยใหม่'); break;
  case 'sub-note': await subtask(args[0], { op: 'set', id: args[1], note: args[2] ?? '' }, 'บันทึกโน้ตงานย่อย'); break;
  case 'sub-rm': await subtask(args[0], { op: 'remove', id: args[1] }, 'ลบงานย่อย'); break;
  case 'status': {
    const s = Number(args[1]); if (!Number.isInteger(s) || s < 0 || s > 4) fail('สถานะต้องเป็น 0-4');
    const t = await patch(await task(args[0]), { status: s }); out(t, `✓ ${pad(t.id)} → ${STATUSES[t.status]}`); break;
  }
  case 'set': { const t = await patch(await task(args[0]), parseFields(args.slice(1))); out(t, `✓ บันทึก ${pad(t.id)} ${t.title} (version ${t.version})`); break; }
  case 'create': {
    const ps = await projects(); const p = ps.find((x) => String(x.id) === args[0] || x.name.toLowerCase() === String(args[0]).toLowerCase());
    if (!p) fail('ไม่พบโปรเจกต์ ' + args[0]); if (!args[1]) fail('ใส่ชื่องาน');
    const body = { ...Object.fromEntries(FIELDS.map((f) => [f, ''])), planned_go_live_on: null, status: Number(flags.status ?? 0), title: args[1], ...parseFields(args.slice(2)), checklist: subs.map((label) => ({ label, done: false })), ...notify };
    const t = (await call(`/projects/${p.id}/tasks`, { method: 'POST', body })).data; out(t, `✓ สร้าง ${pad(t.id)} ${t.title}${prog(t)}\n${site}/?view=board&task=${t.id}`); break;
  }
  case 'notify': { if (!['test', 'main'].includes(args[1])) fail('เลือก test หรือ main'); const r = await call(`/tasks/${Number(args[0])}/notify`, { method: 'POST', body: { notify: args[1], text: args[2] ?? '' } }); out(r.data, '✓ ' + r.message); break; }
  default: fail('ไม่รู้จักคำสั่ง ' + command + ' — ดู node scripts/wb.mjs help');
}
