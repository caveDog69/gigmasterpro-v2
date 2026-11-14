<?php
declare(strict_types=1);

function setlist_payload(array $b): array
{
    $name = str_input($b, 'name', 191);
    if ($name === '') {
        throw new HttpError(422, 'Setlist name is required.');
    }
    return [
        'name' => $name,
        'description' => str_input($b, 'description', 5000),
        'duration' => int_input($b, 'duration', 0, 0, 100000),
        'is_public' => bool_input($b, 'is_public') ? 1 : 0,
    ];
}

/** Replaces setlist entries. Each entry: {song_id, notes?}; order defines position. */
function save_setlist_songs(int $setlistId, $entries): void
{
    if (!is_array($entries)) {
        throw new HttpError(422, 'songs must be a list.');
    }
    $ids = array_values(array_unique(array_map(static fn ($e) => (int) (is_array($e) ? ($e['song_id'] ?? 0) : $e), $entries)));
    if ($ids) {
        $owned = q_all('SELECT id FROM songs WHERE user_id = ? AND id IN (' . in_placeholders($ids) . ')', array_merge([uid()], $ids));
        if (count($owned) !== count($ids)) {
            throw new HttpError(422, 'One or more songs were not found in your repertoire.');
        }
    }
    q('DELETE FROM setlist_songs WHERE setlist_id = ?', [$setlistId]);
    foreach (array_values($entries) as $pos => $e) {
        $songId = (int) (is_array($e) ? ($e['song_id'] ?? 0) : $e);
        $notes = is_array($e) ? mb_substr(trim((string) ($e['notes'] ?? '')), 0, 2000) : '';
        q('INSERT INTO setlist_songs (setlist_id, song_id, position, notes) VALUES (?,?,?,?)', [$setlistId, $songId, $pos + 1, $notes]);
    }
    refresh_setlist_durations([$setlistId]);
}

function setlist_detail(int $id): array
{
    $setlist = q_one('SELECT st.* FROM setlists st WHERE st.id = ? AND ' . visible_sql('setlist', 'st'), [$id]);
    if (!$setlist) {
        throw new HttpError(404, 'Setlist not found.');
    }
    $setlist = out_row($setlist);
    $setlist['is_owner'] = (int) $setlist['user_id'] === uid();
    $rows = q_all(
        'SELECT ss.id AS entry_id, ss.position, ss.notes AS entry_notes, s.* FROM setlist_songs ss JOIN songs s ON s.id = ss.song_id
         WHERE ss.setlist_id = ? ORDER BY ss.position',
        [$id]
    );
    $setlist['songs'] = array_map(static function ($row) use ($id) {
        $entry = ['id' => (int) $row['entry_id'], 'setlist_id' => $id, 'song_id' => (int) $row['id'], 'position' => (int) $row['position'], 'notes' => $row['entry_notes']];
        unset($row['entry_id'], $row['position'], $row['entry_notes']);
        $entry['song'] = out_row($row);
        return $entry;
    }, $rows);
    return $setlist;
}

return static function (Router $r): void {
    $r->get('/setlists', static function () {
        return out_rows(q_all(
            'SELECT st.*, (SELECT COUNT(*) FROM setlist_songs ss WHERE ss.setlist_id = st.id) AS song_count
             FROM setlists st WHERE st.user_id = ? ORDER BY st.updated_at DESC',
            [uid()]
        ));
    });

    $r->post('/setlists', static function () {
        $data = setlist_payload(body());
        $pdo = db();
        $pdo->beginTransaction();
        q('INSERT INTO setlists (user_id, name, description, duration, is_public) VALUES (?,?,?,?,?)', [uid(), $data['name'], $data['description'], $data['duration'], $data['is_public']]);
        $id = (int) $pdo->lastInsertId();
        if (is_array(input('songs'))) {
            save_setlist_songs($id, input('songs'));
        }
        $pdo->commit();
        return setlist_detail($id);
    });

    $r->get('/setlists/{id}', static fn ($p) => setlist_detail(id_param($p)));

    $r->put('/setlists/{id}', static function ($p) {
        $id = id_param($p);
        owned_or_404('setlists', $id, 'Setlist');
        $data = setlist_payload(body());
        $pdo = db();
        $pdo->beginTransaction();
        q('UPDATE setlists SET name = ?, description = ?, duration = ?, is_public = ? WHERE id = ?', [$data['name'], $data['description'], $data['duration'], $data['is_public'], $id]);
        if (is_array(input('songs'))) {
            save_setlist_songs($id, input('songs'));
        }
        $pdo->commit();
        return setlist_detail($id);
    });

    $r->put('/setlists/{id}/songs', static function ($p) {
        $id = id_param($p);
        owned_or_404('setlists', $id, 'Setlist');
        $pdo = db();
        $pdo->beginTransaction();
        save_setlist_songs($id, input('songs', []));
        $pdo->commit();
        return setlist_detail($id);
    });

    $r->delete('/setlists/{id}', static function ($p) {
        $id = id_param($p);
        owned_or_404('setlists', $id, 'Setlist');
        q('DELETE FROM setlists WHERE id = ?', [$id]);
        return ['ok' => true];
    });
};
