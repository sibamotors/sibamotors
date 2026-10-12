-- Direct messages between login accounts, and per-user board permission locks.
create table if not exists app_messages (
  id text primary key,
  from_username text not null,
  to_username text not null,
  body text not null,
  created_at text not null,
  read_at text,
  reply_to_id text
);

create index if not exists app_messages_to_idx on app_messages (to_username, created_at);
create index if not exists app_messages_from_idx on app_messages (from_username, created_at);
create index if not exists app_messages_unread_idx on app_messages (to_username, read_at);

create table if not exists user_permissions (
  username text primary key,
  denied jsonb not null default '[]'::jsonb,
  updated_at text not null
);
