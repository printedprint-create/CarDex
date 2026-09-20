-- 1) Captures: only the owner can read their captures
drop policy if exists "captures readable by authenticated" on public.captures;
create policy "own captures read"
on public.captures for select to authenticated
using (auth.uid() = user_id);

-- 2) Profiles: only yourself and people you have a friendship with
drop policy if exists "profiles readable by authenticated" on public.profiles;
create policy "own and linked profiles read"
on public.profiles for select to authenticated
using (
  auth.uid() = id
  or exists (
    select 1 from public.friendships f
    where (f.requester_id = auth.uid() and f.addressee_id = id)
       or (f.addressee_id = auth.uid() and f.requester_id = id)
  )
);

-- 3) Ranking via security definer function (leaderboard is a product feature)
create or replace function public.get_ranking()
returns table (id uuid, username text, points integer, total bigint, legendarios bigint)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.username, p.points,
         count(c.id) as total,
         count(c.id) filter (where c.rarity = 'legendario') as legendarios
  from public.profiles p
  left join public.captures c on c.user_id = p.id
  group by p.id, p.username, p.points
  order by p.points desc
  limit 100
$$;
grant execute on function public.get_ranking() to authenticated;

-- 4) Friend search via security definer function, with input validation
create or replace function public.search_profiles(_q text)
returns table (id uuid, username text, friend_code text, points integer)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.username, p.friend_code, p.points
  from public.profiles p
  where auth.uid() is not null
    and p.id <> auth.uid()
    and _q is not null and char_length(_q) between 2 and 40
    and (p.username ilike '%' || _q || '%' or p.friend_code = upper(_q))
  limit 10
$$;
grant execute on function public.search_profiles(text) to authenticated;

-- 5) Storage: each user can only download files inside their own folder
drop policy if exists "captures readable by authenticated" on storage.objects;
create policy "own capture files read"
on storage.objects for select to authenticated
using (
  bucket_id = 'captures'
  and (storage.foldername(name))[1] = auth.uid()::text
);