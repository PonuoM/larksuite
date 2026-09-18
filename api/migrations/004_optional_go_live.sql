-- Planned go-live date becomes optional (owner decision 2026-09-18): work imported from the
-- earlier Lark boards has no agreed date, and a made-up date would show as a fake deadline.
-- The UI shows "ยังไม่กำหนดวันเริ่มใช้" and such tasks are never overdue.
ALTER TABLE tasks MODIFY planned_go_live_on DATE NULL;
