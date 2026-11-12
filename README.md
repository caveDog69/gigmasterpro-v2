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
   | `MAIL_FROM` (optional) | e.g. `GigMasterPro <no-reply@yourdomain.com>` |

   | Variable | Purpose |
   |---|---|
   | `SITE_URL` | e.g. `https://yourdomain.com`. Used for canonical/OG URLs, sitemap, email links and the post-deploy health check |
   | `FTP_SERVER_DIR` / `FTP_DEV_SERVER_DIR` (optional) | Default `/` and `/dev/`. Set these if your FTP account doesn't land in `public_html` |
   | `FTP_PROTOCOL` (optional) | Default `ftps`. Set to `ftp` if your host has no FTPS |

3. Push to `main` to deploy production, or to `dev` to deploy the preview at `/dev/`. The workflow lints and builds the app, writes `api/config.php` from the secrets, and uploads everything over FTP. Files in `uploads/` are never deleted.
4. The schema is created automatically on the first API request. Open `https://yourdomain.com/api/health` to check PHP, the extensions, the database connection and the uploads folder.

Password-reset and verification emails use PHP `mail()`. Most cPanel hosts support it out of the box. Send from an address on your own domain for better deliverability.

## Local development

```bash
cp api/config.sample.php api/config.php   # or export GMP_DB_HOST/GMP_DB_NAME/GMP_DB_USER/GMP_DB_PASS
php -S 127.0.0.1:8080 dev-router.php      # API at http://127.0.0.1:8080/api
npm install
npm run dev                               # Vite proxies /api and /uploads to :8080
```

Set `GMP_MAIL_LOG=/path/to/mail.log` to write outgoing emails to a file instead of sending them.

Scripts: `npm run build` (type-check, client build, SSR pre-render), `npm run lint`, `npm run typecheck`.

Environment variables (`.env.example`): `VITE_API_BASE_URL` (default `<base>/api`), `VITE_BASE_PATH`, `VITE_SITE_URL`, `VITE_DEV_API_PROXY`.

## API overview

All endpoints are under `/api`. Every endpoint needs `Authorization: Bearer <token>` except `/health`, `/auth/register`, `/auth/login`, `/auth/forgot-password`, `/auth/reset-password`, `/auth/verify-email` and the private iCal feed `/calendar/{token}.ics`.

| Area | Endpoints |
|---|---|
| Auth | `POST /auth/register`, `/auth/login`, `/auth/logout`, `GET /auth/me`, `POST /auth/forgot-password`, `/auth/reset-password`, `/auth/verify-email`, `/auth/resend-verification`, `PUT /auth/password` |
| Profile | `GET/PUT /profile`, `POST/DELETE /profile/avatar`, `GET/PUT /profile/play-mode-settings`, `POST /profile/calendar-token`, `GET /users/search` |
| Songs | `GET/POST /songs`, `GET/PUT/DELETE /songs/{id}`, `GET /songs/search?q=` (catalog + lrclib), `POST /songs/import/match`, `POST /songs/import` |
| Setlists | `GET/POST /setlists`, `GET/PUT/DELETE /setlists/{id}`, `PUT /setlists/{id}/songs` |
| Gigs | `GET/POST /gigs`, `GET/PUT/DELETE /gigs/{id}`, `PUT /gigs/{id}/setlists`, `GET /gigs/{id}/play`, `GET /gigs/calendar.ics`, `GET /gigs/{id}/calendar.ics` |
| Community | `GET /community/profiles`, `GET/POST /connections`, `PUT/DELETE /connections/{id}` |
| Messaging | `GET/POST /conversations`, `GET/POST /conversations/{id}/messages`, `PUT /conversations/{id}/read`, `GET /messages/unread-counts` |
| Notifications | `GET /notifications`, `GET /notifications/summary`, `PUT /notifications/read-all`, `PUT /notifications/{id}/read` |
| Bands | `GET/POST /bands`, `GET/PUT/DELETE /bands/{id}`, `POST /bands/{id}/invitations`, `DELETE /bands/{id}/invitations/{id}`, `PUT/DELETE /bands/{id}/members/{userId}`, `POST /bands/{id}/{songs\|setlists\|gigs}`, `DELETE /bands/{id}/{type}/{itemId}`, `GET /band-invitations`, `PUT /band-invitations/{id}` |
| Export | `GET /export` (JSON), `/export/songs.csv`, `/export/setlists.csv`, `/export/gigs.csv` |

The schema lives in `api/migrations/` and is applied in order by `api/lib/migrate.php`.
