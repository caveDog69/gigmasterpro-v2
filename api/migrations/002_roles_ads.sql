-- Roles (user/admin), disabled accounts, per-user ad-free flag and site-wide settings.

ALTER TABLE users
  ADD COLUMN role ENUM('user','admin') NOT NULL DEFAULT 'user' AFTER password_hash,
  ADD COLUMN disabled_at DATETIME NULL AFTER email_verified_at,
  ADD COLUMN ad_free TINYINT(1) NOT NULL DEFAULT 0 AFTER disabled_at,
  ADD KEY idx_users_role (role);

CREATE TABLE IF NOT EXISTS app_settings (
  name VARCHAR(64) NOT NULL,
  value TEXT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO app_settings (name, value) VALUES
  ('ads_enabled', '0'),
  ('adsense_client', ''),
  ('adsense_slot_banner', ''),
  ('adsense_slot_sidebar', ''),
  ('adsense_slot_footer', '');
