<?php
declare(strict_types=1);

/** Loads a row from a user-owned table, 404 if it does not exist or belongs to someone else. */
function owned_or_404(string $table, int $id, string $label = 'Item'): array
{
    $row = q_one("SELECT * FROM {$table} WHERE id = ? AND user_id = ?", [$id, uid()]);
    if (!$row) {
        throw new HttpError(404, "{$label} not found.");
    }
    return $row;
}

/** SQL fragment: the row (alias.id) is owned by the user or shared with one of the user's bands. */
function visible_sql(string $type, string $alias): string
{
    $map = [
        'song' => ['band_songs', 'song_id'],
        'setlist' => ['band_setlists', 'setlist_id'],
        'gig' => ['band_gigs', 'gig_id'],
    ];
    [$table, $col] = $map[$type];
    $viewer = (string) uid();
    $sql = "({$alias}.user_id = :viewer OR EXISTS (SELECT 1 FROM {$table} bx JOIN band_members bmx ON bmx.band_id = bx.band_id
             WHERE bx.{$col} = {$alias}.id AND bmx.user_id = :viewer)";
    if ($type === 'setlist') {
        $sql .= " OR EXISTS (SELECT 1 FROM gig_setlists gsx JOIN band_gigs bgx ON bgx.gig_id = gsx.gig_id
                  JOIN band_members bmg ON bmg.band_id = bgx.band_id WHERE gsx.setlist_id = {$alias}.id AND bmg.user_id = :viewer)";
    }
    return str_replace(':viewer', $viewer, $sql . ')');
}

function band_membership(int $bandId, int $userId): ?array
{
    return q_one('SELECT * FROM band_members WHERE band_id = ? AND user_id = ?', [$bandId, $userId]);
}

function require_band_role(int $bandId, array $roles = ['owner', 'admin', 'member']): array
{
    $m = band_membership($bandId, uid());
    if (!$m) {
        throw new HttpError(404, 'Band not found.');
    }
    if (!in_array($m['role'], $roles, true)) {
        throw new HttpError(403, 'You do not have permission to do that in this band.');
    }
    return $m;
}

const PRIVATE_PROFILE_FIELDS = ['latitude', 'longitude', 'calendar_token'];

function profile_out(?array $row, bool $self = false, bool $connected = false): ?array
{
    if ($row === null) {
        return null;
    }
    $row = out_row($row);
    $row['avatar_url'] = public_url($row['avatar_url'] ?? null);
    if (!isset($row['instruments']) || !is_array($row['instruments'])) {
        $row['instruments'] = [];
    }
    if (!$self) {
        foreach (PRIVATE_PROFILE_FIELDS as $f) {
            unset($row[$f]);
        }
        if (!$connected) {
            unset($row['phone']);
        }
    }
    return $row;
}

/** Compact profile columns for joins, prefixed: e.g. p.username AS requester_username. */
function profile_brief_cols(string $alias, string $prefix): string
{
    $cols = ['id', 'username', 'display_name', 'avatar_url', 'city', 'state', 'instrument', 'genre'];
    return implode(', ', array_map(static fn ($c) => "{$alias}.{$c} AS {$prefix}_{$c}", $cols));
}

function extract_brief(array &$row, string $prefix): ?array
{
    $out = [];
    foreach (['id', 'username', 'display_name', 'avatar_url', 'city', 'state', 'instrument', 'genre'] as $c) {
        $out[$c] = $row["{$prefix}_{$c}"] ?? null;
        unset($row["{$prefix}_{$c}"]);
    }
    if ($out['id'] === null) {
        return null;
    }
    $out['avatar_url'] = public_url($out['avatar_url']);
    return $out;
}
