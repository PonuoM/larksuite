import { useState } from 'react';
import type { Developer, Project, Task } from './types';
import { developerNames } from './Developers';
import { KINDS, SIZES, STATUSES, STATUS_ORDER, approvable, dateTime, formatDate, progress } from './TaskDrawer';

// Table layout of the board (owner, 2026-09-19): same filtered tasks as the Kanban, one row each, sortable columns.
// The Kanban stays the default; this is a toggle in the board toolbar.
type Key = 'id' | 'title' | 'project' | 'kind' | 'size' | 'status' | 'assignee' | 'developers' | 'progress' | 'go_live' | 'updated';
const SIZE_RANK: Record<string, number> = { S: 1, M: 2, L: 3 };

export default function TaskTable({ tasks, projects, developers, canApprove, moving, onOpen, onApprove }: { tasks: Task[]; projects: Project[]; developers: Developer[]; canApprove: boolean; moving: number[]; onOpen: (t: Task) => void; onApprove: (t: Task) => void }) {
  const [sort, setSort] = useState<{ key: Key; desc: boolean }>({ key: 'status', desc: false });
  const projectName = (t: Task) => projects.find((p) => p.id === t.project_id)?.name ?? '';
  const today = new Date().toISOString().slice(0, 10);
  // Empty values always sort last, whichever direction.
  const value = (t: Task, key: Key): string | number | null => {
    switch (key) {
      case 'id': return t.id;
      case 'title': return t.title;
      case 'project': return projectName(t) + ' ' + (t.feature ?? '');
      case 'kind': return KINDS[t.kind] ?? null;
      case 'size': return SIZE_RANK[t.size] ?? null;
      case 'status': return STATUS_ORDER.indexOf(t.status);
      case 'assignee': return t.assignee || null;
      case 'developers': return developerNames(t, developers) || null;
      case 'progress': { const { done, total } = progress(t.checklist); return total ? done / total : null; }
      case 'go_live': return t.planned_go_live_on || null;
      case 'updated': return t.updated_at || null;
    }
  };
  const rows = [...tasks].sort((a, b) => {
    const x = value(a, sort.key), y = value(b, sort.key);
    if (x === null || y === null) return x === y ? a.id - b.id : x === null ? 1 : -1;
    const c = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'th');
    return (sort.desc ? -c : c) || a.id - b.id;
  });
  const head = (key: Key, label: string, className = '') => <th className={className} aria-sort={sort.key === key ? (sort.desc ? 'descending' : 'ascending') : 'none'}>
    <button type="button" onClick={() => setSort((s) => ({ key, desc: s.key === key ? !s.desc : false }))}>{label}<span aria-hidden="true">{sort.key === key ? (sort.desc ? ' ↓' : ' ↑') : ''}</span></button>
  </th>;

  if (!rows.length) return <div className="empty"><h2>ไม่มีงานตามตัวกรองนี้</h2><p></p></div>;
  return <div className="table-wrap">
    <table className="task-table" aria-label="ตารางงาน">
      <thead><tr>
        {head('id', '#', 'num')}{head('title', 'ชื่องาน')}{head('project', 'โปรเจกต์ · ฟังก์ชัน')}{head('kind', 'ประเภท')}{head('size', 'ขนาด')}
        {head('status', 'สถานะ')}{head('assignee', 'ผู้รับผิดชอบ')}{head('developers', 'ผู้พัฒนา')}{head('progress', 'งานย่อย')}{head('go_live', 'กำหนดเริ่มใช้')}{head('updated', 'แก้ไขล่าสุด')}
      </tr></thead>
      <tbody>{rows.map((t) => {
        const { done, total } = progress(t.checklist);
        const late = t.status !== 4 && !!t.planned_go_live_on && t.planned_go_live_on < today;
        return <tr key={t.id} tabIndex={0} onClick={() => onOpen(t)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(t); } }}>
          <td className="num">#{String(t.id).padStart(3, '0')}</td>
          <td className="title-cell"><strong>{t.title}</strong>{t.blocked_reason && <small className="blocked">! {t.blocked_reason}</small>}</td>
          <td className="muted-cell">{projectName(t)}{t.feature ? ' · ' + t.feature : ''}</td>
          <td>{KINDS[t.kind] ? <span className={'tag kind-' + t.kind}>{KINDS[t.kind]}</span> : <span className="muted-cell">—</span>}</td>
          <td>{SIZES[t.size] ? <span className="tag size" title={SIZES[t.size].hint}>{SIZES[t.size].label}</span> : <span className="muted-cell">—</span>}</td>
          <td><span className="status-cell"><span className={`status-dot status-${t.status}`} />{STATUSES[t.status]}</span>
            {approvable(t.status) && canApprove && <button type="button" className="approve-tick" disabled={moving.includes(t.id)} onClick={(e) => { e.stopPropagation(); onApprove(t); }} onKeyDown={(e) => e.stopPropagation()} aria-label={'อนุมัติ ' + t.title}>✓ อนุมัติ</button>}</td>
          <td className="muted-cell">{t.assignee || '—'}</td>
          <td className="dev-cell">{developerNames(t, developers) || <span className="muted-cell">—</span>}</td>
          <td className="muted-cell">{total ? `${done}/${total}` : '—'}</td>
          <td className={late ? 'late' : 'muted-cell'}>{t.planned_go_live_on ? formatDate(t.planned_go_live_on) : '—'}</td>
          <td className="muted-cell">{dateTime(t.updated_at)}</td>
        </tr>;
      })}</tbody>
    </table>
  </div>;
}
