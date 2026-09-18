export type Block = { kind: 'heading' | 'paragraph' | 'list' | 'quote' | 'table' | 'code'; lines: string[] };
// Only reorganize presentation. Preserve words and never execute HTML from pasted summaries.
export function formatReport(source: string): Block[] {
 const lines = source.replace(/\r\n?/g, '\n').split('\n');
 const blocks: Block[] = [];
 let code = false;
 for (const raw of lines) {
  const line = raw.trim();
  if (line.startsWith('```')) { code = !code; if(code) blocks.push({kind:'code',lines:[]}); continue; }
  if(code) { blocks[blocks.length-1].lines.push(raw); continue; }
  if(!line || /^[-*_]{3,}$/.test(line)) { if(blocks.at(-1)?.lines.at(-1)!=='') blocks.push({kind:'paragraph',lines:['']}); continue; }
  const heading = line.match(/^#{1,6}\s+(.+)$/) || line.match(/^\*\*(.+?)\*\*:?$/);
  const plainHeading = line.length < 100 && /[:：]$/.test(line) && !/^[-*+>]/.test(line);
  if(heading || plainHeading) { blocks.push({kind:'heading',lines:[heading ? heading[1] : line.replace(/[:：]$/, '')]}); continue; }
  if(/^\|?[ :|-]+\|[ :|-]+\|?$/.test(line)) continue;
  const kind: Block['kind'] = /^[-*+]\s+|^\d+[.)]\s+/.test(line) ? 'list' : line.startsWith('>') ? 'quote' : line.includes('|') && (line.startsWith('|') || line.endsWith('|')) ? 'table' : 'paragraph';
  const previous = blocks.at(-1);
  if(previous?.kind === kind && previous.lines[0] !== '') previous.lines.push(line);
  else blocks.push({kind,lines:[line]});
 }
 return blocks.filter(b=>b.lines.some(line=>line.trim()));
}
