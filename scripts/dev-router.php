<?php
// Router for PHP's built-in server in local development only:
//   php -S 127.0.0.1:8095 scripts/dev-router.php
// Vite (`npm run dev`, http://localhost:5173/Workboard/) proxies /Workboard/api/* here.
// Only the API is served — the same rule .htaccess enforces on Apache; everything else is 403.
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$config = parse_ini_file(dirname(__DIR__) . '/.env', false, INI_SCANNER_RAW) ?: [];
$prefix = rtrim($config['APP_BASE'] ?? '/Workboard', '/') . '/api/v1';
if ($path === $prefix || strncmp($path, $prefix . '/', strlen($prefix) + 1) === 0) {
    require dirname(__DIR__) . '/public/api/index.php';
    return true;
}
http_response_code(403);
header('Content-Type: text/plain; charset=utf-8');
echo "dev-router: only {$prefix}/* is served here; open the app through Vite on :5173";
return true;
