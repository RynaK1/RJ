create extension if not exists pgcrypto;

create table if not exists public.planner_states (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.planner_profiles (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  updated_at timestamptz not null default now(),
  constraint planner_profiles_email_lowercase check (email = lower(email))
);

create table if not exists public.planner_pairings (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint planner_pairings_not_self check (requester_id <> recipient_id),
  constraint planner_pairings_unique_direction unique (requester_id, recipient_id)
);

alter table public.planner_states enable row level security;
alter table public.planner_profiles enable row level security;
alter table public.planner_pairings enable row level security;

grant usage on schema public to authenticated;
grant select, insert, update on public.planner_states to authenticated;
grant select, insert, update on public.planner_profiles to authenticated;
grant select on public.planner_pairings to authenticated;

drop policy if exists "Planner state is readable by owner" on public.planner_states;
drop policy if exists "Planner state is insertable by owner" on public.planner_states;
drop policy if exists "Planner state is updatable by owner" on public.planner_states;
drop policy if exists "Planner profile is readable by owner or linked user" on public.planner_profiles;
drop policy if exists "Planner profile is insertable by owner" on public.planner_profiles;
drop policy if exists "Planner profile is updatable by owner" on public.planner_profiles;
drop policy if exists "Planner pairings are readable by participants" on public.planner_pairings;

create policy "Planner state is readable by owner"
on public.planner_states
for select
to authenticated
using (
  auth.uid() is not null
  and (
    auth.uid() = owner_id
    or exists (
      select 1
      from public.planner_pairings pairing
      where pairing.status = 'accepted'
        and (
          (pairing.requester_id = auth.uid() and pairing.recipient_id = owner_id)
          or (pairing.recipient_id = auth.uid() and pairing.requester_id = owner_id)
        )
    )
  )
);

create policy "Planner state is insertable by owner"
on public.planner_states
for insert
to authenticated
with check (auth.uid() is not null and auth.uid() = owner_id);

create policy "Planner state is updatable by owner"
on public.planner_states
for update
to authenticated
using (auth.uid() is not null and auth.uid() = owner_id)
with check (auth.uid() is not null and auth.uid() = owner_id);

create policy "Planner profile is readable by owner or linked user"
on public.planner_profiles
for select
to authenticated
using (
  auth.uid() is not null
  and (
    auth.uid() = owner_id
    or exists (
      select 1
      from public.planner_pairings pairing
      where pairing.status in ('pending', 'accepted')
        and (
          (pairing.requester_id = auth.uid() and pairing.recipient_id = owner_id)
          or (pairing.recipient_id = auth.uid() and pairing.requester_id = owner_id)
        )
    )
  )
);

create policy "Planner profile is insertable by owner"
on public.planner_profiles
for insert
to authenticated
with check (auth.uid() is not null and auth.uid() = owner_id);

create policy "Planner profile is updatable by owner"
on public.planner_profiles
for update
to authenticated
using (auth.uid() is not null and auth.uid() = owner_id)
with check (auth.uid() is not null and auth.uid() = owner_id);

create policy "Planner pairings are readable by participants"
on public.planner_pairings
for select
to authenticated
using (
  auth.uid() is not null
  and (auth.uid() = requester_id or auth.uid() = recipient_id)
);

create or replace function public.invite_planner_pair(target_email text)
returns public.planner_pairings
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_email text;
  target_user_id uuid;
  active_pairing public.planner_pairings;
  saved_pairing public.planner_pairings;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to invite a partner.';
  end if;

  normalized_email := lower(trim(target_email));

  select owner_id
  into target_user_id
  from public.planner_profiles
  where email = normalized_email;

  if target_user_id is null then
    select id
    into target_user_id
    from auth.users
    where lower(email) = normalized_email;

    if target_user_id is not null then
      insert into public.planner_profiles (owner_id, email, updated_at)
      values (target_user_id, normalized_email, now())
      on conflict (owner_id)
      do update set
        email = excluded.email,
        updated_at = now();
    end if;
  end if;

  if target_user_id is null then
    raise exception 'No registered planner user was found for that email.';
  end if;

  if target_user_id = auth.uid() then
    raise exception 'You cannot pair with your own account.';
  end if;

  select *
  into active_pairing
  from public.planner_pairings
  where status in ('pending', 'accepted')
    and (
      requester_id in (auth.uid(), target_user_id)
      or recipient_id in (auth.uid(), target_user_id)
    )
  limit 1;

  if active_pairing.id is not null then
    if active_pairing.status = 'pending'
      and active_pairing.requester_id = target_user_id
      and active_pairing.recipient_id = auth.uid() then
      raise exception 'This user already invited you. Accept or decline their invitation.';
    end if;

    raise exception 'One of these accounts already has a pairing or pending invitation.';
  end if;

  insert into public.planner_pairings (requester_id, recipient_id, status, created_at, responded_at)
  values (auth.uid(), target_user_id, 'pending', now(), null)
  on conflict (requester_id, recipient_id)
  do update set
    status = 'pending',
    created_at = now(),
    responded_at = null
  returning * into saved_pairing;

  return saved_pairing;
end;
$$;

create or replace function public.respond_planner_pair(pairing_id uuid, accept_invite boolean)
returns public.planner_pairings
language plpgsql
security definer
set search_path = public
as $$
declare
  target_pairing public.planner_pairings;
  active_pairing public.planner_pairings;
  saved_pairing public.planner_pairings;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to respond to an invitation.';
  end if;

  select *
  into target_pairing
  from public.planner_pairings
  where id = pairing_id
    and recipient_id = auth.uid()
    and status = 'pending';

  if target_pairing.id is null then
    raise exception 'Invitation was not found.';
  end if;

  if accept_invite then
    select *
    into active_pairing
    from public.planner_pairings
    where id <> pairing_id
      and status in ('pending', 'accepted')
      and (
        requester_id in (target_pairing.requester_id, target_pairing.recipient_id)
        or recipient_id in (target_pairing.requester_id, target_pairing.recipient_id)
      )
    limit 1;

    if active_pairing.id is not null then
      raise exception 'One of these accounts already has a pairing or pending invitation.';
    end if;

    update public.planner_pairings
    set status = 'accepted',
        responded_at = now()
    where id = pairing_id
    returning * into saved_pairing;
  else
    update public.planner_pairings
    set status = 'declined',
        responded_at = now()
    where id = pairing_id
    returning * into saved_pairing;
  end if;

  return saved_pairing;
end;
$$;

create or replace function public.delete_planner_pair(pairing_id uuid)
returns public.planner_pairings
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_pairing public.planner_pairings;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to remove a pairing.';
  end if;

  delete from public.planner_pairings
  where id = pairing_id
    and (requester_id = auth.uid() or recipient_id = auth.uid())
  returning * into deleted_pairing;

  if deleted_pairing.id is null then
    raise exception 'Pairing was not found.';
  end if;

  return deleted_pairing;
end;
$$;

create or replace function public.delete_current_planner_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to delete your account.';
  end if;

  delete from public.planner_pairings
  where requester_id = auth.uid()
    or recipient_id = auth.uid();

  delete from public.planner_states
  where owner_id = auth.uid();

  delete from public.planner_profiles
  where owner_id = auth.uid();

  delete from auth.users
  where id = auth.uid();

  if not found then
    raise exception 'Account was not found.';
  end if;
end;
$$;

grant execute on function public.invite_planner_pair(text) to authenticated;
grant execute on function public.respond_planner_pair(uuid, boolean) to authenticated;
grant execute on function public.delete_planner_pair(uuid) to authenticated;
grant execute on function public.delete_current_planner_account() to authenticated;
