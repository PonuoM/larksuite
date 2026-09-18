import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,readdir,rm,mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {join} from 'node:path';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const root=fileURLToPath(new URL('../',import.meta.url));
await mkdir(join(root,'scratch'),{recursive:true});
const temp=await mkdtemp(join(root,'scratch','presentation-'));
try {
 execFileSync('node',['node_modules/typescript/bin/tsc','--ignoreConfig','src/vite-env.d.ts','src/FormattedReport.tsx','src/ProjectViews.tsx','src/MeetingCalendar.tsx','--jsx','react-jsx','--module','ESNext','--target','ES2022','--moduleResolution','bundler','--esModuleInterop','--skipLibCheck','--outDir',temp],{cwd:root,windowsHide:true});
 for(const name of await readdir(temp)){if(name.endsWith('.js')){const path=join(temp,name);const source=await readFile(path,'utf8');await writeFile(path,source.replace(/from '([.][^']+)'/g,"from '$1.js'"));}}
 const {default:FormattedReport}=await import(pathToFileURL(join(temp,'FormattedReport.js')));
 const html=renderToStaticMarkup(React.createElement(FormattedReport,{content:'# ประชุม\n- **ข้อสรุป**\n\n<script>alert(1)</script>\n\n| งาน | คน |\n| --- | --- |\n| ตรวจ | ทีม |'}));
 assert.ok(html.includes('<h3>ประชุม</h3>'));assert.ok(html.includes('<strong>ข้อสรุป</strong>'));assert.ok(html.includes('<table>'));assert.ok(!html.includes('<script>'));assert.ok(html.includes('&lt;script&gt;'));
 const listHtml=renderToStaticMarkup(React.createElement(FormattedReport,{content:'- หลัก\n  - ย่อย\n- [x] เสร็จ'}));
 assert.ok(listHtml.includes('<li class="depth-1">ย่อย</li>'));assert.ok(listHtml.includes('<li class="check">'));assert.ok(listHtml.includes('<li>หลัก</li>'));
 const {default:ProjectViews}=await import(pathToFileURL(join(temp,'ProjectViews.js')));
 const projects=[{id:1,name:'Mini ERP',description:'ข้อมูลจริง',role:'viewer'}];
 const report=renderToStaticMarkup(React.createElement(ProjectViews,{view:'report',projects,tasks:[],projectId:0,onProject:()=>{},onOpen:()=>{}}));
 assert.ok(report.includes('Mini ERP'));assert.ok(report.includes('ไม่มีรายการในช่วงนี้'));
 const {default:MeetingCalendar}=await import(pathToFileURL(join(temp,'MeetingCalendar.js')));
 const calendar=renderToStaticMarkup(React.createElement(MeetingCalendar,{projects,tasks:[],projectId:0,onProject:()=>{},onTask:()=>{}}));
 assert.ok(calendar.includes('ปฏิทินรายเดือน'));assert.ok(!calendar.includes('+ บันทึกประชุม'));
 console.log('Presentation: report sections, safe HTML escaping, empty report and viewer calendar passed');
} finally { await rm(temp,{recursive:true,force:true}); }
