<?php
declare(strict_types=1);

function user_out(array $u): array
{
    return [
        'id' => (int) $u['id'],
        'email' => $u['email'],
        'email_verified' => !empty($u['email_verified_at']),
        'created_at' => out_row(['created_at' => $u['created_at']])['created_at'],
    ];
}

function unique_username(string $email): string
{
    $base = preg_replace('/[^a-z0-9]/', '', strtolower(explode('@', $email)[0])) ?: 'user';
    $base = substr($base, 0, 40);
    $candidate = $base;
    for ($i = 0; q_val('SELECT 1 FROM profiles WHERE username = ?', [$candidate]); $i++) {
        $candidate = $base . random_int(10, 9999);
        if ($i > 20) {
            $candidate = $base . bin2hex(random_bytes(3));
        }
    }
    return $candidate;
}

function ensure_profile(int $userId, string $email, ?string $displayName = null): array
{
    $profile = q_one('SELECT * FROM profiles WHERE id = ?', [$userId]);
    if (!$profile) {
        $name = $displayName ?: (explode('@', $email)[0] ?: 'User');
        q(
            'INSERT INTO profiles (id, username, display_name, instruments, calendar_token) VALUES (?, ?, ?, JSON_ARRAY(), ?)',
            [$userId, unique_username($email), mb_substr($name, 0, 100), random_token(16)]
        );
        $profile = q_one('SELECT * FROM profiles WHERE id = ?', [$userId]);
    }
    return $profile;
}

function session_payload(int $userId, ?string $token = null): array
{
    $user = q_one('SELECT id, email, email_verified_at, created_at FROM users WHERE id = ?', [$userId]);
    $profile = ensure_profile($userId, $user['email']);
    $out = ['user' => user_out($user), 'profile' => profile_out($profile, true)];
    if ($token !== null) {
        $out['token'] = $token;
    }
    return $out;
}

