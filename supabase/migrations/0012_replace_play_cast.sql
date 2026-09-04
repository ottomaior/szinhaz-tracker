-- Replacing a production's cast in one statement instead of two.
--
-- sync/run.ts deleted every play_cast row for a play and then inserted the new
-- set. Those were two separate requests with no transaction around them, so a
-- failure in between — a dropped connection, a constraint violation on one
-- member — left the production with no cast at all until the next successful
-- run happened to repair it. The window is small and the consequence is
-- cosmetic, but it is also entirely avoidable.
--
-- Both halves now happen inside one function call, which Postgres runs in a
-- single implicit transaction: either the new cast lands or the old one stays.

begin;

create or replace function public.replace_play_cast(target_play_id uuid, members jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.play_cast where play_id = target_play_id;

  -- `with ordinality` preserves the source's own ordering as sort_order, the
  -- same way the previous insert did by mapping over the array index.
  insert into public.play_cast (play_id, name, role, sort_order)
  select
    target_play_id,
    member ->> 'name',
    member ->> 'role',
    (ordinal - 1)::int
  from jsonb_array_elements(coalesce(members, '[]'::jsonb)) with ordinality as t(member, ordinal)
  where coalesce(member ->> 'name', '') <> '';
end;
$$;

-- Only the sync job calls this; it is not part of the app's surface.
revoke all on function public.replace_play_cast(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.replace_play_cast(uuid, jsonb) to service_role;

commit;
