<?php
declare(strict_types=1);

const SONG_LIST_COLS = 's.id, s.user_id, s.title, s.artist, s.album, s.release_date, s.`key`, s.tempo, s.duration, s.genre, s.guitar_tuning, s.notes, s.is_original, s.created_at, s.updated_at,
    (s.lyrics IS NOT NULL AND s.lyrics <> \'\') AS has_lyrics, (s.chords IS NOT NULL AND s.chords <> \'\') AS has_chords';

function song_list_out(array $rows): array
{
    return array_map(static function ($r) {
        $r = out_row($r);
        $r['has_lyrics'] = (bool) $r['has_lyrics'];
        $r['has_chords'] = (bool) $r['has_chords'];
        return $r;
    }, $rows);
}

function import_match_entry(array $entry, array $catalog, ?array $lrclib, array $userIndex): array
{
    $title = trim((string) ($entry['title'] ?? ''));
    $artist = trim((string) ($entry['artist'] ?? ''));
    $candidates = array_slice(dedupe_results(array_merge($catalog, $lrclib ?? [])), 0, 6);
    $nt = normalize_text($title);
    $na = normalize_text($artist);
    $exact = array_values(array_filter($candidates, static function ($c) use ($nt, $na) {
        if (normalize_text($c['title']) !== $nt) {
            return false;
        }
        if ($na === '') {
            return true;
        }
        $ca = normalize_text($c['artist']);
        return $ca === $na || strpos($ca, $na) !== false || strpos($na, $ca) !== false;
    }));
    if ($exact && (count($exact) === 1 || $na !== '')) {
        $status = 'matched';
        $selected = $exact[0];
    } elseif ($candidates) {
        $status = 'ambiguous';
        $selected = $exact[0] ?? $candidates[0];
    } else {
        $status = 'not_found';
        $selected = null;
    }
    $dupKey = $selected ? result_key($selected) : $nt . '|' . $na;
    return [
        'title' => $title,
        'artist' => $artist,
        'status' => $status,
        'candidates' => $candidates,
        'selected_index' => $selected ? array_search($selected, $candidates, true) : null,
        'duplicate_song_id' => $userIndex[$dupKey] ?? $userIndex[$nt . '|' . $na] ?? null,
        'lrclib_ok' => $lrclib !== null,
    ];
}

return static function (Router $r): void {
    $r->get('/songs', static function () {
        $params = [uid()];
        $where = 's.user_id = ?';
        $search = trim((string) query_param('search', ''));
        if ($search !== '') {
            $like = '%' . str_replace(['%', '_'], ['\\%', '\\_'], $search) . '%';
            $where .= ' AND (s.title LIKE ? OR s.artist LIKE ? OR s.album LIKE ? OR s.genre LIKE ?)';
            array_push($params, $like, $like, $like, $like);
        }
        return song_list_out(q_all('SELECT ' . SONG_LIST_COLS . " FROM songs s WHERE {$where} ORDER BY s.title", $params));
    });

    $r->post('/songs', static function () {
        $song = song_payload(body());
        $id = insert_song(uid(), $song);
        catalog_upsert($song, input('lrclib_id') ? 'lrclib' : 'user', input('lrclib_id') ? (int) input('lrclib_id') : null);
        return out_row(q_one('SELECT * FROM songs WHERE id = ?', [$id]));
    });

    $r->get('/songs/search', static function () {
        $q = trim((string) query_param('q', ''));
        $title = trim((string) query_param('title', $q));
        $artist = trim((string) query_param('artist', ''));
        if ($title === '' && $artist === '') {
            return ['results' => [], 'lrclib_ok' => true];
        }
        $catalog = catalog_search($title, $artist, 10);
        $lrclib = query_param('lrclib', '1') === '0' ? [] : (lrclib_multi([[$title, $artist]])[0]);
        return [
            'results' => array_slice(dedupe_results(array_merge($catalog, $lrclib ?? [])), 0, 25),
            'lrclib_ok' => $lrclib !== null,
        ];
    });

    $r->post('/songs/import/match', static function () {
        $entries = input('entries', []);
        if (!is_array($entries) || count($entries) === 0) {
            throw new HttpError(422, 'No songs to match.');
        }
        if (count($entries) > 10) {
            throw new HttpError(422, 'Match at most 10 songs per request.');
        }
        $userIndex = user_song_index(uid());
        $catalog = [];
        $needLrclib = [];
        foreach (array_values($entries) as $i => $e) {
            $title = mb_substr(trim((string) ($e['title'] ?? '')), 0, 255);
            $artist = mb_substr(trim((string) ($e['artist'] ?? '')), 0, 255);
            $catalog[$i] = $title === '' ? [] : catalog_search($title, $artist, 5);
            $hasExact = false;
            foreach ($catalog[$i] as $c) {
                if (normalize_text($c['title']) === normalize_text($title) && ($artist === '' || normalize_text($c['artist']) === normalize_text($artist))) {
                    $hasExact = true;
                }
            }
            if ($title !== '' && !$hasExact) {
                $needLrclib[$i] = [$title, $artist];
            }
        }
        $lrclib = $needLrclib ? lrclib_multi($needLrclib) : [];
        $out = [];
        foreach (array_values($entries) as $i => $e) {
            $out[] = import_match_entry($e, $catalog[$i], array_key_exists($i, $lrclib) ? $lrclib[$i] : [], $userIndex);
        }
        return ['results' => $out];
    });

    $r->post('/songs/import', static function () {
        $songs = input('songs', []);
        $skipDuplicates = (bool) input('skip_duplicates', true);
        if (!is_array($songs) || !$songs) {
            throw new HttpError(422, 'No songs to import.');
        }
        if (count($songs) > 500) {
            throw new HttpError(422, 'Import at most 500 songs at a time.');
        }
        $index = user_song_index(uid());
        $inserted = [];
        $skipped = [];
        $pdo = db();
        $pdo->beginTransaction();
        foreach ($songs as $raw) {
            if (!is_array($raw)) {
                continue;
            }
            $song = song_payload($raw);
            $k = normalize_text($song['title']) . '|' . normalize_text($song['artist']);
            if ($skipDuplicates && isset($index[$k])) {
                $skipped[] = ['title' => $song['title'], 'artist' => $song['artist'], 'existing_id' => $index[$k]];
                continue;
            }
            $id = insert_song(uid(), $song);
            $index[$k] = $id;
            $lrclibId = !empty($raw['lrclib_id']) ? (int) $raw['lrclib_id'] : null;
            catalog_upsert($song, $lrclibId ? 'lrclib' : 'import', $lrclibId);
            $inserted[] = $id;
        }
        $pdo->commit();
        return ['inserted' => count($inserted), 'inserted_ids' => $inserted, 'skipped' => $skipped];
    });

    $r->get('/songs/{id}', static function ($p) {
        $song = q_one('SELECT s.* FROM songs s WHERE s.id = ? AND ' . visible_sql('song', 's'), [id_param($p)]);
        if (!$song) {
            throw new HttpError(404, 'Song not found.');
        }
        $song = out_row($song);
        $song['is_owner'] = (int) $song['user_id'] === uid();
        return $song;
    });

    $r->put('/songs/{id}', static function ($p) {
        $id = id_param($p);
        owned_or_404('songs', $id, 'Song');
        $song = song_payload(body());
        $set = implode(', ', array_map(static fn ($c) => "`{$c}` = ?", array_keys($song)));
        q("UPDATE songs SET {$set} WHERE id = ? AND user_id = ?", array_merge(array_values($song), [$id, uid()]));
        catalog_upsert($song, 'user', null, false);
        return out_row(q_one('SELECT * FROM songs WHERE id = ?', [$id]));
    });

    $r->delete('/songs/{id}', static function ($p) {
        $id = id_param($p);
        owned_or_404('songs', $id, 'Song');
        q('DELETE FROM songs WHERE id = ? AND user_id = ?', [$id, uid()]);
        return ['ok' => true];
    });
};
