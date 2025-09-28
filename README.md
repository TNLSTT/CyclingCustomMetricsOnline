# Cycling Custom Metrics

Cycling Custom Metrics is a full-stack TypeScript application that ingests Garmin `.FIT` files, normalizes second-by-second activity samples, computes extensible cycling metrics, and renders the results in a modern Next.js dashboard. The first metric shipped is the **Heart Rate to Cadence Scaling Ratio (HCSR)** which highlights cadence efficiency and fatigue trends over the ride.

## Features

- **Node.js + Express API** with Prisma ORM on PostgreSQL and a metric registry for pluggable analytics modules.
- **Garmin FIT ingestion** using `fit-file-parser` with resampling to 1 Hz, forward filling of small gaps, and sample sanitation.
- **Extensible metric engine** – add a single file under `apps/backend/src/metrics` to define new metrics, compute logic, and tests.
- **Next.js 14 App Router UI** styled with TailwindCSS and shadcn/ui components. Includes upload flow, activity list, detail dashboard with HCSR chart, and registry browser.
- **Authentication & profiles** powered by NextAuth credentials provider, enabled by default so every environment is scoped per user.
- **Vitest test suite** covering FIT parsing normalization, HCSR computations, registry wiring, and an API happy-path smoke test.
- **Docker Compose** for local production-style deployment (Postgres + API + Web) and GitHub Actions CI running lint, typecheck, and tests.

## Project Structure

```
apps/
  backend/        # Express API, Prisma schema, metrics engine, Vitest tests
  web/            # Next.js frontend, Tailwind/shadcn components
.github/workflows # CI pipeline
``` 

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 8+
- PostgreSQL 15+ (or use Docker Compose)

### Installation

```bash
pnpm install
```

### Environment

Copy the example environment and adjust as needed:

```bash
cp .env.example .env
```

Key variables:

- `DATABASE_URL` – PostgreSQL connection string used by Prisma.
- `UPLOAD_DIR` – directory where raw FIT uploads are preserved.
- `AUTH_ENABLED` / `NEXT_PUBLIC_AUTH_ENABLED` – toggle authentication.
- `JWT_SECRET` – signing secret for API-issued bearer tokens (defaults to `NEXTAUTH_SECRET` when unset).
- `NEXT_PUBLIC_API_URL` – frontend-to-backend base URL (`http://localhost:4000/api` in dev).
- `NEXT_INTERNAL_API_URL` – internal API URL for server-side Next.js fetching (e.g. `http://backend:4000/api` in Docker).
- `NEXTAUTH_SECRET`, `DEMO_USER_EMAIL`, `DEMO_USER_PASSWORD` – NextAuth credentials (optional).

### Authentication

Authentication and per-user profiles are now enabled by default. To confirm the end-to-end flow:

1. **Update environment variables** – edit your `.env` (or the respective backend/frontend `.env` files if split) and ensure:
   - `AUTH_ENABLED=true`
   - `NEXT_PUBLIC_AUTH_ENABLED=true`
   - `NEXTAUTH_SECRET=<generate a long random string>`
   - (Optional) `JWT_SECRET=<random string>` if you want bearer tokens to use a distinct secret from NextAuth.
2. **Restart the dev servers** so the new environment variables are picked up (`pnpm dev` or the individual backend/frontend processes).
3. **Provision your database** (only required the first time):
   ```bash
   pnpm db:push
   pnpm seed
   ```
   These commands create the `User` and `Profile` tables and seed the metric registry used after login.
4. **Create an account** – visit `/register` in the web app, sign up with an email and password (minimum 8 characters), then sign in via `/signin`. After authentication you will be redirected to `/profile` to complete your display name, avatar, and bio.

- **Protected mode (default)** – with the variables above enabled, all new uploads and activity history are automatically scoped to the authenticated user via bearer tokens issued by the backend. API calls to `/upload`, `/activities`, `/profile`, and metric recomputation endpoints require an authenticated session.
- **Open mode** – set `AUTH_ENABLED=false` and `NEXT_PUBLIC_AUTH_ENABLED=false` to skip authentication entirely. Uploads, metrics, and activities are shared across visitors which keeps local demos frictionless.

### Database

Push the Prisma schema to your Postgres instance and seed metric definitions:

```bash
pnpm db:push
pnpm seed
```

### Development

Run frontend and backend concurrently:

```bash
pnpm dev
```

- Backend API: http://localhost:4000
- Frontend UI: http://localhost:3000

Upload a `.fit` file on the landing page, then navigate to Activities → Activity detail → “Recompute metrics” to generate the HCSR chart.

### Quality Gates

```bash
pnpm lint
pnpm typecheck
pnpm test
```

Vitest uses in-memory Prisma mocks and fixtures so no database is required during tests.

### Docker Compose

Build and run the entire stack (Postgres + API + Web) with:

```bash
docker compose up --build
```

Services:

- API available at http://localhost:4000
- Web UI at http://localhost:3000
- Persistent volumes for Postgres data and uploaded FIT files.

