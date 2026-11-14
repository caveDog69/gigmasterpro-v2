<?php
declare(strict_types=1);

require __DIR__ . '/lib/bootstrap.php';
require __DIR__ . '/lib/migrate.php';
require __DIR__ . '/lib/auth.php';
require __DIR__ . '/lib/router.php';
require __DIR__ . '/lib/access.php';
require __DIR__ . '/lib/geo.php';
require __DIR__ . '/lib/songs.php';

set_error_handler(static function (int $severity, string $message, string $file, int $line): bool {
    if (!(error_reporting() & $severity)) {
        return false;
    }
    throw new ErrorException($message, 0, $severity, $file, $line);
});
ini_set('display_errors', '0');

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$corsOrigin = (string) config('cors_origin', '');
if ($corsOrigin !== '' && ($_SERVER['HTTP_ORIGIN'] ?? '') === $corsOrigin) {
    header('Access-Control-Allow-Origin: ' . $corsOrigin);
    header('Vary: Origin');
    header('Access-Control-Allow-Headers: Authorization, Content-Type');
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
    header('Access-Control-Max-Age: 600');
}
if ($method === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$uri = (string) parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
$pos = strpos($uri, '/api/');
$path = $pos === false ? '/' : substr($uri, $pos + 4);
$path = '/' . trim($path, '/');

try {
    $router = new Router();
    foreach (glob(__DIR__ . '/routes/*.php') as $routeFile) {
        (require $routeFile)($router);
    }
    if ($path !== '/health') {
        run_migrations();
    }
    $router->dispatch($method, $path);
} catch (HttpError $e) {
    json_response(array_filter(['error' => $e->getMessage()] + $e->extra, static fn ($v) => $v !== null), $e->status);
} catch (Throwable $e) {
    error_log('[GigMasterPro] ' . $e->getMessage() . ' in ' . $e->getFile() . ':' . $e->getLine());
    $payload = ['error' => 'Something went wrong on the server.'];
    if (config('debug')) {
        $payload['detail'] = $e->getMessage() . ' (' . basename($e->getFile()) . ':' . $e->getLine() . ')';
    }
    json_response($payload, 500);
}
