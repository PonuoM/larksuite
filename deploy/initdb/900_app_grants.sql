-- The application account only reads and writes rows; schema changes use the root account.
REVOKE ALL PRIVILEGES, GRANT OPTION FROM 'workboard_app'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE ON workboard.* TO 'workboard_app'@'%';
FLUSH PRIVILEGES;
