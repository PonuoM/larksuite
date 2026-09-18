-- Two new board columns (owner decision 2026-09-18): 5 = รอตัดสินใจ (waiting for a decision, before work starts)
-- and 6 = รออนุมัติ (waiting for approval, after testing and before release). Codes are appended so existing
-- 0–4 rows keep their meaning; the board orders columns by workflow, not by code.
-- Approval is a per-person right (e.g. the CEO), independent of project role, so a view-only link can approve.
ALTER TABLE principals ADD COLUMN can_approve TINYINT NOT NULL DEFAULT 0 AFTER is_admin;
ALTER TABLE tasks
 ADD COLUMN approved_by BIGINT UNSIGNED NULL AFTER actual_released_at,
 ADD COLUMN approved_at DATETIME NULL AFTER approved_by,
 ADD CONSTRAINT fk_tasks_approved_by FOREIGN KEY(approved_by) REFERENCES principals(id);
