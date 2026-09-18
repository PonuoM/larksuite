<?php
// Makes an existing permanent link viewable again in the Access page (links created before migration 005).
// The link is read from STDIN so the token never appears in the process list or shell history:
//
//   php scripts/seal-link.php < file-with-link.txt
//   (production, the image has no scripts/) docker cp it to workboard-app:/var/www/html/scripts/, run it with
//   docker exec -i workboard-app php /var/www/html/scripts/seal-link.php < link.txt, then remove the copy
//
// Only stores it when the token matches an open, reusable invitation; prints the invitation id and member.
declare(strict_types=1);
if (PHP_SAPI !== 'cli') exit(1);
require dirname(__DIR__) . '/api/bootstrap.php';
$input = trim((string) stream_get_contents(STDIN));
if (!preg_match('/([a-f0-9]{64})\s*$/', $input, $m)) {fwrite(STDERR, "no 64-hex token found on STDIN\n"); exit(2);}
if (!linkKey()) {fwrite(STDERR, "LINK_KEY is missing or not 64 hex chars in .env\n"); exit(2);}
$row = query('SELECT i.id,p.label FROM invitations i JOIN principals p ON p.id=i.principal_id WHERE i.token_hash=? AND i.reusable=1 AND i.revoked_at IS NULL AND p.revoked_at IS NULL', [hash('sha256', $m[1])])->fetch();
if (!$row) {fwrite(STDERR, "no open permanent link matches this token\n"); exit(1);}
query('UPDATE invitations SET token_cipher=? WHERE id=?', [sealToken($m[1]), $row['id']]);
echo "stored: invitation {$row['id']} ({$row['label']})\n";
