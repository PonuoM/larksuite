import { useMemo, useState } from 'react';
import type { Project, Task } from './types';
import { STATUSES, STATUS_ORDER, approvable, progress, formatDate } from './TaskDrawer';
import { today } from './ProjectViews';

// Phone layout of the board (owner mock-up, 2026-09-18): a status-grouped list with filter chips instead of
// seven swipeable columns. Desktop keeps the Kanban board.
type Props = {
  tasks: Task[]; projects: Project[]; projectId: number | null; query: string; canApprove: boolean; canCreate: boolean;
  onProject: (id: number) => void; onQuery: (q: string) => void; onOpen: (t: Task) => void; onNew: () => void; onApprove: (t: Task) => void; onLogout: () => void;
};

function dayDiff(date: string) { return Math.round((new Date(date + 'T12:00:00').getTime() - new Date(today() + 'T12:00:00').getTime()) / 86400000); }

function when(t: Task): { text: string; late?: boolean } {
  if (t.status === 4) return { text: t.actual_released_at ? 'เปิดใช้ ' + formatDate(t.actual_released_at) : 'เปิดใช้แล้ว' };
  if (!t.planned_go_live_on) return { text: 'ยังไม่กำหนดวัน' };
  const d = dayDiff(t.planned_go_live_on);
  if (d === 0) return { text: 'วันนี้' };
  if (d === 1) return { text: 'พรุ่งนี้' };
  if (d < 0) return { text: 'เลย ' + -d + ' วัน', late: true };
  return { text: new Date(t.planned_go_live_on + 'T12:00:00').toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }) };
}

export default function MobileBoard({ tasks, projects, projectId, query, canApprove, canCreate, onProject, onQuery, onOpen, onNew, onApprove, onLogout }: Props) {
  const [status, setStatus] = useState<number | null>(null);
  const counts = useMemo(() => new Map(STATUS_ORDER.map((s) => [s, tasks.filter((t) => t.status === s).length])), [tasks]);
  const groups = STATUS_ORDER.filter((s) => (status === null || s === status) && (counts.get(s) ?? 0) > 0);
  return <div className="mboard">
    <header className="mboard-head">
      <select aria-label="โปรเจกต์" value={projectId ?? 0} onChange={(e) => onProject(Number(e.target.value))}>
        <option value={0}>ทุกโปรเจกต์</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      {canCreate && <button className="mboard-add" onClick={onNew} aria-label="งานใหม่">＋</button>}
      <button className="mboard-logout" onClick={onLogout} aria-label="ออกจากระบบ" title="ออกจากระบบ">↪</button>
    </header>
    <input className="mboard-search" aria-label="ค้นหางาน" placeholder="ค้นหางาน…" value={query} onChange={(e) => onQuery(e.target.value)} />
    <div className="mboard-chips" role="tablist" aria-label="กรองสถานะ">
      <button role="tab" aria-selected={status === null} className={status === null ? 'on' : ''} onClick={() => setStatus(null)}>ทั้งหมด</button>
      {STATUS_ORDER.filter((s) => (counts.get(s) ?? 0) > 0).map((s) => <button key={s} role="tab" aria-selected={status === s} className={status === s ? 'on' : ''} onClick={() => setStatus(s)}>{STATUSES[s]} <b>{counts.get(s)}</b></button>)}
    </div>
    <div className="mboard-list">
      {groups.map((s) => {
        const items = tasks.filter((t) => t.status === s);
        return <section key={s} aria-label={STATUSES[s]}>
          <h2><span className={'status-dot status-' + s} />{STATUSES[s]} · {items.length} งาน</h2>
          {items.map((t) => {
            const { done, total } = progress(t.checklist);
            const w = when(t);
            return <article key={t.id} className="mrow" role="button" tabIndex={0} onClick={() => onOpen(t)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(t); } }}>
              <strong>{t.title}</strong>
              <small className="mrow-feature">{!projectId && (projects.find((p) => p.id === t.project_id)?.name + ' · ')}{t.feature || 'ทั่วไป'}</small>
              {t.blocked_reason && <p className="mrow-blocked">! {t.blocked_reason}</p>}
              <div className="mrow-meta">
                <span>{total ? `☑ ${done}/${total} งานย่อย` : ''}</span>
                <span className={w.late ? 'late' : ''}>{t.assignee ? t.assignee + ' · ' : ''}{w.text}</span>
              </div>
              {canApprove && approvable(t.status) && <button type="button" className="approve-tick" onClick={(e) => { e.stopPropagation(); onApprove(t); }} aria-label={'อนุมัติ ' + t.title}>✓ อนุมัติ</button>}
            </article>;
          })}
        </section>;
      })}
      {!groups.length && <p className="muted mboard-empty">{query ? 'ไม่พบงานที่ค้นหา' : 'ยังไม่มีงาน'}</p>}
    </div>
  </div>;
}
