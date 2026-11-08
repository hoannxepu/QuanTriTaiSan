-- Migration 0002: Cloudflare D1 Rate Limiting Table
CREATE TABLE IF NOT EXISTS login_attempts (
  identifier TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL DEFAULT 0,
  reset_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_reset_at ON login_attempts(reset_at);
