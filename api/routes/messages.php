<?php
declare(strict_types=1);

function conversation_for_user(int $id): array
{
    $c = q_one('SELECT * FROM conversations WHERE id = ? AND (participant_1_id = ? OR participant_2_id = ?)', [$id, uid(), uid()]);
    if (!$c) {
        throw new HttpError(404, 'Conversation not found.');
    }
    return $c;
}

function conversation_list(?int $onlyId = null): array
{
    $sql = 'SELECT c.*, ' . profile_brief_cols('o', 'o') . ',
              (SELECT content FROM messages m WHERE m.conversation_id = c.id ORDER BY m.id DESC LIMIT 1) AS last_message_content,
              (SELECT sender_id FROM messages m WHERE m.conversation_id = c.id ORDER BY m.id DESC LIMIT 1) AS last_message_sender_id,
              (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id AND m.sender_id <> :me1 AND m.is_read = 0) AS unread_count
            FROM conversations c
            JOIN profiles o ON o.id = IF(c.participant_1_id = :me2, c.participant_2_id, c.participant_1_id)
            WHERE (c.participant_1_id = :me3 OR c.participant_2_id = :me4)' . ($onlyId ? ' AND c.id = :cid' : '') . '
            ORDER BY c.last_message_at DESC';
    $params = ['me1' => uid(), 'me2' => uid(), 'me3' => uid(), 'me4' => uid()];
    if ($onlyId) {
        $params['cid'] = $onlyId;
    }
    return array_map(static function ($row) {
        $other = extract_brief($row, 'o');
        $row = out_row($row);
        $row['other_participant'] = $other;
        $row['unread_count'] = (int) $row['unread_count'];
        return $row;
    }, q_all($sql, $params));
}

