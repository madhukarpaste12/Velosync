# VeloSync Entity Relationship Diagram (ERD)

This ERD is derived from `backend/database/schema.sql` on the `main` branch.

```mermaid
erDiagram
    USERS ||--o{ REFRESH_TOKENS : "has"
    USERS ||--o{ TRIPS : "starts"
    USERS ||--o{ PAYMENTS : "makes"
    USERS ||--o{ ISSUE_REPORTS : "reports"
    STATIONS ||--o{ BICYCLES : "contains"
    BICYCLES ||--o{ TRIPS : "used in"
    TRIPS o|--o{ PAYMENTS : "paid by"

    USERS {
        UUID id PK
        VARCHAR name
        CITEXT email UK
        TEXT password_hash
        VARCHAR role
        VARCHAR phone_number
        BOOLEAN is_suspended
        TIMESTAMPTZ suspended_until
        NUMERIC wallet_balance
        BOOLEAN is_email_verified
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }

    REFRESH_TOKENS {
        BIGSERIAL id PK
        UUID user_id FK
        TEXT token UK
        TIMESTAMPTZ expires_at
        TIMESTAMPTZ created_at
    }

    EMAIL_OTPS {
        BIGSERIAL id PK
        CITEXT email
        VARCHAR purpose
        TEXT otp_hash
        TIMESTAMPTZ expires_at
        INTEGER attempts
        TIMESTAMPTZ consumed_at
        TIMESTAMPTZ reset_used_at
        TIMESTAMPTZ created_at
    }

    STATIONS {
        VARCHAR id PK
        VARCHAR name
        VARCHAR city
        INTEGER capacity
        GEOGRAPHY geom
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }

    BICYCLES {
        VARCHAR id PK
        VARCHAR station_id FK
        INTEGER battery_level
        VARCHAR network_status
        BOOLEAN is_locked
        VARCHAR health
        GEOGRAPHY geom
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }

    TRIPS {
        UUID id PK
        UUID user_id FK
        VARCHAR bicycle_id FK
        TIMESTAMPTZ start_time
        TIMESTAMPTZ end_time
        NUMERIC fare
        VARCHAR status
        TIMESTAMPTZ created_at
    }

    PAYMENTS {
        UUID id PK
        UUID user_id FK
        UUID trip_id FK
        NUMERIC amount
        CHAR currency
        VARCHAR status
        VARCHAR payment_method
        VARCHAR provider_reference UK
        TIMESTAMPTZ created_at
    }

    ISSUE_REPORTS {
        UUID id PK
        UUID user_id FK
        VARCHAR asset_id
        VARCHAR issue_type
        TEXT notes
        VARCHAR status
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }
```

## Relationship notes

- `refresh_tokens.user_id` → `users.id` with `ON DELETE CASCADE`.
- `bicycles.station_id` → `stations.id` with `ON DELETE SET NULL`.
- `trips.user_id` → `users.id` with `ON DELETE RESTRICT`.
- `trips.bicycle_id` → `bicycles.id` with `ON DELETE RESTRICT`.
- `payments.user_id` → `users.id` with `ON DELETE RESTRICT`.
- `payments.trip_id` → `trips.id` with `ON DELETE SET NULL`.
- `issue_reports.user_id` → `users.id` with `ON DELETE SET NULL`.
- `email_otps.email` is not defined as a foreign key to `users.email`; OTP records are therefore shown as an independent entity.
- `issue_reports.asset_id` is not defined as a foreign key to `bicycles.id`; it is shown as an ordinary attribute.

## Important constraints represented by the schema

- A user wallet balance cannot be negative.
- Payment `amount` must be greater than `0`, so zero-rupee transactions are rejected at the database level.
- Only one active (`IN_PROGRESS`) trip can exist per bicycle.
- Bicycle battery level is restricted to 0–100.
- Bicycle network status is `ONLINE`, `OFFLINE`, or `UNKNOWN`.
- Trip status is `IN_PROGRESS`, `COMPLETED`, or `CANCELLED`.
- Payment status is `PENDING`, `SUCCEEDED`, `FAILED`, or `DEMO`.
- PostGIS geography fields support station and bicycle location data.
