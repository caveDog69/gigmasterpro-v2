# GigMasterPro v2

Gig management for working musicians: repertoire, setlists, gigs, stage Play Mode, community and bands.

- **Frontend:** React 18, TypeScript, Vite and Tailwind. The `/` landing page is pre-rendered to static HTML at build time (meta, Open Graph and Twitter tags, JSON-LD, `robots.txt`, `sitemap.xml`). All other routes are served by the SPA shell `app.html`.
- **Backend:** plain PHP 8 REST API in `api/` (no Composer) on MySQL 5.7+/MariaDB 10.3+ (InnoDB, utf8mb4, foreign keys). Auth uses revocable bearer tokens.
- **Realtime:** polling. Notifications refresh every 8 s, open conversations every 5 s.
- **Uploads:** avatars are stored in `uploads/avatars/` on the host.

## Production (cPanel shared hosting)

1. In cPanel → **MySQL Databases**, create a database and a user, and grant the user ALL PRIVILEGES on it. For the `/dev` preview, create a second database.
2. In GitHub → **Settings → Secrets and variables → Actions**, add these:

   | Secret | Purpose |
   |---|---|
   | `FTP_SERVER`, `ftpusername`, `ftppassword` | FTP login (same names as the original repo) |
   | `DB_NAME`, `DB_USER`, `DB_PASS` (optional `DB_HOST`, default `localhost`) | Production database |
   | `DEV_DB_NAME`, `DEV_DB_USER`, `DEV_DB_PASS` (optional `DEV_DB_HOST`) | `/dev` preview database |
   | `MAIL_FROM` (optional) | Bare address only, e.g. `no-reply@yourdomain.com` (the "GigMasterPro" sender name is added automatically). Defaults to `no-reply@<site domain>` |

   | Variable | Purpose |
   |---|---|
   | `SITE_URL` | e.g. `https://yourdomain.com`. Used for canonical/OG URLs, sitemap, email links and the post-deploy health check |
   | `FTP_SERVER_DIR` / `FTP_DEV_SERVER_DIR` (optional) | Default `/` and `/dev/`, relative to the FTP login folder (not `/home/<user>`). Set these if your FTP account doesn't land in `public_html` |
   | `DEV_SITE_URL` (optional) | e.g. `https://dev.yourdomain.com`. Deploys `dev` to the root of that (sub)domain instead of `<SITE_URL>/dev/`; point `FTP_DEV_SERVER_DIR` at its document root |
   | `FTP_PROTOCOL` (optional) | Default `ftps`. Set to `ftp` if your host has no FTPS |

3. Push to `main` to deploy production, or to `dev` to deploy the preview at `/dev/`. The workflow lints and builds the app, writes `api/config.php` from the secrets, and uploads everything over FTP. Files in `uploads/` are never deleted.
4. The schema is created automatically on the first API request. Open `https://yourdomain.com/api/health` to check PHP, the extensions, the database connection and the uploads folder.

Password-reset and verification emails use PHP `mail()`. Most cPanel hosts support it out of the box. Send from an address on your own domain for better deliverability: in cPanel, create that mailbox and make SPF and DKIM valid under **Email → Email Deliverability**. Use **Track Delivery** to check whether a message was sent.

## Local development

```bash
cp api/config.sample.php api/config.php   # or export GMP_DB_HOST/GMP_DB_NAME/GMP_DB_USER/GMP_DB_PASS
php -S 127.0.0.1:8080 dev-router.php      # API at http://127.0.0.1:8080/api
npm install
npm run dev                               # Vite proxies /api and /uploads to :8080
```

Demo data: `php api/seed.php` (CLI only; uses the same `api/config.php` / `GMP_DB_*` settings) creates 20 users (`user1@example.com` … `user20@example.com`, password `Password1!`) with songs, setlists, gigs, a band and connections. It does nothing if `user1@example.com` already exists.

Set `GMP_MAIL_LOG=/path/to/mail.log` to write outgoing emails to a file instead of sending them.

Scripts: `npm run build` (type-check, client build, SSR pre-render), `npm run lint`, `npm run typecheck`.

Environment variables (`.env.example`): `VITE_API_BASE_URL` (default `<base>/api`), `VITE_BASE_PATH`, `VITE_SITE_URL`, `VITE_DEV_API_PROXY`.

## Admin and ads

Users have a role (`user` or `admin`). Admins get an **Admin** link in the sidebar (`/admin`) where they can switch ads on/off, set the AdSense publisher ID and slot IDs, and disable/enable users, grant or remove admin, or mark a user ad-free. Disabled users are signed out everywhere, can't sign in and are hidden from Community.

Make the first admin with SQL (phpMyAdmin → SQL tab):

```sql
UPDATE users SET role = 'admin' WHERE email = 'you@example.com';
```

Ads render in three responsive slots: a banner above page content (320×50 / 728×90 / 970×90), a right-hand rail on wide screens (160×600 / 300×600) and a footer unit below content (300×250 / 728×90). Nothing loads from Google until ads are switched on and a publisher ID and that slot's ID are set; while ads are on but a slot has no ID, admins see a dashed placeholder where it will appear. Users flagged `ad_free` never see ads (the hook for a future paid ad-free plan). AdSense also needs an `ads.txt` at the site root, e.g. `google.com, pub-1234567890123456, DIRECT, f08c47fec0942fa0`.

