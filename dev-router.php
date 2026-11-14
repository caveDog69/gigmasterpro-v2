<?php
// Local development router: php -S localhost:8080 dev-router.php
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
if (strpos($path, '/api/') === 0 || $path === '/api') {
    $_SERVER['SCRIPT_NAME'] = '/api/index.php';
    chdir(__DIR__ . '/api');
    require __DIR__ . '/api/index.php';
    return true;
}
if (strpos($path, '/uploads/') === 0 && is_file(__DIR__ . $path)) {
    return false;
}
http_response_code(404);
echo 'Not found';
return true;
