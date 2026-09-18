-- Permanent links can be shown to admins again (owner decision 2026-09-18).
-- The token is stored AES-256-GCM encrypted with LINK_KEY from the server .env; token_hash stays the lookup key.
-- One-time links and links created before this migration keep token_cipher NULL (shown once, as before).
ALTER TABLE invitations ADD COLUMN token_cipher VARCHAR(255) NULL AFTER token_hash;
