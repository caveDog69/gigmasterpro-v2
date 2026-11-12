<?php
declare(strict_types=1);

date_default_timezone_set('UTC');
mb_internal_encoding('UTF-8');

final class HttpError extends Exception
{
    public int $status;
    public array $extra;

    public function __construct(int $status, string $message, array $extra = [])
    {
        parent::__construct($message);
        $this->status = $status;
        $this->extra = $extra;
    }
}

function config(?string $key = null, $default = null)
{
    static $config = null;
    if ($config === null) {
        $file = dirname(__DIR__) . '/config.php';
        $config = is_file($file) ? (array) require $file : [];
        $envMap = [
            'db_host' => 'GMP_DB_HOST', 'db_port' => 'GMP_DB_PORT', 'db_name' => 'GMP_DB_NAME',
            'db_user' => 'GMP_DB_USER', 'db_pass' => 'GMP_DB_PASS', 'app_url' => 'GMP_APP_URL',
            'mail_from' => 'GMP_MAIL_FROM', 'debug' => 'GMP_DEBUG', 'mail_log' => 'GMP_MAIL_LOG',
        ];
        foreach ($envMap as $k => $env) {
            $v = getenv($env);
            if ($v !== false && !array_key_exists($k, $config)) {
                $config[$k] = $v;
            }
        }
    }
    if ($key === null) {
        return $config;
    }
    return array_key_exists($key, $config) && $config[$key] !== '' ? $config[$key] : $default;
}

function is_configured(): bool
{
    return config('db_name') !== null && config('db_user') !== null;
}

function db(): PDO
{
    static $pdo = null;
    if ($pdo === null) {
        if (!is_configured()) {
            throw new HttpError(503, 'The API is not configured yet: database credentials are missing.', ['setup' => true]);
        }
        $dsn = sprintf(
            'mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4',
            config('db_host', 'localhost'),
            (int) config('db_port', 3306),
            config('db_name')
        );
        try {
            $pdo = new PDO($dsn, (string) config('db_user'), (string) config('db_pass', ''), [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
                PDO::ATTR_STRINGIFY_FETCHES => false,
            ]);
        } catch (PDOException $e) {
            throw new HttpError(503, 'Could not connect to the database. Check the DB_* settings.', [
                'setup' => true,
                'detail' => config('debug') ? $e->getMessage() : null,
            ]);
        }
        $pdo->exec("SET time_zone = '+00:00'");
    }
    return $pdo;
}

function q(string $sql, array $params = []): PDOStatement
{
    $stmt = db()->prepare($sql);
    $stmt->execute($params);
    return $stmt;
}

function q_one(string $sql, array $params = []): ?array
{
    $row = q($sql, $params)->fetch();
    return $row === false ? null : $row;
}

function q_all(string $sql, array $params = []): array
{
    return q($sql, $params)->fetchAll();
}

function q_val(string $sql, array $params = [])
{
    $v = q($sql, $params)->fetchColumn();
    return $v === false ? null : $v;
}

function in_placeholders(array $values): string
{
    return implode(',', array_fill(0, max(1, count($values)), '?'));
}

function now_sql(): string
{
    return gmdate('Y-m-d H:i:s');
}

const BOOL_FIELDS = ['is_public', 'is_original', 'is_read', 'can_edit'];
const JSON_FIELDS = ['instruments', 'visible_fields'];
const DATETIME_FIELDS = ['date_time', 'load_in_time', 'created_at', 'updated_at', 'last_message_at', 'joined_at', 'email_verified_at', 'expires_at'];
const NUMERIC_FIELDS = ['payment', 'latitude', 'longitude', 'distance_miles'];

/** Normalises DB rows for JSON output: ISO UTC datetimes, booleans, decoded JSON, numbers. */
function out_row(?array $row): ?array
{
    if ($row === null) {
        return null;
    }
    foreach ($row as $k => $v) {
        if ($v === null) {
            continue;
        }
        if (in_array($k, BOOL_FIELDS, true)) {
            $row[$k] = (bool) $v;
        } elseif (in_array($k, JSON_FIELDS, true) && is_string($v)) {
            $decoded = json_decode($v, true);
            $row[$k] = $decoded === null ? [] : $decoded;
        } elseif (in_array($k, DATETIME_FIELDS, true) && is_string($v) && preg_match('/^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/', $v)) {
            $row[$k] = str_replace(' ', 'T', $v) . 'Z';
        } elseif (in_array($k, NUMERIC_FIELDS, true)) {
            $row[$k] = (float) $v;
        }
    }
    return $row;
}

function out_rows(array $rows): array
{
    return array_map('out_row', $rows);
}

function json_response($data, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
}

function body(): array
{
    static $body = null;
    if ($body === null) {
        $raw = file_get_contents('php://input') ?: '';
        $ct = $_SERVER['CONTENT_TYPE'] ?? '';
        if (stripos($ct, 'application/json') !== false) {
            $body = $raw === '' ? [] : json_decode($raw, true);
            if (!is_array($body)) {
                throw new HttpError(400, 'Invalid JSON body.');
            }
        } else {
            $body = $_POST;
        }
    }
    return $body;
}

function input(string $key, $default = null)
{
    $b = body();
    return array_key_exists($key, $b) ? $b[$key] : $default;
}

function query_param(string $key, $default = null)
{
    return isset($_GET[$key]) && $_GET[$key] !== '' ? $_GET[$key] : $default;
}

function str_input(array $src, string $key, int $max, string $default = ''): string
{
    $v = $src[$key] ?? $default;
    if ($v === null) {
        return $default;
    }
    if (!is_scalar($v)) {
        throw new HttpError(422, "Invalid value for {$key}.");
    }
    $v = trim((string) $v);
    if (mb_strlen($v) > $max) {
        throw new HttpError(422, "{$key} must be at most {$max} characters.");
    }
    return $v;
}

