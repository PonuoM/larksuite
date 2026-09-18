import React from 'react';
import { formatReport } from './report-format';
function inline(text: string): React.ReactNode[] {
 return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part,i)=>part.startsWith('**')&&part.endsWith('**') ? <strong key={i}>{part.slice(2,-2)}</strong> : part.startsWith('`')&&part.endsWith('`') ? <code key={i}>{part.slice(1,-1)}</code> : part);
}
export default function FormattedReport({ content }: { content: string }) {
 return <div className="formatted-report">{formatReport(content).map((block,i)=> {
  if(block.kind==='heading')return <h3 key={i}>{inline(block.lines[0])}</h3>;
  if(block.kind==='code')return <pre key={i}>{block.lines.join('\n')}</pre>;
  if(block.kind==='quote')return <blockquote key={i}>{block.lines.map((line,j)=><p key={j}>{inline(line.replace(/^>\s?/,''))}</p>)}</blockquote>;
  if(block.kind==='list')return <ul key={i}>{block.lines.map((line,j)=> { const text=line.replace(/^[-*+]\s+|^\d+[.)]\s+/,''); const check=text.match(/^\[([ xX])\]\s*(.*)/); return <li key={j}>{check ? <><span aria-label={check[1]===' '?'ยังไม่เสร็จ':'เสร็จแล้ว'}>{check[1]===' '?'☐':'☑'}</span> {inline(check[2])}</> : inline(text)}</li>; })}</ul>;
  if(block.kind==='table')return <div className="report-table-wrap" key={i}><table><tbody>{block.lines.map((line,j)=><tr key={j}>{line.replace(/^\||\|$/g,'').split('|').map((cell,k)=>j===0?<th key={k}>{inline(cell.trim())}</th>:<td key={k}>{inline(cell.trim())}</td>)}</tr>)}</tbody></table></div>;
  return <p key={i}>{block.lines.map((line,j)=><React.Fragment key={j}>{j>0&&<br/>}{inline(line)}</React.Fragment>)}</p>;
 })}</div>;
}
