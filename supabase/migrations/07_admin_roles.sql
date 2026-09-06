-- Replace the boolean is_admin flag with a three-tier role, so a regular
-- admin's power can be limited relative to a super_admin's.

alter table profiles add column if not exists role text not null default 'user'
  check (role in ('user', 'admin', 'super_admin'));

-- Carry forward anyone already flagged is_admin as a plain 'admin' for now.
update profiles set role = 'admin' where is_admin = true and role = 'user';

-- Explicit assignment for the two known accounts.
update profiles set role = 'super_admin'
where id = (select id from auth.users where email = 'od@nvel.agency');

update profiles set role = 'admin'
where id = (select id from auth.users where email = 'princeakachi@gmail.com');

alter table profiles drop column if exists is_admin;
