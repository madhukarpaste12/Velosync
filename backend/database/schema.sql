CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) NOT NULL CHECK (char_length(trim(name)) >= 2),
  email CITEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  phone_number VARCHAR(30),
  is_suspended BOOLEAN NOT NULL DEFAULT FALSE,
  suspended_until TIMESTAMPTZ,
  wallet_balance NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (wallet_balance >= 0),
  is_email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'user';
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_number VARCHAR(30);
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_until TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS refresh_tokens_user_id_idx ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS refresh_tokens_expires_at_idx ON refresh_tokens(expires_at);

CREATE TABLE IF NOT EXISTS email_otps (
  id BIGSERIAL PRIMARY KEY,
  email CITEXT NOT NULL,
  purpose VARCHAR(30) NOT NULL DEFAULT 'SIGNUP_VERIFICATION' CHECK (purpose IN ('SIGNUP', 'PASSWORD_RESET', 'SIGNUP_VERIFICATION', 'FORGOT_PASSWORD')),
  otp_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  consumed_at TIMESTAMPTZ,
  reset_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS email_otps_email_created_idx ON email_otps(email, created_at DESC);
ALTER TABLE email_otps ADD COLUMN IF NOT EXISTS purpose VARCHAR(30) NOT NULL DEFAULT 'SIGNUP_VERIFICATION';
ALTER TABLE email_otps ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE email_otps ADD COLUMN IF NOT EXISTS reset_used_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS email_otps_email_purpose_idx ON email_otps(email, purpose, created_at DESC);
ALTER TABLE email_otps DROP CONSTRAINT IF EXISTS email_otps_purpose_check;
ALTER TABLE email_otps ADD CONSTRAINT email_otps_purpose_check CHECK (purpose IN ('SIGNUP', 'PASSWORD_RESET', 'SIGNUP_VERIFICATION', 'FORGOT_PASSWORD'));

CREATE TABLE IF NOT EXISTS stations (
  id VARCHAR(20) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  city VARCHAR(60) NOT NULL,
  capacity INTEGER NOT NULL CHECK (capacity > 0),
  geom GEOGRAPHY(Point, 4326) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS stations_geom_gist_idx ON stations USING GIST (geom);
CREATE INDEX IF NOT EXISTS stations_city_idx ON stations(city);

CREATE TABLE IF NOT EXISTS bicycles (
  id VARCHAR(30) PRIMARY KEY,
  station_id VARCHAR(20) REFERENCES stations(id) ON DELETE SET NULL,
  battery_level INTEGER NOT NULL DEFAULT 100 CHECK (battery_level BETWEEN 0 AND 100),
  network_status VARCHAR(20) NOT NULL DEFAULT 'ONLINE' CHECK (network_status IN ('ONLINE', 'OFFLINE', 'UNKNOWN')),
  is_locked BOOLEAN NOT NULL DEFAULT TRUE,
  health VARCHAR(20) NOT NULL DEFAULT 'Good' CHECK (health IN ('Good', 'Needs maintenance', 'Out of service')),
  geom GEOGRAPHY(Point, 4326),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS bicycles_station_locked_idx ON bicycles(station_id, is_locked);
CREATE INDEX IF NOT EXISTS bicycles_geom_gist_idx ON bicycles USING GIST (geom);

CREATE TABLE IF NOT EXISTS trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  bicycle_id VARCHAR(30) NOT NULL REFERENCES bicycles(id) ON DELETE RESTRICT,
  start_time TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  end_time TIMESTAMPTZ,
  fare NUMERIC(12, 2) CHECK (fare IS NULL OR fare >= 0),
  status VARCHAR(20) NOT NULL DEFAULT 'IN_PROGRESS' CHECK (status IN ('IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK ((status = 'IN_PROGRESS' AND end_time IS NULL) OR (status <> 'IN_PROGRESS' AND end_time IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS one_active_trip_per_bicycle_idx ON trips(bicycle_id) WHERE status = 'IN_PROGRESS';
CREATE INDEX IF NOT EXISTS trips_user_started_idx ON trips(user_id, start_time DESC);

CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  trip_id UUID REFERENCES trips(id) ON DELETE SET NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  currency CHAR(3) NOT NULL DEFAULT 'INR',
  status VARCHAR(20) NOT NULL CHECK (status IN ('PENDING', 'SUCCEEDED', 'FAILED', 'DEMO')),
  payment_method VARCHAR(30) NOT NULL,
  provider_reference VARCHAR(120),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS payments_user_created_idx ON payments(user_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS payments_provider_reference_idx ON payments(provider_reference) WHERE provider_reference IS NOT NULL;

CREATE TABLE IF NOT EXISTS issue_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  asset_id VARCHAR(30) NOT NULL,
  issue_type VARCHAR(60) NOT NULL,
  notes TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'IN_PROGRESS', 'RESOLVED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS issue_reports_status_idx ON issue_reports(status, created_at DESC);

DROP TRIGGER IF EXISTS users_updated_at ON users;
CREATE TRIGGER users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS stations_updated_at ON stations;
CREATE TRIGGER stations_updated_at BEFORE UPDATE ON stations FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS bicycles_updated_at ON bicycles;
CREATE TRIGGER bicycles_updated_at BEFORE UPDATE ON bicycles FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS issue_reports_updated_at ON issue_reports;
CREATE TRIGGER issue_reports_updated_at BEFORE UPDATE ON issue_reports FOR EACH ROW EXECUTE FUNCTION set_updated_at();
