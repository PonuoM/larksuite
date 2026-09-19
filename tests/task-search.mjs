import assert from 'node:assert/strict';
import { mkdtemp, rm, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
await mkdir(new URL('../scratch/', import.meta.url), { recursive: true });
const temp = await mkdtemp(new URL('../scratch/task-search-', import.meta.url));
let mod;
try {
  execFileSync('node', ['node_modules/typescript/bin/tsc', '--ignoreConfig', 'src/task-search.ts', '--target', 'ES2022', '--module', 'ES2022', '--outDir', temp], { cwd: fileURLToPath(new URL('../', import.meta.url)), windowsHide: true });
  mod = await import(new URL('file:///' + temp.replaceAll('\\', '/') + '/task-search.js'));
} finally { await rm(temp, { recursive: true, force: true }); }
const { matchesQuery, isNumberHit, taskNumber } = mod;

const t105 = { id: 105, title: 'กฎดึงรายชื่อคืน', public_summary: '', feature: 'ย้ายถัง' };
const t119 = { id: 119, title: 'แก้คะแนน "100 ต้น"', public_summary: '', feature: null };
const t100 = { id: 100, title: 'ปรับระบบ VIP', public_summary: '', feature: 'VIP' };

assert.equal(matchesQuery(t105, ''), true);
// Number forms as shown on cards (#041 style) all find the task.
for (const q of ['#105', '105', '#0105', ' 105 ']) assert.equal(matchesQuery(t105, q), true, q);
// "#100" is the number only; "100" also matches text containing 100.
assert.equal(matchesQuery(t100, '#100'), true);
assert.equal(matchesQuery(t119, '#100'), false);
assert.equal(matchesQuery(t119, '100'), true);
// Text search still works.
assert.equal(matchesQuery(t105, 'รายชื่อ'), true);
assert.equal(matchesQuery(t105, 'vip'), false);
assert.equal(matchesQuery(t100, 'vip'), true);
// Only an exact number hit bypasses the "hide old released tasks" filter.
assert.equal(isNumberHit(t105, '#105'), true);
assert.equal(isNumberHit(t119, '100'), false);
assert.equal(taskNumber('abc'), null);
console.log('Task search: number, #number and text matching passed');
