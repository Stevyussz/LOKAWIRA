CREATE TABLE IF NOT EXISTS entities (
  id text PRIMARY KEY,
  kind text NOT NULL,
  owner_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL,
  file_data bytea,
  mime_type text
);

CREATE INDEX IF NOT EXISTS entities_kind_created_idx ON entities (kind, created_at DESC);
CREATE INDEX IF NOT EXISTS entities_owner_kind_idx ON entities (owner_id, kind);
CREATE INDEX IF NOT EXISTS entities_voucher_status_idx ON entities (kind, (payload->>'status'));
CREATE INDEX IF NOT EXISTS entities_spot_ref_idx ON entities (kind, (payload->>'spotId'));
CREATE UNIQUE INDEX IF NOT EXISTS entities_voucher_code_unique ON entities ((payload->>'code')) WHERE kind = 'voucher';
CREATE UNIQUE INDEX IF NOT EXISTS entities_checkin_code_unique ON entities ((payload->>'code')) WHERE kind = 'checkin';
CREATE UNIQUE INDEX IF NOT EXISTS entities_reservation_ticket_unique ON entities ((payload->>'ticketId')) WHERE kind = 'reservation';

CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY,
  email text NOT NULL UNIQUE,
  name text NOT NULL,
  role text NOT NULL CHECK (role IN ('VISITOR', 'MERCHANT', 'ADMIN')),
  status text,
  status_reason text,
  password_salt text NOT NULL,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  email_verified boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);

CREATE TABLE IF NOT EXISTS profiles (
  user_id text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  xp integer NOT NULL DEFAULT 0 CHECK (xp >= 0),
  lore_cards jsonb NOT NULL DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS one_time_tokens (
  token_hash text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose text NOT NULL CHECK (purpose IN ('RESET_PASSWORD', 'VERIFY_EMAIL')),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rate_limits (
  key text PRIMARY KEY,
  count integer NOT NULL,
  reset_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS redemption_audit (
  id bigserial PRIMARY KEY,
  voucher_code text NOT NULL,
  merchant_user_id text NOT NULL,
  redeemed_at timestamptz NOT NULL DEFAULT now()
);

-- jejak hadiah per akun/titik/jenis/hari WIB. Primary key = hadiah cuma bisa diklaim sekali sehari (atomik)
CREATE TABLE IF NOT EXISTS reward_log (
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  spot_id text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('SCAN', 'RESERVATION', 'REDIRECT', 'CHECKIN')),
  day date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, spot_id, kind, day)
);

-- jejak dampak anonim (UU PDP): cuma jenis, titik, waktu. Tanpa user, IP, atau lokasi
CREATE TABLE IF NOT EXISTS metrics (
  id bigserial PRIMARY KEY,
  type text NOT NULL CHECK (type IN ('QR_OPEN', 'REMINDER_SAVED', 'GUIDE_START')),
  spot_id text NOT NULL,
  at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS metrics_spot_at_idx ON metrics (spot_id, at);