return static function (Router $r): void {
    $r->get('/health', static function () {
        $checks = [
            'php_version' => PHP_VERSION,
            'php_ok' => version_compare(PHP_VERSION, '8.0.0', '>='),
            'pdo_mysql' => extension_loaded('pdo_mysql'),
            'curl' => function_exists('curl_init'),
            'configured' => is_configured(),
            'database' => false,
            'schema_version' => null,
            'uploads_writable' => false,
        ];
        $uploads = dirname(__DIR__, 2) . '/uploads/avatars';
        if (!is_dir($uploads)) {
            @mkdir($uploads, 0755, true);
        }
        $checks['uploads_writable'] = is_dir($uploads) && is_writable($uploads);
        $error = null;
        if ($checks['configured']) {
            try {
                run_migrations();
                $checks['database'] = true;
                $checks['schema_version'] = schema_version();
            } catch (Throwable $e) {
                $error = $e->getMessage();
            }
        } else {
            $error = 'api/config.php is missing. Add the DB_* secrets in GitHub and redeploy.';
        }
        $checks['ok'] = $checks['php_ok'] && $checks['pdo_mysql'] && $checks['database'] && $checks['uploads_writable'];
        if ($error) {
            $checks['error'] = $error;
        }
        return $checks;
    }, true);

    $r->post('/auth/register', static function () {
        $b = body();
        $email = strtolower(str_input($b, 'email', 191));
        $password = (string) ($b['password'] ?? '');
        $displayName = str_input($b, 'display_name', 100);
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            throw new HttpError(422, 'Please enter a valid email address.');
        }
        if ($displayName === '') {
            throw new HttpError(422, 'Display name is required.');
        }
        validate_password($password);
        if (q_val('SELECT 1 FROM users WHERE email = ?', [$email])) {
            throw new HttpError(409, 'An account with this email already exists. Try signing in instead.');
        }
        $pdo = db();
        $pdo->beginTransaction();
        q('INSERT INTO users (email, password_hash) VALUES (?, ?)', [$email, password_hash($password, PASSWORD_DEFAULT)]);
        $userId = (int) $pdo->lastInsertId();
        ensure_profile($userId, $email, $displayName);
        $pdo->commit();
        $mailed = send_verification_email($userId, $email);
        $payload = session_payload($userId, issue_token($userId));
        $payload['verification_email_sent'] = $mailed;
        return $payload;
    }, true);

    $r->post('/auth/login', static function () {
        $b = body();
        $email = strtolower(str_input($b, 'email', 191));
        $password = (string) ($b['password'] ?? '');
        $ip = client_ip();
        $recent = (int) q_val(
            'SELECT COUNT(*) FROM login_attempts WHERE email = ? AND attempted_at > UTC_TIMESTAMP() - INTERVAL 15 MINUTE',
            [$email]
        );
        if ($recent >= 10) {
            throw new HttpError(429, 'Too many failed sign-in attempts. Please wait 15 minutes or reset your password.');
        }
        $user = q_one('SELECT id, password_hash FROM users WHERE email = ?', [$email]);
        if (!$user || !password_verify($password, $user['password_hash'])) {
            q('INSERT INTO login_attempts (ip, email) VALUES (?, ?)', [$ip, $email]);
            throw new HttpError(401, 'Invalid email or password.');
        }
        q('DELETE FROM login_attempts WHERE email = ?', [$email]);
        if (password_needs_rehash($user['password_hash'], PASSWORD_DEFAULT)) {
            q('UPDATE users SET password_hash = ? WHERE id = ?', [password_hash($password, PASSWORD_DEFAULT), $user['id']]);
        }
        return session_payload((int) $user['id'], issue_token((int) $user['id']));
    }, true);

    $r->post('/auth/logout', static function () {
        $token = bearer_token();
        if ($token) {
            q('DELETE FROM auth_tokens WHERE token_hash = ?', [hash('sha256', $token)]);
        }
        return ['ok' => true];
    }, true);

    $r->get('/auth/me', static fn () => session_payload(uid()));

    $r->post('/auth/forgot-password', static function () {
        $email = strtolower(str_input(body(), 'email', 191));
        $user = $email ? q_one('SELECT id, email FROM users WHERE email = ?', [$email]) : null;
        if ($user) {
            $token = create_email_token((int) $user['id'], 'reset', 60);
            $link = app_url() . '/reset-password?token=' . $token;
            send_mail($user['email'], 'Reset your GigMasterPro password', "Someone requested a password reset for your GigMasterPro account.\n\nChoose a new password here:\n{$link}\n\nThe link expires in 1 hour. If this wasn't you, you can ignore this email.");
        }
        return ['ok' => true, 'message' => 'If an account exists for that email, a reset link is on its way.'];
    }, true);

    $r->post('/auth/reset-password', static function () {
        $b = body();
        $password = (string) ($b['password'] ?? '');
        validate_password($password);
        $userId = consume_email_token((string) ($b['token'] ?? ''), 'reset');
        q('UPDATE users SET password_hash = ?, email_verified_at = COALESCE(email_verified_at, UTC_TIMESTAMP()) WHERE id = ?', [password_hash($password, PASSWORD_DEFAULT), $userId]);
        q('DELETE FROM auth_tokens WHERE user_id = ?', [$userId]);
        return session_payload($userId, issue_token($userId));
    }, true);

    $r->post('/auth/verify-email', static function () {
        $userId = consume_email_token((string) input('token', ''), 'verify');
        q('UPDATE users SET email_verified_at = COALESCE(email_verified_at, UTC_TIMESTAMP()) WHERE id = ?', [$userId]);
        return ['ok' => true];
    }, true);

    $r->post('/auth/resend-verification', static function () {
        $u = require_user();
        if (!empty($u['email_verified_at'])) {
            return ['ok' => true, 'already_verified' => true];
        }
        return ['ok' => send_verification_email((int) $u['id'], $u['email'])];
    });

    $r->put('/auth/password', static function () {
        $b = body();
        $row = q_one('SELECT password_hash FROM users WHERE id = ?', [uid()]);
        if (!password_verify((string) ($b['current_password'] ?? ''), $row['password_hash'])) {
            throw new HttpError(422, 'Your current password is incorrect.');
        }
        validate_password((string) ($b['new_password'] ?? ''));
        q('UPDATE users SET password_hash = ? WHERE id = ?', [password_hash((string) $b['new_password'], PASSWORD_DEFAULT), uid()]);
        q('DELETE FROM auth_tokens WHERE user_id = ? AND token_hash <> ?', [uid(), hash('sha256', (string) bearer_token())]);
        return ['ok' => true];
    });
};
