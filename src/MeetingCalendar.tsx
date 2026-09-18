import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from './api';
import type { Meeting, Project, Task } from './types';
import FormattedReport from './FormattedReport';
import { today, dateLabel } from './ProjectViews';
import { calendarItems, monthsBetween, shiftDay, weekOf, weekRows, type CalendarFilters, type CalendarItem } from './calendar-items';
import { mergeLoaded, removeMeeting, upsertMeeting, type LocalChange, type LoadJob } from './meeting-state';
const template='# สรุปการประชุม\n\n## ประเด็นที่หารือ\n- \n\n## ข้อตกลง / มติ\n- \n\n## งานที่ต้องติดตาม\n| งาน | ผู้รับผิดชอบ | กำหนดส่ง |\n| --- | --- | --- |\n|  |  |  |\n\n## ประเด็นค้าง\n- ';

// Calendar layout follows the WorkAlljob/Lark concept (side panel + month/week grid) in Workboard's own palette.
type Item = CalendarItem<Task, Meeting>;
const DOW = ['จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส', 'อา'];
const PROJECT_COLORS = ['#a9361f', '#17654d', '#3b5b92', '#b7791f', '#7a4a8c', '#2f7f86', '#8a5a3c', '#5d6b2f'];
const FILTER_KEY = 'workboard-calendar-filters';
const DATE_ROW = 28;
const LANE = 21;

function loadFilters(): CalendarFilters {
  const fallback = { meetings: true, pending: true, released: true, hiddenProjects: [] };
  try { return { ...fallback, ...JSON.parse(localStorage.getItem(FILTER_KEY) || '{}') }; } catch { return fallback; }
}
function monthLabel(day: string) { return new Date(day + 'T12:00:00').toLocaleDateString('th-TH', { month: 'long', year: 'numeric' }); }
function shortLabel(day: string) { return new Date(day + 'T12:00:00').toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }); }

