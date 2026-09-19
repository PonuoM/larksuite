import React, { useState } from 'react';
import { api } from './api';
import type { Developer, Task } from './types';
import { message } from './TaskDrawer';

// ตั้งค่า → นักพัฒนา (owner, 2026-09-19): admins keep the list of developer names that tasks can pick from.
// No delete: "ปิดใช้" hides a name from the picker but keeps it on the tasks that already name it.
export default function DevelopersManager({ developers, tasks, onChanged }: { developers: Developer[]; tasks: Task[]; onChanged: () => Promise<void> }) {
  const [name, setName] = useState('');
  const [editing, setEditing] = useState(0);
  const [editName, setEditName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const openCount = (id: number) => tasks.filter((t) => t.status !== 4 && t.developer_ids?.includes(id)).length;

  async function run(action: () => Promise<void>, done: string) {
    setBusy(true); setError(''); setNotice('');
    try { await action(); await onChanged(); setNotice(done); } catch (e) { setError(message(e)); } finally { setBusy(false); }
  }
  function add(e: React.FormEvent) {
    e.preventDefault();
    const clean = name.trim();
    run(async () => { await api('/developers', { method: 'POST', body: JSON.stringify({ name: clean }) }); setName(''); }, `เพิ่ม “${clean}” แล้ว`);
  }
  function save(d: Developer) {
    const clean = editName.trim();
    run(async () => { await api(`/developers/${d.id}`, { method: 'PATCH', body: JSON.stringify({ name: clean }) }); setEditing(0); }, 'เปลี่ยนชื่อแล้ว');
  }
  function toggle(d: Developer) {
    run(async () => { await api(`/developers/${d.id}`, { method: 'PATCH', body: JSON.stringify({ active: !d.active }) }); }, d.active ? `ปิดใช้ “${d.name}” แล้ว` : `เปิดใช้ “${d.name}” แล้ว`);
  }

  return <div className="access-content">
    {error && <div className="alert error" role="alert">{error}</div>}
    {notice && <div className="alert success" role="status">{notice}</div>}
    <section className="panel"><h2>เพิ่มนักพัฒนา</h2>
      <form onSubmit={add} className="developer-form">
        <input required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} placeholder="ชื่อที่จะแสดงบนงาน เช่น ต้น, มายด์" aria-label="ชื่อนักพัฒนา" />
        <button className="primary" disabled={busy || !name.trim()}>เพิ่ม</button>
      </form>
      <p className="access-hint">ชื่อในรายการนี้เลือกใส่ในงานได้ที่ช่อง “ผู้พัฒนา” (เลือกได้หลายคน) · เปลี่ยนชื่อแล้วทุกงานเปลี่ยนตาม</p>
    </section>
    <section className="panel"><h2>รายชื่อนักพัฒนา <small>{developers.filter((d) => d.active).length}</small></h2>
      {!developers.length ? <p className="access-hint">ยังไม่มีรายชื่อ</p> : <ul className="developer-list">{developers.map((d) => <li key={d.id} className={d.active ? '' : 'inactive'}>
        {editing === d.id
          ? <form className="developer-form" onSubmit={(e) => { e.preventDefault(); save(d); }}><input autoFocus required maxLength={120} value={editName} onChange={(e) => setEditName(e.target.value)} aria-label={'ชื่อใหม่ของ ' + d.name} /><button className="primary" disabled={busy || !editName.trim()}>บันทึก</button><button type="button" className="text-action" onClick={() => setEditing(0)}>ยกเลิก</button></form>
          : <><span className="avatar">{d.name.slice(0, 1)}</span><div><strong>{d.name}</strong><small>{d.active ? `งานที่ยังไม่เสร็จ ${openCount(d.id)} งาน` : 'ปิดใช้แล้ว · ยังแสดงในงานเดิม'}</small></div>
            <div className="member-actions"><button className="secondary" disabled={busy} onClick={() => { setEditing(d.id); setEditName(d.name); }}>เปลี่ยนชื่อ</button><button className={d.active ? 'danger-text' : 'secondary'} disabled={busy} onClick={() => toggle(d)}>{d.active ? 'ปิดใช้' : 'เปิดใช้อีกครั้ง'}</button></div></>}
      </li>)}</ul>}
    </section>
  </div>;
}

// Drawer field: toggle chips, several people allowed. Deactivated names stay visible only if already on the task.
export function DeveloperPicker({ developers, value, onChange }: { developers: Developer[]; value: number[]; onChange: (ids: number[]) => void }) {
  const shown = developers.filter((d) => d.active || value.includes(d.id));
  return <div className="field"><span>ผู้พัฒนา (เลือกได้หลายคน)</span>
    {shown.length ? <div className="developer-chips" role="group" aria-label="ผู้พัฒนา">{shown.map((d) => {
      const on = value.includes(d.id);
      return <button type="button" key={d.id} aria-pressed={on} className={on ? 'chip on' : 'chip'} onClick={() => onChange(on ? value.filter((id) => id !== d.id) : [...value, d.id])}>{on ? '✓ ' : ''}{d.name}</button>;
    })}</div> : <small className="muted">ยังไม่มีรายชื่อ · ผู้ดูแลเพิ่มได้ที่ ตั้งค่า → นักพัฒนา</small>}
  </div>;
}

export function developerNames(task: Task, developers: Developer[]) {
  return (task.developer_ids ?? []).map((id) => developers.find((d) => d.id === id)?.name).filter(Boolean).join(', ');
}
