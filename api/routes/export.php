<?php
declare(strict_types=1);

function csv_out(array $rows, array $columns, string $filename): void
{
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="' . $filename . '"');
    header('Cache-Control: no-store');
    $fh = fopen('php://output', 'w');
    fwrite($fh, "\xEF\xBB\xBF");
    fputcsv($fh, $columns);
    foreach ($rows as $row) {
        $line = [];
        foreach ($columns as $c) {
            $v = $row[$c] ?? '';
            $v = is_bool($v) ? ($v ? 'yes' : 'no') : (string) $v;
            $line[] = preg_match('/^[=+\-@\t\r]/', $v) ? "'" . $v : $v;
        }
        fputcsv($fh, $line);
    }
    fclose($fh);
}

return static function (Router $r): void {
    $r->get('/export', static function () {
        $u = uid();
        $data = [
            'exported_at' => gmdate('c'),
            'profile' => profile_out(q_one('SELECT * FROM profiles WHERE id = ?', [$u]), true),
            'play_mode_settings' => load_play_mode_settings($u),
            'songs' => out_rows(q_all('SELECT * FROM songs WHERE user_id = ? ORDER BY title', [$u])),
            'setlists' => array_map(static function ($s) {
                $s = out_row($s);
                $s['songs'] = out_rows(q_all('SELECT song_id, position, notes FROM setlist_songs WHERE setlist_id = ? ORDER BY position', [$s['id']]));
                return $s;
            }, q_all('SELECT * FROM setlists WHERE user_id = ? ORDER BY name', [$u])),
            'gigs' => array_map(static function ($g) {
                $g = out_row($g);
                $g['setlists'] = out_rows(q_all('SELECT setlist_id, position FROM gig_setlists WHERE gig_id = ? ORDER BY position', [$g['id']]));
                return $g;
            }, q_all('SELECT * FROM gigs WHERE user_id = ? ORDER BY date_time', [$u])),
            'connections' => out_rows(q_all('SELECT * FROM user_connections WHERE requester_id = ? OR recipient_id = ?', [$u, $u])),
            'messages_sent' => out_rows(q_all('SELECT conversation_id, content, created_at FROM messages WHERE sender_id = ? ORDER BY id', [$u])),
        ];
        header('Content-Disposition: attachment; filename="gigmasterpro-export-' . gmdate('Y-m-d') . '.json"');
        return $data;
    });

    $r->get('/export/{type}', static function ($p) {
        $u = uid();
        $type = preg_replace('/\.csv$/', '', (string) $p['type']);
        if ($type === 'songs') {
            $rows = out_rows(q_all('SELECT * FROM songs WHERE user_id = ? ORDER BY title', [$u]));
            csv_out($rows, ['title', 'artist', 'album', 'release_date', 'key', 'tempo', 'duration', 'genre', 'guitar_tuning', 'is_original', 'notes', 'lyrics', 'chords'], 'songs.csv');
        } elseif ($type === 'setlists') {
            $rows = q_all(
                'SELECT st.name AS setlist, ss.position, s.title, s.artist, s.`key`, s.tempo, s.duration, ss.notes
                 FROM setlists st LEFT JOIN setlist_songs ss ON ss.setlist_id = st.id LEFT JOIN songs s ON s.id = ss.song_id
                 WHERE st.user_id = ? ORDER BY st.name, ss.position',
                [$u]
            );
            csv_out($rows, ['setlist', 'position', 'title', 'artist', 'key', 'tempo', 'duration', 'notes'], 'setlists.csv');
        } elseif ($type === 'gigs') {
            $rows = out_rows(q_all('SELECT * FROM gigs WHERE user_id = ? ORDER BY date_time', [$u]));
            csv_out($rows, ['name', 'venue', 'location', 'date_time', 'load_in_time', 'duration', 'payment', 'status', 'notes'], 'gigs.csv');
        } else {
            throw new HttpError(404, 'Unknown export type.');
        }
        return null;
    });
};