function nullable_str(array $src, string $key, int $max): ?string
{
    $v = str_input($src, $key, $max);
    return $v === '' ? null : $v;
}

function int_input(array $src, string $key, int $default, int $min, int $max): int
{
    $v = $src[$key] ?? null;
    if ($v === null || $v === '') {
        return $default;
    }
    if (!is_numeric($v)) {
        throw new HttpError(422, "{$key} must be a number.");
    }
    return max($min, min($max, (int) $v));
}

function bool_input(array $src, string $key, bool $default = false): bool
{
    if (!array_key_exists($key, $src)) {
        return $default;
    }
    return filter_var($src[$key], FILTER_VALIDATE_BOOLEAN);
}

/** Accepts ISO 8601 (any offset) and returns a UTC 'Y-m-d H:i:s' string. */
function datetime_input(array $src, string $key, bool $required = false): ?string
{
    $v = $src[$key] ?? null;
    if ($v === null || $v === '') {
        if ($required) {
            throw new HttpError(422, "{$key} is required.");
        }
        return null;
    }
    try {
        $dt = new DateTimeImmutable((string) $v);
    } catch (Exception $e) {
        throw new HttpError(422, "{$key} is not a valid date/time.");
    }
    return $dt->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s');
}

function date_input(array $src, string $key): ?string
{
    $v = $src[$key] ?? null;
    if ($v === null || $v === '') {
        return null;
    }
    $v = substr((string) $v, 0, 10);
    $d = DateTimeImmutable::createFromFormat('!Y-m-d', $v);
    return $d ? $d->format('Y-m-d') : null;
}

function require_fields(array $src, array $keys): void
{
    foreach ($keys as $k) {
        if (!isset($src[$k]) || trim((string) $src[$k]) === '') {
            throw new HttpError(422, "{$k} is required.");
        }
    }
}

function client_ip(): string
{
    return substr((string) ($_SERVER['REMOTE_ADDR'] ?? '0.0.0.0'), 0, 45);
}

/** Path prefix where the site is deployed, e.g. '' or '/dev'. */
function base_path(): string
{
    $script = str_replace('\\', '/', $_SERVER['SCRIPT_NAME'] ?? '/api/index.php');
    $base = rtrim(dirname(dirname($script)), '/');
    return $base === '.' ? '' : $base;
}

function app_url(): string
{
    $configured = config('app_url');
    if ($configured) {
        return rtrim((string) $configured, '/');
    }
    $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
    $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
    return ($https ? 'https' : 'http') . '://' . $host . base_path();
}

function public_url(?string $relative): ?string
{
    if (!$relative) {
        return $relative;
    }
    if (preg_match('#^https?://#', $relative)) {
        return $relative;
    }
    return base_path() . '/' . ltrim($relative, '/');
}

function normalize_text(?string $s): string
{
    $s = (string) $s;
    if (function_exists('iconv')) {
        $t = @iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $s);
        if ($t !== false) {
            $s = $t;
        }
    }
    $s = strtolower($s);
    $s = str_replace('&', ' and ', $s);
    $s = preg_replace('/\((?:[^)]*(?:remaster|live|version|edit|mix|mono|stereo|feat)[^)]*)\)|\[[^\]]*\]/', ' ', $s);
    $s = preg_replace('/[^a-z0-9]+/', ' ', $s);
    $s = preg_replace('/^the /', '', trim($s));
    return substr(trim(preg_replace('/\s+/', ' ', $s)), 0, 191);
}

function random_token(int $bytes = 32): string
{
    return bin2hex(random_bytes($bytes));
}

function notify(int $userId, string $type, string $title, string $body = '', string $link = '', ?int $actorId = null): void
{
    q(
        'INSERT INTO notifications (user_id, actor_id, type, title, body, link) VALUES (?,?,?,?,?,?)',
        [$userId, $actorId, $type, mb_substr($title, 0, 191), mb_substr($body, 0, 500), $link]
    );
}

function send_mail(string $to, string $subject, string $text): bool
{
    $from = (string) config('mail_from', 'no-reply@' . preg_replace('/^www\./', '', $_SERVER['HTTP_HOST'] ?? 'localhost'));
    $log = config('mail_log');
    if ($log) {
        @file_put_contents((string) $log, "To: {$to}\nSubject: {$subject}\n\n{$text}\n-----\n", FILE_APPEND);
    }
    $headers = [
        'From: GigMasterPro <' . $from . '>',
        'Reply-To: ' . $from,
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=UTF-8',
    ];
    return @mail($to, '=?UTF-8?B?' . base64_encode($subject) . '?=', $text, implode("\r\n", $headers), '-f' . $from);
}

function http_get_json(string $url, int $timeoutSeconds = 5): ?array
{
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => $timeoutSeconds,
            CURLOPT_CONNECTTIMEOUT => $timeoutSeconds,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_USERAGENT => 'GigMasterPro/2.0 (+https://github.com/caveDog69/gigmasterpro-v2)',
        ]);
        $res = curl_exec($ch);
        $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        if ($res === false || $code >= 400) {
            return null;
        }
    } else {
        $ctx = stream_context_create(['http' => ['timeout' => $timeoutSeconds, 'user_agent' => 'GigMasterPro/2.0']]);
        $res = @file_get_contents($url, false, $ctx);
        if ($res === false) {
            return null;
        }
    }
    $data = json_decode((string) $res, true);
    return is_array($data) ? $data : null;
}
