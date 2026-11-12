<?php
declare(strict_types=1);

const GIG_STATUSES = ['scheduled', 'confirmed', 'completed', 'cancelled'];

function gig_payload(array $b): array
{
    $name = str_input($b, 'name', 191);
    if ($name === '') {
        throw new HttpError(422, 'Gig name is required.');
    }
    $status = (string) ($b['status'] ?? 'scheduled');
    if (!in_array($status, GIG_STATUSES, true)) {
        throw new HttpError(422, 'Invalid gig status.');
    }
    $payment = $b['payment'] ?? null;
    if ($payment !== null && $payment !== '' && !is_numeric($payment)) {
        throw new HttpError(422, 'Payment must be a number.');
    }
    return [
        'name' => $name,
        'venue' => str_input($b, 'venue', 191),
        'location' => str_input($b, 'location', 255),
        'date_time' => datetime_input($b, 'date_time', true),
        'load_in_time' => datetime_input($b, 'load_in_time'),
        'duration' => int_input($b, 'duration', 0, 0, 100000),
        'notes' => str_input($b, 'notes', 5000),
        'payment' => ($payment === null || $payment === '') ? null : round((float) $payment, 2),
        'status' => $status,
    ];
}

function save_gig_setlists(int $gigId, $setlistIds): void
{
    if (!is_array($setlistIds)) {
        throw new HttpError(422, 'setlists must be a list of setlist ids.');
    }
    $ids = array_values(array_unique(array_map(static fn ($v) => (int) (is_array($v) ? ($v['setlist_id'] ?? 0) : $v), $setlistIds)));
    if ($ids) {
        $owned = q_all('SELECT id FROM setlists WHERE user_id = ? AND id IN (' . in_placeholders($ids) . ')', array_merge([uid()], $ids));
        if (count($owned) !== count($ids)) {
            throw new HttpError(422, 'One or more setlists were not found.');
        }
    }
    q('DELETE FROM gig_setlists WHERE gig_id = ?', [$gigId]);
    foreach ($ids as $pos => $sid) {
        q('INSERT INTO gig_setlists (gig_id, setlist_id, position) VALUES (?,?,?)', [$gigId, $sid, $pos + 1]);
    }
}

function gig_visible_or_404(int $id): array
{
    $gig = q_one('SELECT g.* FROM gigs g WHERE g.id = ? AND ' . visible_sql('gig', 'g'), [$id]);
    if (!$gig) {
        throw new HttpError(404, 'Gig not found.');
    }
    return $gig;
}

