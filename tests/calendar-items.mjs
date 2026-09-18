import assert from 'node:assert/strict';
import { mkdtemp, rm, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
await mkdir(new URL('../scratch/', import.meta.url), { recursive: true });
const temp = await mkdtemp(new URL('../scratch/calendar-', import.meta.url));
let mod;
try {
  execFileSync('node', ['node_modules/typescript/bin/tsc', '--ignoreConfig', 'src/calendar-items.ts', '--target', 'ES2022', '--module', 'ES2022', '--outDir', temp], { cwd: fileURLToPath(new URL('../', import.meta.url)), windowsHide: true });
  mod = await import(new URL('file:///' + temp.replaceAll('\\', '/') + '/calendar-items.js'));
} finally { await rm(temp, { recursive: true, force: true }); }
const { calendarItems, bangkokDate, monthsBetween, weekRows } = mod;

const task = (id, status, planned, released = null, project_id = 1) => ({ id, project_id, title: 'งาน ' + id, status, planned_go_live_on: planned, actual_released_at: released });
const meeting = (id, date, project_id = 1) => ({ id, project_id, title: 'ประชุม ' + id, meeting_on: date, published: false, version: 1, updated_at: '' });
const all = { meetings: true, pending: true, released: true, hiddenProjects: [] };

// Released date is converted from UTC to Bangkok: 2026-09-17 18:30 UTC is 2026-09-18 in Thailand.
assert.equal(bangkokDate('2026-09-17 18:30:00'), '2026-09-18');
assert.equal(bangkokDate('2026-09-17 16:59:59'), '2026-09-17');

const byDay = calendarItems([task(1, 0, '2026-09-20'), task(2, 4, '2026-09-25', '2026-09-17 18:30:00'), task(3, 1, '2026-09-10')], [meeting(9, '2026-09-20')], all, '2026-09-18');
// Meetings come before tasks on the same day.
assert.deepEqual(byDay.get('2026-09-20').map((i) => i.key), ['m9', 't1']);
// Released task sits on the actual release day, not the planned day.
assert.equal(byDay.get('2026-09-25'), undefined);
assert.equal(byDay.get('2026-09-18')[0].kind, 'released');
// Unfinished task past its planned date is overdue; future one is not.
assert.equal(byDay.get('2026-09-10')[0].overdue, true);
assert.equal(byDay.get('2026-09-20')[1].overdue, false);

// Filters: each kind and each project can be hidden.
assert.equal(calendarItems([task(1, 0, '2026-09-20')], [meeting(9, '2026-09-20')], { ...all, meetings: false }, '2026-09-18').get('2026-09-20').length, 1);
assert.equal(calendarItems([task(2, 4, '2026-09-25', '2026-09-20 03:00:00')], [], { ...all, released: false }, '2026-09-18').size, 0);
assert.equal(calendarItems([task(1, 0, '2026-09-20', null, 2)], [meeting(9, '2026-09-20', 2)], { ...all, hiddenProjects: [2] }, '2026-09-18').size, 0);

// Visible range helpers: a month view is always 6 Monday-first weeks and may touch 3 months.
const rows = weekRows('2026-09');
assert.equal(rows.length, 6);
assert.equal(rows[0][0], '2026-08-31');
assert.equal(rows[5][6], '2026-10-11');
assert.deepEqual(monthsBetween(rows[0][0], rows[5][6]), ['2026-08', '2026-09', '2026-10']);
console.log('Calendar items: dates, release timezone, overdue, filters, visible months passed');
