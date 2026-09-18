import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { api, ApiError, setCsrf } from './api';
import type { AccessLink, AccessMember, LarkTarget, Project, SessionUser, Task } from './types';
import './index.css';
import ProjectViews from './ProjectViews';
import MeetingCalendar from './MeetingCalendar';
import TaskDrawer, { EMPTY_TASK, STATUSES, Field, ProgressBar, dateTime, formatDate, message, type Notify } from './TaskDrawer';

type View = 'board' | 'overview' | 'calendar' | 'access';
// Everyone lands on the board. Old ?view=report links open the merged overview/report page.
function initialView(): View { const v = new URLSearchParams(location.search).get('view'); return v === 'overview' || v === 'report' ? 'overview' : v === 'calendar' || v === 'access' ? v : 'board'; }

const iconPaths = {
  overview: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></>,
  board: <><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M15 3v18"/></>,
  report: <><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4M16 13H8M16 17H8M10 9H8"/></>,
  calendar: <><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></>,
  access: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
};

function Icon({ name }: { name: keyof typeof iconPaths }) {
  return <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{iconPaths[name]}</svg>;
}

function App() {
  const [session, setSession] = useState<{ user: SessionUser | null; csrf?: string } | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState<number | null>(0);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selected, setSelected] = useState<Task | null>(null);
  const [view, setView] = useState<View>(initialView);
  const [larkTargets, setLarkTargets] = useState<LarkTarget[]>([]);
  const deepLinked = useRef(false);
  // Latest task reload wins: an older, slower reload must not overwrite newer state.
  const taskLoadSeq = useRef(0);
  // Board moves in flight, per task: a second move before the first returns would send a stale version (409).
  const [moving, setMoving] = useState<number[]>([]);
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

  async function loadProjects() {
    try {
      const rows = await api<Project[]>('/projects');
      setProjects(rows);
      setProjectId((current) => current && rows.some((p) => p.id === current) ? current : 0);
    } catch (e) { setError(message(e)); }
  }
  useEffect(() => { if (session?.user) loadProjects(); }, [session?.user?.id]);

  async function fetchTasks(rows: Project[]) {
    return (await Promise.all(rows.map(async p=>{
      const items:Task[]=[];let cursor:number|null=null;
      do {const data:{items:Task[];next_cursor:number|null}=await api('/projects/'+p.id+'/tasks'+(cursor?'?cursor='+cursor:''));items.push(...data.items);cursor=data.next_cursor;}while(cursor);
      return items;
    }))).flat();
  }
  async function loadTasks() {
    const seq=++taskLoadSeq.current;
    try {const items=await fetchTasks(projects);if(seq===taskLoadSeq.current)setTasks(items);} catch(e){if(seq===taskLoadSeq.current)setError(message(e));}
  }
  useEffect(()=>{const seq=++taskLoadSeq.current;setLoadingTasks(true);fetchTasks(projects).then(items=>{if(seq===taskLoadSeq.current)setTasks(items);}).catch(e=>{if(seq===taskLoadSeq.current)setError(message(e));}).finally(()=>setLoadingTasks(false));return()=>{taskLoadSeq.current++;};},[projects]);
  useEffect(()=>{setFeature('');setSelected(null);},[projectId]);
  useEffect(()=>{const url=new URL(location.href);url.searchParams.set('view',view);history.replaceState({},'',url);},[view]);
  // ?task=ID (links sent to Lark) opens that task once the tasks are loaded; the URL follows the open drawer.
  useEffect(()=>{if(deepLinked.current||loadingTasks||!tasks.length)return;deepLinked.current=true;const id=Number(new URLSearchParams(location.search).get('task'));const t=tasks.find(x=>x.id===id);if(t){setView('board');setSelected(t);}},[tasks,loadingTasks]);
  useEffect(()=>{if(!deepLinked.current)return;const url=new URL(location.href);if(selected?.id)url.searchParams.set('task',String(selected.id));else url.searchParams.delete('task');history.replaceState({},'',url);},[selected?.id]);
  useEffect(()=>{if(projects.some(p=>p.role!=='viewer'))api<LarkTarget[]>('/lark/targets').then(setLarkTargets).catch(()=>setLarkTargets([]));},[projects]);
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

  async function saveTask(draft: Task | typeof EMPTY_TASK, notify: Notify = '', notifyText = '') {
    const targetProject = 'project_id' in draft ? draft.project_id : projectId;
    if (!targetProject) return;
    setBusy(true); setError('');
    try {
      const payload = { ...EMPTY_TASK, ...draft, notify: notify || null, notify_text: notifyText };
      const isExisting = 'id' in draft && draft.id > 0;
      const response = isExisting
        ? await api<Task>(`/tasks/${draft.id}`, { method: 'PATCH', body: JSON.stringify(payload) })
        : await api<Task>(`/projects/${targetProject}/tasks`, { method: 'POST', body: JSON.stringify(payload) });
      // Saved even when Lark refused the message (lark_warning): show the saved task so a retry cannot duplicate it.
      const { lark_warning: warning, ...saved } = response;
      taskLoadSeq.current++;
      setTasks((current) => current.some((t) => t.id === saved.id) ? current.map((t) => t.id === saved.id ? saved : t) : [...current, saved]);
      setSelected(saved);
      if (warning) { setNotice(''); setError(warning); } else setNotice(notify ? 'บันทึกและแจ้ง Lark แล้ว' : 'บันทึกแล้ว');
    } catch (e) {
      setError(message(e));
      if (e instanceof ApiError && e.status === 409) await loadTasks();
    } finally { setBusy(false); }
  }

  async function moveTask(task: Task, status: number) {
    if (!canEdit(task) || task.status === status || moving.includes(task.id)) return;
    const optimistic = { ...task, status };
    setMoving((m) => [...m, task.id]);
    taskLoadSeq.current++;
    setTasks((current) => current.map((t) => t.id === task.id ? optimistic : t));
    try {
      const { lark_warning: _ignored, ...saved } = await api<Task>(`/tasks/${task.id}`, { method: 'PATCH', body: JSON.stringify({ ...EMPTY_TASK, ...optimistic }) });
      setTasks((current) => current.map((t) => t.id === saved.id ? saved : t));
      setSelected((s) => s?.id === saved.id ? saved : s);
      setNotice(`ย้ายไป “${STATUSES[status]}” แล้ว`);
    } catch (e) {
      // Put back only this task, and only while the optimistic copy is still what the board shows.
      setTasks((current) => current.map((t) => t === optimistic ? task : t));
      setError(message(e));
      if (e instanceof ApiError && e.status === 409) await loadTasks();
    } finally { setMoving((m) => m.filter((id) => id !== task.id)); }
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
        <button className={view === 'board' ? 'active' : ''} onClick={() => setView('board')}><Icon name="board"/>บอร์ดงาน</button>
        <button className={view === 'overview' ? 'active' : ''} onClick={() => setView('overview')}><Icon name="report"/>ภาพรวม / รายงาน</button>
        <button className={view === 'calendar' ? 'active' : ''} onClick={() => setView('calendar')}><Icon name="calendar"/>ปฏิทิน / ประชุม</button>
        {session.user.is_admin && <button className={view === 'access' ? 'active' : ''} onClick={() => setView('access')}><Icon name="access"/>การเข้าถึง</button>}
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
      {view === 'access' && session.user.is_admin ? <AccessManager projects={projects} onProjectsChanged={loadProjects} onBack={() => setView('board')} /> : <>
        <header className="topbar"><div><h1>{view==='calendar'?'ปฏิทิน / ประชุม':view==='overview'?'ภาพรวม / รายงานสัปดาห์':project?.name??'งานทุกโปรเจกต์'}</h1><span>{scopedTasks.filter(t=>t.status!==4).length} งานค้าง</span></div><div className="topbar-actions"><select aria-label="มุมมอง" value={view} onChange={e=>setView(e.target.value as typeof view)}><option value="board">บอร์ดงาน</option><option value="overview">ภาพรวม / รายงาน</option><option value="calendar">ปฏิทิน / ประชุม</option>{session.user.is_admin&&<option value="access">การเข้าถึง</option>}</select>{view==='board'&&editable&&<button className="primary" onClick={()=>{const p=project?.role!=='viewer'&&project?project:writableProjects[0];if(p)setSelected({...EMPTY_TASK,id:0,project_id:p.id,version:0,actual_released_at:null,updated_at:''});}}>+ งานใหม่</button>}<button className="mobile-action" onClick={logout}>ออก</button></div></header>
        {view==='calendar'?<MeetingCalendar projects={projects} tasks={tasks} projectId={projectId} onProject={setProjectId} onTask={setSelected}/>:view==='overview'?<ProjectViews projects={projects} tasks={tasks} projectId={projectId} onProject={(id,board)=>{setProjectId(id);if(board)setView('board');}} onOpen={setSelected}/>:<>
        <div className="toolbar">
          <select aria-label="โปรเจกต์" value={projectId ?? 0} onChange={(e) => setProjectId(Number(e.target.value))}><option value={0}>ทุกโปรเจกต์</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
          <select aria-label="ฟังก์ชัน" value={feature} onChange={(e) => setFeature(e.target.value)}><option value="">ทุกฟังก์ชัน</option>{features.map((f) => <option key={f}>{f}</option>)}</select>
          <input aria-label="ค้นหางาน" placeholder="ค้นหางาน…" value={query} onChange={(e) => setQuery(e.target.value)} />
          <label><input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} /> งานเสร็จเก่า</label>
          <span className="toolbar-count">{visible.length} งาน</span>
        </div>

        {loadingTasks ? <Empty title="กำลังโหลดงาน…" text=""/> : !projects.length ? <Empty title="ยังไม่มีโปรเจกต์" text="ผู้ดูแลสามารถสร้างโปรเจกต์จากหน้าการเข้าถึง" /> : <Board tasks={visible} projects={projects} canEdit={(t) => canEdit(t) && !moving.includes(t.id)} onOpen={setSelected} onMove={moveTask} />}
        </>}
      </>}
      {notice && !error && <div className="floating-alert success">{notice}<button onClick={() => setNotice('')}>×</button></div>}
      {error && <div className="floating-alert error">{error}<button onClick={() => setError('')}>×</button></div>}
    </main>
    {selected && <TaskDrawer key={selected.id} projects={projects} task={selected} editable={canEdit(selected)} busy={busy} larkTargets={larkTargets} onClose={() => setSelected(null)} onSave={saveTask} onChanged={(saved) => { taskLoadSeq.current++; setTasks((current) => current.map((t) => t.id === saved.id ? saved : t)); }} onDeleted={(gone) => { taskLoadSeq.current++; setTasks((current) => current.filter((t) => t.id !== gone.id)); setSelected(null); setNotice('ลบงานแล้ว'); }} onError={setError} onNotice={setNotice} />}
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
            <ProgressBar list={task.checklist} />
            {task.blocked_reason && <p className="blocked">! {task.blocked_reason}</p>}
            <div className={`deadline ${task.status !== 4 && task.planned_go_live_on && task.planned_go_live_on < new Date().toISOString().slice(0, 10) ? 'overdue' : ''}`}>▣ {task.planned_go_live_on ? `เริ่มใช้ ${formatDate(task.planned_go_live_on)}` : 'ยังไม่กำหนดวันเริ่มใช้'}</div>
            <footer><span>{task.assignee || 'ยังไม่ระบุผู้รับผิดชอบ'}</span><span>#{String(task.id).padStart(3, '0')}</span></footer>
          </article>)}
          {!items.length && <div className="drop-empty">ลากงานมาวางที่นี่</div>}
        </div>
      </section>;
    })}
  </div>;
}

