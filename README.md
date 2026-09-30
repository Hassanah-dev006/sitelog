# SiteLog

Daily site reporting and management dashboard for **Tihama Limited**, Information Technology Department.

Site supervisors submit a short daily report from a phone — progress, manpower, equipment, materials, incidents — and it works even where the network does not. Head office sees live project status and can export weekly reports.

Built as the Skills Immersion 1 internship artefact by **Hassanat Ajoke Bello**, September–November 2026.

---

## Status

**Week 4 — backend foundation.** Database schema, authentication and role-based access control are done and tested.

| Week | Scope | State |
|---|---|---|
| 4 | Schema, auth, roles, tests | ✅ done |
| 5 | Projects, sites and daily report API | next |
| 6 | React app, mobile report form | |
| 7 | Offline drafts, photo upload | |
| 8 | Management dashboard | |
| 9 | PDF / Excel export, security review | |
| 10 | User acceptance testing | |
| 11 | Deploy, document, hand over | |

---

## Requirements

- Node.js 18 or newer
- PostgreSQL 14 or newer

## Getting started

```bash
npm install

cp .env.example .env
# Open .env and set DATABASE_URL and JWT_SECRET.
# Generate a secret with:
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"

createdb sitelog        # if the database does not exist yet
npm run migrate         # create the tables
npm run seed            # optional: demo accounts and a sample project

npm run dev             # http://localhost:4000
```

Check it is alive:

```bash
curl http://localhost:4000/api/health
```

## Tests

```bash
npm test
```

32 tests covering password hashing, token handling, role permissions and the auth routes. They mock the database, so they run without PostgreSQL.

---

## API (so far)

| Method | Route | Who | Purpose |
|---|---|---|---|
| `GET` | `/api/health` | anyone | Service check |
| `POST` | `/api/auth/login` | anyone | Exchange email + password for a token |
| `GET` | `/api/auth/me` | signed in | Current user — restores a session on page load |
| `POST` | `/api/auth/users` | administrator | Create an account |

Send the token on protected routes:

```
Authorization: Bearer <token>
```

### Example

```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@tihama.test","password":"ChangeMe123!"}'
```

---

## Roles

| Role | Can do |
|---|---|
| `site_supervisor` | Submit and view daily reports for their assigned sites |
| `project_manager` | View all reports, dashboards and exports for their projects |
| `administrator` | Everything, plus managing users, projects and sites |

There is no public sign-up. An administrator creates every account.

---

## Project layout

```
src/
  app.js              Express app (exported unstarted, so tests can drive it)
  server.js           Starts the server, handles clean shutdown
  config/env.js       All configuration — fails loudly if something is missing
  db/
    pool.js           One shared connection pool
    migrations/       Versioned SQL, applied in filename order
    seed.js           Development data
  middleware/
    auth.js           requireAuth, requireRole, ROLES
    errorHandler.js   404 and the single error-to-response boundary
  routes/             HTTP routing only
  controllers/        Request validation and responses
  services/           Business logic, independent of Express
  utils/              Password hashing, tokens
scripts/migrate.js    Migration runner
tests/                Jest test suite
```

## Security notes

- Passwords are hashed with bcrypt and never logged or returned.
- A token carries only the user id and role; everything else is read from the database, so a deactivated account loses access immediately rather than at token expiry.
- Login gives the same error for an unknown email and a wrong password, so the endpoint cannot be used to discover which accounts exist.
- All queries are parameterised.
- `.env` is gitignored. Never commit real credentials.

## Data model

`users` · `projects` · `sites` · `site_assignments` · `daily_reports` · `manpower_entries` · `equipment_entries` · `material_entries` · `incidents` · `report_photos`

One report per site per day is enforced by a unique constraint on `(site_id, report_date)`. Indexes on `report_date` and `(site_id, report_date)` support the dashboard's main queries.

See `src/db/migrations/001_init.sql`.