### Deployment Guidance

- **Frontend (Next.js)** – deploy on Vercel. Set environment variables (`NEXT_PUBLIC_API_URL`, `NEXT_INTERNAL_API_URL`, `NEXT_PUBLIC_AUTH_ENABLED`, `NEXTAUTH_SECRET`, etc.) pointing to the API host. Build command: `pnpm install --frozen-lockfile && pnpm --filter web build` with output command `pnpm --filter web start`.
- **Backend (Express)** – deploy on Render, Fly.io, or any Node-compatible host using `apps/backend/Dockerfile`. Provide `DATABASE_URL`, `PORT`, `UPLOAD_DIR`, `AUTH_ENABLED`, and `NEXTAUTH_SECRET`. Run migrations via `pnpm --filter backend db:push` or Prisma migrations prior to launch.
- **PostgreSQL** – provision a managed instance (Render, Fly.io, Supabase, etc.) and update `DATABASE_URL` accordingly.

## Metric Architecture

Metrics live under `apps/backend/src/metrics`:

- Each metric exports a `definition` (key, name, version, description, units, config) and a `compute` function that receives `MetricSample[]` plus activity context.
- Register metrics in `registry.ts`. The registry powers seeding (`prisma/seed.ts`) and exposes definitions to the frontend.
- `runMetrics(activityId, metricKeys?)` orchestrates loading samples, executing metric modules, and upserting `MetricResult` rows.
- Adding a new metric requires creating a file alongside `hcsr.ts`, exporting it from the registry, and writing a Vitest suite.

### HCSR (Heart Rate to Cadence Scaling Ratio)

Implementation details (`apps/backend/src/metrics/hcsr.ts`):

1. Filter samples with cadence ≥ 20 rpm and valid heart rate, bin into 10 rpm buckets.
2. Require ≥ 60 seconds per bucket; compute median HR and IQR.
3. Apply Theil–Sen regression (falling back to OLS) over bucket medians for slope/intercept.
4. Compare linear vs. piecewise fits for nonlinearity delta; compute R² diagnostics.
5. Split ride halves to detect fatigue-related slope drift.
6. Persist summary metrics and per-bucket series for visualization.

## Data Model Notes

- `ActivitySample` stores one row per second with indexes on `(activityId)` and `(activityId, t)`. This keeps queries simple for metrics that scan contiguous time ranges and avoids decoding large JSON payloads at query time. The trade-off is a larger table footprint, but it enables Postgres to stream rows efficiently and lets future metrics push heavy aggregations into SQL if desired.
- `MetricDefinition`/`MetricResult` separate metadata (name, version, config) from per-activity outputs so metric implementations can evolve independently of stored results. Results store both `summary` JSON (scalars) and optional `series` JSON for charting.

## API Overview

| Method | Path | Description |
| ------ | ---- | ----------- |
| `POST` | `/api/upload` | Multipart upload of `.fit` file → activity creation |
| `POST` | `/api/activities/:id/compute` | Compute metrics (defaults to registry) |
| `GET`  | `/api/activities` | Paginated activity list |
| `GET`  | `/api/activities/:id` | Activity metadata + metric summaries |
| `GET`  | `/api/activities/:id/metrics/:metricKey` | Metric result detail (summary + series) |
| `DELETE` | `/api/activities/:id` | Delete activity and associated data |

With `AUTH_ENABLED=true` the upload, activities, and metrics history endpoints require a `Bearer` token and only operate on data
owned by the authenticated user.

## Adding Metrics

1. Create `apps/backend/src/metrics/<metricKey>.ts` exporting `{ definition, compute }`.
2. Append the metric to the registry in `registry.ts`.
3. Write Vitest coverage under `apps/backend/tests`.
4. Run `pnpm seed` to sync `MetricDefinition` rows.

## Testing Fixtures

- FIT ingestion tests mock `fit-file-parser` to validate normalization logic.
- HCSR tests use synthetic cadence/HR samples to assert slope and fit quality.
- API smoke test mocks ingestion and executes upload → compute → fetch flow against the Express app.

## Scripts Summary

| Command | Description |
| ------- | ----------- |
| `pnpm dev` | Run backend & frontend in watch mode |
| `pnpm db:push` | Push Prisma schema to the configured Postgres |
| `pnpm seed` | Seed metric definitions from the registry |
| `pnpm lint` | ESLint (backend & frontend) |
| `pnpm typecheck` | TypeScript checks across packages |
| `pnpm test` | Run Vitest suites |

## Extending & Contributing

- To add authentication providers (GitHub, Google, etc.), configure NextAuth in `apps/web/app/api/auth/[...nextauth]/route.ts`.
- For additional metrics, leverage the sample utilities in `apps/backend/src/utils/statistics.ts` (median, quantiles, Theil–Sen).
- The frontend consumes the API via `apps/web/lib/api.ts`. Prefer updating this layer when adding endpoints.

## License

MIT © 2024 Cycling Custom Metrics maintainers.
