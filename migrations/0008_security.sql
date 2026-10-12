-- Security hardening (server-side sessions, admin flag, brute-force protection).

-- Admin rights now live in the database instead of a list hard-coded in the app.
alter table login_users add column if not exists is_admin boolean not null default false;

-- Bumped whenever a password is changed/reset, so every old session dies at once.
alter table login_users add column if not exists session_version int not null default 0;

-- Keep the two existing administrators (they were hard-coded in the old code).
update login_users set is_admin = true where username in ('h.mojarad', 'a.abbasi');

-- Failed-login counters (used for the 5-tries-then-15-minute lock).
create table if not exists login_attempts (
  key text primary key,
  failures int not null default 0,
  first_failure_at timestamptz not null default now(),
  locked_until timestamptz
);
