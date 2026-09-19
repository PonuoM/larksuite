import React, { useEffect, useState } from 'react';
import { api } from './api';
import type { ChecklistItem, LarkTarget, Project, Task, TaskEvent } from './types';

// Index = status code stored in the database (5 and 6 appended by migration 006).
// Codes 2 and 5 were merged away (migration 007); their names stay so old history still reads correctly.
export const STATUSES = ['รอดำเนินการ', 'กำลังทำ', 'รอทดสอบ', 'รอทดสอบ/เปิดใช้', 'เปิดใช้งานแล้ว', 'รอตัดสินใจ', 'รออนุมัติ'];
// Five columns (owner, 2026-09-18): big system-wide work starts in รออนุมัติ and the approver (CEO) hands it to the
// developers in รอดำเนินการ; bug and data fixes start in รอดำเนินการ. Open questions go in "สาเหตุที่ติดขัด".
export const STATUS_ORDER = [6, 0, 1, 3, 4];
export const AWAITING_APPROVAL = 6;
export const approvable = (status: number) => status === AWAITING_APPROVAL;
export const EMPTY_TASK: Omit<Task, 'id' | 'project_id' | 'updated_at' | 'version' | 'actual_released_at'> = {
  title: '', feature: '', kind: '', size: '', public_summary: '', scope: '', criteria: '', evidence: '', assignee: '',
  blocked_reason: '', checklist: [], status: 0, planned_go_live_on: '', archived: 0,
};
export type Notify = '' | LarkTarget['key'];
// Work type and rough size (migration 008). Keys are what the API stores; keep in sync with TASK_KINDS / TASK_SIZES.
export const KINDS: Record<string, string> = { bug: 'แก้บั๊ก', feature: 'ฟีเจอร์ใหม่', improve: 'ปรับปรุง', data: 'แก้ข้อมูล' };
export const SIZES: Record<string, { label: string; hint: string }> = { S: { label: 'เล็ก', hint: '~1 วัน' }, M: { label: 'กลาง', hint: '2–5 วัน' }, L: { label: 'ใหญ่', hint: '1 สัปดาห์ขึ้นไป' } };
export function TaskTags({ task }: { task: Task }) {
  if (!KINDS[task.kind] && !SIZES[task.size]) return null;
  return <span className="task-tags">{KINDS[task.kind] && <span className={'tag kind-' + task.kind}>{KINDS[task.kind]}</span>}{SIZES[task.size] && <span className="tag size" title={SIZES[task.size].hint}>{SIZES[task.size].label} · {SIZES[task.size].hint}</span>}</span>;
}

// Shared with docs/TASK-GUIDE.md: keep the headings in sync so people and agents write tasks the same way.
const SCOPE_TEMPLATE = '## เป้าหมาย\nทำเพื่ออะไร แก้ปัญหาอะไร ใครได้ประโยชน์\n\n## ขอบเขต\n- ทำ: \n- ไม่ทำในรอบนี้: \n\n## จุดที่เกี่ยวข้องในระบบ\nหน้าจอ / เมนู / ไฟล์ / ตาราง / API\n\n## หมายเหตุ\n';
const CRITERIA_TEMPLATE = '- ผู้ใช้ทำ … ได้ตั้งแต่ต้นจนจบ\n- ข้อมูลที่บันทึกถูกต้องและแสดงผลตรงกันทุกหน้า\n- ใช้งานได้ทั้งบนมือถือและคอมพิวเตอร์\n';

