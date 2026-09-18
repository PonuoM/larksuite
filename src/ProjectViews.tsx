import { useState } from 'react';
import type { Project, Task } from './types';
import { progress, STATUSES as statuses, STATUS_ORDER } from './TaskDrawer';
export function today() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year:'numeric',month:'2-digit',day:'2-digit' }).format(new Date()); }
export function dateLabel(value: string) { return new Date(value+'T12:00:00').toLocaleDateString('th-TH',{day:'numeric',month:'short',year:'numeric'}); }
export function weekRange(value: string) { const d=new Date(value+'T12:00:00'); d.setDate(d.getDate()-((d.getDay()+6)%7)); const start=localDate(d);d.setDate(d.getDate()+6);return [start,localDate(d)]; }
export function localDate(d: Date) { return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
const sub=(t:Task)=>{const {done,total}=progress(t.checklist);return total?' (งานย่อย '+done+'/'+total+')':'';};
export const releasedDay=(t:Task)=>t.actual_released_at?new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(t.actual_released_at.replace(' ','T')+'Z')):'';

// Overview and weekly report on one page (owner decision 2026-09-18): metrics, then each project's week, blockers aside.
export default function ProjectViews({ projects, tasks, projectId, onProject, onOpen }: {projects:Project[];tasks:Task[];projectId:number|null;onProject:(id:number,board?:boolean)=>void;onOpen:(t:Task)=>void}) {
 const [week,setWeek]=useState(today());const [start,end]=weekRange(week);
 const scoped=tasks.filter(t=>!projectId||t.project_id===projectId);
 const active=scoped.filter(t=>t.status!==4);
 // Waiting for a decision = the รอตัดสินใจ column or any open task with a blocked reason.
 const needsDecision=(t:Task)=>t.status!==4&&!!t.blocked_reason;
 const blockers=active.filter(needsDecision);const awaitingApproval=active.filter(t=>t.status===6);
 const released=(t:Task)=>t.status===4&&!!t.actual_released_at&&releasedDay(t)>=start&&releasedDay(t)<=end;
 const delivered=scoped.filter(released);
 const overdue=active.filter(t=>!!t.planned_go_live_on&&t.planned_go_live_on<today());
 const [focus,setFocus]=useState<'approval'|'blocked'|'late'>('approval');
 const attention={approval:awaitingApproval,blocked:blockers,late:overdue};
 const effectiveFocus=attention[focus].length?focus:awaitingApproval.length?'approval':blockers.length?'blocked':'late';
 const attentionItems=attention[effectiveFocus];
 const [showAllAttention,setShowAllAttention]=useState(false);
 const shownProjects=projects.filter(p=>!projectId||p.id===projectId);
 const groupsFor=(pt:Task[])=>[
  {label:'ส่งมอบในสัปดาห์นี้',items:pt.filter(released),tone:'good'},
  {label:'กำลังทำ',items:pt.filter(t=>t.status===1&&!t.blocked_reason),tone:''},
  {label:'รอทดสอบ / เปิดใช้',items:pt.filter(t=>t.status===3&&!t.blocked_reason),tone:''},
  {label:'รออนุมัติ',items:pt.filter(t=>t.status===6&&!t.blocked_reason),tone:''},
  {label:'รอข้อสรุป',items:pt.filter(needsDecision),tone:'accent'},
 ];
 function download() {
  const lines=['# ภาพรวมปัจจุบันและรายการเปิดใช้รายสัปดาห์',dateLabel(start)+' – '+dateLabel(end),'ช่วงสัปดาห์ใช้กับรายการเปิดใช้เท่านั้น สถานะงานอื่นเป็นข้อมูลปัจจุบัน',''];
  for(const p of shownProjects) {lines.push('## '+p.name);const pt=scoped.filter(t=>t.project_id===p.id);for(const group of groupsFor(pt)){if(group.items.length){lines.push('### '+group.label);for(const t of group.items)lines.push('- ['+statuses[t.status]+'] '+t.title+sub(t)+' · '+(t.planned_go_live_on?'กำหนดเริ่มใช้ '+t.planned_go_live_on:'ยังไม่กำหนดวันเริ่มใช้')+(t.blocked_reason?' · '+t.blocked_reason:''));}}const waiting=pt.filter(t=>t.status===0&&!t.blocked_reason).length;if(waiting)lines.push('รอดำเนินการ '+waiting+' งาน');lines.push('');}
  const url=URL.createObjectURL(new Blob([lines.join('\n')],{type:'text/markdown;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='workboard-'+start+'.md';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 function row(t:Task,reason?:string){return <button className="brief-task" key={t.id} onClick={()=>onOpen(t)}><span className="brief-task-id">#{t.id}</span><span><strong>{t.title}</strong><small>{projects.find(p=>p.id===t.project_id)?.name}{t.assignee?' · '+t.assignee:''}</small>{reason&&<p>{reason}</p>}</span><span aria-hidden="true">↗</span></button>;}
 return <div className="brief-page">
  <div className="brief-toolbar"><label>โปรเจกต์<select aria-label="โปรเจกต์ในรายงาน" value={projectId??0} onChange={e=>onProject(Number(e.target.value))}><option value={0}>ทุกโปรเจกต์</option>{projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><span>สถานะปัจจุบัน · {active.length} งานยังไม่จบ</span></div>
  <section className="brief-section"><header><div><span className="brief-number">01 / สิ่งที่ต้องติดตาม</span><h2>ต้องดูตอนนี้</h2></div><small>ตามข้อมูลที่คุณมีสิทธิ์เห็น</small></header>
   <div className="brief-filters" role="group" aria-label="เรื่องที่ต้องติดตาม">{([['approval','รออนุมัติ'],['blocked','ติดขัด'],['late','เลยกำหนด']] as const).map(([key,label])=><button key={key} aria-pressed={effectiveFocus===key} onClick={()=>{setFocus(key);setShowAllAttention(false);}} disabled={!attention[key].length}>{label}<b>{attention[key].length}</b></button>)}</div>
   {attentionItems.length?<div className="brief-tasks">{(showAllAttention?attentionItems:attentionItems.slice(0,5)).map(t=>row(t,effectiveFocus==='blocked'?t.blocked_reason:effectiveFocus==='late'?'กำหนดเริ่มใช้ '+dateLabel(t.planned_go_live_on!):'รอผู้มีสิทธิ์ตรวจและอนุมัติ'))}{attentionItems.length>5&&<button className="brief-expand" onClick={()=>setShowAllAttention(!showAllAttention)}>{showAllAttention?'แสดงน้อยลง':`ดูอีก ${attentionItems.length-5} งาน`}</button>}</div>:<p className="brief-empty">ไม่มีงานรออนุมัติ ติดขัด หรือเลยกำหนดในข้อมูลที่คุณเห็น</p>}
  </section>
  <section className="brief-section"><header><div><span className="brief-number">02 / สถานะปัจจุบัน</span><h2>แต่ละโปรเจกต์ถึงไหน</h2></div><small>{shownProjects.length} โปรเจกต์</small></header>
   <div className="brief-projects">{shownProjects.map(p=>{const pt=scoped.filter(t=>t.project_id===p.id);const open=pt.filter(t=>t.status!==4);const approval=pt.filter(t=>t.status===6);const doing=pt.filter(t=>t.status===1);const ready=pt.filter(t=>t.status===3);const pending=pt.filter(t=>t.status===0);return <details className="brief-project" key={p.id}><summary><span className="brief-project-heading"><strong>{p.name}</strong><small>{open.length?`${open.length} งานยังไม่จบ`:'ไม่มีงานค้างในข้อมูลนี้'}</small></span><span className="brief-project-stats">{approval.length>0&&<span>รออนุมัติ <b>{approval.length}</b></span>}<span>รอดำเนินการ <b>{pending.length}</b></span><span>กำลังทำ <b>{doing.length}</b></span><span>รอทดสอบ/เปิดใช้ <b>{ready.length}</b></span></span><span className="brief-chevron" aria-hidden="true">⌄</span></summary><div className="brief-project-detail"><p className="muted">{STATUS_ORDER.map(s=>`${statuses[s]} ${pt.filter(t=>t.status===s).length}`).join(' · ')}</p>{open.length?open.map(t=>row(t,statuses[t.status]+sub(t))):<p className="brief-empty">ไม่มีงานค้าง</p>}<button className="brief-expand" onClick={()=>onProject(p.id,true)}>เปิดบอร์ด {p.name} ↗</button></div></details>;})}</div>
  </section>
  <section className="brief-section"><header><div><span className="brief-number">03 / ผลที่เปิดให้ใช้แล้ว</span><h2>เปิดใช้ในสัปดาห์ที่เลือก</h2></div></header><div className="brief-week"><label>เลือกสัปดาห์<input aria-label="วันที่ในสัปดาห์" type="date" value={week} onChange={e=>e.target.value&&setWeek(e.target.value)}/></label><span>{dateLabel(start)} – {dateLabel(end)}</span><button className="secondary" onClick={download}>ดาวน์โหลดสรุป</button></div><p className="brief-caption">ส่วนนี้อิงวันที่เปิดใช้จริง ส่วนด้านบนแสดงสถานะปัจจุบัน ไม่ใช่ประวัติย้อนหลัง</p>{delivered.length?delivered.map(t=>row(t,'เปิดใช้ '+dateLabel(releasedDay(t)))):<p className="brief-empty">ไม่มีรายการในช่วงนี้</p>}</section>
 </div>;
}
