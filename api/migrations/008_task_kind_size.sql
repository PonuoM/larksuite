-- Work type and rough size (owner request 2026-09-19): outside viewers should see at a glance whether a card is a
-- bug fix or a new feature and roughly how long it may take. Both are optional; '' = not specified yet.
-- kind: bug (แก้บั๊ก) · feature (ฟีเจอร์ใหม่) · improve (ปรับปรุง) · data (แก้ข้อมูล)
-- size: S (เล็ก ~1 วัน) · M (กลาง 2–5 วัน) · L (ใหญ่ 1 สัปดาห์ขึ้นไป)
ALTER TABLE tasks
  ADD COLUMN kind VARCHAR(16) NOT NULL DEFAULT '' AFTER feature,
  ADD COLUMN size CHAR(1) NOT NULL DEFAULT '' AFTER kind;
