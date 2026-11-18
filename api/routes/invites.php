<?php
declare(strict_types=1);

function invite_out(array $i): array
{
    $status = $i['status'];
    if ($status === 'pending' && strtotime($i['expires_at'] . ' UTC') <= time()) {
        $status = 'expired';
    }
    $o = out_row([
        'sent_at' => $i['sent_at'],
        'expires_at' => $i['expires_at'],
        'accepted_at' => $i['accepted_at'],
        'created_at' => $i['created_at'],
    ]);
    return [
        'id' => (int) $i['id'],
        'email' => $i['email'],
        'message' => $i['message'],
        'status' => $status,
        'sent_at' => $o['sent_at'],
        'expires_at' => $o['expires_at'],
        'accepted_at' => $o['accepted_at'],
        'created_at' => $o['created_at'],
        'accepted_user' => !empty($i['accepted_user_id']) && $i['member_username'] !== null ? [
            'id' => (int) $i['accepted_user_id'],
            'username' => $i['member_username'],
            'display_name' => $i['member_name'],
            'avatar_url' => public_url($i['member_avatar'] ?? null),
        ] : null,
    ];
}

const INVITE_COLS = 'i.*, p.username AS member_username, p.display_name AS member_name, p.avatar_url AS member_avatar';

function load_own_invite(int $id): array
{
    $row = q_one('SELECT ' . INVITE_COLS . ' FROM user_invites i LEFT JOIN profiles p ON p.id = i.accepted_user_id WHERE i.id = ? AND i.inviter_id = ?', [$id, uid()]);
    if (!$row) {
        throw new HttpError(404, 'Invite not found.');
    }
    return $row;
}

function invites_sent_today(): int
{
    return (int) q_val('SELECT COUNT(*) FROM user_invites WHERE inviter_id = ? AND sent_at > UTC_TIMESTAMP() - INTERVAL 1 DAY', [uid()]);
}

function assert_can_invite(string $email): void
{
    if (q_val('SELECT 1 FROM users WHERE email = ?', [$email])) {
        throw new HttpError(409, 'That person already has a GigMasterPro account. Find them in Community instead.');
    }
    if (invites_sent_today() >= INVITE_DAILY_LIMIT) {
        throw new HttpError(429, 'You have sent ' . INVITE_DAILY_LIMIT . ' invites in the last 24 hours. Please try again tomorrow.');
    }
}

function assert_resend_allowed(array $invite): void
{
    if ($invite['status'] === 'accepted') {
        throw new HttpError(409, 'This person has already joined.');
    }
    if ($invite['status'] === 'pending' && strtotime($invite['sent_at'] . ' UTC') > time() - 3600) {
        throw new HttpError(429, 'You already invited this person in the last hour. You can resend the invite after that.');
    }
}

/** Issues a fresh link for the invite row, emails it, and returns the API response. */
function send_invite(int $id): array
{
    $token = random_token();
    q(
        "UPDATE user_invites SET token_hash = ?, status = 'pending', accepted_user_id = NULL, accepted_at = NULL,
         sent_at = UTC_TIMESTAMP(), expires_at = UTC_TIMESTAMP() + INTERVAL " . INVITE_TTL_DAYS . ' DAY WHERE id = ?',
        [invite_hash($token), $id]
    );
    $invite = load_own_invite($id);
    $link = app_url() . '/signup?invite=' . $token;
    $name = (string) q_val('SELECT display_name FROM profiles WHERE id = ?', [uid()]);
    $note = $invite['message'] ? "\n\n\"{$invite['message']}\"\n— {$name}" : '';
    $mailed = send_mail(
        $invite['email'],
        "{$name} invited you to GigMasterPro",
        "{$name} invited you to join GigMasterPro, the app for musicians to manage songs, setlists, gigs and bands.{$note}\n\nCreate your free account here:\n{$link}\n\nThe invite expires in " . INVITE_TTL_DAYS . " days. If you weren't expecting this, you can ignore this email."
    );
    return ['invite' => invite_out($invite), 'link' => $link, 'email_sent' => $mailed, 'remaining_today' => max(0, INVITE_DAILY_LIMIT - invites_sent_today())];
}

return static function (Router $r): void {
    $r->get('/invites', static function () {
        $rows = q_all('SELECT ' . INVITE_COLS . ' FROM user_invites i LEFT JOIN profiles p ON p.id = i.accepted_user_id WHERE i.inviter_id = ? ORDER BY i.sent_at DESC, i.id DESC', [uid()]);
        return [
            'invites' => array_map('invite_out', $rows),
            'daily_limit' => INVITE_DAILY_LIMIT,
            'remaining_today' => max(0, INVITE_DAILY_LIMIT - invites_sent_today()),
        ];
    });

    $r->post('/invites', static function () {
        $b = body();
        $email = strtolower(str_input($b, 'email', 191));
        $message = nullable_str($b, 'message', 500);
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            throw new HttpError(422, 'Please enter a valid email address.');
        }
        assert_can_invite($email);
        $existing = q_one('SELECT id, status, sent_at FROM user_invites WHERE inviter_id = ? AND email = ?', [uid(), $email]);
        if ($existing) {
            assert_resend_allowed($existing);
        }
        if ($existing) {
            $id = (int) $existing['id'];
            q('UPDATE user_invites SET message = ? WHERE id = ?', [$message, $id]);
        } else {
            q(
                'INSERT INTO user_invites (inviter_id, email, message, token_hash, expires_at) VALUES (?, ?, ?, ?, UTC_TIMESTAMP() + INTERVAL ' . INVITE_TTL_DAYS . ' DAY)',
                [uid(), $email, $message, invite_hash(random_token())]
            );
            $id = (int) db()->lastInsertId();
        }
        return send_invite($id);
    });

    $r->post('/invites/{id}/resend', static function (array $p) {
        $invite = load_own_invite(id_param($p));
        assert_can_invite($invite['email']);
        assert_resend_allowed($invite);
        return send_invite((int) $invite['id']);
    });

    $r->delete('/invites/{id}', static function (array $p) {
        $invite = load_own_invite(id_param($p));
        if ($invite['status'] === 'accepted') {
            throw new HttpError(409, 'This person has already joined.');
        }
        q("UPDATE user_invites SET status = 'revoked' WHERE id = ?", [$invite['id']]);
        return invite_out(load_own_invite((int) $invite['id']));
    });

    $r->get('/invites/lookup', static function () {
        $invite = find_open_invite((string) query_param('token', ''));
        if (!$invite) {
            throw new HttpError(404, 'This invite link is invalid or has expired. You can still sign up below.');
        }
        return [
            'email' => $invite['email'],
            'inviter' => [
                'display_name' => $invite['inviter_name'],
                'username' => $invite['inviter_username'],
                'avatar_url' => public_url($invite['inviter_avatar'] ?? null),
            ],
        ];
    }, true);
};
