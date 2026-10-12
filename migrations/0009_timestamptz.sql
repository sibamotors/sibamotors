-- Dates were stored as TEXT (ISO strings). Convert them to real timestamptz so
-- sorting, indexes and date math are correct. The app keeps receiving ISO
-- strings (see the timestamptz parser in src/lib/db.ts), so nothing else changes.

alter table app_messages
  alter column created_at type timestamptz using nullif(created_at, '')::timestamptz,
  alter column read_at type timestamptz using nullif(read_at, '')::timestamptz,
  alter column edited_at type timestamptz using nullif(edited_at, '')::timestamptz,
  alter column deleted_at type timestamptz using nullif(deleted_at, '')::timestamptz;

alter table user_permissions
  alter column updated_at type timestamptz using nullif(updated_at, '')::timestamptz;

alter table app_groups
  alter column created_at type timestamptz using nullif(created_at, '')::timestamptz;

alter table app_group_members
  alter column joined_at type timestamptz using nullif(joined_at, '')::timestamptz;

alter table app_group_messages
  alter column created_at type timestamptz using nullif(created_at, '')::timestamptz,
  alter column edited_at type timestamptz using nullif(edited_at, '')::timestamptz,
  alter column deleted_at type timestamptz using nullif(deleted_at, '')::timestamptz;

alter table app_group_reads
  alter column last_read_at type timestamptz using nullif(last_read_at, '')::timestamptz;

alter table app_notifications
  alter column read_at type timestamptz using nullif(read_at, '')::timestamptz,
  alter column created_at type timestamptz using nullif(created_at, '')::timestamptz;

alter table app_files
  alter column created_at type timestamptz using nullif(created_at, '')::timestamptz;

alter table app_work_reports
  alter column created_at type timestamptz using nullif(created_at, '')::timestamptz,
  alter column read_at type timestamptz using nullif(read_at, '')::timestamptz;