function linkState(link: AccessLink) {
  if (link.revoked_at) return 'ปิดแล้ว ' + dateTime(link.revoked_at);
  if (link.reusable) return link.last_used_at ? 'ใช้ล่าสุด ' + dateTime(link.last_used_at) : 'ยังไม่เคยใช้';
  if (link.consumed_at) return 'เปิดใช้แล้ว ' + dateTime(link.consumed_at);
  if (link.expires_at && new Date(link.expires_at.replace(' ', 'T') + 'Z') < new Date()) return 'หมดอายุ';
  return 'รอเปิด · หมดอายุ ' + dateTime(link.expires_at);
}

function AccessManager({ projects, onProjectsChanged, onBack }: { projects: Project[]; onProjectsChanged: () => Promise<void>; onBack: () => void }) {
  const [members, setMembers] = useState<AccessMember[]>([]);
  const [label, setLabel] = useState('');
  const [role, setRole] = useState('viewer');
  const [permanent, setPermanent] = useState(true);
  const [projectIds, setProjectIds] = useState<number[]>([]);
  const [allProjects, setAllProjects] = useState(false);
  const [showRevoked, setShowRevoked] = useState(false);
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [issued, setIssued] = useState<{ memberId: number; link: string; permanent: boolean } | null>(null);
  const [closing, setClosing] = useState(0);
  const [revoking, setRevoking] = useState(0);
  const [projectName, setProjectName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [projectNotice, setProjectNotice] = useState('');
  const [shown, setShown] = useState<{ linkId: number; link: string } | null>(null);
  function showLink(linkId: number) {
    if (shown?.linkId === linkId) { setShown(null); return; }
    run(async () => { const data = await api<{ link: string }>(`/access/links/${linkId}/url`); setShown({ linkId, link: data.link }); setCopied(false); });
  }
  const selectedIds = allProjects ? projects.map((p) => p.id) : projectIds;
  const visibleMembers = members.filter((m) => showRevoked || !m.revoked_at);
  async function load() { try { setMembers(await api<AccessMember[]>('/access')); } catch (e) { setError(message(e)); } }
  useEffect(() => { load(); }, []);
  async function run(action: () => Promise<void>) {
    setBusy(true); setError('');
    try { await action(); } catch (e) { setError(message(e)); } finally { setBusy(false); }
  }
  function createLink(e: React.FormEvent) {
    e.preventDefault(); setIssued(null); setCopied(false);
    run(async () => {
      const data = await api<{ link: string; permanent: boolean }>('/access', { method: 'POST', body: JSON.stringify({ label, role, project_ids: selectedIds, permanent }) });
      setIssued({ memberId: 0, link: data.link, permanent: data.permanent }); setLabel(''); await load();
    });
  }
  function newLink(memberId: number) {
    setIssued(null); setCopied(false);
    run(async () => {
      const data = await api<{ link: string; permanent: boolean }>(`/access/${memberId}/links`, { method: 'POST', body: JSON.stringify({ permanent: true }) });
      setIssued({ memberId, link: data.link, permanent: data.permanent }); await load();
    });
  }
  function closeLink(linkId: number) {
    run(async () => { await api(`/access/links/${linkId}/close`, { method: 'POST', body: '{}' }); setClosing(0); await load(); });
  }
  function createProject(e: React.FormEvent) {
    e.preventDefault();
    run(async () => {
      await api('/projects', { method: 'POST', body: JSON.stringify({ name: projectName, description }) });
      await onProjectsChanged();
      setProjectNotice(`สร้างโปรเจกต์ “${projectName}” แล้ว`); setProjectName(''); setDescription(''); setShowProjectForm(false);
    });
  }
  const issuedLink = (memberId: number) => issued?.memberId === memberId && <div className="generated-link">
    <p>{issued.permanent ? 'ลิงก์ถาวร ใช้ซ้ำได้ไม่มีวันหมดอายุจนกว่าจะปิด · เปิดดูอีกครั้งได้จากปุ่ม “ดูลิงก์” ในรายการสมาชิก' : 'ลิงก์ใช้ได้ครั้งเดียวภายใน 7 วัน · แสดงครั้งเดียว กรุณาคัดลอกเก็บไว้'}</p>
    <input aria-label="ลิงก์เชิญที่สร้างแล้ว" readOnly value={issued.link} onFocus={(e) => e.target.select()} />
    <button onClick={async () => { try { await navigator.clipboard.writeText(issued.link); setCopied(true); } catch { setError('คัดลอกไม่สำเร็จ กรุณาเลือกและคัดลอกลิงก์จากช่อง'); } }}>{copied ? 'คัดลอกแล้ว' : 'คัดลอก'}</button>
  </div>;
  return <><header className="topbar"><div><h1>การเข้าถึง</h1><span>ลิงก์เชิญและสมาชิก</span></div><div className="topbar-actions"><button className="secondary" onClick={() => setShowProjectForm(!showProjectForm)}>{showProjectForm ? 'ปิดฟอร์ม' : '+ โปรเจกต์'}</button><button className="mobile-action" onClick={onBack}>กลับบอร์ด</button></div></header>
    <div className="access-content">
      {error && <div className="alert error" role="alert">{error}</div>}
      {projectNotice && <div className="alert success" role="status">{projectNotice}</div>}
      <section className="panel"><h2>สร้างลิงก์เชิญ</h2>
        <form onSubmit={createLink} className="access-form">
          <Field label="ชื่อผู้รับ"><input required value={label} onChange={(e) => setLabel(e.target.value)} placeholder="ชื่อสมาชิกหรือทีม" /></Field>
          <Field label="สิทธิ์"><select value={role} onChange={(e) => setRole(e.target.value)}><option value="viewer">ดูอย่างเดียว</option><option value="editor">แก้ไขงาน</option><option value="admin">ผู้ดูแล</option></select></Field>
          <button className="primary" disabled={busy || (role !== 'admin' && selectedIds.length === 0)}>{busy ? 'กำลังสร้าง…' : 'สร้างลิงก์'}</button>
          <label className="project-choice link-kind"><input type="checkbox" checked={permanent} onChange={(e) => setPermanent(e.target.checked)} /> ลิงก์ถาวร — ใช้ซ้ำได้ ไม่มีวันหมดอายุ จนกว่าจะกดปิด</label>
          {role !== 'admin' ? <fieldset className="project-picker"><legend>โปรเจกต์ที่เข้าถึงได้ · {selectedIds.length} โปรเจกต์</legend>
            <label className="project-choice"><input type="checkbox" checked={allProjects} onChange={(e) => { setAllProjects(e.target.checked); setProjectIds([]); }} /> ทุกโปรเจกต์ที่มีตอนนี้</label>
            <div className="project-options">{projects.map((p) => <label className="project-choice" key={p.id}><input type="checkbox" checked={selectedIds.includes(p.id)} onChange={(e) => { setAllProjects(false); setProjectIds(e.target.checked ? [...selectedIds, p.id] : selectedIds.filter((id) => id !== p.id)); }} />{p.name}</label>)}</div>
            <small>เลือกได้หลายโปรเจกต์ · โปรเจกต์ที่สร้างภายหลังต้องให้สิทธิ์เพิ่ม</small>
          </fieldset> : <p className="access-hint">ผู้ดูแลจัดการทุกโปรเจกต์และสิทธิ์สมาชิกได้</p>}
        </form>
        {issuedLink(0)}
      </section>
      {showProjectForm && <section className="panel"><h2>สร้างโปรเจกต์</h2><form onSubmit={createProject} className="access-form"><Field label="ชื่อโปรเจกต์"><input required value={projectName} onChange={(e) => setProjectName(e.target.value)} /></Field><Field label="คำอธิบาย"><input value={description} onChange={(e) => setDescription(e.target.value)} /></Field><button className="primary" disabled={busy}>สร้างโปรเจกต์</button></form></section>}
      <section className="panel"><div className="member-heading"><h2>ลิงก์และสมาชิก <small>{visibleMembers.length}</small></h2><label><input type="checkbox" checked={showRevoked} onChange={(e) => setShowRevoked(e.target.checked)} /> แสดงที่ยกเลิก/ปิดแล้ว</label></div>
        <div className="member-list">{visibleMembers.map((member) => {
          const links = member.links.filter((l) => showRevoked || !l.revoked_at);
          return <article key={member.id} className={member.revoked_at ? 'member revoked' : 'member'}>
            <header><div><strong>{member.label}</strong><span>{member.is_admin ? 'ผู้ดูแล · ทุกโปรเจกต์' : member.projects.map((p) => p.project_name).join(', ') + ' · ' + (member.projects[0]?.role === 'editor' ? 'แก้ไข' : 'ดู')}</span></div>
              {member.revoked_at ? <small>ยกเลิกสมาชิกแล้ว</small> : <div className="member-actions"><button className="secondary" disabled={busy} onClick={() => newLink(member.id)}>+ ลิงก์ถาวรใหม่</button>{revoking === member.id ? <span className="confirm-close"><button className="danger-text" disabled={busy} onClick={() => run(async () => { await api('/access/' + member.id + '/revoke', { method: 'POST', body: '{}' }); setRevoking(0); await load(); })}>ยืนยันยกเลิกสมาชิก</button><button className="text-action" onClick={() => setRevoking(0)}>ไม่ยกเลิก</button></span> : <button className="danger-text" onClick={() => setRevoking(member.id)}>ยกเลิกสมาชิก</button>}</div>}
            </header>
            {links.length > 0 && <ul className="link-list">{links.map((link) => <li key={link.id} className={link.revoked_at ? 'closed' : ''}>
              <span className="link-kind-badge">{link.reusable ? 'ลิงก์ถาวร' : 'ใช้ครั้งเดียว'}</span>
              <small>{linkState(link)}{link.current && ' · ลิงก์ที่คุณใช้อยู่'}</small>
              {link.viewable && <button className="secondary link-show" disabled={busy} onClick={() => showLink(link.id)}>{shown?.linkId === link.id ? 'ซ่อนลิงก์' : 'ดู / คัดลอกลิงก์'}</button>}
              {!link.revoked_at && !link.current && !member.revoked_at && (link.reusable || !link.consumed_at) && (closing === link.id
                ? <span className="confirm-close"><button className="danger-text" disabled={busy} onClick={() => closeLink(link.id)}>ยืนยันปิด</button><button className="text-action" onClick={() => setClosing(0)}>ไม่ปิด</button></span>
                : <button className="danger-text" onClick={() => setClosing(link.id)}>ปิดลิงก์</button>)}
              {shown?.linkId === link.id && <div className="generated-link"><input aria-label="ลิงก์ถาวร" readOnly value={shown.link} onFocus={(e) => e.target.select()} /><button onClick={async () => { try { await navigator.clipboard.writeText(shown.link); setCopied(true); } catch { setError('คัดลอกไม่สำเร็จ กรุณาเลือกและคัดลอกลิงก์จากช่อง'); } }}>{copied ? 'คัดลอกแล้ว' : 'คัดลอก'}</button></div>}
            </li>)}</ul>}
            {issuedLink(member.id)}
          </article>;
        })}</div>
        {!visibleMembers.length && <p className="access-hint">ยังไม่มีสมาชิกในรายการนี้</p>}
      </section>
    </div></>;
}

function Empty({ title, text }: { title: string; text: string }) { return <div className="empty"><h2>{title}</h2><p>{text}</p></div>; }
function Centered({ children }: { children: React.ReactNode }) { return <main className="centered">{children}</main>; }

createRoot(document.getElementById('root')!).render(<App />);
