# VeloSync database

VeloSync uses PostgreSQL with PostGIS for station and bicycle locations. The application database is selected with `DB_NAME`; the default development name is `velosync`.

## Setup

```powershell
# PostgreSQL 18 on Windows (use your installed version if different)
$pg = 'C:\Program Files\PostgreSQL\18\bin'
& "$pg\createdb.exe" -U postgres velosync
& "$pg\psql.exe" -U postgres -d velosync -f backend/database/schema.sql
& "$pg\psql.exe" -U postgres -d velosync -f backend/database/seed.sql
```

If `password authentication failed` appears, set `DB_PASSWORD` in `backend/.env` to the current password for the local `postgres` role. The PostgreSQL Windows service being running does not imply that the password in the application configuration is correct. Do not commit `backend/.env`.

To make the tools available in the current PowerShell window:

```powershell
$env:Path += ';C:\Program Files\PostgreSQL\18\bin'
```

Seed data is for development only. It creates stations and bicycles, but no demo password or real payment credentials.

Required backend variables are documented in `backend/.env.example`: `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `JWT_ACCESS_SECRET`, and `JWT_REFRESH_SECRET`. No email provider is required. Demo OTPs are stored hashed in `email_otps`, expire after five minutes, and are returned only when `NODE_ENV` is not `production`. They are invalidated after use and limited by cooldown and attempt count.

The demo OTP is server-side and database-backed, so it survives a backend restart until it expires. This is suitable for a college demonstration; production should use a secure delivery provider and a dedicated reset-token design.

## Relationships

- A user owns refresh tokens, starts trips, makes payments, and submits issue reports.
- A bicycle may be assigned to a station and may have one active trip at a time.
- A completed trip may have payment records.
- Station and bicycle `geom` columns are indexed PostGIS `GEOGRAPHY(Point, 4326)` values.

## Run and verify

```powershell
npm --prefix backend start
Invoke-RestMethod http://localhost:5000/api/health
```

The health endpoint reports whether the backend is running; database-backed endpoints additionally require PostgreSQL to be available.
