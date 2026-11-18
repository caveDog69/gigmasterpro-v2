<?php
declare(strict_types=1);

const INVITE_TTL_DAYS = 14;
const INVITE_DAILY_LIMIT = 20;
const INVITE_MAX_SENDS = 5;

function invite_hash(string $token): string
{
    return hash('sha256', $token);
}

/** Pending, unexpired invite for a raw token from an invite link, or null. */
function find_open_invite(string $token): ?array
{
    if ($token === '') {
        return null;
    }
    return q_one(
        "SELECT i.*, p.display_name AS inviter_name, p.username AS inviter_username, p.avatar_url AS inviter_avatar
         FROM user_invites i
         JOIN users u ON u.id = i.inviter_id AND u.disabled_at IS NULL
         LEFT JOIN profiles p ON p.id = i.inviter_id
         WHERE i.token_hash = ? AND i.status = 'pending' AND i.expires_at > UTC_TIMESTAMP()",
        [invite_hash($token)]
    );
}

/**
 * Marks open invites for $email as accepted by $userId, connects the new member with each
 * inviter and notifies them. Pass $onlyInviteId to accept just the invite whose link was
 * used; accepting every invite for the address requires a verified email, because the
 * inviter can see their own link.
 */
function accept_invites_for(int $userId, string $email, ?int $onlyInviteId = null): void
{
    if (q_val('SELECT disabled_at FROM users WHERE id = ?', [$userId]) !== null) {
        return;
    }
    $invites = q_all(
        "SELECT i.id, i.inviter_id, i.message FROM user_invites i
         JOIN users u ON u.id = i.inviter_id AND u.disabled_at IS NULL
         WHERE i.email = ? AND i.status = 'pending' AND i.expires_at > UTC_TIMESTAMP() AND i.inviter_id <> ?"
         . ($onlyInviteId !== null ? ' AND i.id = ' . $onlyInviteId : ''),
        [strtolower($email), $userId]
    );
    if (!$invites) {
        return;
    }
    $name = (string) q_val('SELECT display_name FROM profiles WHERE id = ?', [$userId]);
    foreach ($invites as $inv) {
        $inviter = (int) $inv['inviter_id'];
        q("UPDATE user_invites SET status = 'accepted', accepted_user_id = ?, accepted_at = UTC_TIMESTAMP() WHERE id = ?", [$userId, $inv['id']]);
        $linked = q_val(
            'SELECT 1 FROM user_connections WHERE (requester_id = ? AND recipient_id = ?) OR (requester_id = ? AND recipient_id = ?)',
            [$inviter, $userId, $userId, $inviter]
        );
        if (!$linked) {
            q("INSERT INTO user_connections (requester_id, recipient_id, status, message) VALUES (?, ?, 'accepted', ?)", [$inviter, $userId, $inv['message']]);
        }
        notify($inviter, 'invite_accepted', "{$name} joined GigMasterPro from your invite", "You're now connected.", '/community', $userId);
    }
}
