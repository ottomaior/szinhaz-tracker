-- Let a hand-added play carry a poster the app owns a copy of.
--
-- 0011 gave `plays` a `poster_path` into the `posters` bucket and an RLS policy
-- letting a signed-in user write under `user/<their uid>/`. What it did not do
-- is give them any way to fill it: `create_play_with_cast` reads only
-- `play->>'posterUrl'`, the legacy pointer at somebody else's server. So the
-- add-play flow could upload a file and then had nowhere to record it.
--
-- Adding the two columns to the RPC rather than reusing `poster_url` keeps the
-- distinction 0011 drew: `poster_url` is provenance, pointing off-site;
-- `poster_path` is the copy we hold and serve. Both stay optional, so the
-- existing call site — which passes neither — is unaffected.

begin;

create or replace function public.create_play_with_cast(play jsonb, cast_members jsonb default '[]'::jsonb)
returns public.plays
language plpgsql
as $function$
declare
  new_play public.plays;
  member jsonb;
  idx int := 0;
begin
  insert into public.plays (
    title, author, director, venue_id, genre, runtime_minutes,
    intermissions, premiere_date, synopsis, poster_url,
    poster_path, poster_credit, created_by, source
  ) values (
    play->>'title',
    play->>'author',
    play->>'director',
    (play->>'venueId')::uuid,
    play->>'genre',
    nullif(play->>'runtimeMinutes', '')::int,
    coalesce((play->>'intermissions')::int, 0),
    nullif(play->>'premiereDate', '')::date,
    play->>'synopsis',
    play->>'posterUrl',
    -- Only ever the uploader's own folder. The storage RLS policy already
    -- enforces this on the upload itself; repeating it here means a crafted
    -- RPC call cannot point a play at a mirrored theatre poster and claim it.
    case
      when play->>'posterPath' like 'user/' || auth.uid()::text || '/%'
        then play->>'posterPath'
      else null
    end,
    nullif(play->>'posterCredit', ''),
    auth.uid(),
    'user'
  )
  returning * into new_play;

  for member in select * from jsonb_array_elements(cast_members)
  loop
    insert into public.play_cast (play_id, name, role, sort_order)
    values (new_play.id, member->>'name', member->>'role', idx);
    idx := idx + 1;
  end loop;

  return new_play;
end;
$function$;

commit;
