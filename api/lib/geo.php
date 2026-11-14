<?php
declare(strict_types=1);

/** Returns [lat, lng] for a US ZIP using zippopotam.us, cached in zip_geocodes. */
function geocode_zip(?string $zip): ?array
{
    $zip = substr(preg_replace('/\D/', '', (string) $zip), 0, 5);
    if (strlen($zip) !== 5) {
        return null;
    }
    $cached = q_one('SELECT latitude, longitude, fetched_at FROM zip_geocodes WHERE zip = ?', [$zip]);
    if ($cached && ($cached['latitude'] !== null || strtotime($cached['fetched_at'] . ' UTC') > time() - 7 * 86400)) {
        return $cached['latitude'] === null ? null : [(float) $cached['latitude'], (float) $cached['longitude']];
    }
    $data = http_get_json('https://api.zippopotam.us/us/' . $zip, 4);
    $place = $data['places'][0] ?? null;
    $lat = $place ? (float) $place['latitude'] : null;
    $lng = $place ? (float) $place['longitude'] : null;
    q(
        'INSERT INTO zip_geocodes (zip, latitude, longitude, city, state, fetched_at) VALUES (?,?,?,?,?,UTC_TIMESTAMP())
         ON DUPLICATE KEY UPDATE latitude = VALUES(latitude), longitude = VALUES(longitude), city = VALUES(city), state = VALUES(state), fetched_at = VALUES(fetched_at)',
        [$zip, $lat, $lng, $place['place name'] ?? null, $place['state abbreviation'] ?? null]
    );
    return $lat === null ? null : [$lat, $lng];
}

function haversine_miles(float $lat1, float $lng1, float $lat2, float $lng2): float
{
    $r = 3958.8;
    $dLat = deg2rad($lat2 - $lat1);
    $dLng = deg2rad($lng2 - $lng1);
    $a = sin($dLat / 2) ** 2 + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLng / 2) ** 2;
    return 2 * $r * asin(min(1.0, sqrt($a)));
}