export default function MeetingCalendar({ projects, tasks, projectId, onProject, onTask }: { projects: Project[]; tasks: Task[]; projectId: number | null; onProject: (id: number) => void; onTask: (t: Task) => void }) {
  const [view, setView] = useState<'month' | 'week'>('month');
  const [day, setDay] = useState(today());
  const [filters, setFilters] = useState<CalendarFilters>(loadFilters);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [selected, setSelected] = useState<Meeting | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  // Every save/delete gets a sequence number so a reload that started earlier cannot bring the old state back.
  const changeSeq = useRef(0);
  const changes = useRef<LocalChange<Meeting>[]>([]);
  function applyChange(id: number, meeting: Meeting | null) {
    const seq = ++changeSeq.current;
    changes.current = [...changes.current.slice(-49), { seq, id, meeting }];
    setMeetings((list) => meeting ? upsertMeeting(list, meeting) : removeMeeting(list, id));
  }
  const [sheetOpen, setSheetOpen] = useState(false);
  const scoped = useMemo(() => projects.filter((p) => !projectId || p.id === projectId), [projects, projectId]);
  const writable = scoped.filter((p) => p.role !== 'viewer');
  const color = (id: number) => PROJECT_COLORS[Math.max(0, projects.findIndex((p) => p.id === id)) % PROJECT_COLORS.length];
  const rows = useMemo(() => view === 'month' ? weekRows(day.slice(0, 7)) : [weekOf(day)], [view, day]);
  const first = rows[0][0], last = rows[rows.length - 1][6];
  const months = monthsBetween(first, last).join(',');

  useEffect(() => { try { localStorage.setItem(FILTER_KEY, JSON.stringify(filters)); } catch { /* storage unavailable: keep in memory */ } }, [filters]);
  // Load every month the grid shows, so leading/trailing days of neighbouring months also show their meetings.
  // One failed project/month no longer discards the whole reload: it keeps what was shown and reports the gap.
  useEffect(() => {
    let cancelled = false; setLoading(true); setError('');
    const startSeq = changeSeq.current;
    const jobs: LoadJob[] = scoped.flatMap((p) => months.split(',').map((month) => ({ project: p.id, month })));
    Promise.allSettled(jobs.map(async ({ project, month }) => {
      const items: Meeting[] = []; let cursor: number | null = null;
      do { const data: { items: Meeting[]; next_cursor: number | null } = await api('/projects/' + project + '/meetings?month=' + month + (cursor ? '&cursor=' + cursor : '')); items.push(...data.items); cursor = data.next_cursor; } while (cursor);
      return items;
    })).then((settled) => {
      if (cancelled) return;
      const results = settled.map((r) => r.status === 'fulfilled' ? r.value : null);
      setMeetings((previous) => mergeLoaded(previous, jobs, results, changes.current, startSeq));
      const failed = settled.find((r): r is PromiseRejectedResult => r.status === 'rejected');
      if (failed) setError('โหลดรายงานประชุมบางส่วนไม่สำเร็จ: ' + (failed.reason instanceof Error ? failed.reason.message : 'ไม่ทราบสาเหตุ'));
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [months, scoped, revision]);

  const scopedTasks = useMemo(() => tasks.filter((t) => !projectId || t.project_id === projectId), [tasks, projectId]);
  const byDay = useMemo(() => calendarItems(scopedTasks, meetings, filters, today()), [scopedTasks, meetings, filters]);
  const dayItems = byDay.get(day) ?? [];

  function move(delta: number) {
    if (view === 'week') { setDay(shiftDay(day, delta * 7)); return; }
    const d = new Date(day.slice(0, 7) + '-01T12:00:00'); d.setMonth(d.getMonth() + delta);
    setDay(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-01');
  }
  function create(on = day) {
    const p = writable.find((w) => !filters.hiddenProjects.includes(w.id)) ?? writable[0];
    if (p) setSelected({ id: 0, project_id: p.id, title: '', meeting_on: on, participants: '', content: '', published: false, version: 0, updated_at: '' });
  }
  function open(item: Item) { if (item.meeting) setSelected(item.meeting); else if (item.task) onTask(item.task); }
  const toggle = (key: 'meetings' | 'pending' | 'released') => setFilters((f) => ({ ...f, [key]: !f[key] }));
  const toggleProject = (id: number) => setFilters((f) => ({ ...f, hiddenProjects: f.hiddenProjects.includes(id) ? f.hiddenProjects.filter((x) => x !== id) : [...f.hiddenProjects, id] }));
  const title = view === 'month' ? monthLabel(day) : shortLabel(first) + ' – ' + dateLabel(last);
  const agenda = <DayAgenda day={day} items={dayItems} loading={loading} color={color} projects={projects} onOpen={open} canCreate={writable.length > 0} onCreate={() => create()} />;

  return <div className="wcal">
    {sheetOpen && <div className="wcal-backdrop" onClick={() => setSheetOpen(false)} />}
    <aside className={'wcal-side' + (sheetOpen ? ' open' : '')} aria-label="ตัวกรองปฏิทิน">
      <MiniMonth selected={day} onPick={(d) => { setDay(d); setSheetOpen(false); }} marked={byDay} />
      <div className="wcal-side-agenda">{agenda}</div>
      <section className="wcal-filter"><h3>แสดง</h3>
        <FilterRow on={filters.meetings} onToggle={() => toggle('meetings')} mark="dot">รายงานประชุม</FilterRow>
        <FilterRow on={filters.pending} onToggle={() => toggle('pending')} mark="ring">งานรอเริ่มใช้</FilterRow>
        <FilterRow on={filters.released} onToggle={() => toggle('released')} mark="check">งานเปิดใช้แล้ว</FilterRow>
      </section>
      <section className="wcal-filter"><h3>โปรเจกต์</h3>
        {scoped.map((p) => <FilterRow key={p.id} on={!filters.hiddenProjects.includes(p.id)} onToggle={() => toggleProject(p.id)} color={color(p.id)}>{p.name}</FilterRow>)}
        {projectId ? <button className="text-action" onClick={() => onProject(0)}>ดูทุกโปรเจกต์</button> : null}
      </section>
    </aside>
    <section className="wcal-main">
      <header className="wcal-head">
        <button className="secondary wcal-sheet-btn" onClick={() => setSheetOpen(true)}>ตัวกรอง</button>
        <div className="wcal-nav">
          <button className="secondary" aria-label={view === 'month' ? 'เดือนก่อน' : 'สัปดาห์ก่อน'} onClick={() => move(-1)}>‹</button>
          <button className="secondary" onClick={() => setDay(today())}>วันนี้</button>
          <button className="secondary" aria-label={view === 'month' ? 'เดือนถัดไป' : 'สัปดาห์ถัดไป'} onClick={() => move(1)}>›</button>
        </div>
        <h2 className="wcal-title">{title}</h2>
        {loading && <small className="wcal-loading">กำลังโหลด…</small>}
        <div className="wcal-views" role="group" aria-label="มุมมองปฏิทิน">
          <button className={view === 'month' ? 'on' : ''} aria-pressed={view === 'month'} onClick={() => setView('month')}>เดือน</button>
          <button className={view === 'week' ? 'on' : ''} aria-pressed={view === 'week'} onClick={() => setView('week')}>สัปดาห์</button>
        </div>
        {writable.length > 0 && <button className="primary" onClick={() => create()}>+ บันทึกประชุม</button>}
      </header>
      {error && <div className="alert error wcal-error" role="alert">{error} <button className="text-action" disabled={loading} onClick={() => setRevision((v) => v + 1)}>ลองโหลดใหม่</button></div>}
      {view === 'month'
        ? <MonthGrid rows={rows} month={day.slice(0, 7)} selected={day} byDay={byDay} color={color} onSelect={setDay} onOpen={open} />
        : <WeekGrid days={rows[0]} selected={day} byDay={byDay} color={color} projects={projects} onSelect={setDay} onOpen={open} />}
      <div className="wcal-below-agenda">{agenda}</div>
    </section>
    {selected && <MeetingDrawer key={selected.id + '-' + selected.meeting_on} initial={selected} projects={projects} onClose={() => setSelected(null)} onSaved={(m) => { applyChange(m.id, m); setSelected(m); setDay(m.meeting_on); }} onArchived={(id) => { applyChange(id, null); setSelected(null); }} />}
  </div>;
}

function FilterRow({ on, onToggle, color, mark, children }: { on: boolean; onToggle: () => void; color?: string; mark?: 'dot' | 'ring' | 'check'; children: React.ReactNode }) {
  return <label className="wcal-filter-row">
    <input type="checkbox" checked={on} onChange={onToggle} style={color ? { accentColor: color } : undefined} />
    {mark && <span className={'wcal-mark ' + mark} aria-hidden="true">{mark === 'check' ? '✓' : ''}</span>}
    {color && <span className="wcal-swatch" style={{ background: color }} aria-hidden="true" />}
    <span className="truncate">{children}</span>
  </label>;
}

function Chip({ item, color, onOpen, full }: { item: Item; color: string; onOpen: (i: Item) => void; full?: boolean }) {
  const kind = item.kind === 'meeting' ? 'ประชุม' : item.kind === 'released' ? 'เปิดใช้แล้ว' : item.overdue ? 'เลยกำหนดเริ่มใช้' : 'กำหนดเริ่มใช้';
  return <button type="button" className={'wcal-chip ' + item.kind + (item.overdue ? ' overdue' : '') + (full ? ' full' : '')} title={kind + ': ' + item.title} aria-label={kind + ': ' + item.title}
    onClick={(e) => { e.stopPropagation(); onOpen(item); }} style={{ ['--chip' as string]: color }}>
    <span className="wcal-dot" aria-hidden="true">{item.kind === 'released' ? '✓' : ''}</span><span className="wcal-text">{item.title}</span>
  </button>;
}

function MonthGrid({ rows, month, selected, byDay, color, onSelect, onOpen }: { rows: string[][]; month: string; selected: string; byDay: Map<string, Item[]>; color: (id: number) => string; onSelect: (d: string) => void; onOpen: (i: Item) => void }) {
  const grid = useRef<HTMLDivElement>(null);
  const [capacity, setCapacity] = useState(3);
  const [openWeek, setOpenWeek] = useState(-1);
  useEffect(() => { setOpenWeek(-1); }, [month]);
  // How many items fit in a day cell depends on the real window height (dots only on narrow screens).
  useEffect(() => {
    const el = grid.current; if (!el || typeof ResizeObserver === 'undefined') return;
    const calc = () => setCapacity(el.clientWidth < 520 ? 99 : Math.max(1, Math.min(8, Math.floor((el.clientHeight / 6 - DATE_ROW) / LANE))));
    calc(); const ro = new ResizeObserver(calc); ro.observe(el); return () => ro.disconnect();
  }, []);
  const now = today();
  return <section className="wcal-month" aria-label="ปฏิทินรายเดือน">
    <div className="wcal-dow">{DOW.map((d) => <span key={d}>{d}</span>)}</div>
    <div className="wcal-grid" ref={grid}>
      {rows.map((week, w) => {
        const open = openWeek === w;
        return <div key={week[0]} className={'wcal-week' + (open ? ' open' : '')}>
          {week.map((date) => {
            const items = byDay.get(date) ?? [];
            const shown = open || items.length <= capacity ? items : items.slice(0, capacity - 1);
            const more = items.length - shown.length;
            return <div key={date} className={'wcal-cell' + (date.slice(0, 7) !== month ? ' out' : '') + (date === selected ? ' selected' : '') + (date === now ? ' today' : '')} onClick={() => onSelect(date)}>
              <button type="button" className="wcal-date" aria-pressed={date === selected} aria-label={dateLabel(date) + ' · ' + items.length + ' รายการ'} onClick={(e) => { e.stopPropagation(); onSelect(date); }}>{Number(date.slice(8))}</button>
              <div className="wcal-items">
                {shown.map((item) => <Chip key={item.key} item={item} color={color(item.project_id)} onOpen={onOpen} />)}
                {more > 0 && <button type="button" className="wcal-more" onClick={(e) => { e.stopPropagation(); setOpenWeek(w); }}>+{more} เพิ่มเติม</button>}
              </div>
            </div>;
          })}
          {open && <button type="button" className="wcal-collapse" onClick={() => setOpenWeek(-1)}>ย่อสัปดาห์นี้</button>}
        </div>;
      })}
    </div>
  </section>;
}

function WeekGrid({ days, selected, byDay, color, projects, onSelect, onOpen }: { days: string[]; selected: string; byDay: Map<string, Item[]>; color: (id: number) => string; projects: Project[]; onSelect: (d: string) => void; onOpen: (i: Item) => void }) {
  const now = today();
  return <section className="wcal-weekview" aria-label="ปฏิทินรายสัปดาห์">
    {days.map((date, i) => {
      const items = byDay.get(date) ?? [];
      return <div key={date} className={'wcal-daycol' + (date === selected ? ' selected' : '') + (date === now ? ' today' : '')} onClick={() => onSelect(date)}>
        <button type="button" className="wcal-dayhead" aria-pressed={date === selected} onClick={(e) => { e.stopPropagation(); onSelect(date); }}><span>{DOW[i]}</span><strong>{Number(date.slice(8))}</strong></button>
        <div className="wcal-daycol-items">
          {items.map((item) => <div key={item.key} className="wcal-week-item"><Chip item={item} color={color(item.project_id)} onOpen={onOpen} full /><small>{projects.find((p) => p.id === item.project_id)?.name}</small></div>)}
          {!items.length && <p className="wcal-empty">—</p>}
        </div>
      </div>;
    })}
  </section>;
}

function DayAgenda({ day, items, loading, color, projects, onOpen, canCreate, onCreate }: { day: string; items: Item[]; loading: boolean; color: (id: number) => string; projects: Project[]; onOpen: (i: Item) => void; canCreate: boolean; onCreate: () => void }) {
  return <section className="wcal-agenda" aria-label="รายการของวันที่เลือก">
    <header><small>วันที่เลือก</small><h3>{dateLabel(day)}</h3></header>
    {items.map((item) => <button key={item.key} type="button" className={'wcal-agenda-item ' + item.kind + (item.overdue ? ' overdue' : '')} onClick={() => onOpen(item)} style={{ ['--chip' as string]: color(item.project_id) }}>
      <span className="wcal-dot" aria-hidden="true">{item.kind === 'released' ? '✓' : ''}</span>
      <span><strong>{item.title}</strong><small>{projects.find((p) => p.id === item.project_id)?.name} · {item.kind === 'meeting' ? (item.meeting?.published ? 'ประชุม · เผยแพร่ให้ผู้ชม' : 'ประชุม · เฉพาะทีม') : item.kind === 'released' ? 'เปิดใช้งานแล้ว' : item.overdue ? 'เลยกำหนดเริ่มใช้' : 'กำหนดเริ่มใช้'}</small></span>
    </button>)}
    {!items.length && <p className="muted">{loading ? 'กำลังโหลด…' : 'ไม่มีประชุมหรืองานในวันนี้'}</p>}
    {canCreate && <button className="text-action" onClick={onCreate}>+ บันทึกประชุมวันนี้</button>}
  </section>;
}

function MiniMonth({ selected, onPick, marked }: { selected: string; onPick: (d: string) => void; marked: Map<string, Item[]> }) {
  const [month, setMonth] = useState(selected.slice(0, 7));
  useEffect(() => { setMonth(selected.slice(0, 7)); }, [selected]);
  const cells = weekRows(month).flat();
  const now = today();
  const step = (delta: number) => { const d = new Date(month + '-01T12:00:00'); d.setMonth(d.getMonth() + delta); setMonth(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')); };
  return <section className="wcal-mini" aria-label="เลือกวันที่">
    <header><strong>{monthLabel(month + '-01')}</strong><span><button type="button" aria-label="เดือนก่อน" onClick={() => step(-1)}>‹</button><button type="button" aria-label="เดือนถัดไป" onClick={() => step(1)}>›</button></span></header>
    <div className="wcal-mini-grid">
      {DOW.map((d) => <span key={d} className="wcal-mini-dow">{d}</span>)}
      {cells.map((d) => <button type="button" key={d} className={'wcal-mini-day' + (d.slice(0, 7) !== month ? ' out' : '') + (d === now ? ' today' : '') + (d === selected ? ' sel' : '') + (marked.has(d) ? ' has' : '')} aria-label={dateLabel(d)} onClick={() => onPick(d)}>{Number(d.slice(8))}</button>)}
    </div>
  </section>;
}

function MeetingDrawer({initial,projects,onClose,onSaved,onArchived}:{initial:Meeting;projects:Project[];onClose:()=>void;onSaved:(m:Meeting)=>void;onArchived:(id:number)=>void}) {
 const dialog=useRef<HTMLElement>(null);
 useEffect(()=>{const previous=document.activeElement as HTMLElement|null;dialog.current?.focus();return()=>previous?.focus();},[]);
 const [draft,setDraft]=useState(initial);const [tab,setTab]=useState<'edit'|'read'>(initial.id?'read':'edit');const [loading,setLoading]=useState(!!initial.id);const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [saved,setSaved]=useState(false);const [archiveConfirm,setArchiveConfirm]=useState(false);
 const editable=projects.find(p=>p.id===draft.project_id)?.role!=='viewer';
 useEffect(()=>{let current=true;if(initial.id)api<Meeting>('/meetings/'+initial.id).then(m=>{if(current)setDraft(m);}).catch(e=>{if(current)setError(e.message);}).finally(()=>{if(current)setLoading(false);});return()=>{current=false;};},[initial.id]);
 function field<K extends keyof Meeting>(key:K,value:Meeting[K]){setDraft(d=>({...d,[key]:value}));setSaved(false);}
 async function save(e?:React.FormEvent){e?.preventDefault();setBusy(true);setError('');try{const m=await api<Meeting>(draft.id?'/meetings/'+draft.id:'/projects/'+draft.project_id+'/meetings',{method:draft.id?'PATCH':'POST',body:JSON.stringify(draft)});setDraft(m);setSaved(true);setTab('read');onSaved(m);}catch(e){setError(e instanceof Error?e.message:'บันทึกไม่สำเร็จ');}finally{setBusy(false);}}
 async function archive(){setBusy(true);try{await api('/meetings/'+draft.id,{method:'DELETE',body:JSON.stringify({version:draft.version})});onArchived(draft.id);}catch(e){setError((e as Error).message);setArchiveConfirm(false);}finally{setBusy(false);}}
 const confirmBox=archiveConfirm&&<div className="archive-confirm" role="alertdialog" aria-label="ยืนยันลบรายงาน"><p>ลบรายงาน “{draft.title}” ออกจากปฏิทิน? (ระบบเก็บสำเนาไว้ในประวัติ กู้คืนได้โดยผู้ดูแลฐานข้อมูล)</p><button type="button" className="secondary" onClick={()=>setArchiveConfirm(false)}>ไม่ลบ</button><button type="button" className="danger" disabled={busy} onClick={archive}>{busy?'กำลังลบ…':'ยืนยันลบ'}</button></div>;
 async function reload(){setLoading(true);try{setDraft(await api<Meeting>('/meetings/'+draft.id));setError('');}catch(e){setError((e as Error).message);}finally{setLoading(false);}}
 return <div className="drawer-layer"><aside ref={dialog} tabIndex={-1} onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();onClose();}if(e.key==='Tab'){const nodes=Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]')??[]);const first=nodes[0],last=nodes[nodes.length-1];if(e.shiftKey&&(document.activeElement===first||document.activeElement===dialog.current)){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}}} className="drawer meeting-drawer" role="dialog" aria-modal="true" aria-label="รายงานประชุม"><header><div><small>{projects.find(p=>p.id===draft.project_id)?.name} / {dateLabel(draft.meeting_on)}</small><h1>{draft.title||'บันทึกประชุมใหม่'}</h1></div><button className="icon-button" aria-label="ปิดรายงานประชุม" onClick={onClose}>×</button></header><div className="drawer-tabs"><button className={tab==='read'?'active':''} onClick={()=>setTab('read')}>หน้าอ่าน</button>{editable&&<button className={tab==='edit'?'active':''} onClick={()=>setTab('edit')}>แก้ไข / วางสรุป AI</button>}</div>
 {loading?<div className="drawer-body">กำลังโหลด…</div>:<><div className="meeting-messages">{error&&<div className="alert error" role="alert">{error}{draft.id>0&&<button className="secondary" onClick={reload}>โหลดฉบับล่าสุด</button>}</div>}{saved&&<p className="good" role="status">บันทึกแล้ว</p>}</div>
 {tab==='read'?<div className="drawer-body meeting-paper"><div className="meeting-meta"><span>{draft.published?'เผยแพร่ให้ผู้ชม':'เฉพาะทีม'}</span><span>{dateLabel(draft.meeting_on)}</span></div>{draft.participants&&<p className="participants">ผู้เข้าร่วม: {draft.participants}</p>}{draft.content?<FormattedReport content={draft.content}/>:<p className="muted">วางสรุปการประชุมในแท็บแก้ไข แล้วดูรูปแบบได้ที่นี่</p>}<footer className="meeting-footnote">{draft.updated_at?'บันทึกล่าสุด '+new Date(draft.updated_at.replace(' ','T')+'Z').toLocaleString('th-TH'):'ยังไม่บันทึก'} · จัดรูปแบบจากข้อความที่ผู้เขียนส่งมา</footer>{confirmBox}{editable&&<div className="drawer-actions">{draft.id>0&&<button className="danger-text" onClick={()=>setArchiveConfirm(true)}>ลบรายงาน</button>}<button onClick={()=>setTab('edit')}>แก้ไขข้อความ</button><button className="primary" disabled={busy||!draft.title.trim()||!draft.content?.trim()||!draft.meeting_on} onClick={()=>save()}>{busy?'กำลังบันทึก…':'บันทึกรายงาน'}</button></div>}</div>:
 <form className="drawer-body meeting-editor" onSubmit={save}><div className="field-grid"><label className="field"><span>โปรเจกต์</span><select disabled={draft.id>0} value={draft.project_id} onChange={e=>field('project_id',Number(e.target.value))}>{projects.filter(p=>p.role!=='viewer').map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label className="field"><span>วันที่ประชุม</span><input type="date" required value={draft.meeting_on} onChange={e=>field('meeting_on',e.target.value)}/></label></div><label className="field"><span>หัวข้อการประชุม</span><input required value={draft.title} onChange={e=>field('title',e.target.value)} placeholder="เช่น ประชุมติดตามงานประจำวัน"/></label><label className="field"><span>ผู้เข้าร่วม (เฉพาะทีม)</span><input value={draft.participants??''} onChange={e=>field('participants',e.target.value)} placeholder="รายชื่อหรือทีมที่เข้าร่วม"/></label><div className="section-heading"><strong>สรุปการประชุมจาก AI หรือบันทึกของคุณ</strong>{!draft.content&&<button type="button" className="text-action" onClick={()=>field('content',template)}>ใช้โครงรายงาน</button>}</div><p className="muted">วางข้อความหรือ Markdown รองรับหัวข้อ รายการ เช็กลิสต์ และตาราง ดูผลในแท็บหน้าอ่านก่อนบันทึก</p><textarea aria-label="เนื้อหารายงานประชุม" required rows={16} value={draft.content??''} onChange={e=>field('content',e.target.value)} placeholder={'## ประเด็นที่หารือ\n- …\n\n## ข้อตกลง\n- …\n\n## งานที่ต้องติดตาม\n- ผู้รับผิดชอบ / กำหนดส่ง'}/><label className="publish-choice"><input type="checkbox" checked={draft.published} onChange={e=>field('published',e.target.checked)}/> ให้ผู้ชมที่มีสิทธิ์ในโปรเจกต์อ่านรายงานฉบับนี้ได้</label><div className="drawer-actions">{draft.id>0&&<button type="button" className="danger-text" onClick={()=>setArchiveConfirm(true)}>ลบรายงาน</button>}<button type="button" onClick={()=>setTab('read')}>ดูรูปแบบ</button><button className="primary" disabled={busy}>{busy?'กำลังบันทึก…':'บันทึกรายงาน'}</button></div>{confirmBox}</form>}</>}
 </aside></div>;
}
