<?php
declare(strict_types=1);

const SONG_KEYS = [
    'C', 'C#/Db', 'D', 'D#/Eb', 'E', 'F', 'F#/Gb', 'G', 'G#/Ab', 'A', 'A#/Bb', 'B',
    'Cm', 'C#m/Dbm', 'Dm', 'D#m/Ebm', 'Em', 'Fm', 'F#m/Gbm', 'Gm', 'G#m/Abm', 'Am', 'A#m/Bbm', 'Bm',
];

function parse_duration($v): int
{
    if ($v === null || $v === '') {
        return 0;
    }
    if (is_string($v) && preg_match('/^(\d{1,3}):([0-5]?\d)$/', trim($v), $m)) {
        return (int) $m[1] * 60 + (int) $m[2];
    }
    return is_numeric($v) ? max(0, min(36000, (int) round((float) $v))) : 0;
}

/** Validates song input into a column => value map. */
function tempo_input(array $b): int
{
    $tempo = int_input($b, 'tempo', 120, 0, 100000);
    if ($tempo < 40 || $tempo > 300) {
        throw new HttpError(422, 'Tempo must be between 40 and 300 BPM.');
    }
    return $tempo;
}

function song_payload(array $b): array
{
    $title = str_input($b, 'title', 255);
    if ($title === '') {
        throw new HttpError(422, 'Song title is required.');
    }
    $key = str_input($b, 'key', 10);
    if ($key !== '' && !in_array($key, SONG_KEYS, true)) {
        throw new HttpError(422, 'Invalid key.');
    }
    return [
        'title' => $title,
        'artist' => str_input($b, 'artist', 255),
        'album' => str_input($b, 'album', 255),
        'release_date' => date_input($b, 'release_date'),
        'key' => $key,
        'tempo' => tempo_input($b),
        'duration' => parse_duration($b['duration'] ?? 0),
        'genre' => str_input($b, 'genre', 50),
        'guitar_tuning' => str_input($b, 'guitar_tuning', 100),
        'lyrics' => str_input($b, 'lyrics', 200000),
        'chords' => str_input($b, 'chords', 200000),
        'notes' => str_input($b, 'notes', 5000),
        'is_original' => bool_input($b, 'is_original') ? 1 : 0,
    ];
}

function insert_song(int $userId, array $song): int
{
    $cols = array_keys($song);
    $sql = 'INSERT INTO songs (user_id, ' . implode(', ', array_map(static fn ($c) => "`{$c}`", $cols)) . ') VALUES (?' . str_repeat(', ?', count($cols)) . ')';
    q($sql, array_merge([$userId], array_values($song)));
    return (int) db()->lastInsertId();
}

