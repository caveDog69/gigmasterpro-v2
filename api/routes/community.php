<?php
declare(strict_types=1);

function connection_between(int $a, int $b): ?array
{
    return q_one(
        'SELECT * FROM user_connections WHERE (requester_id = ? AND recipient_id = ?) OR (requester_id = ? AND recipient_id = ?) LIMIT 1',
        [$a, $b, $b, $a]
    );
}

function are_connected(int $a, int $b): bool
{
    $c = connection_between($a, $b);
    return $c !== null && $c['status'] === 'accepted';
}

function connection_out(array $row): array
{
    $requester = extract_brief($row, 'rq');
    $recipient = extract_brief($row, 'rc');
    $row = out_row($row);
    $row['requester'] = $requester;
    $row['recipient'] = $recipient;
    return $row;
}

function load_connection(int $id): ?array
{
    $row = q_one(
        'SELECT c.*, ' . profile_brief_cols('rq', 'rq') . ', ' . profile_brief_cols('rc', 'rc') . '
         FROM user_connections c JOIN profiles rq ON rq.id = c.requester_id JOIN profiles rc ON rc.id = c.recipient_id WHERE c.id = ?',
        [$id]
    );
    return $row ? connection_out($row) : null;
}

return static function (Router $r): void {
    $r->get('/community/profiles', static function () {
        $me = q_one('SELECT latitude, longitude, zip FROM profiles WHERE id = ?', [uid()]);
        if ($me && $me['latitude'] === null && $me['zip']) {
            $coords = geocode_zip($me['zip']);
            if ($coords) {
                q('UPDATE profiles SET latitude = ?, longitude = ? WHERE id = ?', [$coords[0], $coords[1], uid()]);
                [$me['latitude'], $me['longitude']] = $coords;
            }
        }
        $where = ['p.is_public = 1', 'p.id <> ?'];
        $params = [uid()];
        $search = trim((string) query_param('search', ''));
        if ($search !== '') {
            $like = '%' . str_replace(['%', '_'], ['\\%', '\\_'], $search) . '%';
            $where[] = '(p.display_name LIKE ? OR p.username LIKE ? OR p.bio LIKE ? OR p.city LIKE ? OR p.instrument LIKE ? OR p.genre LIKE ?)';
            array_push($params, $like, $like, $like, $like, $like, $like);
        }
        if ($instrument = query_param('instrument')) {
            $where[] = '(JSON_CONTAINS(p.instruments, JSON_QUOTE(?)) OR p.instrument = ?)';
            array_push($params, $instrument, $instrument);
        }
        if ($genre = query_param('genre')) {
            $where[] = 'p.genre = ?';
            $params[] = $genre;
        }
        if ($commitment = query_param('commitment')) {
            $where[] = 'p.commitment_level = ?';
            $params[] = $commitment;
        }
        $rows = q_all('SELECT p.* FROM profiles p WHERE ' . implode(' AND ', $where) . ' LIMIT 500', $params);

        $connections = [];
        foreach (q_all('SELECT * FROM user_connections WHERE requester_id = ? OR recipient_id = ?', [uid(), uid()]) as $c) {
            $other = (int) $c['requester_id'] === uid() ? (int) $c['recipient_id'] : (int) $c['requester_id'];
            $connections[$other] = $c;
        }
        $unread = [];
        foreach (q_all(
            'SELECT m.sender_id, COUNT(*) AS n FROM messages m JOIN conversations c ON c.id = m.conversation_id
             WHERE (c.participant_1_id = ? OR c.participant_2_id = ?) AND m.sender_id <> ? AND m.is_read = 0 GROUP BY m.sender_id',
            [uid(), uid(), uid()]
        ) as $u) {
            $unread[(int) $u['sender_id']] = (int) $u['n'];
        }

        $out = [];
        foreach ($rows as $row) {
            $id = (int) $row['id'];
            $c = $connections[$id] ?? null;
            if ($c && $c['status'] === 'blocked') {
                continue;
            }
            $status = 'none';
            if ($c) {
                if ($c['status'] === 'accepted') {
                    $status = 'connected';
                } elseif ($c['status'] === 'pending') {
                    $status = (int) $c['requester_id'] === uid() ? 'pending_sent' : 'pending_received';
                } elseif ($c['status'] === 'declined') {
                    $status = (int) $c['requester_id'] === uid() ? 'declined' : 'none';
                }
            }
            $distance = null;
            if ($me && $me['latitude'] !== null && $row['latitude'] !== null) {
                $distance = round(haversine_miles((float) $me['latitude'], (float) $me['longitude'], (float) $row['latitude'], (float) $row['longitude']), 1);
            }
            $p = profile_out($row, false, $status === 'connected');
            $p['distance_miles'] = $distance;
            $p['connection_status'] = $status;
            $p['connection_id'] = $c ? (int) $c['id'] : null;
            $p['unread_count'] = $unread[$id] ?? 0;
            $out[] = $p;
        }
        usort($out, static function ($a, $b) {
            if ($a['distance_miles'] === null && $b['distance_miles'] === null) {
                return strcasecmp($a['display_name'], $b['display_name']);
            }
            if ($a['distance_miles'] === null) {
                return 1;
            }
            if ($b['distance_miles'] === null) {
                return -1;
            }
            return $a['distance_miles'] <=> $b['distance_miles'];
        });
        return ['profiles' => $out, 'location_known' => $me && $me['latitude'] !== null];
    });

    $r->get('/connections', static function () {
        $rows = q_all(
            'SELECT c.*, ' . profile_brief_cols('rq', 'rq') . ', ' . profile_brief_cols('rc', 'rc') . '
             FROM user_connections c JOIN profiles rq ON rq.id = c.requester_id JOIN profiles rc ON rc.id = c.recipient_id
             WHERE c.requester_id = ? OR c.recipient_id = ? ORDER BY c.updated_at DESC',
            [uid(), uid()]
        );
        return array_map('connection_out', $rows);
    });

    $r->post('/connections', static function () {
        $recipient = (int) input('recipient_id', 0);
        $message = str_input(body(), 'message', 1000);
        if ($recipient === uid() || !q_val('SELECT 1 FROM profiles WHERE id = ?', [$recipient])) {
            throw new HttpError(422, 'Invalid recipient.');
        }
        $existing = connection_between(uid(), $recipient);
        if ($existing) {
            if ($existing['status'] === 'blocked') {
                throw new HttpError(403, 'You cannot connect with this musician.');
            }
            if ($existing['status'] === 'accepted') {
                throw new HttpError(409, 'You are already connected.');
            }
            if ($existing['status'] === 'pending') {
                if ((int) $existing['recipient_id'] === uid()) {
                    q("UPDATE user_connections SET status = 'accepted' WHERE id = ?", [$existing['id']]);
                    return load_connection((int) $existing['id']);
                }
                throw new HttpError(409, 'A connection request is already pending.');
            }
            q('DELETE FROM user_connections WHERE id = ?', [$existing['id']]);
        }
        q('INSERT INTO user_connections (requester_id, recipient_id, status, message) VALUES (?, ?, \'pending\', ?)', [uid(), $recipient, $message]);
        $id = (int) db()->lastInsertId();
        $name = q_val('SELECT display_name FROM profiles WHERE id = ?', [uid()]);
        notify($recipient, 'connection_request', "{$name} wants to connect", $message, '/community?tab=requests', uid());
        return load_connection($id);
    });

    $r->put('/connections/{id}', static function ($p) {
        $id = id_param($p);
        $c = q_one('SELECT * FROM user_connections WHERE id = ? AND (requester_id = ? OR recipient_id = ?)', [$id, uid(), uid()]);
        if (!$c) {
            throw new HttpError(404, 'Connection not found.');
        }
        $status = (string) input('status', '');
        $isRecipient = (int) $c['recipient_id'] === uid();
        if (in_array($status, ['accepted', 'declined'], true)) {
            if (!$isRecipient || $c['status'] !== 'pending') {
                throw new HttpError(403, 'Only the recipient can respond to a pending request.');
            }
        } elseif ($status !== 'blocked') {
            throw new HttpError(422, 'Invalid status.');
        }
        if ($status === 'blocked' && !$isRecipient) {
            q('UPDATE user_connections SET requester_id = recipient_id, recipient_id = ? WHERE id = ?', [uid(), $id]);
        }
        q('UPDATE user_connections SET status = ? WHERE id = ?', [$status, $id]);
        if ($status === 'accepted') {
            $name = q_val('SELECT display_name FROM profiles WHERE id = ?', [uid()]);
            notify((int) $c['requester_id'], 'connection_accepted', "{$name} accepted your connection request", '', '/community', uid());
        }
        return load_connection($id);
    });

    $r->delete('/connections/{id}', static function ($p) {
        $id = id_param($p);
        $c = q_one('SELECT * FROM user_connections WHERE id = ? AND (requester_id = ? OR recipient_id = ?)', [$id, uid(), uid()]);
        if (!$c) {
            throw new HttpError(404, 'Connection not found.');
        }
        if ($c['status'] === 'blocked' && (int) $c['recipient_id'] === uid()) {
            throw new HttpError(403, 'Connection not found.');
        }
        q('DELETE FROM user_connections WHERE id = ?', [$id]);
        return ['ok' => true];
    });
};
