-- Allow store admins to assign the least-privilege sub_admin role.
-- Run this once in a fresh Supabase SQL Editor window.

alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('user', 'admin', 'sub_admin'));