function gig_detail(int $id): array
{
    $gig = out_row(gig_visible_or_404($id));
    $gig['is_owner'] = (int) $gig['user_id'] === uid();
    $setlists = q_all(
        'SELECT gs.id AS link_id, gs.position, st.* FROM gig_setlists gs JOIN setlists st ON st.id = gs.setlist_id WHERE gs.gig_id = ? ORDER BY gs.position',
        [$id]
    );
    $gig['setlists'] = [];
    foreach ($setlists as $row) {
        $songs = q_all(
            'SELECT ss.id AS entry_id, ss.position, ss.notes AS entry_notes, s.id, s.title, s.artist, s.album, s.`key`, s.tempo, s.duration, s.genre, s.guitar_tuning, s.notes, s.is_original,
                    (s.lyrics IS NOT NULL AND s.lyrics <> \'\') AS has_lyrics, (s.chords IS NOT NULL AND s.chords <> \'\') AS has_chords
             FROM setlist_songs ss JOIN songs s ON s.id = ss.song_id WHERE ss.setlist_id = ? ORDER BY ss.position',
            [$row['id']]
        );
        $link = ['id' => (int) $row['link_id'], 'gig_id' => $id, 'setlist_id' => (int) $row['id'], 'position' => (int) $row['position']];
        unset($row['link_id'], $row['position']);
        $setlist = out_row($row);
        $setlist['songs'] = array_map(static function ($s) use ($row) {
            $entry = ['id' => (int) $s['entry_id'], 'setlist_id' => (int) $row['id'], 'song_id' => (int) $s['id'], 'position' => (int) $s['position'], 'notes' => $s['entry_notes']];
            unset($s['entry_id'], $s['position'], $s['entry_notes']);
            $s['has_lyrics'] = (bool) $s['has_lyrics'];
            $s['has_chords'] = (bool) $s['has_chords'];
            $entry['song'] = out_row($s);
            return $entry;
        }, $songs);
        $link['setlist'] = $setlist;
        $gig['setlists'][] = $link;
    }
    return $gig;
}

function ics_escape(string $s): string
{
    return str_replace(["\\", ';', ',', "\r\n", "\n"], ["\\\\", '\\;', '\\,', '\\n', '\\n'], $s);
}

function ics_fold(string $line): string
{
    $out = '';
    while (strlen($line) > 74) {
        $cut = 74;
        while ($cut > 0 && (ord($line[$cut]) & 0xC0) === 0x80) {
            $cut--;
        }
        $out .= substr($line, 0, $cut) . "\r\n ";
        $line = substr($line, $cut);
    }
    return $out . $line;
}

function gigs_to_ics(array $gigs, string $calName): string
{
    $host = parse_url(app_url(), PHP_URL_HOST) ?: 'gigmasterpro';
    $lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//GigMasterPro//Gigs//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:' . ics_escape($calName)];
    foreach ($gigs as $g) {
        $start = strtotime($g['date_time'] . ' UTC');
        $duration = max(60, (int) $g['duration']) * 60;
        $desc = trim(implode("\n", array_filter([
            $g['load_in_time'] ? 'Load-in: ' . gmdate('Y-m-d H:i', strtotime($g['load_in_time'] . ' UTC')) . ' UTC' : null,
            $g['payment'] !== null ? 'Payment: $' . number_format((float) $g['payment'], 2) : null,
            'Status: ' . $g['status'],
            $g['notes'] ?: null,
        ])));
        $lines[] = 'BEGIN:VEVENT';
        $lines[] = 'UID:gig-' . $g['id'] . '@' . $host;
        $lines[] = 'DTSTAMP:' . gmdate('Ymd\THis\Z', strtotime($g['updated_at'] . ' UTC'));
        $lines[] = 'DTSTART:' . gmdate('Ymd\THis\Z', $start);
        $lines[] = 'DTEND:' . gmdate('Ymd\THis\Z', $start + $duration);
        $lines[] = 'SUMMARY:' . ics_escape($g['name'] . ($g['venue'] ? ' @ ' . $g['venue'] : ''));
        if ($g['location'] || $g['venue']) {
            $lines[] = 'LOCATION:' . ics_escape(trim($g['venue'] . ($g['location'] ? ', ' . $g['location'] : ''), ', '));
        }
        $lines[] = 'DESCRIPTION:' . ics_escape($desc);
        $lines[] = 'STATUS:' . ($g['status'] === 'cancelled' ? 'CANCELLED' : ($g['status'] === 'confirmed' ? 'CONFIRMED' : 'TENTATIVE'));
        $lines[] = 'URL:' . app_url() . '/gigs/' . $g['id'];
        $lines[] = 'END:VEVENT';
    }
    $lines[] = 'END:VCALENDAR';
    return implode("\r\n", array_map('ics_fold', $lines)) . "\r\n";
}

function send_ics(string $ics, string $filename): void
{
    header('Content-Type: text/calendar; charset=utf-8');
    header('Content-Disposition: attachment; filename="' . $filename . '"');
    header('Cache-Control: no-store');
    echo $ics;
}

return static function (Router $r): void {
    $r->get('/gigs', static function () {
        $params = [uid()];
        $where = 'g.user_id = ?';
        $status = query_param('status');
        if ($status && in_array($status, GIG_STATUSES, true)) {
            $where .= ' AND g.status = ?';
            $params[] = $status;
        }
        $search = trim((string) query_param('search', ''));
        if ($search !== '') {
            $like = '%' . str_replace(['%', '_'], ['\\%', '\\_'], $search) . '%';
            $where .= ' AND (g.name LIKE ? OR g.venue LIKE ? OR g.location LIKE ?)';
            array_push($params, $like, $like, $like);
        }
        if (query_param('upcoming')) {
            $where .= " AND g.date_time >= UTC_TIMESTAMP() - INTERVAL 12 HOUR AND g.status <> 'cancelled'";
        }
        $order = query_param('upcoming') ? 'g.date_time ASC' : 'g.date_time DESC';
        $limit = (int) query_param('limit', 0);
        return out_rows(q_all(
            "SELECT g.*, (SELECT COUNT(*) FROM gig_setlists gs WHERE gs.gig_id = g.id) AS setlist_count FROM gigs g WHERE {$where} ORDER BY {$order}" . ($limit > 0 ? ' LIMIT ' . min($limit, 100) : ''),
            $params
        ));
    });

    $r->post('/gigs', static function () {
        $d = gig_payload(body());
        $pdo = db();
        $pdo->beginTransaction();
        q(
            'INSERT INTO gigs (user_id, name, venue, location, date_time, load_in_time, duration, notes, payment, status) VALUES (?,?,?,?,?,?,?,?,?,?)',
            [uid(), $d['name'], $d['venue'], $d['location'], $d['date_time'], $d['load_in_time'], $d['duration'], $d['notes'], $d['payment'], $d['status']]
        );
        $id = (int) $pdo->lastInsertId();
        if (is_array(input('setlists'))) {
            save_gig_setlists($id, input('setlists'));
        }
        $pdo->commit();
        return gig_detail($id);
    });

    $r->get('/gigs/calendar.ics', static function () {
        $gigs = q_all('SELECT * FROM gigs WHERE user_id = ? ORDER BY date_time', [uid()]);
        send_ics(gigs_to_ics($gigs, 'GigMasterPro Gigs'), 'gigmasterpro-gigs.ics');
        return null;
    });

    $r->get('/calendar/{token}', static function ($p) {
        $token = preg_replace('/\.ics$/', '', (string) $p['token']);
        if (!preg_match('/^[a-f0-9]{32}$/', $token)) {
            throw new HttpError(404, 'Calendar not found.');
        }
        $profile = q_one('SELECT id, display_name FROM profiles WHERE calendar_token = ?', [$token]);
        if (!$profile) {
            throw new HttpError(404, 'Calendar not found.');
        }
        $gigs = q_all('SELECT * FROM gigs WHERE user_id = ? AND date_time > UTC_TIMESTAMP() - INTERVAL 180 DAY ORDER BY date_time', [$profile['id']]);
        send_ics(gigs_to_ics($gigs, $profile['display_name'] . ' — Gigs'), 'gigs.ics');
        return null;
    }, true);

    $r->get('/gigs/{id}', static fn ($p) => gig_detail(id_param($p)));

    $r->get('/gigs/{id}/calendar.ics', static function ($p) {
        $gig = gig_visible_or_404(id_param($p));
        send_ics(gigs_to_ics([$gig], $gig['name']), 'gig-' . $gig['id'] . '.ics');
        return null;
    });

    $r->put('/gigs/{id}', static function ($p) {
        $id = id_param($p);
        owned_or_404('gigs', $id, 'Gig');
        $d = gig_payload(body());
        $pdo = db();
        $pdo->beginTransaction();
        q(
            'UPDATE gigs SET name = ?, venue = ?, location = ?, date_time = ?, load_in_time = ?, duration = ?, notes = ?, payment = ?, status = ? WHERE id = ?',
            [$d['name'], $d['venue'], $d['location'], $d['date_time'], $d['load_in_time'], $d['duration'], $d['notes'], $d['payment'], $d['status'], $id]
        );
        if (is_array(input('setlists'))) {
            save_gig_setlists($id, input('setlists'));
        }
        $pdo->commit();
        return gig_detail($id);
    });

    $r->put('/gigs/{id}/setlists', static function ($p) {
        $id = id_param($p);
        owned_or_404('gigs', $id, 'Gig');
        $pdo = db();
        $pdo->beginTransaction();
        save_gig_setlists($id, input('setlists', []));
        $pdo->commit();
        return gig_detail($id);
    });

    $r->delete('/gigs/{id}', static function ($p) {
        $id = id_param($p);
        owned_or_404('gigs', $id, 'Gig');
        q('DELETE FROM gigs WHERE id = ?', [$id]);
        return ['ok' => true];
    });

    $r->get('/gigs/{id}/play', static function ($p) {
        $id = id_param($p);
        $gig = out_row(gig_visible_or_404($id));
        $rows = q_all(
            'SELECT s.*, ss.notes AS entry_notes, ss.position AS song_position, gs.position AS setlist_position, st.name AS setlist_name, st.id AS setlist_id
             FROM gig_setlists gs
             JOIN setlists st ON st.id = gs.setlist_id
             JOIN setlist_songs ss ON ss.setlist_id = st.id
             JOIN songs s ON s.id = ss.song_id
             WHERE gs.gig_id = ? ORDER BY gs.position, ss.position',
            [$id]
        );
        return [
            'gig' => $gig,
            'songs' => out_rows($rows),
            'settings' => load_play_mode_settings(uid()),
        ];
    });
};