export function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${value.slice(0, 10)}T12:00:00`));
}
export function dateTime(value: string | null | undefined) {
  return value ? new Date(value.replace(' ', 'T') + 'Z').toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' }) : '';
}
export function message(error: unknown) { return error instanceof Error ? error.message : 'เกิดข้อผิดพลาด'; }
export function progress(list: ChecklistItem[] | undefined) { const all = list ?? []; return { done: all.filter((c) => c.done).length, total: all.length }; }

export function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="field"><span>{label}</span>{children}</label>; }

export function ProgressBar({ list }: { list: ChecklistItem[] | undefined }) {
  const { done, total } = progress(list);
  if (!total) return null;
  return <div className="subtask-progress" aria-label={`งานย่อยเสร็จ ${done} จาก ${total}`}><span className="track"><span style={{ width: `${Math.round(done / total * 100)}%` }} /></span><small>งานย่อย {done}/{total}</small></div>;
}

function NotifyPicker({ targets, value, onChange, label = 'แจ้ง Lark' }: { targets: LarkTarget[]; value: Notify; onChange: (v: Notify) => void; label?: string }) {
  if (!targets.length) return null;
  return <label className="notify-picker"><span>{label}</span><select value={value} onChange={(e) => onChange(e.target.value as Notify)}><option value="">ไม่แจ้ง</option>{targets.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}</select></label>;
}

type Props = {
  task: Task; projects: Project[]; editable: boolean; canApprove: boolean; busy: boolean; larkTargets: LarkTarget[];
  onClose: () => void; onSave: (t: Task, notify: Notify, notifyText: string) => void;
  onChanged: (t: Task) => void; onDeleted: (t: Task) => void; onError: (s: string) => void; onNotice: (s: string) => void;
};

export default function TaskDrawer({ task, projects, editable, canApprove, busy, larkTargets, onClose, onSave, onChanged, onDeleted, onError, onNotice }: Props) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  async function remove() {
    setDeleting(true);
    try { await api(`/tasks/${draft.id}`, { method: 'DELETE', body: JSON.stringify({ version: draft.version }) }); onDeleted(draft); }
    catch (e) { onError(message(e)); setConfirmDelete(false); } finally { setDeleting(false); }
  }
  const [draft, setDraft] = useState(task);
  const [tab, setTab] = useState<'details' | 'progress'>('details');
  const [notify, setNotify] = useState<Notify>('');
  const [notifyText, setNotifyText] = useState('');
  // A new task object arrives after every successful save: show it, and do not repeat the Lark notice on the next save.
  useEffect(() => { setDraft(task); setNotify(''); setNotifyText(''); }, [task]);
  const isNew = task.id === 0;
  function field(name: keyof Task, value: string | number | ChecklistItem[]) { setDraft((d) => ({ ...d, [name]: value })); }
  // Sub-task changes on a saved task are stored immediately; keep the rest of the unsaved form as it is.
  function applied(saved: Task) { setDraft((d) => ({ ...d, checklist: saved.checklist, version: saved.version, updated_at: saved.updated_at })); onChanged(saved); }

  return <div className="drawer-layer" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
    <aside className="drawer" aria-label="รายละเอียดงาน">
      <header><div><small>{isNew ? 'งานใหม่' : `#${String(task.id).padStart(3, '0')} · ${projects.find((p) => p.id === task.project_id)?.name ?? ''}`}</small><h1>{draft.title || 'ตั้งชื่องาน'}</h1></div><button className="icon-button" onClick={onClose} aria-label="ปิด">×</button></header>
      {!isNew && (editable || canApprove) && <div className="drawer-tabs"><button className={tab === 'details' ? 'active' : ''} onClick={() => setTab('details')}>รายละเอียด</button><button className={tab === 'progress' ? 'active' : ''} onClick={() => setTab('progress')}>ความคืบหน้า / ประวัติ</button></div>}
      {tab === 'progress' ? <ProgressTab task={draft} larkTargets={editable ? larkTargets : []} commentOnly={!editable} onError={onError} onNotice={onNotice} /> : <form className="drawer-body" onSubmit={(e) => { e.preventDefault(); onSave(isNew ? { ...EMPTY_TASK, ...draft } as Task : draft, notify, notifyText); }}>
        {canApprove && !isNew && approvable(draft.status) && <ApprovalPanel task={draft} onComment={() => setTab('progress')} onDone={(saved) => { onChanged(saved); onNotice(saved.status === 0 ? 'อนุมัติแล้ว ย้ายไป “รอดำเนินการ”' : 'บันทึกเหตุผลแล้ว งานยังรออนุมัติ'); onClose(); }} onError={onError} />}
        {editable ? <>
          <Field label="โปรเจกต์"><select value={draft.project_id} onChange={(e) => field('project_id', Number(e.target.value))}>{projects.filter((p) => p.id === draft.project_id || p.role !== 'viewer').map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
          <Field label="ชื่องาน"><input required value={draft.title} onChange={(e) => field('title', e.target.value)} placeholder="สิ่งที่จะได้เมื่อเสร็จ เช่น หน้าโทรออกแบบใหม่สำหรับทีมเทเล" /></Field>
          <div className="field-grid"><Field label="สถานะ"><select value={draft.status} onChange={(e) => field('status', Number(e.target.value))}>{STATUS_ORDER.map((i) => <option key={i} value={i} disabled={i !== draft.status && task.status === AWAITING_APPROVAL && !canApprove}>{STATUSES[i]}</option>)}</select></Field><Field label="กำหนดเริ่มใช้งาน (เว้นว่างได้)"><input type="date" value={draft.planned_go_live_on ?? ''} onChange={(e) => field('planned_go_live_on', e.target.value)} /></Field></div>
          <div className="field-grid"><Field label="ประเภทงาน"><select value={draft.kind} onChange={(e) => field('kind', e.target.value)}><option value="">ไม่ระบุ</option>{Object.entries(KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field><Field label="ขนาดงาน (ประมาณเวลา)"><select value={draft.size} onChange={(e) => field('size', e.target.value)}><option value="">ไม่ระบุ</option>{Object.entries(SIZES).map(([k, v]) => <option key={k} value={k}>{v.label} · {v.hint}</option>)}</select></Field></div>
          <div className="field-grid"><Field label="ฟังก์ชัน"><input value={draft.feature ?? ''} onChange={(e) => field('feature', e.target.value)} /></Field><Field label="ผู้รับผิดชอบ"><input value={draft.assignee ?? ''} onChange={(e) => field('assignee', e.target.value)} /></Field></div>
          <Field label="สรุปสำหรับผู้ชมภายนอก"><textarea rows={3} value={draft.public_summary} onChange={(e) => field('public_summary', e.target.value)} placeholder="1–2 ประโยคที่คนนอกทีมอ่านแล้วเข้าใจ: ทำอะไร เพื่อใคร ตอนนี้ถึงไหน" /></Field>
        </> : <><ViewerSummary task={draft} projects={projects} />{canApprove && <ReadOnlyDetails task={draft} />}</>}
        <Subtasks task={draft} editable={editable} onLocal={(list) => field('checklist', list)} onApplied={applied} onError={onError} />
        {editable && <>
          <TemplateField label="รายละเอียดและขอบเขตงาน" rows={8} value={draft.scope ?? ''} template={SCOPE_TEMPLATE} onChange={(v) => field('scope', v)} />
          <Field label="สาเหตุที่ติดขัด"><textarea rows={2} value={draft.blocked_reason ?? ''} onChange={(e) => field('blocked_reason', e.target.value)} placeholder="เว้นว่างถ้าไม่ติดอะไร ถ้ามี งานจะขึ้นในหัวข้อ “ต้องการข้อสรุป”" /></Field>
          <TemplateField label="เกณฑ์ตรวจรับ" rows={5} value={draft.criteria ?? ''} template={CRITERIA_TEMPLATE} onChange={(v) => field('criteria', v)} />
          <Field label="หลักฐาน"><textarea rows={4} value={draft.evidence ?? ''} onChange={(e) => field('evidence', e.target.value)} placeholder="ลิงก์ commit / PR / หน้าจอ / ผลทดสอบ" /></Field>
        </>}
        {draft.approved_at && <p className="approved-line">✓ อนุมัติเมื่อ {dateTime(draft.approved_at)}</p>}
        {!isNew && <div className="read-only"><span>เปิดใช้จริง</span><strong>{formatDate(draft.actual_released_at)}</strong><span>แก้ไขล่าสุด</span><strong>{dateTime(draft.updated_at)}</strong></div>}
        {/* The delete confirmation lives in the sticky action bar so it is visible however long the form is. */}
        {editable && <div className="drawer-actions">
          {confirmDelete ? <div className="archive-confirm" role="alertdialog" aria-label="ยืนยันลบงาน"><p>ลบงาน “{draft.title}” ออกจากบอร์ด? (ประวัติยังเก็บไว้ กู้คืนได้โดยผู้ดูแลฐานข้อมูล)</p><button type="button" className="secondary" onClick={() => setConfirmDelete(false)}>ไม่ลบ</button><button type="button" className="danger" disabled={deleting} onClick={remove}>{deleting ? 'กำลังลบ…' : 'ยืนยันลบ'}</button></div> : <>
            {!isNew && <button type="button" className="danger-text" onClick={() => setConfirmDelete(true)}>ลบงาน</button>}
            <NotifyPicker targets={larkTargets} value={notify} onChange={setNotify} />
            {notify && <input className="notify-text" value={notifyText} onChange={(e) => setNotifyText(e.target.value)} placeholder="ข้อความถึงกลุ่ม (เว้นว่าง = สรุปสิ่งที่แก้)" aria-label="ข้อความถึงกลุ่ม Lark" />}
            <button type="button" onClick={onClose}>ยกเลิก</button><button className="primary" disabled={busy}>{busy ? 'กำลังบันทึก…' : isNew ? 'สร้างงาน' : notify ? 'บันทึก + แจ้ง' : 'บันทึก'}</button>
          </>}
        </div>}
      </form>}
    </aside>
  </div>;
}

// Shown to people with the approver right (e.g. the CEO) while the task is in รออนุมัติ.
export async function decide(taskId: number, decision: 'approve' | 'reject', note = '') {
  return api<Task>(`/tasks/${taskId}/approve`, { method: 'POST', body: JSON.stringify({ decision, note }) });
}
function ApprovalPanel({ task, onDone, onComment, onError }: { task: Task; onDone: (t: Task) => void; onComment: () => void; onError: (s: string) => void }) {
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  async function run(decision: 'approve' | 'reject') {
    setBusy(true);
    try { onDone(await decide(task.id, decision, note)); } catch (e) { onError(message(e)); } finally { setBusy(false); }
  }
  return <section className="approval-panel" aria-label="อนุมัติงาน">
    <strong>งานนี้รอคุณอนุมัติ</strong>
    <p>ตรวจรายละเอียดด้านล่าง ถ้าโอเคกดอนุมัติ งานจะไป “รอดำเนินการ” ให้ทีมเริ่มทำ · มีไอเดียเพิ่มหรือคำถาม กด “แสดงความเห็น”</p>
    {rejecting && <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="เหตุผลที่ไม่อนุมัติ / สิ่งที่ต้องแก้ก่อนส่งมาใหม่" aria-label="เหตุผลที่ไม่อนุมัติ" />}
    <div className="approval-actions">
      {rejecting
        ? <><button type="button" className="secondary" onClick={() => setRejecting(false)}>กลับ</button><button type="button" className="danger" disabled={busy || !note.trim()} onClick={() => run('reject')}>บันทึกเหตุผล</button></>
        : <><button type="button" className="secondary" onClick={onComment}>แสดงความเห็น</button><button type="button" className="secondary" onClick={() => setRejecting(true)}>ไม่อนุมัติ</button><button type="button" className="primary" disabled={busy} onClick={() => run('approve')}>{busy ? 'กำลังบันทึก…' : '✓ อนุมัติ'}</button></>}
    </div>
  </section>;
}

// Approvers with a view-only link still need the whole picture to decide.
function ReadOnlyDetails({ task }: { task: Task }) {
  const blocks = [['รายละเอียดและขอบเขต', task.scope], ['เกณฑ์ตรวจรับ', task.criteria], ['สาเหตุที่ติดขัด / เรื่องที่รอตัดสินใจ', task.blocked_reason], ['หลักฐาน', task.evidence]].filter(([, v]) => v && v.trim());
  if (!blocks.length) return null;
  return <div className="readonly-details">{blocks.map(([label, value]) => <section key={label}><h3>{label}</h3><p>{value}</p></section>)}</div>;
}

function ViewerSummary({ task, projects }: { task: Task; projects: Project[] }) {
  return <div className="viewer-summary">
    <dl><dt>โปรเจกต์</dt><dd>{projects.find((p) => p.id === task.project_id)?.name}</dd><dt>สถานะ</dt><dd>{STATUSES[task.status]}</dd><dt>กำหนดเริ่มใช้</dt><dd>{task.planned_go_live_on ? formatDate(task.planned_go_live_on) : 'ยังไม่กำหนด'}</dd><dt>ประเภทงาน</dt><dd>{KINDS[task.kind] ?? 'ไม่ระบุ'}</dd><dt>ขนาดงาน</dt><dd>{SIZES[task.size] ? `${SIZES[task.size].label} · ${SIZES[task.size].hint}` : 'ไม่ระบุ'}</dd></dl>
    {task.public_summary ? <p>{task.public_summary}</p> : <p className="muted">ยังไม่มีสรุปสำหรับผู้ชม</p>}
  </div>;
}

function TemplateField({ label, rows, value, template, onChange }: { label: string; rows: number; value: string; template: string; onChange: (v: string) => void }) {
  return <div className="field"><span className="field-head">{label}{!value.trim() && <button type="button" className="text-action" onClick={() => onChange(template)}>ใช้แม่แบบ</button>}</span><textarea aria-label={label} rows={rows} value={value} onChange={(e) => onChange(e.target.value)} /></div>;
}

function Subtasks({ task, editable, onLocal, onApplied, onError }: { task: Task; editable: boolean; onLocal: (l: ChecklistItem[]) => void; onApplied: (t: Task) => void; onError: (s: string) => void }) {
  const list = task.checklist ?? [];
  const live = task.id > 0; // saved task: every change goes straight to the server
  const [label, setLabel] = useState('');
  const [pending, setPending] = useState('');
  const [openNote, setOpenNote] = useState('');
  const [noteText, setNoteText] = useState('');
  const { done, total } = progress(list);
  async function op(key: string, body: Record<string, unknown>) {
    setPending(key);
    try { onApplied(await api<Task>(`/tasks/${task.id}/subtasks`, { method: 'POST', body: JSON.stringify(body) })); return true; }
    catch (e) { onError(message(e)); return false; }
    finally { setPending(''); }
  }
  async function add() {
    const text = label.trim(); if (!text) return;
    if (!live) { onLocal([...list, { label: text, done: false, note: '' }]); setLabel(''); return; }
    if (await op('add', { op: 'add', label: text })) setLabel('');
  }
  function toggle(item: ChecklistItem, index: number) {
    if (!live) { onLocal(list.map((x, i) => i === index ? { ...x, done: !x.done } : x)); return; }
    op(item.id!, { op: 'set', id: item.id, done: !item.done });
  }
  function remove(item: ChecklistItem, index: number) {
    if (!live) { onLocal(list.filter((_, i) => i !== index)); return; }
    op(item.id!, { op: 'remove', id: item.id });
  }
  async function saveNote(item: ChecklistItem, index: number) {
    if (!live) { onLocal(list.map((x, i) => i === index ? { ...x, note: noteText } : x)); setOpenNote(''); return; }
    if (await op(item.id!, { op: 'set', id: item.id, note: noteText })) setOpenNote('');
  }
  if (!editable && !total) return null;
  return <section className="checklist">
    <div className="section-heading"><strong>งานย่อย</strong><small>{total ? `เสร็จ ${done}/${total}` : 'ยังไม่มี'}</small></div>
    {total > 0 && <ProgressBar list={list} />}
    {list.map((item, index) => {
      const key = item.id ?? String(index);
      return <div key={key} className={'subtask' + (item.done ? ' done' : '')}>
        <label><input type="checkbox" checked={item.done} disabled={!editable || pending === key} onChange={() => toggle(item, index)} /><span>{item.label}</span></label>
        {editable && <span className="subtask-actions"><button type="button" onClick={() => { setOpenNote(openNote === key ? '' : key); setNoteText(item.note ?? ''); }}>{item.note ? 'โน้ต' : '+ โน้ต'}</button><button type="button" disabled={pending === key} onClick={() => remove(item, index)} aria-label={'ลบงานย่อย ' + item.label}>×</button></span>}
        {editable && item.note && openNote !== key && <p className="subtask-note">{item.note}{item.done_at && <small> · เสร็จ {dateTime(item.done_at)}</small>}</p>}
        {openNote === key && <div className="subtask-note-edit"><textarea rows={2} value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="ทำอะไรไปแล้ว ติดอะไร ลิงก์หลักฐาน" aria-label={'โน้ตของ ' + item.label} /><button type="button" className="secondary" disabled={pending === key} onClick={() => saveNote(item, index)}>บันทึกโน้ต</button></div>}
      </div>;
    })}
    {editable && <div className="add-check"><input placeholder="เพิ่มงานย่อย เช่น ออกแบบหน้าจอ, ทำ API, ทดสอบกับทีม" value={label} onChange={(e) => setLabel(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} /><button type="button" disabled={pending === 'add'} onClick={add}>เพิ่ม</button></div>}
    {editable && live && <small className="muted">ติ๊ก / เพิ่ม / ลบงานย่อยบันทึกทันที ไม่ต้องกดบันทึกด้านล่าง</small>}
  </section>;
}

const FIELD_NAMES: Record<string, string> = { project_id: 'ย้ายโปรเจกต์', title: 'ชื่องาน', feature: 'ฟังก์ชัน', public_summary: 'สรุป', scope: 'รายละเอียด', criteria: 'เกณฑ์ตรวจรับ', evidence: 'หลักฐาน', assignee: 'ผู้รับผิดชอบ', blocked_reason: 'สาเหตุที่ติดขัด', checklist: 'งานย่อย', planned_go_live_on: 'กำหนดเริ่มใช้', status: 'สถานะ' };

function describe(event: TaskEvent): { title: string; body?: string } {
  let p: Record<string, any> = {};
  try { p = JSON.parse(event.payload) ?? {}; } catch { /* keep empty */ }
  switch (event.action) {
    case 'note': return { title: 'ความคืบหน้า / ความเห็น', body: p.text };
    case 'subtask': {
      if (p.op === 'add') return { title: 'เพิ่มงานย่อย', body: p.label };
      if (p.op === 'remove') return { title: 'ลบงานย่อย', body: p.label };
      const verb = p.done ? (p.done.to ? 'งานย่อยเสร็จ' : 'เปิดงานย่อยใหม่') : 'แก้งานย่อย';
      return { title: verb, body: p.label + (p.note?.to ? ' — ' + p.note.to : '') };
    }
    case 'updated': {
      const parts = Object.keys(p).map((k) => k === 'status' ? `สถานะ ${STATUSES[Number(p.status.from)]} → ${STATUSES[Number(p.status.to)]}` : FIELD_NAMES[k] ?? k);
      return { title: 'แก้ไขงาน', body: parts.join(' · ') || 'ไม่มีการเปลี่ยนแปลง' };
    }
    case 'created': return { title: 'สร้างงาน' };
    case 'imported': return { title: 'นำเข้า', body: [p.source, p.status].filter(Boolean).join(' · ') };
    case 'archived': return { title: 'ลบงาน' };
    case 'approved': return { title: '✓ อนุมัติ', body: p.note || 'ย้ายไป “' + STATUSES[Number(p.status?.to ?? 0)] + '”' };
    case 'rejected': return { title: 'ไม่อนุมัติ', body: p.note };
    case 'lark_notified': return { title: 'แจ้งกลุ่ม Lark (' + (p.target === 'main' ? 'กลุ่มจริง' : 'กลุ่มทดสอบ') + ')', body: p.headline };
    default: return { title: event.action };
  }
}

function ProgressTab({ task, larkTargets, commentOnly = false, onError, onNotice }: { task: Task; larkTargets: LarkTarget[]; commentOnly?: boolean; onError: (s: string) => void; onNotice: (s: string) => void }) {
  const [events, setEvents] = useState<TaskEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [notify, setNotify] = useState<Notify>('');
  const [busy, setBusy] = useState(false);
  async function load() { try { setEvents(await api<TaskEvent[]>(`/tasks/${task.id}/events`)); } catch (e) { onError(message(e)); } finally { setLoading(false); } }
  useEffect(() => { load(); }, [task.id]);
  async function send(kind: 'notes' | 'notify') {
    setBusy(true);
    try {
      if (kind === 'notes') {
        // A Lark failure still returns 201 (the note is saved) with lark_warning: clear the box so it is not sent twice.
        const r = await api<{ lark_warning?: string }>(`/tasks/${task.id}/notes`, { method: 'POST', body: JSON.stringify({ text, notify: notify || null }) });
        if (r.lark_warning) onError(r.lark_warning); else onNotice(commentOnly ? 'บันทึกความเห็นแล้ว' : notify ? 'บันทึกและส่งเข้า Lark แล้ว' : 'บันทึกความคืบหน้าแล้ว');
      }
      else { await api(`/tasks/${task.id}/notify`, { method: 'POST', body: JSON.stringify({ notify, text }) }); onNotice('ส่งสถานะงานเข้า Lark แล้ว'); }
      setText(''); await load();
    } catch (e) { onError(message(e)); await load(); } finally { setBusy(false); }
  }
  return <div className="drawer-body progress-tab">
    <section className="note-composer">
      <strong>{commentOnly ? 'แสดงความเห็น / ไอเดียเพิ่มเติม' : 'อัปเดตความคืบหน้า'}</strong>
      <textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder={commentOnly ? 'ความเห็น คำถาม หรือไอเดียเพิ่มเติมถึงทีม' : 'ทำอะไรไปแล้ว / ต่อไปจะทำอะไร / ติดอะไร\nเช่น ทำหน้า list เสร็จแล้ว รอ API ฝั่งหลังบ้าน'} aria-label="ข้อความความคืบหน้า" />
      <div className="note-actions">
        <NotifyPicker targets={larkTargets} value={notify} onChange={setNotify} label="ส่งเข้า Lark ด้วย" />
        {notify && <button type="button" className="secondary" disabled={busy} onClick={() => send('notify')} title="ส่งสถานะงานและข้อความนี้เข้ากลุ่ม โดยไม่บันทึกเป็นความคืบหน้า">ส่งเข้า Lark อย่างเดียว</button>}
        <button type="button" className="primary" disabled={busy || !text.trim()} onClick={() => send('notes')}>{busy ? 'กำลังบันทึก…' : 'บันทึก'}</button>
      </div>
    </section>
    <div className="history-list">
      {events.map((event) => { const d = describe(event); return <article key={event.id} className={event.action === 'note' ? 'note' : ''}><strong>{d.title}</strong>{d.body && <p className="history-body">{d.body}</p>}<p>{event.actor} · {dateTime(event.created_at)}</p></article>; })}
      {!events.length && <p className="muted">{loading ? 'กำลังโหลด…' : 'ยังไม่มีประวัติ'}</p>}
    </div>
  </div>;
}
