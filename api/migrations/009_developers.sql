-- Developer names (owner request 2026-09-19): admins keep the list under ตั้งค่า → นักพัฒนา, and each task
-- records who is developing it (zero, one or several people). Tasks store the ids as a JSON array so a rename
-- shows everywhere at once. A developer is deactivated, never deleted, so old tasks keep their name.
CREATE TABLE developers (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  active TINYINT NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_developers_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
ALTER TABLE tasks ADD COLUMN developer_ids VARCHAR(1000) NOT NULL DEFAULT '[]' AFTER assignee;
