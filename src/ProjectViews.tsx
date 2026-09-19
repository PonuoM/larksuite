import { useMemo, useState } from 'react';
import type { Project, Task } from './types';
import { KINDS, progress, STATUSES as statuses, STATUS_ORDER } from './TaskDrawer';
export function today() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year:'numeric',month:'2-digit',day:'2-digit' }).format(new Date()); }
export function dateLabel(value: string) { return new Date(value+'T12:00:00').toLocaleDateString('th-TH',{day:'numeric',month:'short',year:'numeric'}); }
export function weekRange(value: string) { const d=new Date(value+'T12:00:00'); d.setDate(d.getDate()-((d.getDay()+6)%7)); const start=localDate(d);d.setDate(d.getDate()+6);return [start,localDate(d)]; }
export function localDate(d: Date) { return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
const sub=(t:Task)=>{const {done,total}=progress(t.checklist);return total?' (งานย่อย '+done+'/'+total+')':'';};
// Server timestamps are UTC "YYYY-MM-DD HH:MM:SS"; the dashboard counts days in Bangkok.
const bkkDay=(ts?:string|null)=>ts?new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(ts.replace(' ','T')+'Z')):'';
export const releasedDay=(t:Task)=>bkkDay(t.actual_released_at);
const addDays=(day:string,n:number)=>{const d=new Date(day+'T12:00:00');d.setDate(d.getDate()+n);return localDate(d);};
const shortDate=(day:string)=>new Date(day+'T12:00:00').toLocaleDateString('th-TH',{day:'numeric',month:'short'});
const DAY_NAMES=['จ.','อ.','พ.','พฤ.','ศ.','ส.','อา.'];
// Status colours for charts (board order). Kept apart from the board's column dots on purpose: charts need more contrast.
const STATUS_COLOR:Record<number,string>={6:'#f59e0b',0:'#cbd5e1',1:'#3b82f6',3:'#8b5cf6',4:'#84cc16'};
const KIND_KEYS=[...Object.keys(KINDS),''];

