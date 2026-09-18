import { useMemo, useState } from 'react';
import type { Project, Task } from './types';
import { STATUSES, STATUS_ORDER, approvable, progress, formatDate } from './TaskDrawer';
import { today } from './ProjectViews';

// Phone layout of the board (owner mock-up, 2026-09-18): a status-grouped list with filter chips instead of
// seven swipeable columns. Desktop keeps the Kanban board.
type Props = {
  tasks: Task[]; projects: Project[]; projectId: number | null; query: string; canApprove: boolean; canCreate: boolean;
  showDone: boolean; onShowDone: (v: boolean) => void; moving: number[];
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

export default function MobileBoard({ tasks, projects, projectId, query, canApprove, canCreate, showDone, onShowDone, moving, onProject, onQuery, onOpen, onNew, onApprove, onLogout }: Props) {
  const [status, setStatus] = useState<number | null>(null);
  const [layout, setLayout] = useState<'list' | 'board'>('list');
  const counts = useMemo(() => new Map(STATUS_ORDER.map((s) => [s, tasks.filter((t) => t.status === s).length])), [tasks]);
  const groups = STATUS_ORDER.filter((s) => (status === null || s === status) && (layout === 'board' || (counts.get(s) ?? 0) > 0));
  return <div className="mboard">
    <div className="mboard-controls">
    <header className="mboard-head">
      <div className="mboard-project"><span>WORKBOARD <span className="mboard-project-dot">/</span> งานของทีม</span>
      <select aria-label="โปรเจกต์" value={projectId ?? 0} onChange={(e) => onProject(Number(e.target.value))}>
        <option value={0}>ทุกโปรเจกต์</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      </div>
      {canCreate && <button className="mboard-add" onClick={onNew} aria-label="งานใหม่"><span aria-hidden="true">＋</span> เพิ่มงาน</button>}
    </header>
    <div className="mboard-search-wrap"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg><input className="mboard-search" aria-label="ค้นหางาน" placeholder="ค้นหาชื่องานหรือฟังก์ชัน" value={query} onChange={(e) => onQuery(e.target.value)} />{query && <button aria-label="ล้างคำค้น" onClick={() => onQuery('')}>×</button>}</div>
    <div className="mboard-viewbar"><span>{tasks.length} งาน</span><div className="mboard-layout" role="group" aria-label="รูปแบบงาน"><button aria-pressed={layout === 'list'} onClick={() => setLayout('list')}>รายการ</button><button aria-pressed={layout === 'board'} onClick={() => setLayout('board')}>บอร์ด</button></div></div>
    <div className="mboard-chips" role="group" aria-label="กรองสถานะ">
      <button aria-pressed={status === null} className={status === null ? 'on' : ''} onClick={() => setStatus(null)}>ทั้งหมด</button>
      {STATUS_ORDER.map((s) => <button key={s} aria-pressed={status === s} className={status === s ? 'on' : ''} onClick={() => setStatus(s)}>{STATUSES[s]} <b>{counts.get(s) ?? 0}</b></button>)}
    </div>
    </div>
    <div className={'mboard-list' + (layout === 'board' ? ' mboard-kanban' : '')} aria-label={layout === 'board' ? 'บอร์ดงานมือถือ' : 'รายการงาน'}>
      {groups.map((s) => {
        const items = tasks.filter((t) => t.status === s);
        return <section key={s} aria-label={STATUSES[s]}>
          <h2><span className={'status-dot status-' + s} />{STATUSES[s]}<span className="mgroup-count">{items.length}</span></h2>
          {items.map((t) => {
            const { done, total } = progress(t.checklist);
            const w = when(t);
            return <article key={t.id} className="mrow">
              <button className="mrow-open" onClick={() => onOpen(t)}>
              <span className="mrow-eyebrow"><span>{!projectId ? projects.find((p) => p.id === t.project_id)?.name : t.feature || 'ทั่วไป'}</span><span>#{String(t.id).padStart(3, '0')}</span></span>
              <strong>{t.title}</strong>
              {t.public_summary && <span className="mrow-summary">{t.public_summary}</span>}
              {t.blocked_reason && <p className="mrow-blocked">! {t.blocked_reason}</p>}
              <div className="mrow-meta">
                <span>{total ? `✓ ${done}/${total} งานย่อย` : 'ยังไม่มีงานย่อย'}</span>
                <span className={w.late ? 'late' : ''}>{w.text}</span>
              </div>
              {t.assignee && <span className="mrow-owner"><span aria-hidden="true">{t.assignee.slice(0, 1)}</span>{t.assignee}</span>}
              </button>
              {canApprove && approvable(t.status) && <button type="button" className="approve-tick" disabled={moving.includes(t.id)} onClick={() => onApprove(t)} aria-label={'อนุมัติ ' + t.title}>{moving.includes(t.id) ? 'กำลังอนุมัติ…' : '✓ อนุมัติงาน'}</button>}
            </article>;
          })}
          {!items.length && <p className="mboard-empty">ไม่มีงานในสถานะนี้</p>}
        </section>;
      })}
      {!groups.length && <div className="mboard-empty"><strong>{query ? 'ไม่พบงานที่ค้นหา' : 'ไม่มีงานในสถานะนี้'}</strong><p>ลองดูสถานะอื่น หรือแสดงงานที่เปิดใช้แล้ว</p><button onClick={() => { setStatus(null); onQuery(''); onShowDone(true); }}>ดูงานทั้งหมด</button></div>}
    </div>
    <footer className="mboard-foot"><label><input type="checkbox" checked={showDone} onChange={e => onShowDone(e.target.checked)} />รวมงานเปิดใช้เก่า</label><button onClick={onLogout}>ออกจากระบบ</button></footer>
  </div>;
}
