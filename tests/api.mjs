import { execFile as execFileCallback, spawn } from 'node:child_process';
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
const mysql = process.env.MYSQL_BIN || 'C:/AppServ/MySQL/bin/mysql.exe';
const mysqlArgs = [`-u${env.DB_USER}`, `-p${env.DB_PASSWORD}`, '-hlocalhost', '-N', env.DB_NAME];
// Defaults target local AppServ. For a deployed instance set WORKBOARD_API, WORKBOARD_ORIGIN and
// WORKBOARD_SQL_SSH (e.g. root@host): fixtures then run through `docker exec workboard-db` over SSH.
const base = process.env.WORKBOARD_API || 'http://localhost/Workboard/api/v1';
const origin = process.env.WORKBOARD_ORIGIN || 'http://localhost';
const sqlSsh = process.env.WORKBOARD_SQL_SSH || '';

async function sql(statement) {
  if (!sqlSsh) return (await execFile(mysql, [...mysqlArgs, '-e', statement], { cwd: root, windowsHide: true })).stdout.trim();
  return new Promise((resolve, reject) => {
    const child = spawn('ssh', ['-o', 'BatchMode=yes', sqlSsh, `docker exec -i workboard-db sh -c 'mariadb -uroot -p"$MARIADB_ROOT_PASSWORD" -N workboard'`], { windowsHide: true });
    let out = '', err = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { err += d; });
    child.on('close', (code) => code === 0 ? resolve(out.trim()) : reject(new Error('remote sql failed: ' + err.trim())));
    child.stdin.end(statement);
  });
}

