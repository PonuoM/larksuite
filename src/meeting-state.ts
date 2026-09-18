// Calendar meeting state (kept free of React so tests/meeting-state.mjs can check it).
// Writes are applied from the API response right away; reloads only refresh what they managed to fetch and
// never undo a write made after the reload started.
export type MeetingLike = { id: number; project_id: number; meeting_on: string };
export type LoadJob = { project: number; month: string };
export type LocalChange<M> = { seq: number; id: number; meeting: M | null };

export function upsertMeeting<M extends MeetingLike>(list: M[], meeting: M): M[] {
  return [...list.filter((m) => m.id !== meeting.id), meeting];
}

export function removeMeeting<M extends MeetingLike>(list: M[], id: number): M[] {
  return list.filter((m) => m.id !== id);
}

// Rebuilds the list after a reload of `jobs` (one per project+month). A failed job keeps what was already shown
// for that project+month; writes with seq > startSeq happened while the reload was in flight and win.
export function mergeLoaded<M extends MeetingLike>(previous: M[], jobs: LoadJob[], results: (M[] | null)[], changes: LocalChange<M>[], startSeq: number): M[] {
  const failed = jobs.filter((_, i) => results[i] === null);
  let list = [
    ...results.flatMap((r) => r ?? []),
    ...previous.filter((m) => failed.some((f) => f.project === m.project_id && m.meeting_on.startsWith(f.month))),
  ];
  for (const c of changes) if (c.seq > startSeq) list = c.meeting ? upsertMeeting(list, c.meeting) : removeMeeting(list, c.id);
  return list;
}
