# Demo Data Importer

The backend ships with a script that can provision a handful of demo users and ingest
activities directly from `.fit` files on disk. This is useful for seeding admin +
member accounts without going through the registration flow.

## 1. Prepare your demo bundle

1. Copy `apps/backend/demo/demo-data.example.json` to `apps/backend/demo/demo-data.json`.
2. Edit the copy to match the users you want to create. The example already shows
   one admin and three rider accounts. Each `activities` entry should point to a
   FIT file **relative to the JSON file**. A typical structure looks like:

   ```text
   apps/backend/demo/
     demo-data.json
     fits/
       admin-baseline.fit
       alex-endurance.fit
       alex-vo2.fit
       bailey-gravel.fit
   ```

   > Passwords must be at least 6 characters. The script overwrites existing
   > passwords for matching emails so you always know the credentials after an import.

## 2. Run the importer

From the repository root run:

```bash
pnpm --filter backend import:demo [path/to/demo-data.json]
```

- If you omit the path the script looks for `demo/demo-data.json` relative to the
  backend package (for example `apps/backend/demo/demo-data.json` when running
  from the repo root).
- By default each activity is parsed, stored, copied into `UPLOAD_DIR`, and the
  metric engine runs immediately so the dashboard is ready to explore.

## 3. Customize behaviour (optional)

The JSON accepts a top-level `defaults` object:

```json
{
  "defaults": {
    "computeMetrics": true,
    "uploadCopy": true
  },
  "users": [
    { "email": "you@example.com", "password": "Secret123", "activities": [] }
  ]
}
```

- `computeMetrics`: set to `false` to skip automatic metric computation for every
  imported activity. You can override per activity with `{"computeMetrics": true}`.
- `uploadCopy`: set to `false` to avoid copying the FIT files into the server's
  `UPLOAD_DIR`. (The activities are still persisted in the database.)

Per-activity overrides can also provide a human friendly `label` that only affects
log output during the import.

## 4. Re-running the import

- Users are upserted by email. Running the script again updates the password,
  role, provider, and UTM source specified in the JSON.
- Activities are deduplicated by `(userId, startTime, durationSec)`. If a matching
  activity already exists the import skips it so you can safely re-run the script
  after tweaking credentials or adding new rides.

When the script finishes it reports the number of failures (if any). A non-zero
exit code means at least one user or activity failed to import—check the console
output for details.
