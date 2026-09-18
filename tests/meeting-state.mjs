// Regression test for "deleted meeting stays on the calendar until F5" (2026-09-18).
// The calendar used to show a delete only after reloading every project/month; one failed reload kept the old list.
import assert from 'node:assert/strict';
import { mkdtemp, rm, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
await mkdir(new URL('../scratch/', import.meta.url), { recursive: true });
const temp = await mkdtemp(new URL('../scratch/meeting-state-', import.meta.url));
let mod;
try {
  execFileSync('node', ['node_modules/typescript/bin/tsc', '--ignoreConfig', 'src/meeting-state.ts', '--target', 'ES2022', '--module', 'ES2022', '--outDir', temp], { cwd: fileURLToPath(new URL('../', import.meta.url)), windowsHide: true });
  mod = await import(new URL('file:///' + temp.replaceAll('\\', '/') + '/meeting-state.js'));
} finally { await rm(temp, { recursive: true, force: true }); }
const { upsertMeeting, removeMeeting, mergeLoaded } = mod;

const m = (id, project, day, title = 'm' + id) => ({ id, project_id: project, meeting_on: day, title });
const ids = (list) => list.map((x) => x.id).sort((a, b) => a - b);
const shown = [m(1, 1, '2026-09-18'), m(2, 1, '2026-09-18'), m(3, 2, '2026-09-10'), m(4, 5, '2026-09-02')];

// Delete and save act on the list directly — no reload needed to see the result.
assert.deepEqual(ids(removeMeeting(shown, 2)), [1, 3, 4]);
assert.equal(upsertMeeting(shown, m(1, 1, '2026-10-01', 'moved')).find((x) => x.id === 1).meeting_on, '2026-10-01');
assert.deepEqual(ids(upsertMeeting(shown, m(9, 1, '2026-09-20'))), [1, 2, 3, 4, 9]);

const jobs = [{ project: 1, month: '2026-09' }, { project: 2, month: '2026-09' }, { project: 5, month: '2026-09' }];

// A reload where project 5 fails: projects 1 and 2 are refreshed, project 5 keeps what it showed.
const partial = mergeLoaded(shown, jobs, [[m(1, 1, '2026-09-18')], [m(3, 2, '2026-09-10')], null], [], 0);
assert.deepEqual(ids(partial), [1, 3, 4], 'meeting 2 deleted elsewhere is gone, failed project keeps meeting 4');

// The browser case: delete meeting 2 (seq 1) while a reload that started before it (startSeq 0) returns old data.
const stale = mergeLoaded(removeMeeting(shown, 2), jobs, [[m(1, 1, '2026-09-18'), m(2, 1, '2026-09-18')], [m(3, 2, '2026-09-10')], [m(4, 5, '2026-09-02')]], [{ seq: 1, id: 2, meeting: null }], 0);
assert.deepEqual(ids(stale), [1, 3, 4], 'an older reload must not bring back a deleted meeting');

// A save made during the reload wins over the reloaded copy; changes older than the reload are not re-applied.
const saved = mergeLoaded(shown, jobs, [[m(1, 1, '2026-09-18', 'old title')], [], []], [{ seq: 1, id: 7, meeting: m(7, 1, '2026-09-01') }, { seq: 2, id: 1, meeting: m(1, 1, '2026-09-18', 'new title') }], 1);
assert.equal(saved.find((x) => x.id === 1).title, 'new title');
assert.equal(saved.some((x) => x.id === 7), false, 'change seq 1 is older than the reload and already reflected by it');
assert.equal(saved.filter((x) => x.id === 1).length, 1, 'no duplicate rows after merging');

console.log('Meeting state: delete/save applied locally, partial reload keeps failed months, stale reload cannot undo a write passed');
