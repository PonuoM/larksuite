export type Role = 'admin' | 'editor' | 'viewer';

export type SessionUser = {
  id: number;
  label: string;
  is_admin: boolean;
  can_approve: boolean;
};

export type Project = {
  id: number;
  name: string;
  description: string;
  role: Role;
};

// Sub-task. Viewers receive only id/label/done. id is assigned by the server (legacy items get "i0", "i1", …).
export type ChecklistItem = { id?: string; label: string; done: boolean; note?: string; done_at?: string | null };

export type Task = {
  id: number;
  project_id: number;
  title: string;
  public_summary: string;
  status: number;
  planned_go_live_on: string | null;
  actual_released_at: string | null;
  updated_at: string;
  version: number;
  feature?: string;
  scope?: string;
  criteria?: string;
  evidence?: string;
  assignee?: string;
  blocked_reason?: string;
  checklist?: ChecklistItem[];
  archived?: number;
  // Present only in a write response when the change was saved but the Lark notice failed.
  lark_warning?: string;
  approved_at?: string | null;
};

export type TaskEvent = {
  id: number;
  action: string;
  payload: string;
  created_at: string;
  actor: string;
};

export type AccessLink = {
  id: number;
  reusable: boolean;
  viewable: boolean;
  expires_at: string | null;
  consumed_at: string | null;
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string;
  current: boolean;
};

export type AccessMember = {
  id: number;
  label: string;
  is_admin: boolean;
  can_approve: boolean;
  revoked_at: string | null;
  created_at: string;
  projects: { project_id: number; project_name: string; role: Role }[];
  links: AccessLink[];
};

export type Meeting = { id: number; project_id: number; title: string; meeting_on: string; participants?: string; content?: string; published: boolean; version: number; updated_at: string };

export type LarkTarget = { key: 'main' | 'test'; label: string };
