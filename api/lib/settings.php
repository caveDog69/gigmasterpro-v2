<?php
declare(strict_types=1);

const AD_SETTING_KEYS = ['ads_enabled', 'adsense_client', 'adsense_slot_banner', 'adsense_slot_sidebar', 'adsense_slot_footer'];

function app_settings(): array
{
    $out = array_fill_keys(AD_SETTING_KEYS, '');
    foreach (q_all('SELECT name, value FROM app_settings') as $row) {
        $out[$row['name']] = (string) $row['value'];
    }
    return $out;
}

function set_app_setting(string $name, string $value): void
{
    q('INSERT INTO app_settings (name, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)', [$name, $value]);
}

function ad_settings_out(array $s): array
{
    return [
        'enabled' => $s['ads_enabled'] === '1',
        'client' => $s['adsense_client'],
        'slots' => [
            'banner' => $s['adsense_slot_banner'],
            'sidebar' => $s['adsense_slot_sidebar'],
            'footer' => $s['adsense_slot_footer'],
        ],
    ];
}

/** Ad config for one user: ads show only when switched on and the user is not ad-free. */
function ads_for_user(array $user): array
{
    $ads = ad_settings_out(app_settings());
    $ads['show'] = $ads['enabled'] && empty($user['ad_free']);
    return $ads;
}

function require_admin(): array
{
    $user = require_user();
    if (($user['role'] ?? 'user') !== 'admin') {
        throw new HttpError(403, 'Admins only.');
    }
    return $user;
}
