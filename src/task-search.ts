// Board search: text in title/summary/feature, or a task number. Pure so it can be tested without a browser.
type TaskLike = { id: number; title: string; public_summary: string; feature?: string | null };

// "#105" / "#0105" searches the number only; a bare "105" also matches text such as "100 ต้น".
export function taskNumber(query: string): { id: number; only: boolean } | null {
  const m = query.trim().match(/^(#?)0*(\d+)$/);
  return m ? { id: Number(m[2]), only: m[1] === '#' } : null;
}

export function matchesQuery(task: TaskLike, query: string): boolean {
  const q = query.trim();
  if (!q) return true;
  const num = taskNumber(q);
  if (num && task.id === num.id) return true;
  if (num?.only) return false;
  return `${task.title} ${task.public_summary} ${task.feature ?? ''}`.toLowerCase().includes(q.toLowerCase());
}

// A task found by its number is shown even when it would otherwise be hidden (e.g. released long ago).
export function isNumberHit(task: TaskLike, query: string): boolean {
  return taskNumber(query)?.id === task.id;
}