async function raw(path, options = {}) {
  return fetch(base + path, { ...options, headers: { Origin: origin, ...(options.headers ?? {}) } });
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
let meetingId = 0;
const extraPrincipals = [];
const admin = await redeem(`API admin ${marker}`, 'admin', projectId);
extraPrincipals.push(admin.id);

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

  const thaiTitle = 'ก'.repeat(240);
  const thaiCreated = await call(editor, `/projects/${projectId}/tasks`, { method: 'POST', body: JSON.stringify({ ...taskInput, title: thaiTitle }) });
  if (thaiCreated.status === 201) await sql(`UPDATE tasks SET archived=1 WHERE id=${Number(thaiCreated.payload.data.id)};`);
  if (thaiCreated.status !== 201 || thaiCreated.payload.data.title !== thaiTitle) throw new Error(`240-character Thai title rejected: ${thaiCreated.status}`);
  if ((await call(editor, `/projects/${projectId}/tasks`, { method: 'POST', body: JSON.stringify({ ...taskInput, title: thaiTitle + 'ก' }) })).status !== 422) throw new Error('241-character title accepted');

  // Go-live date is optional (migration 004): missing / null / '' are stored as null; a malformed date is still rejected.
  for (const due of [undefined, null, '']) {
    const input = { ...taskInput, title: 'ไม่มีกำหนดเริ่มใช้' };
    if (due === undefined) delete input.planned_go_live_on; else input.planned_go_live_on = due;
    const undated = await call(editor, `/projects/${projectId}/tasks`, { method: 'POST', body: JSON.stringify(input) });
    if (undated.status === 201) await sql(`UPDATE tasks SET archived=1 WHERE id=${Number(undated.payload.data.id)};`);
    if (undated.status !== 201 || undated.payload.data.planned_go_live_on !== null) throw new Error(`task without go-live date (${JSON.stringify(due)}) rejected: ${undated.status}`);
  }
  if ((await call(editor, `/projects/${projectId}/tasks`, { method: 'POST', body: JSON.stringify({ ...taskInput, planned_go_live_on: '2026-02-30' }) })).status !== 422) throw new Error('invalid go-live date accepted');

  const moved = await call(editor, `/tasks/${taskId}`, { method: 'PATCH', body: JSON.stringify({ ...taskInput, status: 1, version }) });
  if (moved.status !== 200 || moved.payload.data.status !== 1 || moved.payload.data.version !== version + 1) throw new Error('move/version failed');

  const stale = await call(editor, `/tasks/${taskId}`, { method: 'PATCH', body: JSON.stringify({ ...taskInput, status: 2, version }) });
  if (stale.status !== 409) throw new Error(`stale update should be 409, got ${stale.status}`);

  const viewerList = await call(viewer, `/projects/${projectId}/tasks`);
  const projected = viewerList.payload.data.items.find((item) => item.id === taskId);
  if (!projected || projected.public_summary !== taskInput.public_summary || 'scope' in projected) throw new Error('viewer projection failed');
  // Viewers see sub-task names and progress, never notes.
  if (projected.checklist?.length !== 1 || projected.checklist[0].label !== 'สร้างงาน' || projected.checklist[0].done !== true || 'note' in projected.checklist[0]) throw new Error('viewer sub-task projection failed: ' + JSON.stringify(projected.checklist));

  const denied = await call(viewer, `/tasks/${taskId}`, { method: 'PATCH', body: JSON.stringify({ ...taskInput, status: 2, version: version + 1 }) });
  if (denied.status !== 403) throw new Error(`viewer mutation should be 403, got ${denied.status}`);

  const history = await call(editor, `/tasks/${taskId}/events`);
  if (history.status !== 200 || history.payload.data.length < 2) throw new Error('history failed');

  // Sub-task operations merge on the server (no version), keep stable ids and are audited.
  const sub = (body) => call(editor, `/tasks/${taskId}/subtasks`, { method: 'POST', body: JSON.stringify(body) });
  const added = await sub({ op: 'add', label: 'ออกแบบหน้าจอ', note: 'ร่างแรก' });
  const addedItem = added.payload.data?.checklist?.[1];
  if (added.status !== 200 || !addedItem || !/^[a-z0-9]{1,16}$/.test(addedItem.id) || addedItem.done || addedItem.note !== 'ร่างแรก') throw new Error('add sub-task failed: ' + JSON.stringify(added));
  const done = await sub({ op: 'set', id: addedItem.id, done: true, note: 'ส่งให้ทีมดูแล้ว' });
  const doneItem = done.payload.data?.checklist?.[1];
  if (done.status !== 200 || !doneItem?.done || !doneItem.done_at || doneItem.note !== 'ส่งให้ทีมดูแล้ว' || done.payload.data.version !== version + 3) throw new Error('set sub-task failed: ' + JSON.stringify(done));
  if ((await sub({ op: 'set', id: 'missing', done: true })).status !== 404) throw new Error('unknown sub-task accepted');
  if ((await sub({ op: 'set', id: addedItem.id, done: 'yes' })).status !== 422) throw new Error('non-boolean done accepted');
  if ((await sub({ op: 'bogus' })).status !== 422) throw new Error('unknown op accepted');
  if ((await call(viewer, `/tasks/${taskId}/subtasks`, { method: 'POST', body: JSON.stringify({ op: 'add', label: 'x' }) })).status !== 403) throw new Error('viewer changed sub-tasks');
  const firstId = done.payload.data.checklist[0].id;
  const removed = await sub({ op: 'remove', id: firstId });
  if (removed.status !== 200 || removed.payload.data.checklist.length !== 1 || removed.payload.data.checklist[0].id !== addedItem.id) throw new Error('remove sub-task failed');
  // A full save keeps the ids and done_at it was given.
  const full = await call(editor, `/tasks/${taskId}`, { method: 'PATCH', body: JSON.stringify({ ...taskInput, status: 1, checklist: removed.payload.data.checklist, version: removed.payload.data.version }) });
  if (full.status !== 200 || full.payload.data.checklist[0].id !== addedItem.id || full.payload.data.checklist[0].done_at !== doneItem.done_at) throw new Error('full save lost sub-task identity: ' + JSON.stringify(full.payload));
  const note = await call(editor, `/tasks/${taskId}/notes`, { method: 'POST', body: JSON.stringify({ text: 'ทำหน้า list เสร็จ รอ API' }) });
  if (note.status !== 201) throw new Error('note failed: ' + JSON.stringify(note));
  if ((await call(editor, `/tasks/${taskId}/notes`, { method: 'POST', body: JSON.stringify({ text: ' ' }) })).status !== 422) throw new Error('empty note accepted');
  if ((await call(editor, `/tasks/${taskId}/notes`, { method: 'POST', body: JSON.stringify({ text: 'x', notify: 'everyone' }) })).status !== 422) throw new Error('unknown Lark target accepted');
  if ((await call(editor, `/tasks/${taskId}/notify`, { method: 'POST', body: '{}' })).status !== 422) throw new Error('notify without target accepted');
  const actions = (await call(editor, `/tasks/${taskId}/events`)).payload.data.map((e) => e.action);
  if (actions.filter((a) => a === 'subtask').length !== 3 || !actions.includes('note')) throw new Error('sub-task/note history missing: ' + actions.join(','));
  // WORKBOARD_LARK_BROKEN=1 with LARK_TEST_WEBHOOK pointing somewhere unreachable: a saved change whose Lark notice
  // fails must answer 2xx with the saved data + lark_warning (a 502 made the UI treat it as unsaved → duplicates).
  if (process.env.WORKBOARD_LARK_BROKEN === '1') {
    const larkTitle = 'API Lark broken ' + marker;
    const created = await call(editor, `/projects/${projectId}/tasks`, { method: 'POST', body: JSON.stringify({ ...taskInput, title: larkTitle, notify: 'test' }) });
    if (created.status !== 201 || !created.payload.data?.id || !created.payload.data.lark_warning) throw new Error('create + failed Lark should be 201 with lark_warning: ' + JSON.stringify(created));
    await sql(`UPDATE tasks SET archived=1 WHERE id=${Number(created.payload.data.id)};`);
    if (Number(await sql(`SELECT COUNT(*) FROM tasks WHERE title='${larkTitle}'`)) !== 1) throw new Error('task saved more than once');
    const patched = await call(editor, `/tasks/${taskId}`, { method: 'PATCH', body: JSON.stringify({ ...taskInput, status: 1, checklist: full.payload.data.checklist, version: full.payload.data.version, notify: 'test' }) });
    if (patched.status !== 200 || !patched.payload.data.lark_warning || patched.payload.data.version !== full.payload.data.version + 1) throw new Error('patch + failed Lark should be 200 with lark_warning: ' + JSON.stringify(patched));
    full.payload.data = patched.payload.data;
    const brokenNote = await call(editor, `/tasks/${taskId}/notes`, { method: 'POST', body: JSON.stringify({ text: 'note with broken Lark', notify: 'test' }) });
    if (brokenNote.status !== 201 || !brokenNote.payload.data.lark_warning) throw new Error('note + failed Lark should be 201 with lark_warning');
    const brokenSub = await sub({ op: 'add', label: 'sub with broken Lark', notify: 'test' });
    if (brokenSub.status !== 200 || !brokenSub.payload.data.lark_warning) throw new Error('sub-task + failed Lark should be 200 with lark_warning');
    full.payload.data = brokenSub.payload.data;
    if ((await call(editor, `/tasks/${taskId}/notify`, { method: 'POST', body: JSON.stringify({ notify: 'test' }) })).status !== 502) throw new Error('send-only notify with failed Lark should stay 502');
  }
  if (process.env.WORKBOARD_LARK_TEST === '1') {
    const sent = await call(editor, `/tasks/${taskId}/notify`, { method: 'POST', body: JSON.stringify({ target: 'test', notify: 'test', text: 'ทดสอบระบบแจ้งเตือนจาก Workboard (integration test)' }) });
    if (sent.status !== 200) throw new Error('Lark test notify failed: ' + JSON.stringify(sent));
  }
  const current = full.payload.data.version;

  const archived = await call(editor, `/tasks/${taskId}`, { method: 'DELETE', body: JSON.stringify({ version: current }) });
  if (archived.status !== 200) throw new Error('archive failed');

  const projectList = await call(admin, '/projects');
  const allIds = projectList.payload.data.map((p) => Number(p.id));
  if (allIds.length < 3) throw new Error('multi-project tests require at least 3 seeded projects');
  for (const ids of [allIds.slice(0, 2), allIds]) {
    const invited = await call(admin, '/access', { method: 'POST', body: JSON.stringify({ label: 'API multi ' + marker, role: 'viewer', project_ids: ids }) });
    if (invited.status !== 201) throw new Error('multi-project invitation failed');
    extraPrincipals.push(invited.payload.data.id);
    const token = new URL(invited.payload.data.link).hash.slice(8);
    const redeemed = await raw('/redeem', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) });
    if (redeemed.status !== 200) throw new Error('multi-project redemption failed');
    const cookie = redeemed.headers.getSetCookie()[0].split(';')[0];
    const session = await (await raw('/session', { headers: { Cookie: cookie } })).json();
    const actor = { cookie, csrf: session.data.csrf };
    const accessible = await call(actor, '/projects');
    const actual = accessible.payload.data.map((p) => Number(p.id));
    if (JSON.stringify(actual) !== JSON.stringify(ids)) throw new Error('project scope differs from selected IDs');
    for (const id of ids) if ((await call(actor, '/projects/' + id + '/tasks')).status !== 200) throw new Error('selected project denied');
    const outside = allIds.find((id) => !ids.includes(id));
    if (outside && (await call(actor, '/projects/' + outside + '/tasks')).status !== 404) throw new Error('unselected project accessible');
    if ((await call(actor, '/access')).status !== 403) throw new Error('viewer gained admin access');
    const replay = await raw('/redeem', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) });
    if (replay.status !== 401) throw new Error('invite token reused');
  }
  for (const ids of [[], [allIds[0], 2147483647], ['invalid']]) {
    const invalid = await call(admin, '/access', { method: 'POST', body: JSON.stringify({ label: 'API invalid ' + marker, role: 'viewer', project_ids: ids }) });
    if (![404, 422].includes(invalid.status)) throw new Error('invalid project selection accepted');
  }
  const redeemToken = async (link) => {
    const response = await raw('/redeem', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: new URL(link).hash.slice(8) }) });
    if (response.status !== 200) return { status: response.status };
    const cookie = response.headers.getSetCookie()[0].split(';')[0];
    const session = await (await raw('/session', { headers: { Cookie: cookie } })).json();
    return { status: 200, cookie, csrf: session.data.csrf };
  };
  const permanent = await call(admin, '/access', { method: 'POST', body: JSON.stringify({ label: 'API permanent ' + marker, role: 'viewer', project_ids: [projectId], permanent: true }) });
  if (permanent.status !== 201) throw new Error('permanent link create failed: ' + JSON.stringify(permanent));
  extraPrincipals.push(permanent.payload.data.id);
  const firstDevice = await redeemToken(permanent.payload.data.link);
  const secondDevice = await redeemToken(permanent.payload.data.link);
  if (firstDevice.status !== 200 || secondDevice.status !== 200) throw new Error('permanent link not reusable');
  if ((await call(firstDevice, '/projects')).status !== 200 || (await call(secondDevice, '/projects')).status !== 200) throw new Error('permanent sessions invalid');
  const accessList = (await call(admin, '/access')).payload.data;
  const permanentMember = accessList.find((m) => m.id === permanent.payload.data.id);
  const permanentLink = permanentMember?.links?.[0];
  // Permanent links can be shown again when LINK_KEY is configured; one-time links never.
  if (permanentLink?.viewable) {
    const shown = await call(admin, `/access/links/${permanentLink.id}/url`);
    if (shown.status !== 200 || shown.payload.data.link !== permanent.payload.data.link) throw new Error('stored permanent link differs');
    if ((await call(viewer, `/access/links/${permanentLink.id}/url`)).status !== 403) throw new Error('viewer read a stored link');
  } else if (process.env.WORKBOARD_EXPECT_VIEWABLE !== '0') throw new Error('permanent link not viewable (LINK_KEY missing?)');
  if (!permanentLink || permanentLink.reusable !== true || permanentLink.expires_at !== null || !permanentLink.last_used_at || permanentLink.consumed_at) throw new Error('permanent link listing incorrect: ' + JSON.stringify(permanentMember));
  if ((await call(admin, `/access/links/${permanentLink.id}/close`, { method: 'POST', body: '{}' })).status !== 200) throw new Error('close link failed');
  if ((await call(admin, `/access/links/${permanentLink.id}/url`)).status !== 404) throw new Error('closed link still shown');
  if ((await call(firstDevice, '/projects')).status !== 401 || (await call(secondDevice, '/projects')).status !== 401) throw new Error('closed link sessions still active');
  if ((await redeemToken(permanent.payload.data.link)).status !== 401) throw new Error('closed link still redeemable');
  const replacement = await call(admin, `/access/${permanent.payload.data.id}/links`, { method: 'POST', body: JSON.stringify({ permanent: true }) });
  if (replacement.status !== 201) throw new Error('replacement link failed: ' + JSON.stringify(replacement));
  const replacementDevice = await redeemToken(replacement.payload.data.link);
  if (replacementDevice.status !== 200) throw new Error('replacement link not redeemable');
  const replacementProjects = (await call(replacementDevice, '/projects')).payload.data.map((p) => Number(p.id));
  if (JSON.stringify(replacementProjects) !== JSON.stringify([projectId])) throw new Error('replacement link changed project scope');
  if ((await call(viewer, `/access/links/${permanentLink.id}/close`, { method: 'POST', body: '{}' })).status !== 403) throw new Error('viewer closed a link');
  const adminLink = Number(await sql(`SELECT id FROM invitations WHERE principal_id=${admin.id} ORDER BY id DESC LIMIT 1;`));
  if ((await call(admin, `/access/links/${adminLink}/close`, { method: 'POST', body: '{}' })).status !== 422) throw new Error('admin closed the link of the current session');
  const oneTime = await call(admin, '/access', { method: 'POST', body: JSON.stringify({ label: 'API one-time ' + marker, role: 'viewer', project_ids: [projectId] }) });
  extraPrincipals.push(oneTime.payload.data.id);
  const oneTimeLink = (await call(admin, '/access')).payload.data.find((m) => m.id === oneTime.payload.data.id).links[0];
  if (oneTimeLink.viewable || (await call(admin, `/access/links/${oneTimeLink.id}/url`)).status !== 404) throw new Error('one-time link is viewable');
  if ((await redeemToken(oneTime.payload.data.link)).status !== 200 || (await redeemToken(oneTime.payload.data.link)).status !== 401) throw new Error('default link is not one-time');
  const meetingInput = { title: 'API meeting '+marker, meeting_on:'2026-09-18', participants:'Internal participants', content:'## Summary\n- Agreed scope\n\n## Actions\n| Task | Owner |\n| --- | --- |\n| Review | Team |', published:false };
  const meetingCreated=await call(editor, '/projects/'+projectId+'/meetings', {method:'POST',body:JSON.stringify(meetingInput)});
  if(meetingCreated.status!==201)throw new Error('meeting create failed: '+JSON.stringify(meetingCreated));
  meetingId=meetingCreated.payload.data.id;
  if((await call(viewer,'/meetings/'+meetingId)).status!==404)throw new Error('internal meeting visible');
  const hidden=await call(viewer,'/projects/'+projectId+'/meetings?month=2026-09');
  if(hidden.payload.data.items.some(m=>m.id===meetingId))throw new Error('internal meeting leaked in calendar');
  const published=await call(editor,'/meetings/'+meetingId,{method:'PATCH',body:JSON.stringify({...meetingInput,published:true,version:1})});
  if(published.status!==200||published.payload.data.version!==2)throw new Error('publish/version failed');
  const publicMeeting=await call(viewer,'/meetings/'+meetingId);
  if(publicMeeting.status!==200||publicMeeting.payload.data.content!==meetingInput.content||'participants' in publicMeeting.payload.data)throw new Error('published meeting projection failed');
  const month=await call(viewer,'/projects/'+projectId+'/meetings?month=2026-09');
  if(!month.payload.data.items.some(m=>m.id===meetingId))throw new Error('published calendar entry missing');
  const otherMonth=await call(editor,'/projects/'+projectId+'/meetings?month=2026-10');
  if(otherMonth.payload.data.items.some(m=>m.id===meetingId))throw new Error('calendar month filter failed');
  if((await call(editor,'/projects/'+projectId+'/meetings?month=2026-99')).status!==422)throw new Error('invalid month accepted');
  if((await call(editor,'/projects/'+projectId+'/meetings',{method:'POST',body:JSON.stringify({...meetingInput,meeting_on:'2026-02-30'})})).status!==422)throw new Error('invalid meeting date accepted');
  if((await call(editor,'/projects/'+allIds[1]+'/meetings?month=2026-09')).status!==404)throw new Error('cross-project calendar accessible');
  if((await call(viewer,'/meetings/'+meetingId,{method:'PATCH',body:JSON.stringify({...meetingInput,version:2})})).status!==403)throw new Error('viewer edited meeting');
  if((await call(editor,'/meetings/'+meetingId,{method:'PATCH',body:JSON.stringify({...meetingInput,version:1})})).status!==409)throw new Error('stale meeting overwrite');
  const unpublish=await call(editor,'/meetings/'+meetingId,{method:'PATCH',body:JSON.stringify({...meetingInput,version:2})});
  if(unpublish.status!==200||(await call(viewer,'/meetings/'+meetingId)).status!==404)throw new Error('unpublish failed');
  const eventCount=Number(await sql('SELECT COUNT(*) FROM meeting_events WHERE meeting_id='+meetingId));
  if(eventCount!==3)throw new Error('meeting audit event count incorrect');
  if((await call(editor,'/meetings/'+meetingId,{method:'DELETE',body:JSON.stringify({version:3})})).status!==200)throw new Error('archive meeting failed');
  if((await call(editor,'/meetings/'+meetingId)).status!==404)throw new Error('archived meeting readable');
  console.log(JSON.stringify({ ok: true, checks: ['one-time invite redemption', 'session + CSRF', 'project-scoped editor', 'create + persisted task', 'multibyte title length', 'optimistic version conflict', 'viewer field projection', 'viewer write denial', 'event history', 'archive', 'multiple/all existing project access', 'unselected project denial', 'invalid project selection', 'one-time token replay denial', 'permanent reusable link', 'close link ends its sessions', 'replacement link keeps scope', 'cannot close current session link', 'meeting persistence and month filtering', 'meeting publication and viewer projection', 'meeting write/project denial', 'meeting conflict and audit', 'meeting archive', 'viewer sub-task projection', 'sub-task add/set/remove + ids', 'progress notes', 'Lark target validation', 'viewable permanent links'] }, null, 2));
} finally {
  if(meetingId) await sql('UPDATE meetings SET archived=1 WHERE id='+meetingId);
  const ids = [editor.id, viewer.id, ...extraPrincipals].join(',');
  await sql(`UPDATE principals SET revoked_at=UTC_TIMESTAMP() WHERE id IN (${ids}); UPDATE invitations SET revoked_at=UTC_TIMESTAMP() WHERE principal_id IN (${ids}); DELETE FROM access_sessions WHERE principal_id IN (${ids});`);
}