return static function (Router $r): void {
    $r->get('/conversations', static fn () => conversation_list());

    $r->post('/conversations', static function () {
        $other = (int) input('user_id', 0);
        if ($other === uid() || !are_connected(uid(), $other)) {
            throw new HttpError(403, 'You can only message musicians you are connected with.');
        }
        $p1 = min(uid(), $other);
        $p2 = max(uid(), $other);
        q('INSERT IGNORE INTO conversations (participant_1_id, participant_2_id) VALUES (?, ?)', [$p1, $p2]);
        $id = (int) q_val('SELECT id FROM conversations WHERE participant_1_id = ? AND participant_2_id = ?', [$p1, $p2]);
        return conversation_list($id)[0];
    });

    $r->get('/conversations/{id}/messages', static function ($p) {
        $c = conversation_for_user(id_param($p));
        $after = (int) query_param('after_id', 0);
        $rows = $after > 0
            ? q_all('SELECT * FROM messages WHERE conversation_id = ? AND id > ? ORDER BY id ASC LIMIT 200', [$c['id'], $after])
            : array_reverse(q_all('SELECT * FROM messages WHERE conversation_id = ? ORDER BY id DESC LIMIT 200', [$c['id']]));
        return out_rows($rows);
    });

    $r->post('/conversations/{id}/messages', static function ($p) {
        $c = conversation_for_user(id_param($p));
        $content = str_input(body(), 'content', 5000);
        if ($content === '') {
            throw new HttpError(422, 'Message cannot be empty.');
        }
        $other = (int) $c['participant_1_id'] === uid() ? (int) $c['participant_2_id'] : (int) $c['participant_1_id'];
        if (!are_connected(uid(), $other)) {
            throw new HttpError(403, 'You are no longer connected with this musician.');
        }
        q('INSERT INTO messages (conversation_id, sender_id, content) VALUES (?, ?, ?)', [$c['id'], uid(), $content]);
        $id = (int) db()->lastInsertId();
        q('UPDATE conversations SET last_message_at = UTC_TIMESTAMP() WHERE id = ?', [$c['id']]);
        $recentlyNotified = q_val(
            "SELECT 1 FROM notifications WHERE user_id = ? AND actor_id = ? AND type = 'message' AND is_read = 0 AND created_at > UTC_TIMESTAMP() - INTERVAL 10 MINUTE",
            [$other, uid()]
        );
        if (!$recentlyNotified) {
            $name = q_val('SELECT display_name FROM profiles WHERE id = ?', [uid()]);
            notify($other, 'message', "New message from {$name}", mb_substr($content, 0, 140), '/community?chat=' . uid(), uid());
        }
        return out_row(q_one('SELECT * FROM messages WHERE id = ?', [$id]));
    });

    $r->put('/conversations/{id}/read', static function ($p) {
        $c = conversation_for_user(id_param($p));
        q('UPDATE messages SET is_read = 1 WHERE conversation_id = ? AND sender_id <> ? AND is_read = 0', [$c['id'], uid()]);
        $other = (int) $c['participant_1_id'] === uid() ? (int) $c['participant_2_id'] : (int) $c['participant_1_id'];
        q("UPDATE notifications SET is_read = 1 WHERE user_id = ? AND actor_id = ? AND type = 'message'", [uid(), $other]);
        return ['ok' => true];
    });

    $r->get('/messages/unread-counts', static function () {
        $rows = q_all(
            'SELECT c.id AS conversation_id, IF(c.participant_1_id = ?, c.participant_2_id, c.participant_1_id) AS user_id, COUNT(m.id) AS n
             FROM conversations c JOIN messages m ON m.conversation_id = c.id AND m.sender_id <> ? AND m.is_read = 0
             WHERE c.participant_1_id = ? OR c.participant_2_id = ? GROUP BY c.id',
            [uid(), uid(), uid(), uid()]
        );
        $byConversation = [];
        $byUser = [];
        $total = 0;
        foreach ($rows as $row) {
            $byConversation[$row['conversation_id']] = (int) $row['n'];
            $byUser[$row['user_id']] = (int) $row['n'];
            $total += (int) $row['n'];
        }
        return ['total' => $total, 'by_conversation' => (object) $byConversation, 'by_user' => (object) $byUser];
    });

    $r->get('/notifications', static function () {
        $rows = q_all(
            'SELECT n.*, ' . profile_brief_cols('a', 'a') . ' FROM notifications n LEFT JOIN profiles a ON a.id = n.actor_id
             WHERE n.user_id = ? ORDER BY n.id DESC LIMIT 50',
            [uid()]
        );
        return array_map(static function ($row) {
            $actor = extract_brief($row, 'a');
            $row = out_row($row);
            $row['actor'] = $actor;
            return $row;
        }, $rows);
    });

    $r->get('/notifications/summary', static function () {
        return [
            'unread_notifications' => (int) q_val('SELECT COUNT(*) FROM notifications WHERE user_id = ? AND is_read = 0', [uid()]),
            'unread_messages' => (int) q_val(
                'SELECT COUNT(*) FROM messages m JOIN conversations c ON c.id = m.conversation_id
                 WHERE (c.participant_1_id = ? OR c.participant_2_id = ?) AND m.sender_id <> ? AND m.is_read = 0',
                [uid(), uid(), uid()]
            ),
            'pending_connections' => (int) q_val("SELECT COUNT(*) FROM user_connections WHERE recipient_id = ? AND status = 'pending'", [uid()]),
            'pending_band_invitations' => (int) q_val("SELECT COUNT(*) FROM band_invitations WHERE invitee_id = ? AND status = 'pending'", [uid()]),
            'latest_notification_id' => (int) q_val('SELECT COALESCE(MAX(id), 0) FROM notifications WHERE user_id = ?', [uid()]),
        ];
    });

    $r->put('/notifications/read-all', static function () {
        q('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [uid()]);
        return ['ok' => true];
    });

    $r->put('/notifications/{id}/read', static function ($p) {
        q('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?', [id_param($p), uid()]);
        return ['ok' => true];
    });
};
