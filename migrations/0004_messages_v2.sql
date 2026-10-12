-- Message editing / soft-deletion for direct messages, plus group chat.
alter table app_messages add column if not exists edited_at text;
alter table app_messages add column if not exists deleted_at text;

create table if not exists app_groups (
  id text primary key,
  name text not null,
  created_by text not null,
  created_at text not null
);

create table if not exists app_group_members (
  group_id text not null references app_groups (id) on delete cascade,
  username text not null,
  joined_at text not null,
  primary key (group_id, username)
);

create index if not exists app_group_members_user_idx on app_group_members (username);

create table if not exists app_group_messages (
  id text primary key,
  group_id text not null references app_groups (id) on delete cascade,
  from_username text not null,
  body text not null,
  created_at text not null,
  edited_at text,
  deleted_at text,
  reply_to_id text
);

create index if not exists app_group_messages_group_idx on app_group_messages (group_id, created_at);

-- Per-user "read up to" marker per group, used both for the unread badge and
-- for group read-receipts (a message is "seen by everyone" once every other
-- member's last_read_at is at or after that message's created_at).
create table if not exists app_group_reads (
  group_id text not null references app_groups (id) on delete cascade,
  username text not null,
  last_read_at text not null,
  primary key (group_id, username)
);
