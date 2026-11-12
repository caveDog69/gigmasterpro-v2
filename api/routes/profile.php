<?php
declare(strict_types=1);

const PLAY_MODE_FIELDS = ['artist', 'key', 'tempo', 'duration', 'guitar_tuning', 'genre', 'notes', 'chords', 'lyrics', 'album', 'is_original'];
const PROFILE_INSTRUMENT_LIMIT = 16;

function play_mode_defaults(): array
{
    return [
        'lyrics' => ['content' => 'lyrics', 'header_fields' => [], 'show_artist' => true],
        'songs' => ['fields' => ['artist', 'duration', 'notes']],
    ];
}

function sanitize_play_mode(string $mode, $value): array
{
    $defaults = play_mode_defaults()[$mode];
    if (!is_array($value)) {
        return $defaults;
    }
    $pick = static fn ($list) => array_values(array_intersect(PLAY_MODE_FIELDS, is_array($list) ? $list : []));
    if ($mode === 'lyrics') {
        return [
            'content' => in_array($value['content'] ?? '', ['lyrics', 'chords', 'both'], true) ? $value['content'] : $defaults['content'],
            'header_fields' => $pick($value['header_fields'] ?? []),
            'show_artist' => (bool) ($value['show_artist'] ?? true),
        ];
    }
    return ['fields' => $pick($value['fields'] ?? $defaults['fields'])];
}

function load_play_mode_settings(int $userId): array
{
    $settings = play_mode_defaults();
    foreach (q_all('SELECT mode, visible_fields FROM play_mode_settings WHERE user_id = ?', [$userId]) as $row) {
        $settings[$row['mode']] = sanitize_play_mode($row['mode'], json_decode($row['visible_fields'], true));
    }
    return $settings;
}

function avatar_dir(): string
{
    $root = dirname(__DIR__, 2) . '/uploads';
    $dir = $root . '/avatars';
    if (!is_dir($dir) && !@mkdir($dir, 0755, true)) {
        throw new HttpError(500, 'The uploads/avatars folder is missing and could not be created.');
    }
    if (!is_file($root . '/.htaccess')) {
        @file_put_contents($root . '/.htaccess', "Options -Indexes -ExecCGI\nRemoveHandler .php .phtml .php3 .php4 .php5 .php7 .php8 .phar\n<FilesMatch \"\\.(php|phtml|phar|pl|py|cgi|sh)$\">\n  Require all denied\n</FilesMatch>\n");
    }
    return $dir;
}

function delete_local_avatar(?string $relative): void
{
    if ($relative && strpos($relative, 'uploads/avatars/') === 0) {
        $file = dirname(__DIR__, 2) . '/' . $relative;
        if (is_file($file)) {
            @unlink($file);
        }
    }
}

