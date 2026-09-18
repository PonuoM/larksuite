export type Role = 'admin' | 'editor' | 'viewer';

export type SessionUser = {
  id: number;
  label: string;
  is_admin: boolean;
};

export type Project = {
  id: number;
  name: string;
  description: string;
  role: Role;
};

export type ChecklistItem = { label: string; done: boolean };

export type Task = {
  id: number;
  project_id: number;
  title: string;
  public_summary: string;
  status: number;
  planned_go_live_on: string;
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
};

export type TaskEvent = {
  id: number;
  action: string;
  payload: string;
  created_at: string;
  actor: string;
};

export type AccessRow = {
  id: number;
  label: string;
  is_admin: number;
  revoked_at: string | null;
  expires_at: string | null;
  consumed_at: string | null;
  invitation_revoked: string | null;
  project_id: number | null;
  role: Role | null;
  project_name: string | null;
};
