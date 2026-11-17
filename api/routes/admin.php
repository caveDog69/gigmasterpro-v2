<?php
declare(strict_types=1);

function admin_user_out(array $u): array
{
    return [
        'id' => (int) $u['id'],
        'email' => $u['email'],
        'username' => $u['username'],
        'display_name' => $u['display_name'],
        'avatar_url' => public_url($u['avatar_url'] ?? null),
        'role' => $u['role'],
        'ad_free' => !empty($u['ad_free']),
        'email_verified' => !empty($u['email_verified_at']),
        'disabled' => !empty($u['disabled_at']),
        'disabled_at' => out_row(['disabled_at' => $u['disabled_at']])['disabled_at'],
        'created_at' => out_row(['created_at' => $u['created_at']])['created_at'],
    ];
}

const ADMIN_USER_COLS = 'u.id, u.email, u.role, u.ad_free, u.email_verified_at, u.disabled_at, u.created_at, p.username, p.display_name, p.avatar_url';

return static function (Router $r): void {
    $r->get('/admin/settings', static function () {
        require_admin();
        return ad_settings_out(app_settings());
    });

    $r->put('/admin/settings', static function () {
        require_admin();
        $b = body();
        if (array_key_exists('enabled', $b)) {
            set_app_setting('ads_enabled', bool_input($b, 'enabled') ? '1' : '0');
        }
        if (array_key_exists('client', $b)) {
            $client = str_input($b, 'client', 64);
            if ($client !== '' && !preg_match('/^ca-pub-\d{10,20}$/', $client)) {
                throw new HttpError(422, 'The AdSense publisher ID looks like ca-pub-1234567890123456.');
            }
            set_app_setting('adsense_client', $client);
        }
        $slots = is_array($b['slots'] ?? null) ? $b['slots'] : [];
        foreach (['banner', 'sidebar', 'footer'] as $slot) {
            if (array_key_exists($slot, $slots)) {
                $id = str_input($slots, $slot, 20);
                if ($id !== '' && !ctype_digit($id)) {
                    throw new HttpError(422, 'Ad slot IDs are numbers, e.g. 1234567890.');
                }
                set_app_setting('adsense_slot_' . $slot, $id);
            }
        }
        return ad_settings_out(app_settings());
    });

    $r->get('/admin/users', static function () {
        require_admin();
        $where = ['1 = 1'];
        $params = [];
        $search = trim((string) query_param('search', ''));
        if ($search !== '') {
            $like = '%' . str_replace(['%', '_'], ['\\%', '\\_'], $search) . '%';
            $where[] = '(u.email LIKE ? OR p.username LIKE ? OR p.display_name LIKE ?)';
            array_push($params, $like, $like, $like);
        }
        $status = query_param('status');
        if ($status === 'disabled') {
            $where[] = 'u.disabled_at IS NOT NULL';
        } elseif ($status === 'active') {
            $where[] = 'u.disabled_at IS NULL';
        } elseif ($status === 'admin') {
            $where[] = "u.role = 'admin'";
        }
        $limit = int_input($_GET, 'limit', 50, 1, 200);
        $offset = int_input($_GET, 'offset', 0, 0, 1000000);
        $sqlWhere = implode(' AND ', $where);
        $total = (int) q_val("SELECT COUNT(*) FROM users u LEFT JOIN profiles p ON p.id = u.id WHERE {$sqlWhere}", $params);
        $rows = q_all(
            'SELECT ' . ADMIN_USER_COLS . " FROM users u LEFT JOIN profiles p ON p.id = u.id WHERE {$sqlWhere} ORDER BY u.id DESC LIMIT {$limit} OFFSET {$offset}",
            $params
        );
        return [
            'total' => $total,
            'users' => array_map('admin_user_out', $rows),
            'counts' => [
                'all' => (int) q_val('SELECT COUNT(*) FROM users'),
                'admins' => (int) q_val("SELECT COUNT(*) FROM users WHERE role = 'admin'"),
                'disabled' => (int) q_val('SELECT COUNT(*) FROM users WHERE disabled_at IS NOT NULL'),
            ],
        ];
    });

    $r->put('/admin/users/{id}', static function (array $p) {
        $me = require_admin();
        $id = id_param($p);
        if (!q_val('SELECT 1 FROM users WHERE id = ?', [$id])) {
            throw new HttpError(404, 'User not found.');
        }
        $b = body();
        $self = $id === (int) $me['id'];
        if (array_key_exists('disabled', $b)) {
            $disable = bool_input($b, 'disabled');
            if ($self && $disable) {
                throw new HttpError(422, 'You cannot disable your own account.');
            }
            q('UPDATE users SET disabled_at = ' . ($disable ? 'COALESCE(disabled_at, UTC_TIMESTAMP())' : 'NULL') . ' WHERE id = ?', [$id]);
            if ($disable) {
                q('DELETE FROM auth_tokens WHERE user_id = ?', [$id]);
            }
        }
        if (array_key_exists('role', $b)) {
            $role = (string) $b['role'];
            if (!in_array($role, ['user', 'admin'], true)) {
                throw new HttpError(422, 'Role must be user or admin.');
            }
            if ($self && $role !== 'admin') {
                throw new HttpError(422, 'You cannot remove your own admin role.');
            }
            q('UPDATE users SET role = ? WHERE id = ?', [$role, $id]);
        }
        if (array_key_exists('ad_free', $b)) {
            q('UPDATE users SET ad_free = ? WHERE id = ?', [bool_input($b, 'ad_free') ? 1 : 0, $id]);
        }
        return admin_user_out(q_one('SELECT ' . ADMIN_USER_COLS . ' FROM users u LEFT JOIN profiles p ON p.id = u.id WHERE u.id = ?', [$id]));
    });
};
