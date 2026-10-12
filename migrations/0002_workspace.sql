-- Shared app data (boards/lists/cards/people) and login accounts.
--
-- Previously ALL of this lived in each browser's localStorage, so every
-- teammate had their own private copy that never synced with anyone else's,
-- even when logged in with the same account. This migration moves it into
-- Postgres so every user (any device, any browser) reads and writes the
-- SAME data.
--
-- workspace_state: the whole workspace (people + boards + lists + cards +
-- checklists + labels) as one JSON document, keyed by a constant id. This
-- mirrors the shape the app already used in memory — it just now lives in
-- the shared database instead of one browser's localStorage.
create table if not exists workspace_state (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

-- login_users: the app's own simple username/password accounts (separate
-- from the Better Auth tables in migrations/auth/, which this app does not
-- use). Previously stored in localStorage under "sibamotor-users", which is
-- why an account created by the admin on one PC did not work on another.
create table if not exists login_users (
  username text primary key,
  password text not null,
  display_name text not null,
  role text not null default '',
  created_at timestamptz not null default now()
);

-- (Security) This migration used to insert three accounts with a shared,
-- publicly visible default password. They were REMOVED. The first admin is now
-- created at deploy time from the ADMIN_BOOTSTRAP_* environment variables
-- (see scripts/bootstrap.mjs and README.md). Databases that already ran the old
-- version are cleaned up by scripts/bootstrap.mjs on the next deploy.
