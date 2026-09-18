-- Reusable (permanent) invitation links that stay valid until an admin closes them.
-- Sessions remember the link they came from so closing a link ends those sessions.
ALTER TABLE invitations
 ADD COLUMN reusable TINYINT NOT NULL DEFAULT 0 AFTER token_hash,
 ADD COLUMN last_used_at DATETIME NULL AFTER consumed_at,
 MODIFY expires_at DATETIME NULL;
ALTER TABLE access_sessions
 ADD COLUMN invitation_id BIGINT UNSIGNED NULL AFTER principal_id,
 ADD CONSTRAINT fk_access_sessions_invitation FOREIGN KEY(invitation_id) REFERENCES invitations(id);
