<?php
declare(strict_types=1);

const BAND_SHARE_TYPES = [
    'songs' => ['band_songs', 'song_id', 'songs', 'Song'],
    'setlists' => ['band_setlists', 'setlist_id', 'setlists', 'Setlist'],
    'gigs' => ['band_gigs', 'gig_id', 'gigs', 'Gig'],
];

function band_payload(array $b): array
{
    $name = str_input($b, 'name', 191);
    if ($name === '') {
        throw new HttpError(422, 'Band name is required.');
    }
    return ['name' => $name, 'description' => str_input($b, 'description', 5000), 'is_public' => bool_input($b, 'is_public') ? 1 : 0];
}

function band_detail(int $bandId): array
{
    $membership = require_band_role($bandId);
    $band = out_row(q_one('SELECT * FROM bands WHERE id = ?', [$bandId]));
    $band['my_role'] = $membership['role'];
    $band['my_can_edit'] = (bool) $membership['can_edit'] || in_array($membership['role'], ['owner', 'admin'], true);
    $band['members'] = array_map(static function ($row) {
        $profile = extract_brief($row, 'p');
        $row = out_row($row);
        $row['profile'] = $profile;
        return $row;
    }, q_all(
        "SELECT bm.*, " . profile_brief_cols('p', 'p') . " FROM band_members bm JOIN profiles p ON p.id = bm.user_id
         WHERE bm.band_id = ? ORDER BY FIELD(bm.role, 'owner', 'admin', 'member'), p.display_name",
        [$bandId]
    ));
    $band['songs'] = array_map('band_share_out', q_all(
        'SELECT bs.id AS share_id, bs.added_by, bs.created_at AS shared_at, s.id, s.user_id, s.title, s.artist, s.`key`, s.tempo, s.duration, s.genre, s.guitar_tuning,
                (s.lyrics IS NOT NULL AND s.lyrics <> \'\') AS has_lyrics, (s.chords IS NOT NULL AND s.chords <> \'\') AS has_chords, p.display_name AS added_by_name
         FROM band_songs bs JOIN songs s ON s.id = bs.song_id JOIN profiles p ON p.id = bs.added_by WHERE bs.band_id = ? ORDER BY s.title',
        [$bandId]
    ));
    $band['setlists'] = array_map('band_share_out', q_all(
        'SELECT bs.id AS share_id, bs.added_by, bs.created_at AS shared_at, st.id, st.user_id, st.name, st.description, st.duration,
                (SELECT COUNT(*) FROM setlist_songs ss WHERE ss.setlist_id = st.id) AS song_count, p.display_name AS added_by_name
         FROM band_setlists bs JOIN setlists st ON st.id = bs.setlist_id JOIN profiles p ON p.id = bs.added_by WHERE bs.band_id = ? ORDER BY st.name',
        [$bandId]
    ));
    $band['gigs'] = array_map('band_share_out', q_all(
        'SELECT bg.id AS share_id, bg.added_by, bg.created_at AS shared_at, g.id, g.user_id, g.name, g.venue, g.location, g.date_time, g.status, p.display_name AS added_by_name
         FROM band_gigs bg JOIN gigs g ON g.id = bg.gig_id JOIN profiles p ON p.id = bg.added_by WHERE bg.band_id = ? ORDER BY g.date_time DESC',
        [$bandId]
    ));
    $band['invitations'] = in_array($membership['role'], ['owner', 'admin'], true) ? array_map(static function ($row) {
        $invitee = extract_brief($row, 'i');
        $row = out_row($row);
        $row['invitee'] = $invitee;
        return $row;
    }, q_all(
        "SELECT bi.*, " . profile_brief_cols('i', 'i') . " FROM band_invitations bi JOIN profiles i ON i.id = bi.invitee_id WHERE bi.band_id = ? AND bi.status = 'pending' ORDER BY bi.created_at DESC",
        [$bandId]
    )) : [];
    return $band;
}

function band_share_out(array $row): array
{
    $row = out_row($row);
    $row['shared_at'] = out_row(['created_at' => $row['shared_at']])['created_at'];
    foreach (['has_lyrics', 'has_chords'] as $k) {
        if (array_key_exists($k, $row)) {
            $row[$k] = (bool) $row[$k];
        }
    }
    return $row;
}

function band_invitation_list(): array
{
    return array_map(static function ($row) {
        $inviter = extract_brief($row, 'iv');
        $row = out_row($row);
        $row['inviter'] = $inviter;
        $row['band'] = ['id' => (int) $row['band_id'], 'name' => $row['band_name'], 'description' => $row['band_description']];
        unset($row['band_name'], $row['band_description']);
        return $row;
    }, q_all(
        "SELECT bi.*, b.name AS band_name, b.description AS band_description, " . profile_brief_cols('iv', 'iv') . "
         FROM band_invitations bi JOIN bands b ON b.id = bi.band_id JOIN profiles iv ON iv.id = bi.inviter_id
         WHERE bi.invitee_id = ? AND bi.status = 'pending' ORDER BY bi.created_at DESC",
        [uid()]
    ));
}

return static function (Router $r): void {
    $r->get('/bands', static function () {
        $bands = out_rows(q_all(
            'SELECT b.*, bm.role AS my_role, (SELECT COUNT(*) FROM band_members x WHERE x.band_id = b.id) AS member_count,
                    (SELECT COUNT(*) FROM band_songs x WHERE x.band_id = b.id) AS song_count,
                    (SELECT COUNT(*) FROM band_gigs x JOIN gigs g ON g.id = x.gig_id WHERE x.band_id = b.id AND g.date_time >= UTC_TIMESTAMP()) AS upcoming_gig_count
             FROM bands b JOIN band_members bm ON bm.band_id = b.id AND bm.user_id = ? ORDER BY b.name',
            [uid()]
        ));
        return ['bands' => $bands, 'invitations' => band_invitation_list()];
    });

    $r->post('/bands', static function () {
        $d = band_payload(body());
        $pdo = db();
        $pdo->beginTransaction();
        q('INSERT INTO bands (name, description, owner_id, is_public) VALUES (?,?,?,?)', [$d['name'], $d['description'], uid(), $d['is_public']]);
        $id = (int) $pdo->lastInsertId();
        q("INSERT INTO band_members (band_id, user_id, role, can_edit) VALUES (?, ?, 'owner', 1)", [$id, uid()]);
        $pdo->commit();
        return band_detail($id);
    });

    $r->get('/band-invitations', static fn () => band_invitation_list());

    $r->put('/band-invitations/{id}', static function ($p) {
        $id = id_param($p);
        $inv = q_one("SELECT * FROM band_invitations WHERE id = ? AND invitee_id = ? AND status = 'pending'", [$id, uid()]);
        if (!$inv) {
            throw new HttpError(404, 'Invitation not found.');
        }
        $status = (string) input('status', '');
        if (!in_array($status, ['accepted', 'declined'], true)) {
            throw new HttpError(422, 'Invalid status.');
        }
        $pdo = db();
        $pdo->beginTransaction();
        q('UPDATE band_invitations SET status = ? WHERE id = ?', [$status, $id]);
        if ($status === 'accepted') {
            q("INSERT IGNORE INTO band_members (band_id, user_id, role) VALUES (?, ?, 'member')", [$inv['band_id'], uid()]);
            $name = q_val('SELECT display_name FROM profiles WHERE id = ?', [uid()]);
            $band = q_val('SELECT name FROM bands WHERE id = ?', [$inv['band_id']]);
            notify((int) $inv['inviter_id'], 'band_joined', "{$name} joined {$band}", '', '/bands/' . $inv['band_id'], uid());
        }
        $pdo->commit();
        return ['ok' => true, 'band_id' => (int) $inv['band_id']];
    });

    $r->get('/bands/{id}', static fn ($p) => band_detail(id_param($p)));

    $r->put('/bands/{id}', static function ($p) {
        $id = id_param($p);
        require_band_role($id, ['owner', 'admin']);
        $d = band_payload(body());
        q('UPDATE bands SET name = ?, description = ?, is_public = ? WHERE id = ?', [$d['name'], $d['description'], $d['is_public'], $id]);
        return band_detail($id);
    });

    $r->delete('/bands/{id}', static function ($p) {
        $id = id_param($p);
        require_band_role($id, ['owner']);
        q('DELETE FROM bands WHERE id = ?', [$id]);
        return ['ok' => true];
    });

    $r->post('/bands/{id}/invitations', static function ($p) {
        $id = id_param($p);
        require_band_role($id, ['owner', 'admin']);
        $invitee = (int) input('user_id', 0);
        if (!$invitee && ($username = strtolower(trim((string) input('username', ''))))) {
            $invitee = (int) q_val('SELECT id FROM profiles WHERE username = ?', [ltrim($username, '@')]);
        }
        if (!$invitee || !q_val('SELECT 1 FROM profiles WHERE id = ?', [$invitee])) {
            throw new HttpError(422, 'Musician not found.');
        }
        if (band_membership($id, $invitee)) {
            throw new HttpError(409, 'That musician is already in the band.');
        }
        q(
            "INSERT INTO band_invitations (band_id, inviter_id, invitee_id, status) VALUES (?, ?, ?, 'pending')
             ON DUPLICATE KEY UPDATE status = 'pending', inviter_id = VALUES(inviter_id)",
            [$id, uid(), $invitee]
        );
        $band = q_val('SELECT name FROM bands WHERE id = ?', [$id]);
        $name = q_val('SELECT display_name FROM profiles WHERE id = ?', [uid()]);
        notify($invitee, 'band_invitation', "{$name} invited you to join {$band}", '', '/bands', uid());
        return band_detail($id);
    });

    $r->delete('/bands/{id}/invitations/{invitationId}', static function ($p) {
        $id = id_param($p);
        require_band_role($id, ['owner', 'admin']);
        q('DELETE FROM band_invitations WHERE id = ? AND band_id = ?', [id_param($p, 'invitationId'), $id]);
        return band_detail($id);
    });

    $r->put('/bands/{id}/members/{userId}', static function ($p) {
        $id = id_param($p);
        $me = require_band_role($id, ['owner', 'admin']);
        $target = band_membership($id, id_param($p, 'userId'));
        if (!$target) {
            throw new HttpError(404, 'Member not found.');
        }
        $b = body();
        $role = $b['role'] ?? $target['role'];
        if (!in_array($role, ['owner', 'admin', 'member'], true)) {
            throw new HttpError(422, 'Invalid role.');
        }
        if ($target['role'] === 'owner' && (int) $target['user_id'] !== uid()) {
            throw new HttpError(403, 'The band owner can only be changed by the owner.');
        }
        if ($me['role'] !== 'owner' && $role !== $target['role']) {
            throw new HttpError(403, 'Only the owner can change roles.');
        }
        $canEdit = array_key_exists('can_edit', $b) ? (bool) $b['can_edit'] : (bool) $target['can_edit'];
        $pdo = db();
        $pdo->beginTransaction();
        if ($role === 'owner' && $target['role'] !== 'owner') {
            q("UPDATE band_members SET role = 'admin' WHERE band_id = ? AND user_id = ?", [$id, uid()]);
            q('UPDATE bands SET owner_id = ? WHERE id = ?', [$target['user_id'], $id]);
            $canEdit = true;
        } elseif ($target['role'] === 'owner' && $role !== 'owner') {
            throw new HttpError(422, 'Transfer ownership by making another member the owner.');
        }
        q('UPDATE band_members SET role = ?, can_edit = ? WHERE id = ?', [$role, $canEdit ? 1 : 0, $target['id']]);
        $pdo->commit();
        return band_detail($id);
    });

    $r->delete('/bands/{id}/members/{userId}', static function ($p) {
        $id = id_param($p);
        $userId = id_param($p, 'userId');
        $me = require_band_role($id);
        $target = band_membership($id, $userId);
        if (!$target) {
            throw new HttpError(404, 'Member not found.');
        }
        if ($target['role'] === 'owner') {
            throw new HttpError(422, 'The owner cannot leave. Transfer ownership or delete the band.');
        }
        if ($userId !== uid() && !in_array($me['role'], ['owner', 'admin'], true)) {
            throw new HttpError(403, 'Only owners and admins can remove members.');
        }
        if ($userId !== uid() && $me['role'] === 'admin' && $target['role'] === 'admin') {
            throw new HttpError(403, 'Only the owner can remove an admin.');
        }
        q('DELETE FROM band_members WHERE id = ?', [$target['id']]);
        return $userId === uid() ? ['ok' => true, 'left' => true] : band_detail($id);
    });

    $r->post('/bands/{id}/{type}', static function ($p) {
        $id = id_param($p);
        $type = $p['type'];
        if (!isset(BAND_SHARE_TYPES[$type])) {
            throw new HttpError(404, 'Endpoint not found.');
        }
        [$table, $col, $source, $label] = BAND_SHARE_TYPES[$type];
        $me = require_band_role($id);
        if (!$me['can_edit'] && !in_array($me['role'], ['owner', 'admin'], true)) {
            throw new HttpError(403, 'You need edit permission to share with this band.');
        }
        $ids = input('ids', input($col) !== null ? [input($col)] : []);
        if (!is_array($ids) || !$ids) {
            throw new HttpError(422, "Choose at least one item to share.");
        }
        foreach ($ids as $itemId) {
            owned_or_404($source, (int) $itemId, $label);
            q("INSERT IGNORE INTO {$table} (band_id, {$col}, added_by) VALUES (?, ?, ?)", [$id, (int) $itemId, uid()]);
        }
        return band_detail($id);
    });

    $r->delete('/bands/{id}/{type}/{itemId}', static function ($p) {
        $id = id_param($p);
        $type = $p['type'];
        if (!isset(BAND_SHARE_TYPES[$type])) {
            throw new HttpError(404, 'Endpoint not found.');
        }
        [$table, $col] = BAND_SHARE_TYPES[$type];
        $me = require_band_role($id);
        $share = q_one("SELECT * FROM {$table} WHERE band_id = ? AND {$col} = ?", [$id, id_param($p, 'itemId')]);
        if (!$share) {
            throw new HttpError(404, 'Not shared with this band.');
        }
        if ((int) $share['added_by'] !== uid() && !in_array($me['role'], ['owner', 'admin'], true)) {
            throw new HttpError(403, 'Only the person who shared it or a band admin can remove it.');
        }
        q("DELETE FROM {$table} WHERE id = ?", [$share['id']]);
        return band_detail($id);
    });
};
