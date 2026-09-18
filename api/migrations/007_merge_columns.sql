-- Five columns instead of seven (owner decision 2026-09-18, cards were too narrow):
-- รอตัดสินใจ (5) merges into รอดำเนินการ (0) — what is still undecided stays in blocked_reason;
-- รอทดสอบ (2) merges into รอทดสอบ/เปิดใช้ (3). Codes 2 and 5 are retired: the API no longer accepts them,
-- and task history keeps showing their old names.
UPDATE tasks SET status = 0, version = version + 1, updated_at = UTC_TIMESTAMP() WHERE status = 5;
UPDATE tasks SET status = 3, version = version + 1, updated_at = UTC_TIMESTAMP() WHERE status = 2;
