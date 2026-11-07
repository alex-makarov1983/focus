-- Focus: cloud storage schema. Run once in Supabase → SQL Editor → New query → Run.
-- Safe to run again: everything is "if not exists" / "or replace".

-- 1) One row per user with the whole app state (Safe is stored only as ciphertext).
create table if not exists public.focus_state (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  vault      jsonb,
  version    bigint not null default 0,
  device     text,
  updated_at timestamptz not null default now()
);

alter table public.focus_state enable row level security;

drop policy if exists "focus_state owner select" on public.focus_state;
drop policy if exists "focus_state owner insert" on public.focus_state;
drop policy if exists "focus_state owner update" on public.focus_state;
drop policy if exists "focus_state owner delete" on public.focus_state;
create policy "focus_state owner select" on public.focus_state for select to authenticated using (auth.uid() = user_id);
create policy "focus_state owner insert" on public.focus_state for insert to authenticated with check (auth.uid() = user_id);
create policy "focus_state owner update" on public.focus_state for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "focus_state owner delete" on public.focus_state for delete to authenticated using (auth.uid() = user_id);

-- 2) Save with a version check so two devices never silently overwrite each other.
create or replace function public.focus_save(p_data jsonb, p_vault jsonb, p_base bigint, p_device text)
returns table (new_version bigint, conflict boolean, remote_data jsonb, remote_vault jsonb)
language plpgsql
security invoker
set search_path = public
as $$
declare
  cur public.focus_state%rowtype;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  select * into cur from public.focus_state where user_id = auth.uid() for update;
  if not found then
    insert into public.focus_state (user_id, data, vault, version, device)
    values (auth.uid(), p_data, p_vault, 1, p_device);
    return query select 1::bigint, false, null::jsonb, null::jsonb;
    return;
  end if;
  if cur.version <> p_base then
    return query select cur.version, true, cur.data, cur.vault;
    return;
  end if;
  update public.focus_state
     set data = p_data, vault = p_vault, version = cur.version + 1, device = p_device, updated_at = now()
   where user_id = auth.uid();
  return query select cur.version + 1, false, null::jsonb, null::jsonb;
end;
$$;

revoke all on function public.focus_save(jsonb, jsonb, bigint, text) from public, anon;
grant execute on function public.focus_save(jsonb, jsonb, bigint, text) to authenticated;

-- 3) Private photo storage: each user can only touch files in their own folder.
insert into storage.buckets (id, name, public)
values ('photos', 'photos', false)
on conflict (id) do nothing;

drop policy if exists "focus photos read" on storage.objects;
drop policy if exists "focus photos insert" on storage.objects;
drop policy if exists "focus photos update" on storage.objects;
drop policy if exists "focus photos delete" on storage.objects;
create policy "focus photos read" on storage.objects for select to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "focus photos insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "focus photos update" on storage.objects for update to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "focus photos delete" on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