return static function (Router $r): void {
    $r->get('/profile', static function () {
        return profile_out(q_one('SELECT * FROM profiles WHERE id = ?', [uid()]), true);
    });

    $r->put('/profile', static function () {
        $b = body();
        $current = q_one('SELECT * FROM profiles WHERE id = ?', [uid()]);
        $fields = [];

        if (array_key_exists('username', $b)) {
            $username = strtolower(str_input($b, 'username', 30));
            if (!preg_match('/^[a-z0-9_]{3,30}$/', $username)) {
                throw new HttpError(422, 'Username must be 3–30 characters: lowercase letters, numbers or underscores.');
            }
            if (q_val('SELECT 1 FROM profiles WHERE username = ? AND id <> ?', [$username, uid()])) {
                throw new HttpError(409, 'That username is taken.');
            }
            $fields['username'] = $username;
        }
        if (array_key_exists('display_name', $b)) {
            $name = str_input($b, 'display_name', 100);
            if ($name === '') {
                throw new HttpError(422, 'Display name is required.');
            }
            $fields['display_name'] = $name;
        }
        foreach (['bio' => 2000, 'location' => 191, 'city' => 100, 'phone' => 30, 'instrument' => 100, 'genre' => 50, 'equipment' => 2000] as $k => $max) {
            if (array_key_exists($k, $b)) {
                $fields[$k] = nullable_str($b, $k, $max);
            }
        }
        if (array_key_exists('state', $b)) {
            $state = strtoupper(str_input($b, 'state', 2));
            if ($state !== '' && !preg_match('/^[A-Z]{2}$/', $state)) {
                throw new HttpError(422, 'State must be a two-letter code.');
            }
            $fields['state'] = $state ?: null;
        }
        if (array_key_exists('website', $b)) {
            $site = str_input($b, 'website', 255);
            if ($site !== '' && !preg_match('#^https?://#i', $site)) {
                $site = 'https://' . $site;
            }
            if ($site !== '' && !filter_var($site, FILTER_VALIDATE_URL)) {
                throw new HttpError(422, 'Website must be a valid URL.');
            }
            $fields['website'] = $site ?: null;
        }
        if (array_key_exists('instruments', $b)) {
            $list = is_array($b['instruments']) ? $b['instruments'] : [];
            $clean = [];
            foreach ($list as $item) {
                if (is_string($item) && trim($item) !== '' && mb_strlen($item) <= 50) {
                    $clean[] = trim($item);
                }
            }
            $fields['instruments'] = json_encode(array_slice(array_values(array_unique($clean)), 0, PROFILE_INSTRUMENT_LIMIT));
        }
        if (array_key_exists('experience_level', $b)) {
            $v = $b['experience_level'] ?: null;
            if ($v !== null && !in_array($v, ['beginner', 'intermediate', 'advanced', 'professional'], true)) {
                throw new HttpError(422, 'Invalid experience level.');
            }
            $fields['experience_level'] = $v;
        }
        if (array_key_exists('commitment_level', $b)) {
            $v = $b['commitment_level'] ?: null;
            if ($v !== null && !in_array($v, ['casual', 'serious', 'professional'], true)) {
                throw new HttpError(422, 'Invalid commitment level.');
            }
            $fields['commitment_level'] = $v;
        }
        if (array_key_exists('is_public', $b)) {
            $fields['is_public'] = bool_input($b, 'is_public') ? 1 : 0;
        }
        if (array_key_exists('zip', $b)) {
            $zip = str_input($b, 'zip', 10);
            if ($zip !== '' && !preg_match('/^\d{5}(-\d{4})?$/', $zip)) {
                throw new HttpError(422, 'ZIP code must be 5 digits.');
            }
            $fields['zip'] = $zip ?: null;
            if ($zip !== ($current['zip'] ?? '') || $current['latitude'] === null) {
                $coords = $zip ? geocode_zip($zip) : null;
                $fields['latitude'] = $coords[0] ?? null;
                $fields['longitude'] = $coords[1] ?? null;
            }
        }
        if ($fields) {
            $set = implode(', ', array_map(static fn ($k) => "`{$k}` = ?", array_keys($fields)));
            q("UPDATE profiles SET {$set} WHERE id = ?", array_merge(array_values($fields), [uid()]));
        }
        return profile_out(q_one('SELECT * FROM profiles WHERE id = ?', [uid()]), true);
    });

    $r->post('/profile/avatar', static function () {
        $file = $_FILES['avatar'] ?? null;
        if (!$file || !is_array($file) || ($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
            $code = $file['error'] ?? UPLOAD_ERR_NO_FILE;
            $msg = in_array($code, [UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE], true) ? 'Image must be 5MB or smaller.' : 'Please choose an image to upload.';
            throw new HttpError(422, $msg);
        }
        if ($file['size'] > 5 * 1024 * 1024) {
            throw new HttpError(422, 'Image must be 5MB or smaller.');
        }
        $types = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/gif' => 'gif', 'image/webp' => 'webp'];
        $mime = function_exists('finfo_open') ? (string) finfo_file(finfo_open(FILEINFO_MIME_TYPE), $file['tmp_name']) : (string) (getimagesize($file['tmp_name'])['mime'] ?? '');
        if (!isset($types[$mime]) || @getimagesize($file['tmp_name']) === false) {
            throw new HttpError(422, 'Avatar must be a JPG, PNG, GIF or WebP image.');
        }
        $name = uid() . '-' . bin2hex(random_bytes(8)) . '.' . $types[$mime];
        $dest = avatar_dir() . '/' . $name;
        if (!move_uploaded_file($file['tmp_name'], $dest) && !rename($file['tmp_name'], $dest)) {
            throw new HttpError(500, 'Could not save the uploaded image. Check that uploads/avatars is writable.');
        }
        @chmod($dest, 0644);
        $old = q_val('SELECT avatar_url FROM profiles WHERE id = ?', [uid()]);
        q('UPDATE profiles SET avatar_url = ? WHERE id = ?', ['uploads/avatars/' . $name, uid()]);
        delete_local_avatar($old);
        return profile_out(q_one('SELECT * FROM profiles WHERE id = ?', [uid()]), true);
    });

    $r->delete('/profile/avatar', static function () {
        delete_local_avatar(q_val('SELECT avatar_url FROM profiles WHERE id = ?', [uid()]));
        q('UPDATE profiles SET avatar_url = NULL WHERE id = ?', [uid()]);
        return profile_out(q_one('SELECT * FROM profiles WHERE id = ?', [uid()]), true);
    });

    $r->get('/profile/play-mode-settings', static fn () => load_play_mode_settings(uid()));

    $r->put('/profile/play-mode-settings', static function () {
        $b = body();
        foreach (['lyrics', 'songs'] as $mode) {
            if (array_key_exists($mode, $b)) {
                q(
                    'INSERT INTO play_mode_settings (user_id, mode, visible_fields) VALUES (?, ?, ?)
                     ON DUPLICATE KEY UPDATE visible_fields = VALUES(visible_fields)',
                    [uid(), $mode, json_encode(sanitize_play_mode($mode, $b[$mode]))]
                );
            }
        }
        return load_play_mode_settings(uid());
    });

    $r->post('/profile/calendar-token', static function () {
        q('UPDATE profiles SET calendar_token = ? WHERE id = ?', [random_token(16), uid()]);
        return profile_out(q_one('SELECT * FROM profiles WHERE id = ?', [uid()]), true);
    });

    $r->get('/users/search', static function () {
        $term = trim((string) query_param('q', ''));
        if (mb_strlen($term) < 2) {
            return [];
        }
        $like = '%' . str_replace(['%', '_'], ['\\%', '\\_'], $term) . '%';
        $rows = q_all(
            'SELECT id, username, display_name, avatar_url, city, state, instrument, genre FROM profiles
             WHERE id <> ? AND (username LIKE ? OR display_name LIKE ?) ORDER BY display_name LIMIT 10',
            [uid(), $like, $like]
        );
        return array_map(static fn ($p) => profile_out($p), $rows);
    });
};
