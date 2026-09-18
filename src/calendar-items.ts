// Decides which calendar day each meeting and task lands on. Pure functions so they can be tested without a browser.
type TaskLike = { id: number; project_id: number; title: string; status: number; planned_go_live_on: string; actual_released_at: string | null };
type MeetingLike = { id: number; project_id: number; title: string; meeting_on: string };

export type CalendarFilters = { meetings: boolean; pending: boolean; released: boolean; hiddenProjects: number[] };
export type CalendarItem<T extends TaskLike = TaskLike, M extends MeetingLike = MeetingLike> = {
  key: string;
  kind: 'meeting' | 'pending' | 'released';
  project_id: number;
  title: string;
  overdue: boolean;
  task?: T;
  meeting?: M;
};

const bangkok = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' });

// Release timestamps are stored in UTC; the calendar shows Thai calendar days.
export function bangkokDate(utc: string): string {
  return bangkok.format(new Date(utc.replace(' ', 'T') + 'Z'));
}

export function calendarItems<T extends TaskLike, M extends MeetingLike>(tasks: T[], meetings: M[], filters: CalendarFilters, today: string): Map<string, CalendarItem<T, M>[]> {
  const byDay = new Map<string, CalendarItem<T, M>[]>();
  const add = (day: string, item: CalendarItem<T, M>) => { if (!byDay.has(day)) byDay.set(day, []); byDay.get(day)!.push(item); };
  const hidden = new Set(filters.hiddenProjects);
  if (filters.meetings) for (const m of meetings) if (!hidden.has(m.project_id)) add(m.meeting_on, { key: 'm' + m.id, kind: 'meeting', project_id: m.project_id, title: m.title, overdue: false, meeting: m });
  for (const t of tasks) {
    if (hidden.has(t.project_id)) continue;
    const released = t.status === 4;
    if (released ? !filters.released : !filters.pending) continue;
    const day = released && t.actual_released_at ? bangkokDate(t.actual_released_at) : t.planned_go_live_on;
    add(day, { key: 't' + t.id, kind: released ? 'released' : 'pending', project_id: t.project_id, title: t.title, overdue: !released && t.planned_go_live_on < today, task: t });
  }
  const order = { meeting: 0, pending: 1, released: 2 };
  for (const list of byDay.values()) list.sort((a, b) => order[a.kind] - order[b.kind] || a.title.localeCompare(b.title, 'th'));
  return byDay;
}

function ymd(d: Date) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }

// Six Monday-first weeks covering the month, so the grid height never jumps between months.
export function weekRows(month: string): string[][] {
  const first = new Date(month + '-01T12:00:00');
  const start = new Date(first); start.setDate(1 - (first.getDay() + 6) % 7);
  return Array.from({ length: 6 }, (_, w) => Array.from({ length: 7 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + w * 7 + i); return ymd(d); }));
}

export function weekOf(day: string): string[] {
  const d = new Date(day + 'T12:00:00'); d.setDate(d.getDate() - (d.getDay() + 6) % 7);
  return Array.from({ length: 7 }, (_, i) => { const x = new Date(d); x.setDate(d.getDate() + i); return ymd(x); });
}

export function monthsBetween(from: string, to: string): string[] {
  const out: string[] = [];
  const d = new Date(from.slice(0, 7) + '-01T12:00:00');
  while (ymd(d).slice(0, 7) <= to.slice(0, 7) && out.length < 24) { out.push(ymd(d).slice(0, 7)); d.setMonth(d.getMonth() + 1); }
  return out;
}

export function shiftDay(day: string, days: number): string { const d = new Date(day + 'T12:00:00'); d.setDate(d.getDate() + days); return ymd(d); }
