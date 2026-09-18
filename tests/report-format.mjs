import assert from 'node:assert/strict';
import { mkdtemp, rm, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
await mkdir(new URL('../scratch/',import.meta.url),{recursive:true});
const temp=await mkdtemp(new URL('../scratch/format-',import.meta.url));
let formatReport;
try {
 execFileSync('node',['node_modules/typescript/bin/tsc','--ignoreConfig','src/report-format.ts','--target','ES2022','--module','ES2022','--outDir',temp],{cwd:fileURLToPath(new URL('../',import.meta.url)),windowsHide:true});
 ({formatReport}=await import(new URL('file:///'+temp.replaceAll('\\','/')+'/report-format.js')));
} finally { await rm(temp,{recursive:true,force:true}); }
const blocks=formatReport('# สรุป\n\n## ข้อตกลง\n- คงข้อความเดิม\n- [x] ตรวจแล้ว\n\n| งาน | คน |\n| --- | --- |\n| ทดสอบ | ทีม |');
assert.deepEqual(blocks.map(b=>b.kind),['heading','heading','list','table']);
assert.equal(blocks[2].lines[0],'- คงข้อความเดิม');
assert.equal(blocks[3].lines.length,2);
assert.deepEqual(formatReport('บันทึกทั่วไป\nอีกบรรทัด')[0].lines,['บันทึกทั่วไป','อีกบรรทัด']);
assert.equal(formatReport('<script>alert(1)</script>')[0].lines[0],'<script>alert(1)</script>');
assert.equal(formatReport('**งานติดตาม**\n1. งานแรก')[0].kind,'heading');
assert.equal(formatReport('')[0],undefined);
const nested=formatReport('- หลัก\n  - ย่อย\n\t- ย่อยแท็บ\n- [ ] ต้องทำ');
assert.equal(nested.length,1);
assert.deepEqual(nested[0].lines,['- หลัก','  - ย่อย','  - ย่อยแท็บ','- [ ] ต้องทำ']);
console.log('Report format: headings, lists, tables, raw text preservation passed');