// Overview and weekly report as a card dashboard (owner, 2026-09-19): every number and chart comes from the tasks the
// viewer can see; nothing is sample data. The week picker drives the trend highlight, the schedule and the download.
export default function ProjectViews({ projects, tasks, projectId, onProject, onOpen }: {projects:Project[];tasks:Task[];projectId:number|null;onProject:(id:number,board?:boolean)=>void;onOpen:(t:Task)=>void}) {
 const [week,setWeek]=useState(today());const [start,end]=weekRange(week);
 const scoped=tasks.filter(t=>!projectId||t.project_id===projectId);
 const active=scoped.filter(t=>t.status!==4);
 // Waiting for a decision = any open task with a blocked reason.
 const needsDecision=(t:Task)=>t.status!==4&&!!t.blocked_reason;
 const blockers=active.filter(needsDecision);const awaitingApproval=active.filter(t=>t.status===6);
 const inWeek=(day:string,s:string)=>!!day&&day>=s&&day<=addDays(s,6);
 const released=(t:Task)=>t.status===4&&inWeek(releasedDay(t),start);
 const delivered=scoped.filter(released);
 const prevDelivered=scoped.filter(t=>t.status===4&&inWeek(releasedDay(t),addDays(start,-7))).length;
 const overdue=active.filter(t=>!!t.planned_go_live_on&&t.planned_go_live_on<today());
 const [focus,setFocus]=useState<'approval'|'blocked'|'late'>('approval');
 const attention={approval:awaitingApproval,blocked:blockers,late:overdue};
 const effectiveFocus=attention[focus].length?focus:awaitingApproval.length?'approval':blockers.length?'blocked':'late';
 const attentionItems=attention[effectiveFocus];
 const [showAllAttention,setShowAllAttention]=useState(false);
 const shownProjects=projects.filter(p=>!projectId||p.id===projectId);
 const projectName=(t:Task)=>projects.find(p=>p.id===t.project_id)?.name??'';
 const groupsFor=(pt:Task[])=>[
  {label:'ส่งมอบในสัปดาห์นี้',items:pt.filter(released)},
  {label:'กำลังทำ',items:pt.filter(t=>t.status===1&&!t.blocked_reason)},
  {label:'รอทดสอบ / เปิดใช้',items:pt.filter(t=>t.status===3&&!t.blocked_reason)},
  {label:'รออนุมัติ',items:pt.filter(t=>t.status===6&&!t.blocked_reason)},
  {label:'รอข้อสรุป',items:pt.filter(needsDecision)},
 ];
 function download() {
  const lines=['# ภาพรวมปัจจุบันและรายการเปิดใช้รายสัปดาห์',dateLabel(start)+' – '+dateLabel(end),'ช่วงสัปดาห์ใช้กับรายการเปิดใช้เท่านั้น สถานะงานอื่นเป็นข้อมูลปัจจุบัน',''];
  for(const p of shownProjects) {lines.push('## '+p.name);const pt=scoped.filter(t=>t.project_id===p.id);for(const group of groupsFor(pt)){if(group.items.length){lines.push('### '+group.label);for(const t of group.items)lines.push('- ['+statuses[t.status]+'] '+t.title+sub(t)+' · '+(t.planned_go_live_on?'กำหนดเริ่มใช้ '+t.planned_go_live_on:'ยังไม่กำหนดวันเริ่มใช้')+(t.blocked_reason?' · '+t.blocked_reason:''));}}const waiting=pt.filter(t=>t.status===0&&!t.blocked_reason).length;if(waiting)lines.push('รอดำเนินการ '+waiting+' งาน');lines.push('');}
  const url=URL.createObjectURL(new Blob([lines.join('\n')],{type:'text/markdown;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='workboard-'+start+'.md';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 const statusCounts=STATUS_ORDER.map(s=>({s,n:scoped.filter(t=>t.status===s).length}));
 const delta=delivered.length-prevDelivered;
 const subDone=active.reduce((a,t)=>{const p=progress(t.checklist);return {done:a.done+p.done,total:a.total+p.total};},{done:0,total:0});
 const reason=(t:Task)=>effectiveFocus==='blocked'?t.blocked_reason!:effectiveFocus==='late'?'กำหนดเริ่มใช้ '+dateLabel(t.planned_go_live_on!):'รอผู้มีสิทธิ์ตรวจและอนุมัติ';
 return <div className="dash-page">
  <div className="dash-toolbar">
   <label className="dash-pill-select"><span>โปรเจกต์</span><select aria-label="โปรเจกต์ในรายงาน" value={projectId??0} onChange={e=>onProject(Number(e.target.value))}><option value={0}>ทุกโปรเจกต์</option>{projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
   <div className="dash-week">
    <button className="dash-icon-btn" aria-label="สัปดาห์ก่อน" onClick={()=>setWeek(addDays(start,-7))}>‹</button>
    <label><span className="sr-only">วันที่ในสัปดาห์</span><input aria-label="วันที่ในสัปดาห์" type="date" value={week} onChange={e=>e.target.value&&setWeek(e.target.value)}/></label>
    <button className="dash-icon-btn" aria-label="สัปดาห์ถัดไป" onClick={()=>setWeek(addDays(start,7))}>›</button>
    <button className="dash-chip" onClick={()=>setWeek(today())} disabled={inWeek(today(),start)}>สัปดาห์นี้</button>
    <button className="dash-primary" onClick={download}>ดาวน์โหลดสรุป</button>
   </div>
  </div>
  <div className="dash-layout">
   <div className="dash-main">
    <section className="dash-card dash-hero" aria-label="ตัวเลขหลัก">
     <div className="dash-kpis">
      <div><div className="dash-big">{active.length}</div><span>งานยังไม่จบ</span></div>
      <div><div className="dash-big">{delivered.length}{prevDelivered+delivered.length>0&&<em className={delta>=0?'up':'down'} title="เทียบกับสัปดาห์ก่อน">{delta>=0?'↑':'↓'} {Math.abs(delta)}</em>}</div><span>เปิดใช้ในสัปดาห์ที่เลือก</span></div>
      <div><div className="dash-big">{subDone.total?Math.round(subDone.done/subDone.total*100):0}<small>%</small></div><span>งานย่อยเสร็จ {subDone.done}/{subDone.total}</span></div>
     </div>
     <div className="dash-mini-kpis">
      <button onClick={()=>setFocus('approval')}><b style={{background:STATUS_COLOR[6]}}/>รออนุมัติ <strong>{awaitingApproval.length}</strong></button>
      <button onClick={()=>setFocus('blocked')}><b style={{background:'#f43f5e'}}/>ติดขัด <strong>{blockers.length}</strong></button>
      <button onClick={()=>setFocus('late')}><b style={{background:'#fb923c'}}/>เลยกำหนด <strong>{overdue.length}</strong></button>
     </div>
     <StatusBar counts={statusCounts}/>
    </section>
    <ActivityHeatmap tasks={scoped} anchor={start}/>
    <TrendChart tasks={scoped} start={start} onWeek={setWeek}/>
    <KindChart tasks={scoped}/>
    <section className="dash-card dash-attention">
     <header className="dash-card-head"><h2>ต้องดูตอนนี้</h2><div className="dash-tabs" role="group" aria-label="เรื่องที่ต้องติดตาม">{([['approval','รออนุมัติ'],['blocked','ติดขัด'],['late','เลยกำหนด']] as const).map(([key,label])=><button key={key} aria-pressed={effectiveFocus===key} onClick={()=>{setFocus(key);setShowAllAttention(false);}} disabled={!attention[key].length}>{label}<b>{attention[key].length}</b></button>)}</div></header>
     {attentionItems.length?<div className="dash-rows">{(showAllAttention?attentionItems:attentionItems.slice(0,5)).map(t=><button className="dash-row" key={t.id} onClick={()=>onOpen(t)}><span className="dash-row-id">#{t.id}</span><span className="dash-row-main"><strong>{t.title}</strong><small>{projectName(t)}{t.assignee?' · '+t.assignee:''}</small></span><span className="dash-row-reason">{reason(t)}</span><span className="dash-row-go" aria-hidden="true">↗</span></button>)}{attentionItems.length>5&&<button className="dash-more" onClick={()=>setShowAllAttention(!showAllAttention)}>{showAllAttention?'แสดงน้อยลง':`ดูอีก ${attentionItems.length-5} งาน`}</button>}</div>:<p className="dash-empty">ไม่มีงานรออนุมัติ ติดขัด หรือเลยกำหนดในข้อมูลที่คุณเห็น</p>}
    </section>
    <StatusDonut counts={statusCounts}/>
    <section className="dash-card dash-projects">
     <header className="dash-card-head"><h2>แต่ละโปรเจกต์ถึงไหน</h2><small>{shownProjects.length} โปรเจกต์</small></header>
     <div className="dash-project-list">{shownProjects.map(p=>{const pt=scoped.filter(t=>t.project_id===p.id);const open=pt.filter(t=>t.status!==4);const done=pt.length-open.length;const pct=pt.length?Math.round(done/pt.length*100):0;return <details className="dash-project" key={p.id}><summary>
      <span className="dash-project-name"><strong>{p.name}</strong><small>{open.length?`${open.length} งานยังไม่จบ`:'ไม่มีงานค้างในข้อมูลนี้'}</small></span>
      <StatusBar counts={STATUS_ORDER.map(s=>({s,n:pt.filter(t=>t.status===s).length}))} compact/>
      <span className="dash-project-pct"><strong>{pct}%</strong><small>เปิดใช้แล้ว</small></span>
      <span className="dash-chevron" aria-hidden="true">⌄</span>
     </summary><div className="dash-project-detail"><p>{STATUS_ORDER.map(s=>`${statuses[s]} ${pt.filter(t=>t.status===s).length}`).join(' · ')}</p>{open.length?open.map(t=><button className="dash-row" key={t.id} onClick={()=>onOpen(t)}><span className="dash-row-id">#{t.id}</span><span className="dash-row-main"><strong>{t.title}</strong><small>{statuses[t.status]+sub(t)}{t.assignee?' · '+t.assignee:''}</small></span><span className="dash-row-reason">{t.blocked_reason||''}</span><span className="dash-row-go" aria-hidden="true">↗</span></button>):<p className="dash-empty">ไม่มีงานค้าง</p>}<button className="dash-more" onClick={()=>onProject(p.id,true)}>เปิดบอร์ด {p.name} ↗</button></div></details>;})}</div>
    </section>
   </div>
   <WeekSchedule tasks={scoped} start={start} projectName={projectName} onOpen={onOpen}/>
  </div>
 </div>;
}

function StatusBar({counts,compact}:{counts:{s:number;n:number}[];compact?:boolean}) {
 const total=counts.reduce((a,c)=>a+c.n,0);
 return <div className={'dash-statusbar'+(compact?' compact':'')}>
  <div className="dash-statusbar-track" role="img" aria-label={counts.map(c=>statuses[c.s]+' '+c.n).join(', ')}>{total?counts.filter(c=>c.n).map(c=><i key={c.s} title={statuses[c.s]+' '+c.n} style={{flexGrow:c.n,background:STATUS_COLOR[c.s]}}/>):<i style={{flexGrow:1}}/>}</div>
  {!compact&&<ul className="dash-statusbar-legend">{counts.map(c=><li key={c.s}><b style={{background:STATUS_COLOR[c.s]}}/>{statuses[c.s]}<strong>{c.n}</strong></li>)}</ul>}
 </div>;
}

// Days with activity: sub-tasks ticked done, releases, and each task's latest edit. Only the latest edit is stored,
// so older edits do not show; the caption says so.
function ActivityHeatmap({tasks,anchor}:{tasks:Task[];anchor:string}) {
 const WEEKS=12;const first=addDays(anchor,-7*(WEEKS-1));
 const counts=useMemo(()=>{const m=new Map<string,number>();const add=(d:string)=>{if(d)m.set(d,(m.get(d)??0)+1);};for(const t of tasks){add(bkkDay(t.updated_at));add(releasedDay(t));for(const c of t.checklist??[])if(c.done&&c.done_at)add(bkkDay(c.done_at));}return m;},[tasks]);
 const cells=Array.from({length:WEEKS*7},(_,i)=>{const day=addDays(first,Math.floor(i/7)*7+i%7);return {day,n:counts.get(day)??0,future:day>today()};});
 const max=Math.max(1,...cells.map(c=>c.n));
 const total=cells.reduce((a,c)=>a+c.n,0);
 const level=(n:number)=>n===0?0:Math.min(4,Math.ceil(n/max*4));
 return <section className="dash-card dash-heat">
  <header className="dash-card-head"><h2>ความเคลื่อนไหว</h2><small>{total} ครั้ง · 12 สัปดาห์</small></header>
  <div className="dash-heat-grid">
   <div className="dash-heat-days">{DAY_NAMES.map((d,i)=><span key={d}>{i%2===0?d:''}</span>)}</div>
   <div className="dash-heat-cells">{cells.map(c=><i key={c.day} className={'l'+level(c.n)+(c.future?' future':'')} title={shortDate(c.day)+' · '+c.n+' ครั้ง'}/>)}</div>
  </div>
  <div className="dash-heat-foot"><span>{shortDate(first)}</span><span className="dash-heat-legend">น้อย<i className="l1"/><i className="l2"/><i className="l3"/><i className="l4"/>มาก</span><span>{shortDate(addDays(anchor,6))}</span></div>
  <p className="dash-caption">นับจากงานย่อยที่เสร็จ วันเปิดใช้ และการแก้ไขล่าสุดของแต่ละงาน</p>
 </section>;
}

// Smooth path through points (Catmull-Rom converted to cubic Bézier).
function smooth(pts:[number,number][]) {
 if(pts.length<2)return '';
 let d=`M${pts[0][0]},${pts[0][1]}`;
 for(let i=0;i<pts.length-1;i++){const p0=pts[i-1]??pts[i],p1=pts[i],p2=pts[i+1],p3=pts[i+2]??p2;d+=` C${p1[0]+(p2[0]-p0[0])/6},${p1[1]+(p2[1]-p0[1])/6} ${p2[0]-(p3[0]-p1[0])/6},${p2[1]-(p3[1]-p1[1])/6} ${p2[0]},${p2[1]}`;}
 return d;
}

function TrendChart({tasks,start,onWeek}:{tasks:Task[];start:string;onWeek:(d:string)=>void}) {
 const [thisWeek]=weekRange(today());
 const weeks=Array.from({length:8},(_,i)=>addDays(start,(i-5)*7));
 const data=weeks.map(w=>({w,planned:tasks.filter(t=>!!t.planned_go_live_on&&t.planned_go_live_on>=w&&t.planned_go_live_on<=addDays(w,6)).length,actual:w>thisWeek?null:tasks.filter(t=>t.status===4&&releasedDay(t)>=w&&releasedDay(t)<=addDays(w,6)).length}));
 const W=640,H=220,L=30,R=12,T=22,B=30;const top=Math.max(4,...data.map(d=>Math.max(d.planned,d.actual??0)));const yMax=Math.ceil(top/4)*4;
 const x=(i:number)=>L+(W-L-R)*(i+.5)/data.length;const y=(v:number)=>T+(H-T-B)*(1-v/yMax);
 const planned=data.map((d,i)=>[x(i),y(d.planned)] as [number,number]);
 const actual=data.flatMap((d,i)=>d.actual===null?[]:[[x(i),y(d.actual)] as [number,number]]);
 const sel=5;const colW=(W-L-R)/data.length;
 return <section className="dash-card dash-trend">
  <header className="dash-card-head"><h2>กำหนดเริ่มใช้ vs เปิดใช้จริง</h2><div className="dash-legend"><span><b className="dot planned"/>ตามกำหนด</span><span><b className="dot actual"/>เปิดใช้จริง</span></div></header>
  <svg viewBox={`0 0 ${W} ${H}`} className="dash-svg" role="img" aria-label={data.map(d=>`สัปดาห์ ${shortDate(d.w)}: กำหนด ${d.planned} เปิดใช้ ${d.actual??'-'}`).join('; ')}>
   <defs>
    <linearGradient id="dashActualFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3b82f6" stopOpacity=".22"/><stop offset="1" stopColor="#3b82f6" stopOpacity="0"/></linearGradient>
    <linearGradient id="dashSel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3b82f6" stopOpacity=".04"/><stop offset="1" stopColor="#3b82f6" stopOpacity=".14"/></linearGradient>
   </defs>
   {[0,.25,.5,.75,1].map(f=><g key={f}><line x1={L} x2={W-R} y1={y(yMax*f)} y2={y(yMax*f)} className="grid"/><text x={L-8} y={y(yMax*f)+4} textAnchor="end" className="axis">{Math.round(yMax*f)}</text></g>)}
   <rect x={x(sel)-colW/2+6} y={T-14} width={colW-12} height={H-T-B+14} rx="10" fill="url(#dashSel)"/>
   {actual.length>1&&<path d={smooth(actual)+` L${actual.at(-1)![0]},${y(0)} L${actual[0][0]},${y(0)} Z`} fill="url(#dashActualFill)"/>}
   <path d={smooth(planned)} className="line-planned"/>
   {actual.length>1&&<path d={smooth(actual)} className="line-actual"/>}
   {data[sel].actual!==null&&<g><circle cx={x(sel)} cy={y(data[sel].actual!)} r="7" className="knob"/><text x={x(sel)} y={y(data[sel].actual!)-14} textAnchor="middle" className="knob-label">{data[sel].actual} งาน</text></g>}
   {data.map((d,i)=><g key={d.w} className="week-hit" onClick={()=>onWeek(d.w)}><rect x={x(i)-colW/2} y={0} width={colW} height={H} fill="transparent"><title>{`สัปดาห์ ${shortDate(d.w)} · กำหนด ${d.planned} · เปิดใช้ ${d.actual??'-'}`}</title></rect><text x={x(i)} y={H-8} textAnchor="middle" className={'axis'+(i===sel?' on':'')}>{shortDate(d.w)}</text></g>)}
  </svg>
 </section>;
}

function KindChart({tasks}:{tasks:Task[]}) {
 const data=KIND_KEYS.map(k=>{const items=tasks.filter(t=>(KINDS[t.kind]?t.kind:'')===k);return {k,label:KINDS[k]??'ไม่ระบุ',open:items.filter(t=>t.status!==4).length,done:items.filter(t=>t.status===4).length};}).filter(d=>d.k||d.open+d.done);
 const max=Math.max(1,...data.map(d=>d.open+d.done));
 const peak=data.reduce((a,d)=>d.open>a.open?d:a,data[0]);
 return <section className="dash-card dash-kinds">
  <header className="dash-card-head"><h2>ประเภทงาน</h2><div className="dash-legend"><span><b className="dot open"/>ค้าง</span><span><b className="dot done"/>เปิดใช้แล้ว</span></div></header>
  <div className="dash-bars">{data.map(d=><div className="dash-bar" key={d.k||'none'} title={`${d.label}: ค้าง ${d.open} · เปิดใช้แล้ว ${d.done}`}>
   {d===peak&&d.open>0&&<span className="dash-bar-tip">{d.open} ค้าง</span>}<div className="dash-bar-track"><i className="done" style={{height:d.done/max*100+'%'}}/><i className="open" style={{height:d.open/max*100+'%'}}/></div>
   <strong>{d.open+d.done}</strong><small>{d.label}</small>
  </div>)}</div>
 </section>;
}

function StatusDonut({counts}:{counts:{s:number;n:number}[]}) {
 const total=counts.reduce((a,c)=>a+c.n,0);const r=62,C=2*Math.PI*r,gap=total>1?6:0;
 let offset=0;
 const arcs=counts.filter(c=>c.n).map(c=>{const len=c.n/total*C;const arc={s:c.s,dash:Math.max(len-gap,1),offset};offset+=len;return arc;});
 return <section className="dash-card dash-donut">
  <header className="dash-card-head"><h2>สถานะงาน</h2><small>ทั้งหมด</small></header>
  <div className="dash-donut-body">
   <svg viewBox="0 0 180 180" role="img" aria-label={counts.map(c=>statuses[c.s]+' '+c.n).join(', ')}>
    <circle cx="90" cy="90" r={r} className="donut-track"/>
    {arcs.map(a=><circle key={a.s} cx="90" cy="90" r={r} fill="none" stroke={STATUS_COLOR[a.s]} strokeWidth="22" strokeLinecap="round" strokeDasharray={`${a.dash} ${C}`} strokeDashoffset={-a.offset} transform="rotate(-90 90 90)"><title>{statuses[a.s]} {counts.find(c=>c.s===a.s)!.n}</title></circle>)}
    <text x="90" y="88" textAnchor="middle" className="donut-total">{total}</text><text x="90" y="108" textAnchor="middle" className="donut-sub">งาน</text>
   </svg>
   <ul className="dash-donut-legend">{counts.map(c=><li key={c.s}><b style={{background:STATUS_COLOR[c.s]}}/>{statuses[c.s]}<strong>{c.n}</strong></li>)}</ul>
  </div>
 </section>;
}

// Week schedule: releases that happened and go-live dates planned in the selected week, by day.
function WeekSchedule({tasks,start,projectName,onOpen}:{tasks:Task[];start:string;projectName:(t:Task)=>string;onOpen:(t:Task)=>void}) {
 const days=Array.from({length:7},(_,i)=>addDays(start,i));
 const [pick,setPick]=useState<string|null>(null);
 const day=pick&&days.includes(pick)?pick:null;
 const items=days.flatMap(d=>[
  ...tasks.filter(t=>t.status===4&&releasedDay(t)===d).map(t=>({d,t,kind:'released' as const})),
  ...tasks.filter(t=>t.status!==4&&t.planned_go_live_on===d).map(t=>({d,t,kind:(d<today()?'late':'planned') as 'late'|'planned'})),
 ]);
 const shown=items.filter(i=>!day||i.d===day);
 const label={released:'เปิดใช้แล้ว',planned:'กำหนดเริ่มใช้',late:'เลยกำหนด'};
 return <aside className="dash-card dash-schedule">
  <header className="dash-card-head"><h2>ตารางสัปดาห์</h2><small>{shortDate(start)} – {shortDate(days[6])}</small></header>
  <div className="dash-days" role="group" aria-label="เลือกวัน">{days.map((d,i)=>{const n=items.filter(x=>x.d===d).length;return <button key={d} aria-pressed={day===d} className={d===today()?'today':''} onClick={()=>setPick(day===d?null:d)}><span>{DAY_NAMES[i]}</span><strong>{Number(d.slice(8))}</strong>{n>0&&<i/>}</button>;})}</div>
  <p className="dash-caption">{day?'แสดงเฉพาะ '+dateLabel(day)+' · แตะอีกครั้งเพื่อดูทั้งสัปดาห์':'รายการเปิดใช้จริงและวันกำหนดเริ่มใช้ในสัปดาห์นี้'}</p>
  <div className="dash-timeline">{shown.length?shown.map(({d,t,kind},i)=><div className="dash-slot" key={kind+t.id}>
   <span className="dash-slot-time">{i===0||shown[i-1].d!==d?shortDate(d):''}</span>
   <button className={'dash-event '+kind} onClick={()=>onOpen(t)}><span className="dash-event-kind">{label[kind]}</span><strong>{t.title}</strong><small>#{t.id} · {projectName(t)}{t.assignee?' · '+t.assignee:''}</small></button>
  </div>):<p className="dash-empty">ไม่มีรายการในช่วงนี้</p>}</div>
 </aside>;
}
