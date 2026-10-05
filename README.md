# SiteLog

Daily site reporting and management dashboard for **Tihama Limited (Constructions)**, Kano — Information Technology Department.

Site supervisors submit a short daily report from a phone — progress, manpower, equipment, materials, incidents — and it works even where the network does not. Head office sees live project status and can export weekly reports.

Built as the Skills Immersion 1 internship artefact by **Hassanat Ajoke Bello**, September–November 2026.

---

## Status

**Week 7 — works without a signal.** Reports survive a dead zone and send themselves when the connection returns.

| Week | Scope | State |
|---|---|---|
| 4 | Schema, auth, roles, tests | ✅ done |
| 5 | Projects, sites and daily report API | ✅ done |
| 6 | React app, mobile report form | ✅ done |
| 7 | Offline drafts, photo upload | ✅ done |
| 8 | Management dashboard | next |
| 9 | PDF / Excel export, security review | |
| 10 | User acceptance testing | |
| 11 | Deploy, document, hand over | |

---

This repository holds both halves:

```
/        the API      (Node, Express, PostgreSQL)
/web     the frontend (React, Vite)
```

## Requirements

- Node.js 18 or newer
- PostgreSQL 14 or newer

## Getting started — API

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

## Getting started — frontend

In a second terminal, with the API already running:

```bash
cd web
npm install
npm run dev          # http://localhost:5173
```

The dev server proxies `/api` to port 4000, so no CORS setup is needed. Sign in with a seeded account.

**To try it on a real phone**, start Vite with `npm run dev -- --host`, then open the network address it prints on a phone connected to the same wifi. The layout is built for a phone first; a desktop browser simply gets more margin.

## Tests

```bash
npm test             # API    — 72 tests
cd web && npm test   # web    — 32 tests
cd web && npm run build   # confirms the frontend compiles
```

The API tests cover password hashing, tokens, role permissions, the auth, project, site, report and photo routes, and retry idempotency. The web tests cover the outbox queue, payload building and image sizing. Both mock their dependencies, so neither needs PostgreSQL or a browser.

---

## The frontend

Three screens, built mobile-first for a supervisor finishing work at six in the evening.

| Screen | Route | What it does |
|---|---|---|
| Sign in | `/login` | Email and password, session restored on reload |
| Daily report | `/report/new` | The main form |
| Reports | `/reports` | Recent reports, narrowed to what you may see |

Decisions worth knowing:

- **Only three fields are really expected** — site, date and what was done. Manpower, equipment, materials and incidents stay collapsed until a row is added, so the form is not a wall of empty boxes.
- **Every tappable thing is at least 48px tall**, and body text is 16px — below that, iOS zooms the page whenever a field is focused.
- **The form is validated on the phone first**, so an obvious mistake is caught before a round trip over a weak connection.
- **Rows left blank are dropped** rather than sent as empty records.
- **Route guards are convenience, not security.** The API enforces permissions on every request regardless of what the interface shows.

`src/lib/reportPayload.js` turns form state into the API body and is a pure function, so it is tested without rendering anything.

---

## Working without a signal

Tihama's sites regularly have no usable mobile coverage. A supervisor who fills in a report and loses it to a failed request will stop using the system within a week, so losing a report is treated as the worst thing the application can do.

**How it works**

1. Pressing Send writes the report to an outbox in `localStorage` **before** any network call. If the browser is killed between the two, the report is still there.
2. The phone generates a `clientUuid` once and reuses it on every retry.
3. The request is attempted. On success the entry is cleared.
4. On a network or 5xx failure the entry stays queued, and the supervisor is told plainly: *"saved on this phone, it will send by itself."*
5. When the browser fires `online`, the queue is flushed automatically. Reports left from a previous session go out on next load.

**Why it cannot duplicate**

The server stores `client_uuid` under a unique index and inserts with `ON CONFLICT DO NOTHING`. A retry that the server already received returns **200 with `created: false`** instead of 201, and the phone clears the entry. A report sent three times from a flaky connection is stored once.

**Permanent failures are not retried forever.** A 4xx other than 408 or 429 means the server rejected the report on its merits — a future date, say. The entry is dropped and surfaced to the user rather than retrying silently until the end of time.

`navigator.onLine` is only used to decide *when to try*. It reports true on a wifi network with no internet behind it, so a failed request is the real signal.

## Photos