## Song privacy and community moderation

Each song has a **Who can see this song** setting: *Private* (only the owner; it can't be shared with a band, stays out of the shared catalog, and is left out when other people view the owner's shared setlists, gigs and Play Mode), *Band members* (the default; members of bands it has been shared with) or *Band members & connections* (also accepted connections, who can browse it from **Songs** on the Connections tab).

In **Community → Discover**, each musician card has **Hide** (removes them from your feed only; manage and unhide from the "hidden members" link above the results) and **Block**. Blocking removes any connection, hides both members from each other's feed, and stops messages, connection requests and band invitations between them; unblock from the Blocked list on the Connections tab.

## Feedback

Any signed-in user can send feedback (optional subject + message) from **Feedback** (`/feedback`) and see the status of what they've sent. Admins review it in the Feedback panel on `/admin`, filter by new/read/resolved and mark items read or resolved; the Admin sidebar link shows the number of new items.

## Invites

Any signed-in user can invite people from **Invite friends** (`/invite`). The invitee gets an email with a sign-up link (`/signup?invite=…`, valid 14 days); the inviter also gets the link to copy, in case the host's mail doesn't arrive. Signing up through the link with the invited address connects the new member with that inviter and notifies them; once the new member verifies their email (or resets their password), every other open invite for that address is accepted the same way. The link isn't treated as proof of email ownership, since the inviter can see it too. An invite can be resent at most once an hour and 5 times in total, or revoked; each user can send 20 per 24 hours, and existing members can't be invited. Sign-up stays open to everyone.

## API overview

All endpoints are under `/api`. Every endpoint needs `Authorization: Bearer <token>` except `/health`, `/auth/register`, `/auth/login`, `/auth/forgot-password`, `/auth/reset-password`, `/auth/verify-email`, `/invites/lookup` and the private iCal feed `/calendar/{token}.ics`.

| Area | Endpoints |
|---|---|
| Admin (admins only) | `GET/PUT /admin/settings`, `GET /admin/users?search=&status=active\|disabled\|admin`, `PUT /admin/users/{id}` (`disabled`, `role`, `ad_free`), `GET /admin/feedback?status=new\|read\|resolved`, `PUT /admin/feedback/{id}` (`status`) |
| Auth | `POST /auth/register`, `/auth/login`, `/auth/logout`, `GET /auth/me`, `POST /auth/forgot-password`, `/auth/reset-password`, `/auth/verify-email`, `/auth/resend-verification`, `PUT /auth/password` |
| Profile | `GET/PUT /profile`, `POST/DELETE /profile/avatar`, `GET/PUT /profile/play-mode-settings`, `POST /profile/calendar-token`, `GET /users/search` |
| Songs | `GET/POST /songs`, `GET/PUT/DELETE /songs/{id}` (`visibility`: `private\|bands\|connections`), `GET /songs/search?q=&artist=&album=` (catalog + lrclib; `q` is the title), `POST /songs/import/match`, `POST /songs/import` |
| Setlists | `GET/POST /setlists`, `GET/PUT/DELETE /setlists/{id}`, `PUT /setlists/{id}/songs` |
| Gigs | `GET/POST /gigs`, `GET/PUT/DELETE /gigs/{id}`, `PUT /gigs/{id}/setlists`, `GET /gigs/{id}/play`, `GET /gigs/calendar.ics`, `GET /gigs/{id}/calendar.ics` |
| Community | `GET /community/profiles`, `GET/POST /connections`, `PUT/DELETE /connections/{id}`, `GET/POST /community/hidden`, `DELETE /community/hidden/{userId}`, `POST /community/blocks` (`user_id`), `GET /community/members/{id}/songs` (connections only) |
| Feedback | `GET/POST /feedback` (own submissions; `subject`, `message`) |
| Invites | `GET/POST /invites`, `POST /invites/{id}/resend`, `DELETE /invites/{id}` (revoke), `GET /invites/lookup?token=` (public); `POST /auth/register` accepts `invite_token` |
| Messaging | `GET/POST /conversations`, `GET/POST /conversations/{id}/messages`, `PUT /conversations/{id}/read`, `GET /messages/unread-counts` |
| Notifications | `GET /notifications`, `GET /notifications/summary`, `PUT /notifications/read-all`, `PUT /notifications/{id}/read` |
| Bands | `GET/POST /bands`, `GET/PUT/DELETE /bands/{id}`, `POST /bands/{id}/invitations`, `DELETE /bands/{id}/invitations/{id}`, `PUT/DELETE /bands/{id}/members/{userId}`, `POST /bands/{id}/{songs\|setlists\|gigs}`, `DELETE /bands/{id}/{type}/{itemId}`, `GET /band-invitations`, `PUT /band-invitations/{id}` |
| Export | `GET /export` (JSON), `/export/songs.csv`, `/export/setlists.csv`, `/export/gigs.csv` |

The schema lives in `api/migrations/` and is applied in order by `api/lib/migrate.php`.
