<?php
declare(strict_types=1);

const FEEDBACK_STATUSES = ['new', 'read', 'resolved'];
const FEEDBACK_MESSAGE_MAX = 5000;
const FEEDBACK_DAILY_LIMIT = 20;
const FEEDBACK_COLS = 'f.id, f.user_id, f.subject, f.message, f.status, f.created_at, f.updated_at, u.email, p.username, p.display_name, p.avatar_url';
const FEEDBACK_FROM = 'feedback f JOIN users u ON u.id = f.user_id LEFT JOIN profiles p ON p.id = f.user_id';

function feedback_out(array $f): array
{
    $o = out_row(['created_at' => $f['created_at'], 'updated_at' => $f['updated_at']]);
    return [
        'id' => (int) $f['id'],
        'subject' => $f['subject'],
        'message' => $f['message'],
        'status' => $f['status'],
        'created_at' => $o['created_at'],
        'updated_at' => $o['updated_at'],
        'user' => [
            'id' => (int) $f['user_id'],
            'email' => $f['email'],
            'username' => $f['username'],
            'display_name' => $f['display_name'],
            'avatar_url' => public_url($f['avatar_url'] ?? null),
        ],
    ];
}

function load_feedback(int $id): array
{
    $row = q_one('SELECT ' . FEEDBACK_COLS . ' FROM ' . FEEDBACK_FROM . ' WHERE f.id = ?', [$id]);
    if (!$row) {
        throw new HttpError(404, 'Feedback not found.');
    }
    return $row;
}

return static function (Router $r): void {
    $r->post('/feedback', static function () {
        $b = body();
        $subject = nullable_str($b, 'subject', 191);
        $message = str_input($b, 'message', FEEDBACK_MESSAGE_MAX);
        if ($message === '') {
            throw new HttpError(422, 'Please enter your feedback.');
        }
        $recent = (int) q_val('SELECT COUNT(*) FROM feedback WHERE user_id = ? AND created_at > UTC_TIMESTAMP() - INTERVAL 1 DAY', [uid()]);
        if ($recent >= FEEDBACK_DAILY_LIMIT) {
            throw new HttpError(429, 'You have sent a lot of feedback today. Please try again tomorrow.');
        }
        q('INSERT INTO feedback (user_id, subject, message) VALUES (?, ?, ?)', [uid(), $subject, $message]);
        return feedback_out(load_feedback((int) db()->lastInsertId()));
    });

    $r->get('/feedback', static function () {
        $rows = q_all('SELECT ' . FEEDBACK_COLS . ' FROM ' . FEEDBACK_FROM . ' WHERE f.user_id = ? ORDER BY f.created_at DESC, f.id DESC LIMIT 50', [uid()]);
        return array_map('feedback_out', $rows);
    });

    $r->get('/admin/feedback', static function () {
        require_admin();
        $where = '1 = 1';
        $params = [];
        $status = query_param('status');
        if ($status !== null && $status !== 'all') {
            if (!in_array($status, FEEDBACK_STATUSES, true)) {
                throw new HttpError(422, 'Status must be new, read or resolved.');
            }
            $where = 'f.status = ?';
            $params[] = $status;
        }
        $limit = int_input($_GET, 'limit', 50, 1, 200);
        $offset = int_input($_GET, 'offset', 0, 0, 1000000);
        $total = (int) q_val("SELECT COUNT(*) FROM feedback f WHERE {$where}", $params);
        $rows = q_all('SELECT ' . FEEDBACK_COLS . ' FROM ' . FEEDBACK_FROM . " WHERE {$where} ORDER BY f.created_at DESC, f.id DESC LIMIT {$limit} OFFSET {$offset}", $params);
        $counts = array_fill_keys(FEEDBACK_STATUSES, 0);
        foreach (q_all('SELECT status, COUNT(*) AS n FROM feedback GROUP BY status') as $c) {
            $counts[$c['status']] = (int) $c['n'];
        }
        $counts['all'] = array_sum($counts);
        return ['total' => $total, 'feedback' => array_map('feedback_out', $rows), 'counts' => $counts];
    });

    $r->put('/admin/feedback/{id}', static function (array $p) {
        require_admin();
        $id = id_param($p);
        load_feedback($id);
        $status = (string) input('status', '');
        if (!in_array($status, FEEDBACK_STATUSES, true)) {
            throw new HttpError(422, 'Status must be new, read or resolved.');
        }
        q('UPDATE feedback SET status = ? WHERE id = ?', [$status, $id]);
        return feedback_out(load_feedback($id));
    });
};
