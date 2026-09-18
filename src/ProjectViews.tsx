import { useState } from 'react';
import type { Project, Task } from './types';
import { progress, STATUSES as statuses, STATUS_ORDER } from './TaskDrawer';
export function today() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year:'numeric',month:'2-digit',day:'2-digit' }).format(new Date()); }
export function dateLabel(value: string) { return new Date(value+'T12:00:00').toLocaleDateString('th-TH',{day:'numeric',month:'short',year:'numeric'}); }
export function weekRange(value: string) { const d=new Date(value+'T12:00:00'); d.setDate(d.getDate()-((d.getDay()+6)%7)); const start=localDate(d);d.setDate(d.getDate()+6);return [start,localDate(d)]; }
export function localDate(d: Date) { return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
const sub=(t:Task)=>{const {done,total}=progress(t.checklist);return total?' (งานย่อย '+done+'/'+total+')':'';};

// Overview and weekly report on one page (owner decision 2026-09-18): metrics, then each project's week, blockers aside.
export default function ProjectViews({ projects, tasks, projectId, onProject, onOpen }: {projects:Project[];tasks:Task[];projectId:number|null;onProject:(id:number,board?:boolean)=>void;onOpen:(t:Task)=>void}) {
 const [week,setWeek]=useState(today());const [start,end]=weekRange(week);
 const scoped=tasks.filter(t=>!projectId||t.project_id===projectId);
 const active=scoped.filter(t=>t.status!==4);
 // Waiting for a decision = the รอตัดสินใจ column or any open task with a blocked reason.
 const needsDecision=(t:Task)=>t.status!==4&&!!t.blocked_reason;
 const blockers=active.filter(needsDecision);const awaitingApproval=active.filter(t=>t.status===6);
 const released=(t:Task)=>t.status===4&&!!t.actual_released_at&&t.actual_released_at.slice(0,10)>=start&&t.actual_released_at.slice(0,10)<=end;
 const delivered=scoped.filter(released);
 const shownProjects=projects.filter(p=>!projectId||p.id===projectId);
 const groupsFor=(pt:Task[])=>[
  {label:'ส่งมอบในสัปดาห์นี้',items:pt.filter(released),tone:'good'},
  {label:'กำลังทำ',items:pt.filter(t=>t.status===1&&!t.blocked_reason),tone:''},
  {label:'รอทดสอบ / เปิดใช้',items:pt.filter(t=>t.status===3&&!t.blocked_reason),tone:''},
  {label:'รออนุมัติ',items:pt.filter(t=>t.status===6&&!t.blocked_reason),tone:''},
  {label:'รอข้อสรุป',items:pt.filter(needsDecision),tone:'accent'},
 ];
 function download() {
  const lines=['# รายงานสัปดาห์',dateLabel(start)+' – '+dateLabel(end),''];
  for(const p of shownProjects) {lines.push('## '+p.name);const pt=scoped.filter(t=>t.project_id===p.id);for(const group of groupsFor(pt)){if(group.items.length){lines.push('### '+group.label);for(const t of group.items)lines.push('- ['+statuses[t.status]+'] '+t.title+sub(t)+' · '+(t.planned_go_live_on?'กำหนดเริ่มใช้ '+t.planned_go_live_on:'ยังไม่กำหนดวันเริ่มใช้')+(t.blocked_reason?' · '+t.blocked_reason:''));}}const waiting=pt.filter(t=>t.status===0&&!t.blocked_reason).length;if(waiting)lines.push('รอดำเนินการ '+waiting+' งาน');lines.push('');}
  const url=URL.createObjectURL(new Blob([lines.join('\n')],{type:'text/markdown;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='workboard-'+start+'.md';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 return <><div className="toolbar"><select aria-label="โปรเจกต์ในรายงาน" value={projectId??0} onChange={e=>onProject(Number(e.target.value))}><option value={0}>ทุกโปรเจกต์</option>{projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select><input aria-label="วันที่ในสัปดาห์" type="date" value={week} onChange={e=>e.target.value&&setWeek(e.target.value)}/><span className="period-label">{dateLabel(start)} – {dateLabel(end)}</span><button className="primary toolbar-end" onClick={download}>ดาวน์โหลดสรุป</button></div>
 <div className="view-content">
  <div className="overview-metrics">{[[active.length,'งานที่ยังไม่จบ'],[active.filter(t=>t.status===1).length,'กำลังลงมือทำ'],[delivered.length,'เปิดใช้ในสัปดาห์นี้'],[blockers.length,'เรื่องที่ต้องช่วยตัดสินใจ']].map(([n,label])=><div key={label}><strong>{n}</strong><span>{label}</span></div>)}</div>
  <div className="overview-layout"><div>
   {shownProjects.map(p=>{const pt=scoped.filter(t=>t.project_id===p.id);const groups=groupsFor(pt);const waiting=pt.filter(t=>t.status===0&&!t.blocked_reason).length;
    return <section className="project-report" key={p.id}><div><button className="project-title" onClick={()=>onProject(p.id,true)}>{p.name} ↗</button><p>{p.description}</p><p className="project-counts">{STATUS_ORDER.map(i=><span key={i}>{statuses[i]} <b>{pt.filter(t=>t.status===i).length}</b></span>)}</p></div>
     <div>{groups.filter(g=>g.items.length).map(g=><section className="report-group" key={g.label}><h3 className={g.tone}>{g.label}</h3>{g.items.map(t=><button className="report-task" key={t.id} onClick={()=>onOpen(t)}><span>—</span><span>{t.title}{sub(t)&&<em className="report-sub">{sub(t)}</em>}{t.blocked_reason&&<small>{t.blocked_reason}</small>}</span></button>)}</section>)}
      {waiting>0&&<p className="muted report-waiting">รอดำเนินการ {waiting} งาน · <button className="text-action" onClick={()=>onProject(p.id,true)}>ดูในบอร์ด</button></p>}
      {groups.every(g=>!g.items.length)&&!waiting&&<p className="muted">ไม่มีรายการในช่วงนี้</p>}</div></section>})}
  </div>
  <aside className="overview-aside">{awaitingApproval.length>0&&<><h2>รออนุมัติ <small>{awaitingApproval.length}</small></h2>{awaitingApproval.map(t=><button className="task-card" key={t.id} onClick={()=>onOpen(t)}><small>{projects.find(p=>p.id===t.project_id)?.name}</small><h2>{t.title}</h2></button>)}</>}<h2>ต้องการข้อสรุป</h2>{blockers.length?blockers.map(t=><button className="task-card" key={t.id} onClick={()=>onOpen(t)}><small>{projects.find(p=>p.id===t.project_id)?.name}</small><h2>{t.title}</h2><p className="blocked">{t.blocked_reason}</p></button>):<p className="muted">ไม่มีเรื่องติดขัดในข้อมูลที่คุณเข้าถึงได้</p>}</aside></div>
 </div></>;
}
