-- GigMasterPro MySQL schema (InnoDB, utf8mb4).
-- Applied automatically by the API on first request (see api/lib/migrate.php),
-- or import manually through phpMyAdmin.

CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  email VARCHAR(191) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  email_verified_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS auth_tokens (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  token_hash CHAR(64) NOT NULL,
  user_agent VARCHAR(255) NULL,
  expires_at DATETIME NOT NULL,
  last_used_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_auth_tokens_hash (token_hash),
  KEY idx_auth_tokens_user (user_id),
  CONSTRAINT fk_auth_tokens_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS email_tokens (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  purpose ENUM('verify','reset') NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_email_tokens_hash (token_hash),
  KEY idx_email_tokens_user (user_id, purpose),
  CONSTRAINT fk_email_tokens_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS login_attempts (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  ip VARCHAR(45) NOT NULL,
  email VARCHAR(191) NOT NULL,
  attempted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_login_attempts_lookup (email, ip, attempted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS profiles (
  id INT UNSIGNED NOT NULL,
  username VARCHAR(50) NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  bio TEXT NULL,
  location VARCHAR(191) NULL,
  city VARCHAR(100) NULL,
  state CHAR(2) NULL,
  zip VARCHAR(10) NULL,
  phone VARCHAR(30) NULL,
  instrument VARCHAR(100) NULL,
  genre VARCHAR(50) NULL,
  avatar_url VARCHAR(255) NULL,
  website VARCHAR(255) NULL,
  instruments JSON NULL,
  experience_level ENUM('beginner','intermediate','advanced','professional') NULL,
  commitment_level ENUM('casual','serious','professional') NULL,
  equipment TEXT NULL,
  is_public TINYINT(1) NOT NULL DEFAULT 0,
  latitude DECIMAL(9,6) NULL,
  longitude DECIMAL(9,6) NULL,
  calendar_token CHAR(32) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_profiles_username (username),
  UNIQUE KEY uq_profiles_calendar_token (calendar_token),
  KEY idx_profiles_public (is_public),
  CONSTRAINT fk_profiles_user FOREIGN KEY (id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS zip_geocodes (
  zip CHAR(5) NOT NULL,
  latitude DECIMAL(9,6) NULL,
  longitude DECIMAL(9,6) NULL,
  city VARCHAR(100) NULL,
  state CHAR(2) NULL,
  fetched_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (zip)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS songs (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  title VARCHAR(255) NOT NULL,
  artist VARCHAR(255) NOT NULL DEFAULT '',
  album VARCHAR(255) NOT NULL DEFAULT '',
  release_date DATE NULL,
  `key` VARCHAR(10) NOT NULL DEFAULT '',
  tempo SMALLINT UNSIGNED NOT NULL DEFAULT 120,
  duration INT UNSIGNED NOT NULL DEFAULT 0,
  genre VARCHAR(50) NOT NULL DEFAULT '',
  guitar_tuning VARCHAR(100) NOT NULL DEFAULT '',
  lyrics MEDIUMTEXT NULL,
  chords MEDIUMTEXT NULL,
  notes TEXT NULL,
  is_original TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_songs_user_title (user_id, title),
  CONSTRAINT fk_songs_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS catalog_songs (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  title VARCHAR(255) NOT NULL,
  artist VARCHAR(255) NOT NULL DEFAULT '',
  normalized_title VARCHAR(191) NOT NULL,
  normalized_artist VARCHAR(191) NOT NULL DEFAULT '',
  album VARCHAR(255) NOT NULL DEFAULT '',
  release_date DATE NULL,
  duration INT UNSIGNED NOT NULL DEFAULT 0,
  genre VARCHAR(50) NOT NULL DEFAULT '',
  `key` VARCHAR(10) NOT NULL DEFAULT '',
  tempo SMALLINT UNSIGNED NULL,
  lyrics MEDIUMTEXT NULL,
  source VARCHAR(20) NOT NULL DEFAULT 'user',
  lrclib_id INT UNSIGNED NULL,
  times_imported INT UNSIGNED NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_catalog_normalized (normalized_title, normalized_artist),
  KEY idx_catalog_artist (normalized_artist)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS setlists (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  name VARCHAR(191) NOT NULL,
  description TEXT NULL,
  duration INT UNSIGNED NOT NULL DEFAULT 0,
  is_public TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_setlists_user (user_id),
  CONSTRAINT fk_setlists_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS setlist_songs (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  setlist_id INT UNSIGNED NOT NULL,
  song_id INT UNSIGNED NOT NULL,
  position INT UNSIGNED NOT NULL DEFAULT 0,
  notes TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_setlist_songs_order (setlist_id, position),
  KEY idx_setlist_songs_song (song_id),
  CONSTRAINT fk_setlist_songs_setlist FOREIGN KEY (setlist_id) REFERENCES setlists(id) ON DELETE CASCADE,
  CONSTRAINT fk_setlist_songs_song FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS gigs (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  name VARCHAR(191) NOT NULL,
  venue VARCHAR(191) NOT NULL DEFAULT '',
  location VARCHAR(255) NOT NULL DEFAULT '',
  date_time DATETIME NOT NULL,
  load_in_time DATETIME NULL,
  duration INT UNSIGNED NOT NULL DEFAULT 0,
  notes TEXT NULL,
  payment DECIMAL(10,2) NULL,
  status ENUM('scheduled','confirmed','completed','cancelled') NOT NULL DEFAULT 'scheduled',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_gigs_user_date (user_id, date_time),
  CONSTRAINT fk_gigs_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS gig_setlists (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  gig_id INT UNSIGNED NOT NULL,
  setlist_id INT UNSIGNED NOT NULL,
  position INT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_gig_setlists (gig_id, setlist_id),
  KEY idx_gig_setlists_setlist (setlist_id),
  CONSTRAINT fk_gig_setlists_gig FOREIGN KEY (gig_id) REFERENCES gigs(id) ON DELETE CASCADE,
  CONSTRAINT fk_gig_setlists_setlist FOREIGN KEY (setlist_id) REFERENCES setlists(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_connections (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  requester_id INT UNSIGNED NOT NULL,
  recipient_id INT UNSIGNED NOT NULL,
  status ENUM('pending','accepted','declined','blocked') NOT NULL DEFAULT 'pending',
  message TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_connections_pair (requester_id, recipient_id),
  KEY idx_connections_recipient (recipient_id, status),
  CONSTRAINT fk_connections_requester FOREIGN KEY (requester_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_connections_recipient FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- participant_1_id is always the smaller user id so each pair has one row.
CREATE TABLE IF NOT EXISTS conversations (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  participant_1_id INT UNSIGNED NOT NULL,
  participant_2_id INT UNSIGNED NOT NULL,
  last_message_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_conversations_pair (participant_1_id, participant_2_id),
  KEY idx_conversations_p2 (participant_2_id),
  CONSTRAINT fk_conversations_p1 FOREIGN KEY (participant_1_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_conversations_p2 FOREIGN KEY (participant_2_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS messages (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  conversation_id INT UNSIGNED NOT NULL,
  sender_id INT UNSIGNED NOT NULL,
  content TEXT NOT NULL,
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_messages_conversation (conversation_id, id),
  KEY idx_messages_unread (conversation_id, is_read, sender_id),
  CONSTRAINT fk_messages_conversation FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  CONSTRAINT fk_messages_sender FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS play_mode_settings (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  mode ENUM('lyrics','songs') NOT NULL,
  visible_fields JSON NOT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_play_mode_settings (user_id, mode),
  CONSTRAINT fk_play_mode_settings_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS notifications (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  actor_id INT UNSIGNED NULL,
  type VARCHAR(40) NOT NULL,
  title VARCHAR(191) NOT NULL,
  body VARCHAR(500) NOT NULL DEFAULT '',
  link VARCHAR(255) NOT NULL DEFAULT '',
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_notifications_user (user_id, is_read, id),
  CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_notifications_actor FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS bands (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(191) NOT NULL,
  description TEXT NULL,
  logo_url VARCHAR(255) NOT NULL DEFAULT '',
  owner_id INT UNSIGNED NOT NULL,
  is_public TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_bands_owner (owner_id),
  CONSTRAINT fk_bands_owner FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS band_members (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  band_id INT UNSIGNED NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  role ENUM('owner','admin','member') NOT NULL DEFAULT 'member',
  can_edit TINYINT(1) NOT NULL DEFAULT 0,
  joined_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_band_members (band_id, user_id),
  KEY idx_band_members_user (user_id),
  CONSTRAINT fk_band_members_band FOREIGN KEY (band_id) REFERENCES bands(id) ON DELETE CASCADE,
  CONSTRAINT fk_band_members_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS band_songs (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  band_id INT UNSIGNED NOT NULL,
  song_id INT UNSIGNED NOT NULL,
  added_by INT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_band_songs (band_id, song_id),
  KEY idx_band_songs_song (song_id),
  CONSTRAINT fk_band_songs_band FOREIGN KEY (band_id) REFERENCES bands(id) ON DELETE CASCADE,
  CONSTRAINT fk_band_songs_song FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE,
  CONSTRAINT fk_band_songs_user FOREIGN KEY (added_by) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS band_setlists (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  band_id INT UNSIGNED NOT NULL,
  setlist_id INT UNSIGNED NOT NULL,
  added_by INT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_band_setlists (band_id, setlist_id),
  KEY idx_band_setlists_setlist (setlist_id),
  CONSTRAINT fk_band_setlists_band FOREIGN KEY (band_id) REFERENCES bands(id) ON DELETE CASCADE,
  CONSTRAINT fk_band_setlists_setlist FOREIGN KEY (setlist_id) REFERENCES setlists(id) ON DELETE CASCADE,
  CONSTRAINT fk_band_setlists_user FOREIGN KEY (added_by) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS band_gigs (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  band_id INT UNSIGNED NOT NULL,
  gig_id INT UNSIGNED NOT NULL,
  added_by INT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_band_gigs (band_id, gig_id),
  KEY idx_band_gigs_gig (gig_id),
  CONSTRAINT fk_band_gigs_band FOREIGN KEY (band_id) REFERENCES bands(id) ON DELETE CASCADE,
  CONSTRAINT fk_band_gigs_gig FOREIGN KEY (gig_id) REFERENCES gigs(id) ON DELETE CASCADE,
  CONSTRAINT fk_band_gigs_user FOREIGN KEY (added_by) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS band_invitations (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  band_id INT UNSIGNED NOT NULL,
  inviter_id INT UNSIGNED NOT NULL,
  invitee_id INT UNSIGNED NOT NULL,
  status ENUM('pending','accepted','declined') NOT NULL DEFAULT 'pending',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_band_invitations (band_id, invitee_id),
  KEY idx_band_invitations_invitee (invitee_id, status),
  CONSTRAINT fk_band_invitations_band FOREIGN KEY (band_id) REFERENCES bands(id) ON DELETE CASCADE,
  CONSTRAINT fk_band_invitations_inviter FOREIGN KEY (inviter_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_band_invitations_invitee FOREIGN KEY (invitee_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
