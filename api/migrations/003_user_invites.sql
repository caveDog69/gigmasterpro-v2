-- Invitations sent by members to people who don't have an account yet.

CREATE TABLE IF NOT EXISTS user_invites (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  inviter_id INT UNSIGNED NOT NULL,
  email VARCHAR(191) NOT NULL,
  message VARCHAR(500) NULL,
  token_hash CHAR(64) NOT NULL,
  status ENUM('pending','accepted','revoked') NOT NULL DEFAULT 'pending',
  accepted_user_id INT UNSIGNED NULL,
  send_count TINYINT UNSIGNED NOT NULL DEFAULT 0,
  sent_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL,
  accepted_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_user_invites_token (token_hash),
  UNIQUE KEY uq_user_invites_inviter_email (inviter_id, email),
  KEY idx_user_invites_email (email, status),
  KEY idx_user_invites_sent (inviter_id, sent_at),
  CONSTRAINT fk_user_invites_inviter FOREIGN KEY (inviter_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_user_invites_accepted_user FOREIGN KEY (accepted_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
