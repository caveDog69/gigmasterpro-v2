<?php
declare(strict_types=1);

const TOKEN_TTL_DAYS = 30;

function bearer_token(): ?string
{
    $header = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
    if ($header === '' && function_exists('apache_request_headers')) {
        foreach (apache_request_headers() as $k => $v) {
            if (strcasecmp($k, 'Authorization') === 0) {
                $header = $v;
            }
        }
    }
    if ($header === '' && !empty($_SERVER['HTTP_X_AUTH_TOKEN'])) {
        return (string) $_SERVER['HTTP_X_AUTH_TOKEN'];
    }
    return preg_match('/^Bearer\s+([a-f0-9]{64})$/i', trim((string) $header), $m) ? strtolower($m[1]) : null;
}

/** Returns the authenticated user row or null. Sliding expiry: refreshed at most once per hour. */
function current_user(): ?array
{
    static $resolved = false;
    static $user = null;
    if ($resolved) {
        return $user;
    }
    $resolved = true;
    $token = bearer_token();
    if ($token === null) {
        return null;
    }
    $row = q_one(
        'SELECT t.id AS token_id, t.last_used_at, u.id, u.email, u.email_verified_at, u.created_at
         FROM auth_tokens t JOIN users u ON u.id = t.user_id
         WHERE t.token_hash = ? AND t.expires_at > UTC_TIMESTAMP()',
        [hash('sha256', $token)]
    );
    if (!$row) {
        return null;
    }
    if (strtotime($row['last_used_at'] . ' UTC') < time() - 3600) {
        q(
            'UPDATE auth_tokens SET last_used_at = UTC_TIMESTAMP(), expires_at = UTC_TIMESTAMP() + INTERVAL ' . TOKEN_TTL_DAYS . ' DAY WHERE id = ?',
            [$row['token_id']]
        );
    }
    $user = $row;
    return $user;
}

function require_user(): array
{
    $user = current_user();
    if (!$user) {
        throw new HttpError(401, 'Your session has expired. Please sign in again.');
    }
    return $user;
}

function uid(): int
{
    return (int) require_user()['id'];
}

function issue_token(int $userId): string
{
    $token = random_token();
    q(
        'INSERT INTO auth_tokens (user_id, token_hash, user_agent, expires_at) VALUES (?, ?, ?, UTC_TIMESTAMP() + INTERVAL ' . TOKEN_TTL_DAYS . ' DAY)',
        [$userId, hash('sha256', $token), substr((string) ($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 255)]
    );
    if (random_int(1, 50) === 1) {
        q('DELETE FROM auth_tokens WHERE expires_at < UTC_TIMESTAMP()');
        q('DELETE FROM login_attempts WHERE attempted_at < UTC_TIMESTAMP() - INTERVAL 1 DAY');
    }
    return $token;
}

function validate_password(string $password): void
{
    $errors = [];
    if (strlen($password) < 8) {
        $errors[] = 'at least 8 characters';
    }
    if (!preg_match('/[A-Z]/', $password)) {
        $errors[] = 'an uppercase letter';
    }
    if (!preg_match('/[a-z]/', $password)) {
        $errors[] = 'a lowercase letter';
    }
    if (!preg_match('/[0-9]/', $password)) {
        $errors[] = 'a number';
    }
    if (!preg_match('/[^A-Za-z0-9]/', $password)) {
        $errors[] = 'a special character';
    }
    if ($errors) {
        throw new HttpError(422, 'Password must contain ' . implode(', ', $errors) . '.');
    }
}

function create_email_token(int $userId, string $purpose, int $ttlMinutes): string
{
    q('DELETE FROM email_tokens WHERE user_id = ? AND purpose = ?', [$userId, $purpose]);
    $token = random_token();
    q(
        'INSERT INTO email_tokens (user_id, purpose, token_hash, expires_at) VALUES (?, ?, ?, UTC_TIMESTAMP() + INTERVAL ' . $ttlMinutes . ' MINUTE)',
        [$userId, $purpose, hash('sha256', $token)]
    );
    return $token;
}

function consume_email_token(string $token, string $purpose): int
{
    $row = q_one(
        'SELECT id, user_id FROM email_tokens WHERE token_hash = ? AND purpose = ? AND used_at IS NULL AND expires_at > UTC_TIMESTAMP()',
        [hash('sha256', $token), $purpose]
    );
    if (!$row) {
        throw new HttpError(400, 'This link is invalid or has expired. Please request a new one.');
    }
    q('UPDATE email_tokens SET used_at = UTC_TIMESTAMP() WHERE id = ?', [$row['id']]);
    return (int) $row['user_id'];
}

function send_verification_email(int $userId, string $email): bool
{
    $token = create_email_token($userId, 'verify', 60 * 48);
    $link = app_url() . '/verify-email?token=' . $token;
    return send_mail($email, 'Confirm your GigMasterPro email', "Welcome to GigMasterPro!\n\nConfirm your email address by opening this link:\n{$link}\n\nThe link expires in 48 hours. If you did not sign up, ignore this email.");
}