| Method | Route | Who |
|---|---|---|
| `POST` | `/api/reports/:id/photos` | anyone who may see that report |

- Photos upload **after** the report, as a separate request. A few megabytes of images must never hold the written report hostage on a weak connection.
- The phone resizes to 1600px on the long edge and re-encodes as JPEG first. A 4.8 MB camera photo typically lands around 300 KB — small enough to actually arrive, clear enough to see cracked blockwork or a delivery note.
- JPEG, PNG and WebP only; 3 MB and 5 files per request.
- Stored filenames are generated. A client-supplied filename is never trusted — it can contain path separators, and reusing it would let one upload overwrite another.

---

## API

Send the token on every protected route:

```
Authorization: Bearer <token>
```

### Auth

| Method | Route | Who | Purpose |
|---|---|---|---|
| `GET` | `/api/health` | anyone | Service check |
| `POST` | `/api/auth/login` | anyone | Exchange email + password for a token |
| `GET` | `/api/auth/me` | signed in | Current user — restores a session on page load |
| `POST` | `/api/auth/users` | administrator | Create an account |

### Projects and sites

| Method | Route | Who | Purpose |
|---|---|---|---|
| `GET` | `/api/projects` | manager, admin | List projects (`?status=active`) |
| `POST` | `/api/projects` | administrator | Create a project |
| `GET` | `/api/projects/:id` | manager, admin | One project |
| `PATCH` | `/api/projects/:id` | administrator | Update a project |
| `GET` | `/api/projects/:id/sites` | manager, admin | Sites on a project |
| `POST` | `/api/projects/:id/sites` | administrator | Add a site |
| `GET` | `/api/sites/:siteId/supervisors` | manager, admin | Who covers this site |
| `POST` | `/api/sites/:siteId/supervisors` | administrator | Assign a supervisor |
| `DELETE` | `/api/sites/:siteId/supervisors/:userId` | administrator | Remove an assignment |

### Daily reports

| Method | Route | Who | Purpose |
|---|---|---|---|
| `POST` | `/api/reports` | assigned supervisor, manager, admin | Submit a daily report |
| `GET` | `/api/reports` | signed in | List reports, narrowed to what you may see |
| `GET` | `/api/reports/:id` | signed in | One report with all line items |

List filters: `siteId`, `projectId`, `from`, `to`, `limit` (max 200), `offset`.

### Examples

```bash
# Sign in
curl -X POST http://localhost:4000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@tihama.test","password":"ChangeMe123!"}'

# Submit a daily report
curl -X POST http://localhost:4000/api/reports \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "siteId": 1,
    "reportDate": "2026-10-05",
    "weather": "Clear",
    "progressNotes": "Foundation work continued on block B.",
    "manpower":  [{ "trade": "Masons", "headcount": 6, "hoursWorked": 8 }],
    "equipment": [{ "equipmentName": "Excavator", "hoursRun": 5, "status": "operational" }],
    "materials": [{ "materialName": "Cement", "unit": "bags",
                    "quantityReceived": 100, "quantityUsed": 60 }],
    "incidents": [{ "category": "safety", "severity": "low",
                    "description": "Minor hand injury, first aid given." }]
  }'

# Reports for one project in September
curl "http://localhost:4000/api/reports?projectId=1&from=2026-09-01&to=2026-09-30" \
  -H "Authorization: Bearer $TOKEN"
```

### Rules enforced by the API

- A supervisor may only submit for a site they are **assigned** to.
- A supervisor's report listing is narrowed to their own sites **in SQL**, not filtered afterwards.
- Reading a report on a site you do not cover returns **404, not 403**, so the endpoint cannot be used to discover which reports exist.
- One report per site per day. A second submission returns **409**.
- A report dated in the future is rejected.
- A report and all its line items are written in **one transaction** — a half-saved report is never possible.

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
  constants/roles.js  The three roles, free of any Express dependency
  db/
    pool.js           One shared connection pool, plus withTransaction
    migrations/       Versioned SQL, applied in filename order
    seed.js           Development data
  middleware/
    auth.js           requireAuth, requireRole
    errorHandler.js   404 and the single error-to-response boundary
  routes/             HTTP routing only
  controllers/        Request validation and responses
  services/
    auth.service.js     Login and user creation
    access.service.js   Who may see which site
    project.service.js  Projects, sites, supervisor assignments
    report.service.js   Daily reports, written transactionally
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