/** Adds the song to the shared catalog (originals stay private), filling blanks on existing rows. */
function catalog_upsert(array $song, string $source = 'user', ?int $lrclibId = null, bool $countImport = true): void
{
    if (!empty($song['is_original'])) {
        return;
    }
    $nt = normalize_text($song['title'] ?? '');
    if ($nt === '') {
        return;
    }
    q(
        'INSERT INTO catalog_songs (title, artist, normalized_title, normalized_artist, album, release_date, duration, genre, `key`, tempo, lyrics, source, lrclib_id, times_imported)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,1)
         ON DUPLICATE KEY UPDATE
           album = IF(album = \'\', VALUES(album), album),
           release_date = COALESCE(release_date, VALUES(release_date)),
           duration = IF(duration = 0, VALUES(duration), duration),
           genre = IF(genre = \'\', VALUES(genre), genre),
           `key` = IF(`key` = \'\', VALUES(`key`), `key`),
           tempo = COALESCE(tempo, VALUES(tempo)),
           lyrics = IF(lyrics IS NULL OR lyrics = \'\', VALUES(lyrics), lyrics),
           lrclib_id = COALESCE(lrclib_id, VALUES(lrclib_id)),
           times_imported = times_imported + ' . ($countImport ? 1 : 0),
        [
            mb_substr((string) $song['title'], 0, 255),
            mb_substr((string) ($song['artist'] ?? ''), 0, 255),
            $nt,
            normalize_text($song['artist'] ?? ''),
            mb_substr((string) ($song['album'] ?? ''), 0, 255),
            $song['release_date'] ?? null,
            (int) ($song['duration'] ?? 0),
            mb_substr((string) ($song['genre'] ?? ''), 0, 50),
            (string) ($song['key'] ?? ''),
            isset($song['tempo']) && $song['tempo'] !== '' ? (int) $song['tempo'] : null,
            ($song['lyrics'] ?? '') !== '' ? $song['lyrics'] : null,
            $source,
            $lrclibId,
        ]
    );
}

function catalog_search(string $title, string $artist = '', int $limit = 10): array
{
    $nt = normalize_text($title);
    $na = normalize_text($artist);
    if ($nt === '' && $na === '') {
        return [];
    }
    $esc = static fn ($s) => '%' . str_replace(['%', '_'], ['\\%', '\\_'], $s) . '%';
    $where = [];
    $params = [];
    if ($nt !== '' && $na !== '') {
        $where[] = 'normalized_title LIKE ? AND normalized_artist LIKE ?';
        array_push($params, $esc($nt), $esc($na));
    } else {
        $term = $nt !== '' ? $nt : $na;
        $where[] = '(normalized_title LIKE ? OR normalized_artist LIKE ?)';
        array_push($params, $esc($term), $esc($term));
    }
    $params[] = $nt;
    $rows = q_all(
        'SELECT id, title, artist, album, release_date, duration, genre, `key`, tempo, lyrics, lrclib_id, times_imported FROM catalog_songs
         WHERE ' . implode(' AND ', $where) . ' ORDER BY (normalized_title = ?) DESC, times_imported DESC LIMIT ' . (int) $limit,
        $params
    );
    return array_map(static fn ($r) => [
        'source' => 'catalog',
        'catalog_id' => (int) $r['id'],
        'lrclib_id' => $r['lrclib_id'] !== null ? (int) $r['lrclib_id'] : null,
        'title' => $r['title'],
        'artist' => $r['artist'],
        'album' => $r['album'],
        'release_date' => $r['release_date'],
        'duration' => (int) $r['duration'],
        'genre' => $r['genre'],
        'key' => $r['key'],
        'tempo' => $r['tempo'] !== null ? (int) $r['tempo'] : null,
        'lyrics' => $r['lyrics'] ?? '',
        'times_imported' => (int) $r['times_imported'],
    ], $rows);
}

function lrclib_url(string $title, string $artist): string
{
    $params = [];
    if ($title !== '') {
        $params['track_name'] = $title;
    }
    if ($artist !== '') {
        $params['artist_name'] = $artist;
    }
    return 'https://lrclib.net/api/search?' . http_build_query($params);
}

function lrclib_map(?array $data, int $limit = 15): array
{
    if (!is_array($data)) {
        return [];
    }
    $out = [];
    foreach (array_slice($data, 0, 40) as $item) {
        if (!is_array($item) || empty($item['trackName'])) {
            continue;
        }
        $out[] = [
            'source' => 'lrclib',
            'catalog_id' => null,
            'lrclib_id' => isset($item['id']) ? (int) $item['id'] : null,
            'title' => (string) $item['trackName'],
            'artist' => (string) ($item['artistName'] ?? ''),
            'album' => (string) ($item['albumName'] ?? ''),
            'release_date' => null,
            'duration' => (int) round((float) ($item['duration'] ?? 0)),
            'genre' => '',
            'key' => '',
            'tempo' => null,
            'lyrics' => (string) ($item['plainLyrics'] ?? ''),
        ];
    }
    return array_slice(dedupe_results($out), 0, $limit);
}

/** Fetches several lrclib searches in parallel. Returns [index => results|null]. null means the request failed. */
function lrclib_multi(array $queries, int $timeout = 5): array
{
    $results = [];
    if (!function_exists('curl_multi_init')) {
        foreach ($queries as $i => [$t, $a]) {
            $data = http_get_json(lrclib_url($t, $a), $timeout);
            $results[$i] = $data === null ? null : lrclib_map($data);
        }
        return $results;
    }
    $mh = curl_multi_init();
    $handles = [];
    foreach ($queries as $i => [$t, $a]) {
        $ch = curl_init(lrclib_url($t, $a));
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => $timeout,
            CURLOPT_CONNECTTIMEOUT => $timeout,
            CURLOPT_USERAGENT => 'GigMasterPro/2.0 (+https://github.com/caveDog69/gigmasterpro-v2)',
        ]);
        curl_multi_add_handle($mh, $ch);
        $handles[$i] = $ch;
    }
    do {
        $status = curl_multi_exec($mh, $running);
        if ($running) {
            curl_multi_select($mh, 0.5);
        }
    } while ($running && $status === CURLM_OK);
    foreach ($handles as $i => $ch) {
        $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $body = curl_multi_getcontent($ch);
        $results[$i] = ($code >= 200 && $code < 300 && $body) ? lrclib_map(json_decode($body, true)) : null;
        curl_multi_remove_handle($mh, $ch);
        curl_close($ch);
    }
    curl_multi_close($mh);
    return $results;
}

function result_key(array $r): string
{
    return normalize_text($r['title']) . '|' . normalize_text($r['artist']);
}

/** Dedupes by normalised title+artist, keeping the first (catalog wins) and filling missing lyrics. */
function dedupe_results(array $results): array
{
    $seen = [];
    foreach ($results as $r) {
        $k = result_key($r);
        if (!isset($seen[$k])) {
            $seen[$k] = $r;
        } elseif (($seen[$k]['lyrics'] ?? '') === '' && ($r['lyrics'] ?? '') !== '') {
            $seen[$k]['lyrics'] = $r['lyrics'];
            $seen[$k]['lrclib_id'] = $seen[$k]['lrclib_id'] ?? $r['lrclib_id'];
        }
    }
    return array_values($seen);
}

function user_song_index(int $userId): array
{
    $index = [];
    foreach (q_all('SELECT id, title, artist FROM songs WHERE user_id = ?', [$userId]) as $s) {
        $index[normalize_text($s['title']) . '|' . normalize_text($s['artist'])] = (int) $s['id'];
    }
    return $index;
}

/** @return int[] ids of setlists that contain the song */
function setlists_with_song(int $songId): array
{
    return array_map('intval', array_column(q_all('SELECT DISTINCT setlist_id FROM setlist_songs WHERE song_id = ?', [$songId]), 'setlist_id'));
}

/** Recomputes setlists.duration from the durations of their songs. */
function refresh_setlist_durations(array $setlistIds): void
{
    foreach (array_unique($setlistIds) as $sid) {
        q('UPDATE setlists SET duration = (SELECT COALESCE(SUM(s.duration), 0) FROM setlist_songs ss JOIN songs s ON s.id = ss.song_id WHERE ss.setlist_id = ?) WHERE id = ?', [$sid, $sid]);
    }
}
