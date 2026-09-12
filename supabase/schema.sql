-- ============================================================================
-- Masjid Board — shared settings
--
-- Run this once in the Supabase SQL editor. It creates one table and three
-- functions, and locks the table so that the key shipped in the website cannot
-- read secrets or write anything.
--
-- The security model:
--   * The website carries the project's publishable ("anon") key. That key is
--     public by design — anyone can read it out of the page.
--   * Row Level Security is enabled on `boards` with NO policies, and the anon
--     role has no grants on the table. So the public key alone can neither read
--     nor write a single row directly.
--   * Everything goes through three SECURITY DEFINER functions instead:
--       board_read      - returns the board's settings, never its secrets
--       board_write     - writes, but only if the caller presents the edit key
--       board_check_key - confirms an edit key without changing anything
--   * The edit key is stored only as a SHA-256 digest, so a database dump does
--     not hand over write access.
-- ============================================================================

create extension if not exists pgcrypto with schema extensions;

-- --- the table --------------------------------------------------------------

create table if not exists public.boards (
  id uuid primary key default gen_random_uuid(),
  -- Short name used in links, e.g. "taqwa". Lowercase letters, digits and dashes.
  slug text not null unique
    check (slug ~ '^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$'),
  -- A human label, only ever seen in the Supabase dashboard.
  label text not null default '',
  -- The whole board configuration, exactly as the app exports it.
  config jsonb not null default '{}'::jsonb,
  -- SHA-256 of the edit key, hex encoded. Never the key itself.
  edit_token_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.boards is
  'One row per masjid board. Reached only through the board_* functions.';

-- --- lock it down -----------------------------------------------------------

alter table public.boards enable row level security;

-- No policies are created, so RLS denies everything. Belt and braces: also
-- remove the table grants the anon and authenticated roles get by default.
revoke all on public.boards from anon, authenticated;

-- --- read -------------------------------------------------------------------

create or replace function public.board_read(p_slug text)
returns table (config jsonb, updated_at timestamptz)
language sql
security definer
set search_path = public, extensions
as $$
  select b.config, b.updated_at
    from public.boards b
   where b.slug = p_slug;
$$;

comment on function public.board_read(text) is
  'Public read of one board''s settings. Returns no secrets.';

-- --- write ------------------------------------------------------------------

create or replace function public.board_write(p_slug text, p_token text, p_config jsonb)
returns timestamptz
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_updated_at timestamptz;
begin
  if p_token is null or length(p_token) < 16 then
    raise exception 'invalid board or edit key' using errcode = '42501';
  end if;

  -- A jsonb object is the only shape the board can render.
  if jsonb_typeof(p_config) is distinct from 'object' then
    raise exception 'settings must be a JSON object' using errcode = '22023';
  end if;

  update public.boards
     set config = p_config,
         updated_at = now()
   where slug = p_slug
     and edit_token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
  returning boards.updated_at into v_updated_at;

  -- Same error whether the board is unknown or the key is wrong, so this
  -- cannot be used to discover which boards exist.
  if v_updated_at is null then
    raise exception 'invalid board or edit key' using errcode = '42501';
  end if;

  return v_updated_at;
end;
$$;

comment on function public.board_write(text, text, jsonb) is
  'Writes a board''s settings. Requires the edit key; verified here, not in the client.';

-- --- check a key ------------------------------------------------------------

create or replace function public.board_check_key(p_slug text, p_token text)
returns boolean
language sql
security definer
set search_path = public, extensions
as $$
  select exists (
    select 1
      from public.boards b
     where b.slug = p_slug
       and b.edit_token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
  );
$$;

comment on function public.board_check_key(text, text) is
  'Confirms an edit key without writing, for the editor''s connect screen.';

-- --- grants -----------------------------------------------------------------

revoke all on function public.board_read(text) from public;
revoke all on function public.board_write(text, text, jsonb) from public;
revoke all on function public.board_check_key(text, text) from public;

grant execute on function public.board_read(text) to anon, authenticated;
grant execute on function public.board_write(text, text, jsonb) to anon, authenticated;
grant execute on function public.board_check_key(text, text) to anon, authenticated;

-- ============================================================================
-- Creating a board
--
-- Pick a slug and generate an edit key. Run this, then copy the key that comes
-- back — it is shown once and stored only as a digest.
-- ============================================================================

-- Generate a key and create the board in one step:
--
--   with new_key as (
--     select encode(extensions.gen_random_bytes(24), 'hex') as k
--   )
--   insert into public.boards (slug, label, edit_token_hash, config)
--   select 'taqwa',
--          'Masjid Ut Taqwa, Sea Cow Lake',
--          encode(extensions.digest(k, 'sha256'), 'hex'),
--          '{}'::jsonb
--     from new_key
--   returning slug, (select k from new_key) as edit_key;
--
-- To change the key later (if the editor link is ever shared too widely):
--
--   with new_key as (
--     select encode(extensions.gen_random_bytes(24), 'hex') as k
--   )
--   update public.boards
--      set edit_token_hash = (select encode(extensions.digest(k, 'sha256'), 'hex') from new_key)
--    where slug = 'taqwa'
--   returning slug, (select k from new_key) as edit_key;
