import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { api, ApiError, setCsrf } from './api';
import type { AccessRow, ChecklistItem, Project, SessionUser, Task, TaskEvent } from './types';
import './index.css';
import ProjectViews from './ProjectViews';
import MeetingCalendar from './MeetingCalendar';

const STATUSES = ['รอทำ', 'กำลังทำ', 'รอทดสอบ', 'รอเปิดใช้', 'เปิดใช้งานแล้ว'];
const EMPTY_TASK: Omit<Task, 'id' | 'project_id' | 'updated_at' | 'version' | 'actual_released_at'> = {
  title: '', feature: '', public_summary: '', scope: '', criteria: '', evidence: '', assignee: '',
  blocked_reason: '', checklist: [], status: 0, planned_go_live_on: '', archived: 0,
};

function formatDate(value: string | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${value.slice(0, 10)}T12:00:00`));
}

function message(error: unknown) { return error instanceof Error ? error.message : 'เกิดข้อผิดพลาด'; }

function Icon({ children }: { children: React.ReactNode }) {
  return <span className="icon" aria-hidden="true">{children}</span>;
}

function App() {
  const [session, setSession] = useState<{ user: SessionUser | null; csrf?: string } | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState<number | null>(0);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selected, setSelected] = useState<Task | null>(null);
  const [view, setView] = useState<'overview' | 'board' | 'report' | 'calendar' | 'access'>(() => { const v=new URLSearchParams(location.search).get('view'); return v==='overview'||v==='calendar'||v==='access'||v==='board'?v:'report'; });
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [query, setQuery] = useState('');
  const [feature, setFeature] = useState('');
  const [showDone, setShowDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  async function loadSession() {
    const data = await api<{ user: SessionUser | null; csrf?: string }>('/session');
    if (data.csrf) setCsrf(data.csrf);
    setSession(data);
    return data;
  }

  useEffect(() => {
    (async () => {
      try {
        const token = location.hash.startsWith('#invite=') ? location.hash.slice(8) : '';
        if (token) {
          history.replaceState({}, '', location.pathname + location.search);
          await api('/redeem', { method: 'POST', body: JSON.stringify({ token }) });
        }
        await loadSession();
      } catch (e) { setError(message(e)); setSession({ user: null }); }
    })();
  }, []);

  useEffect(() => {
    if (!session?.user) return;
    api<Project[]>('/projects').then((rows) => {
      setProjects(rows);
      setProjectId((current) => current && rows.some((p) => p.id === current) ? current : 0);
    }).catch((e) => setError(message(e)));
  }, [session?.user?.id]);

  async function fetchTasks(rows: Project[]) {
    return (await Promise.all(rows.map(async p=>{
      const items:Task[]=[];let cursor:number|null=null;
      do {const data:{items:Task[];next_cursor:number|null}=await api('/projects/'+p.id+'/tasks'+(cursor?'?cursor='+cursor:''));items.push(...data.items);cursor=data.next_cursor;}while(cursor);
      return items;
    }))).flat();
  }
  async function loadTasks() {
    try {setTasks(await fetchTasks(projects));} catch(e){setError(message(e));}
  }
  useEffect(()=>{let current=true;setLoadingTasks(true);fetchTasks(projects).then(items=>{if(current)setTasks(items);}).catch(e=>{if(current)setError(message(e));}).finally(()=>{if(current)setLoadingTasks(false);});return()=>{current=false;};},[projects]);
  useEffect(()=>{setFeature('');setSelected(null);},[projectId]);
  useEffect(()=>{const url=new URL(location.href);url.searchParams.set('view',view);history.replaceState({},'',url);},[view]);
  const project = projects.find((p) => p.id === projectId) ?? null;
  const writableProjects=projects.filter(p=>p.role!=='viewer');
  const editable = project ? project.role !== 'viewer' : writableProjects.length>0;
  const canEdit=(t:Task)=>projects.some(p=>p.id===t.project_id&&p.role!=='viewer');
  const scopedTasks=tasks.filter(t=>!projectId||t.project_id===projectId);
  const features = useMemo(() => [...new Set(scopedTasks.map((t) => t.feature).filter(Boolean))] as string[], [tasks, projectId]);
  const visible = scopedTasks.filter((task) =>
    (!query || `${task.title} ${task.public_summary} ${task.feature ?? ''}`.toLowerCase().includes(query.toLowerCase())) &&
    (!feature || task.feature === feature) &&
    (showDone || task.status !== 4 || (task.actual_released_at ?? '').slice(0, 10) >= new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10))
  );

  async function saveTask(draft: Task | typeof EMPTY_TASK) {
    const targetProject = 'project_id' in draft ? draft.project_id : projectId;
    if (!targetProject) return;
    setBusy(true); setError('');
    try {
      const payload = { ...EMPTY_TASK, ...draft };
      const isExisting = 'id' in draft && draft.id > 0;
      const saved = isExisting
        ? await api<Task>(`/tasks/${draft.id}`, { method: 'PATCH', body: JSON.stringify(payload) })
        : await api<Task>(`/projects/${targetProject}/tasks`, { method: 'POST', body: JSON.stringify(payload) });
      setTasks((current) => isExisting ? current.map((t) => t.id === saved.id ? saved : t) : [...current, saved]);
      setSelected(saved); setNotice('บันทึกแล้ว');
    } catch (e) {
      setError(message(e));
      if (e instanceof ApiError && e.status === 409) await loadTasks();
    } finally { setBusy(false); }
  }

  async function moveTask(task: Task, status: number) {
    if (!canEdit(task) || task.status === status) return;
    const previous = tasks;
    const optimistic = { ...task, status };
    setTasks((current) => current.map((t) => t.id === task.id ? optimistic : t));
    try {
      const saved = await api<Task>(`/tasks/${task.id}`, { method: 'PATCH', body: JSON.stringify({ ...EMPTY_TASK, ...optimistic }) });
      setTasks((current) => current.map((t) => t.id === saved.id ? saved : t));
      if (selected?.id === saved.id) setSelected(saved);
      setNotice(`ย้ายไป “${STATUSES[status]}” แล้ว`);
    } catch (e) {
      setTasks(previous);
      setError(message(e));
      if (e instanceof ApiError && e.status === 409) await loadTasks();
    }
  }

  async function logout() {
    await api('/logout', { method: 'POST', body: '{}' });
    setSession({ user: null }); setProjects([]); setTasks([]);
  }

  if (session === null) return <Centered><p>กำลังเปิด Workboard…</p></Centered>;
  if (!session.user) return <Centered>
    <div className="access-gate">
      <div className="brand-mark">W</div>
      <h1>Workboard</h1>
      <p>หน้านี้เปิดได้ผ่านลิงก์เชิญที่ยังใช้งานได้เท่านั้น</p>
      {error && <div className="alert error">{error}</div>}
      <small>หากลิงก์เคยถูกเปิดแล้ว ให้เปิดด้วยเบราว์เซอร์เครื่องเดิม หรือขอลิงก์ใหม่จากผู้ดูแล</small>
    </div>
  </Centered>;

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark small">W</div><strong>Workboard</strong></div>
      <nav aria-label="เมนูหลัก">
        <button className={view === 'overview' ? 'active' : ''} onClick={() => setView('overview')}><Icon>▦</Icon>ภาพรวมโปรเจกต์</button>
        <button className={view === 'board' ? 'active' : ''} onClick={() => setView('board')}><Icon>▥</Icon>บอร์ดงาน</button>
        <button className={view === 'report' ? 'active' : ''} onClick={() => setView('report')}><Icon>≡</Icon>รายงานสัปดาห์</button>
        <button className={view === 'calendar' ? 'active' : ''} onClick={() => setView('calendar')}><Icon>▦</Icon>ปฏิทิน / ประชุม</button>
        {session.user.is_admin && <button className={view === 'access' ? 'active' : ''} onClick={() => setView('access')}><Icon>◎</Icon>การเข้าถึง</button>}
      </nav>
      <p className="sidebar-label">โปรเจกต์</p>
      <nav className="projects" aria-label="เลือกโปรเจกต์">
        <button className={!projectId ? 'active-project' : ''} onClick={()=>setProjectId(0)}><span className="project-avatar">ALL</span>ทุกโปรเจกต์</button>
        {projects.map((p) => <button key={p.id} className={projectId === p.id && view === 'board' ? 'active-project' : ''} onClick={() => { setProjectId(p.id); setView('board'); }}>
          <span className="project-avatar">{p.name.slice(0, 2).toUpperCase()}</span><span className="truncate">{p.name}</span><small>{tasks.filter(t=>t.project_id===p.id&&t.status!==4).length}</small>
        </button>)}
      </nav>
      <div className="profile"><span className="avatar">{session.user.label.slice(0, 1)}</span><div className="truncate"><strong>{session.user.label}</strong><small>{session.user.is_admin ? 'ผู้ดูแล' : 'สมาชิก'}</small></div><button className="icon-button" onClick={logout} title="ออกจากอุปกรณ์นี้">↪</button></div>
    </aside>
    <main className="workspace">
      {view === 'access' && session.user.is_admin ? <AccessManager projects={projects} /> : <>
        <header className="topbar"><div><h1>{view==='calendar'?'ปฏิทิน / ประชุม':view==='report'?'รายงานสัปดาห์':view==='overview'?'ภาพรวมโปรเจกต์':project?.name??'งานทุกโปรเจกต์'}</h1><span>{scopedTasks.filter(t=>t.status!==4).length} งานค้าง</span></div><div className="topbar-actions"><select aria-label="มุมมอง" value={view} onChange={e=>setView(e.target.value as typeof view)}><option value="board">Kanban</option><option value="overview">ภาพรวม</option><option value="report">รายงานสัปดาห์</option><option value="calendar">ปฏิทิน / ประชุม</option>{session.user.is_admin&&<option value="access">การเข้าถึง</option>}</select>{view==='board'&&editable&&<button className="primary" onClick={()=>{const p=project?.role!=='viewer'&&project?project:writableProjects[0];if(p)setSelected({...EMPTY_TASK,id:0,project_id:p.id,version:0,actual_released_at:null,updated_at:''});}}>+ งานใหม่</button>}<button className="mobile-action" onClick={logout}>ออก</button></div></header>
        {view==='calendar'?<MeetingCalendar projects={projects} tasks={tasks} projectId={projectId} onProject={setProjectId} onTask={setSelected}/>:view==='overview'||view==='report'?<ProjectViews view={view} projects={projects} tasks={tasks} projectId={projectId} onProject={(id,board)=>{setProjectId(id);if(board)setView('board');}} onOpen={setSelected}/>:<>
        <div className="toolbar">
          <select aria-label="โปรเจกต์" value={projectId ?? 0} onChange={(e) => setProjectId(Number(e.target.value))}><option value={0}>ทุกโปรเจกต์</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
          <select aria-label="ฟังก์ชัน" value={feature} onChange={(e) => setFeature(e.target.value)}><option value="">ทุกฟังก์ชัน</option>{features.map((f) => <option key={f}>{f}</option>)}</select>
          <input aria-label="ค้นหางาน" placeholder="ค้นหางาน…" value={query} onChange={(e) => setQuery(e.target.value)} />
          <label><input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} /> งานเสร็จเก่า</label>
          <span className="toolbar-count">{visible.length} งาน</span>
        </div>

        {notice && <div className="floating-alert success">{notice}<button onClick={() => setNotice('')}>×</button></div>}
        {loadingTasks ? <Empty title="กำลังโหลดงาน…" text=""/> : !projects.length ? <Empty title="ยังไม่มีโปรเจกต์" text="ผู้ดูแลสามารถสร้างโปรเจกต์จากหน้าการเข้าถึง" /> : <Board tasks={visible} projects={projects} canEdit={canEdit} onOpen={setSelected} onMove={moveTask} />}
        </>}
      </>}
      {error && <div className="floating-alert error">{error}<button onClick={() => setError('')}>×</button></div>}
    </main>
    {selected && <TaskDrawer key={selected.id} projects={projects} task={selected} editable={canEdit(selected)} busy={busy} onClose={() => setSelected(null)} onSave={saveTask} onError={setError} />}
  </div>;
}

function Board({ tasks, projects, canEdit, onOpen, onMove }: { tasks: Task[]; projects:Project[]; canEdit:(t:Task)=>boolean; onOpen: (t: Task) => void; onMove: (t: Task, s: number) => void }) {
  const [dragId, setDragId] = useState<number | null>(null);
  return <div className="board" aria-label="บอร์ด Kanban">
    {STATUSES.map((status, index) => {
      const items = tasks.filter((t) => t.status === index);
      return <section key={status} className="column" onDragOver={(e) => e.preventDefault()} onDrop={() => { const task = tasks.find((t) => t.id === dragId); if (task) onMove(task, index); setDragId(null); }}>
        <header><span className={`status-dot status-${index}`} /> <strong>{status}</strong><small>{items.length}</small></header>
        <div className="cards">
          {items.map((task) => <article key={task.id} className={`task-card ${dragId === task.id ? 'dragging' : ''}`} draggable={canEdit(task)} onDragStart={() => setDragId(task.id)} onDragEnd={() => setDragId(null)} onClick={() => onOpen(task)} tabIndex={0} role="button" onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onOpen(task);}}}>
            <div className="card-top"><small>{projects.find(p=>p.id===task.project_id)?.name} · {task.feature || 'ทั่วไป'}</small>{canEdit(task) && <span className="drag-grip">⠿</span>}</div>
            <h2>{task.title}</h2>
            {task.public_summary&&<p className="card-summary">{task.public_summary}</p>}
            {task.blocked_reason && <p className="blocked">! {task.blocked_reason}</p>}
            <div className={`deadline ${task.status !== 4 && task.planned_go_live_on < new Date().toISOString().slice(0, 10) ? 'overdue' : ''}`}>▣ เริ่มใช้ {formatDate(task.planned_go_live_on)}</div>
            <footer><span>{task.assignee || 'ยังไม่ระบุผู้รับผิดชอบ'}</span><span>#{String(task.id).padStart(3, '0')}</span></footer>
          </article>)}
          {!items.length && <div className="drop-empty">ลากงานมาวางที่นี่</div>}
        </div>
      </section>;
    })}
  </div>;
}

function TaskDrawer({ task, projects, editable, busy, onClose, onSave, onError }: { task: Task; projects:Project[]; editable: boolean; busy: boolean; onClose: () => void; onSave: (t: Task | typeof EMPTY_TASK) => void; onError: (s: string) => void }) {
  const [draft, setDraft] = useState(task);
  useEffect(()=>setDraft(task),[task]);
  const [tab, setTab] = useState<'details' | 'history'>('details');
  const [events, setEvents] = useState<TaskEvent[]>([]);
  const isNew = task.id === 0;
  useEffect(() => { if (tab === 'history' && !isNew) api<TaskEvent[]>(`/tasks/${task.id}/events`).then(setEvents).catch((e) => onError(message(e))); }, [tab]);
  function field(name: keyof Task, value: string | number | ChecklistItem[]) { setDraft((d) => ({ ...d, [name]: value })); }
  return <div className="drawer-layer" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
    <aside className="drawer" aria-label="รายละเอียดงาน">
      <header><div><small>{isNew ? 'งานใหม่' : `#${String(task.id).padStart(3, '0')}`}</small><h1>{draft.title || 'ตั้งชื่องาน'}</h1></div><button className="icon-button" onClick={onClose} aria-label="ปิด">×</button></header>
      {!isNew && <div className="drawer-tabs"><button className={tab === 'details' ? 'active' : ''} onClick={() => setTab('details')}>รายละเอียด</button><button className={tab === 'history' ? 'active' : ''} onClick={() => setTab('history')}>ประวัติ</button></div>}
      {tab === 'history' ? <div className="drawer-body history-list">{events.map((event) => <article key={event.id}><strong>{event.action}</strong><p>{event.actor} · {event.created_at}</p></article>)}{!events.length && <p>ยังไม่มีประวัติ</p>}</div> : <form className="drawer-body" onSubmit={(e) => { e.preventDefault(); onSave(isNew ? { ...EMPTY_TASK, ...draft } : draft); }}>
        <Field label="โปรเจกต์"><select value={draft.project_id} disabled={!isNew} onChange={e=>field('project_id',Number(e.target.value))}>{projects.filter(p=>p.id===draft.project_id||p.role!=='viewer').map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
        <Field label="ชื่องาน"><input required value={draft.title} onChange={(e) => field('title', e.target.value)} disabled={!editable} /></Field>
        <div className="field-grid"><Field label="สถานะ"><select value={draft.status} onChange={(e) => field('status', Number(e.target.value))} disabled={!editable}>{STATUSES.map((s, i) => <option key={s} value={i}>{s}</option>)}</select></Field><Field label="กำหนดเริ่มใช้งาน"><input required type="date" value={draft.planned_go_live_on} onChange={(e) => field('planned_go_live_on', e.target.value)} disabled={!editable} /></Field></div>
        <div className="field-grid"><Field label="ฟังก์ชัน"><input value={draft.feature ?? ''} onChange={(e) => field('feature', e.target.value)} disabled={!editable} /></Field><Field label="ผู้รับผิดชอบ"><input value={draft.assignee ?? ''} onChange={(e) => field('assignee', e.target.value)} disabled={!editable} /></Field></div>
        <Field label="สรุปสำหรับผู้ชมภายนอก"><textarea rows={3} value={draft.public_summary} onChange={(e) => field('public_summary', e.target.value)} disabled={!editable} /></Field>
        {editable && <><Field label="รายละเอียดและขอบเขตงาน"><textarea rows={6} value={draft.scope ?? ''} onChange={(e) => field('scope', e.target.value)} /></Field>
          <Field label="สาเหตุที่ติดขัด"><textarea rows={2} value={draft.blocked_reason ?? ''} onChange={(e) => field('blocked_reason', e.target.value)} /></Field>
          <Checklist value={draft.checklist ?? []} onChange={(value) => field('checklist', value)} />
          <Field label="เกณฑ์ตรวจรับ"><textarea rows={5} value={draft.criteria ?? ''} onChange={(e) => field('criteria', e.target.value)} /></Field>
          <Field label="หลักฐาน"><textarea rows={4} value={draft.evidence ?? ''} onChange={(e) => field('evidence', e.target.value)} /></Field>
        </>}
        {!isNew && <div className="read-only"><span>เปิดใช้จริง</span><strong>{formatDate(draft.actual_released_at)}</strong><span>Version</span><strong>{draft.version}</strong></div>}
        {editable && <div className="drawer-actions"><button type="button" onClick={onClose}>ยกเลิก</button><button className="primary" disabled={busy}>{busy ? 'กำลังบันทึก…' : isNew ? 'สร้างงาน' : 'บันทึก'}</button></div>}
      </form>}
    </aside>
  </div>;
}

function Checklist({ value, onChange }: { value: ChecklistItem[]; onChange: (v: ChecklistItem[]) => void }) {
  const [newItem, setNewItem] = useState('');
  return <section className="checklist"><div className="section-heading"><strong>งานย่อย / เช็กลิสต์</strong><small>{value.filter((x) => x.done).length}/{value.length}</small></div>
    {value.map((item, index) => <label key={index}><input type="checkbox" checked={item.done} onChange={() => onChange(value.map((x, i) => i === index ? { ...x, done: !x.done } : x))} /><span>{item.label}</span><button type="button" onClick={() => onChange(value.filter((_, i) => i !== index))} aria-label="ลบ">×</button></label>)}
    <div className="add-check"><input placeholder="เพิ่มงานย่อย" value={newItem} onChange={(e) => setNewItem(e.target.value)} /><button type="button" onClick={() => { if (newItem.trim()) { onChange([...value, { label: newItem.trim(), done: false }]); setNewItem(''); } }}>เพิ่ม</button></div>
  </section>;
}

function AccessManager({ projects }: { projects: Project[] }) {
  const [rows, setRows] = useState<AccessRow[]>([]);
  const [label, setLabel] = useState('');
  const [role, setRole] = useState('viewer');
  const [projectIds, setProjectIds] = useState<number[]>([]);
  const [allProjects, setAllProjects] = useState(false);
  const [showRevoked, setShowRevoked] = useState(false);
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [link, setLink] = useState('');
  const [projectName, setProjectName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const selectedIds = allProjects ? projects.map((p) => p.id) : projectIds;
  const members = useMemo(() => {
    const grouped = new Map<number, { row: AccessRow; names: string[] }>();
    for (const row of rows) {
      const item = grouped.get(row.id) ?? { row, names: [] };
      if (row.project_name && !item.names.includes(row.project_name)) item.names.push(row.project_name);
      grouped.set(row.id, item);
    }
    return [...grouped.values()].filter(({ row }) => showRevoked || !row.revoked_at);
  }, [rows, showRevoked]);
  async function load() { try { setRows(await api<AccessRow[]>('/access')); } catch (e) { setError(message(e)); } }
  useEffect(() => { load(); }, []);
  async function createLink(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(''); setLink(''); setCopied(false);
    try {
      const data = await api<{ link: string }>('/access', { method: 'POST', body: JSON.stringify({ label, role, project_ids: selectedIds }) });
      setLink(data.link); setLabel(''); await load();
    } catch (e) { setError(message(e)); } finally { setBusy(false); }
  }
  async function createProject(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError('');
    try { await api('/projects', { method: 'POST', body: JSON.stringify({ name: projectName, description }) }); location.reload(); }
    catch (e) { setError(message(e)); } finally { setBusy(false); }
  }
  return <><header className="topbar"><div><h1>การเข้าถึง</h1><span>ลิงก์เชิญและสมาชิก</span></div><div className="topbar-actions"><button className="secondary" onClick={() => setShowProjectForm(!showProjectForm)}>{showProjectForm ? 'ปิดฟอร์ม' : '+ โปรเจกต์'}</button><button className="mobile-action" onClick={() => location.reload()}>กลับบอร์ด</button></div></header>
    <div className="access-content">
      {error && <div className="alert error" role="alert">{error}</div>}
      <section className="panel"><h2>สร้างลิงก์เชิญ</h2>
        <form onSubmit={createLink} className="access-form">
          <Field label="ชื่อผู้รับ"><input required value={label} onChange={(e) => setLabel(e.target.value)} placeholder="ชื่อสมาชิกหรือทีม" /></Field>
          <Field label="สิทธิ์"><select value={role} onChange={(e) => setRole(e.target.value)}><option value="viewer">ดูอย่างเดียว</option><option value="editor">แก้ไขงาน</option><option value="admin">ผู้ดูแล</option></select></Field>
          <button className="primary" disabled={busy || (role !== 'admin' && selectedIds.length === 0)}>{busy ? 'กำลังสร้าง…' : 'สร้างลิงก์'}</button>
          {role !== 'admin' ? <fieldset className="project-picker"><legend>โปรเจกต์ที่เข้าถึงได้ · {selectedIds.length} โปรเจกต์</legend>
            <label className="project-choice"><input type="checkbox" checked={allProjects} onChange={(e) => { setAllProjects(e.target.checked); setProjectIds([]); }} /> ทุกโปรเจกต์ที่มีตอนนี้</label>
            <div className="project-options">{projects.map((p) => <label className="project-choice" key={p.id}><input type="checkbox" checked={selectedIds.includes(p.id)} onChange={(e) => { setAllProjects(false); setProjectIds(e.target.checked ? [...selectedIds, p.id] : selectedIds.filter((id) => id !== p.id)); }} />{p.name}</label>)}</div>
            <small>เลือกได้หลายโปรเจกต์ · โปรเจกต์ที่สร้างภายหลังต้องให้สิทธิ์เพิ่ม</small>
          </fieldset> : <p className="access-hint">ผู้ดูแลจัดการทุกโปรเจกต์และสิทธิ์สมาชิกได้</p>}
        </form>
        {link && <div className="generated-link"><p>ลิงก์ใช้ได้ครั้งเดียวภายใน 7 วัน</p><input aria-label="ลิงก์เชิญที่สร้างแล้ว" readOnly value={link} /><button onClick={async () => { try { await navigator.clipboard.writeText(link); setCopied(true); } catch { setError('คัดลอกไม่สำเร็จ กรุณาเลือกและคัดลอกลิงก์จากช่อง'); } }}>{copied ? 'คัดลอกแล้ว' : 'คัดลอก'}</button></div>}
      </section>
      {showProjectForm && <section className="panel"><h2>สร้างโปรเจกต์</h2><form onSubmit={createProject} className="access-form"><Field label="ชื่อโปรเจกต์"><input required value={projectName} onChange={(e) => setProjectName(e.target.value)} /></Field><Field label="คำอธิบาย"><input value={description} onChange={(e) => setDescription(e.target.value)} /></Field><button className="primary" disabled={busy}>สร้างโปรเจกต์</button></form></section>}
      <section className="panel"><div className="member-heading"><h2>ลิงก์และสมาชิก <small>{members.length}</small></h2><label><input type="checkbox" checked={showRevoked} onChange={(e) => setShowRevoked(e.target.checked)} /> แสดงที่ยกเลิกแล้ว</label></div>
        <div className="access-table">{members.map(({ row, names }) => <div key={row.id}><strong>{row.label}</strong><span>{row.is_admin ? 'ผู้ดูแล · ทุกโปรเจกต์' : names.join(', ') + ' · ' + (row.role === 'editor' ? 'แก้ไข' : 'ดู')}</span><small>{row.revoked_at ? 'ยกเลิกแล้ว' : row.consumed_at ? 'เปิดใช้งานแล้ว' : row.invitation_revoked ? 'ลิงก์ยกเลิกแล้ว' : row.expires_at && new Date(row.expires_at.replace(' ', 'T') + 'Z') < new Date() ? 'ลิงก์หมดอายุ' : 'รอเปิดลิงก์'}</small>{!row.revoked_at && <button onClick={async () => { try { await api('/access/' + row.id + '/revoke', { method: 'POST', body: '{}' }); await load(); } catch (e) { setError(message(e)); } }}>ยกเลิก</button>}</div>)}</div>
        {!members.length && <p className="access-hint">ยังไม่มีสมาชิกในรายการนี้</p>}
      </section>
    </div></>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="field"><span>{label}</span>{children}</label>; }
function Empty({ title, text }: { title: string; text: string }) { return <div className="empty"><h2>{title}</h2><p>{text}</p></div>; }
function Centered({ children }: { children: React.ReactNode }) { return <main className="centered">{children}</main>; }

createRoot(document.getElementById('root')!).render(<App />);
