-- Per-song visibility and members hidden from a user's community feed.

ALTER TABLE songs
  ADD COLUMN visibility ENUM('private','bands','connections') NOT NULL DEFAULT 'bands' AFTER is_original;

CREATE TABLE IF NOT EXISTS hidden_members (
  user_id INT UNSIGNED NOT NULL,
  hidden_user_id INT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, hidden_user_id),
  KEY idx_hidden_members_hidden (hidden_user_id),
  CONSTRAINT fk_hidden_members_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_hidden_members_hidden FOREIGN KEY (hidden_user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
