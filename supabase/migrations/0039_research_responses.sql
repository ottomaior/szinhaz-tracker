-- The research questionnaire, and the first anonymous write in the schema.
--
-- Before launch the product needs to hear from theatregoers who do not have an
-- account and are not going to make one to answer a survey. `landing/kutatas.html`
-- asks them seven minutes of questions — how they go to the theatre today, then
-- forced choices between the app's features rather than ratings of them — and
-- has to put the answers somewhere.
--
-- Every write path so far is keyed on `auth.uid()`, and `anon` has never been
-- granted anything on a table. This keeps that true. The page does not insert
-- into a table; it calls one function, `submit_research_response(jsonb)`, which
-- is exposed to `anon` the same way every search function is, and which
-- validates the payload before anything reaches the row. The table itself has
-- no policy at all — nothing can read it through the API, and only the function
-- (as its `security definer` owner) can write it. The report reads it with the
-- service role, from `scripts/research-report.ts`.
--
-- The validation is deliberately in SQL rather than trusted from the page: a
-- static HTML file is the easiest thing in the world to POST around, and a
-- survey whose ranking can be filled by a loop is not a survey. So the function
-- checks the shape — nine MaxDiff answers, each naming a real screen and two
-- different features from it; Kano answers from the fixed vocabulary; text
-- capped — and refuses more than thirty submissions in any one minute, which is
-- an order of magnitude above what a survey shared among friends can produce
-- and an order of magnitude below what a script would.

begin;

-- ---------------------------------------------------------------------------
-- 1. The table
-- ---------------------------------------------------------------------------
--
-- `client_id` is a random id the page keeps in localStorage so one browser
-- cannot submit twice; it identifies a browser, not a person. `email` is null
-- unless the respondent asked to hear about the launch, and is the only
-- personal data in the row. `source` is the `?s=` parameter the link was
-- shared with, so a wave posted to a Facebook group can be told from the one
-- sent to friends.

create table if not exists public.research_responses (
  id            uuid primary key default gen_random_uuid(),
  submitted_at  timestamptz not null default now(),
  client_id     text not null unique check (char_length(client_id) between 8 and 64),
  version       int  not null check (version = 1),
  source        text check (source is null or char_length(source) <= 40),
  behaviour     jsonb not null,
  maxdiff       jsonb not null,
  kano          jsonb not null,
  open_answer   text check (open_answer is null or char_length(open_answer) <= 1500),
  email         text check (email is null or (char_length(email) <= 254 and position('@' in email) > 1))
);

comment on table public.research_responses is
  'Pre-launch questionnaire answers from landing/kutatas.html. Written only through submit_research_response(); read only with the service role.';

create index if not exists research_responses_submitted_at_idx
  on public.research_responses (submitted_at);

alter table public.research_responses enable row level security;

-- No policies on purpose. `anon` and `authenticated` get no path to this table
-- through PostgREST; the service role bypasses RLS and is how the report reads.

-- ---------------------------------------------------------------------------
-- 2. The vocabulary the function checks against
-- ---------------------------------------------------------------------------
--
-- These mirror `scripts/research-design.ts`. The MaxDiff screens are listed
-- as arrays of feature ids so the function can check that "best" and "worst"
-- were actually on the screen the answer claims to be for.

create or replace function public.research_maxdiff_blocks()
returns text[][]
language sql
immutable
set search_path = public, pg_temp
as $$
  select array[
    array['naptar', 'idopontok_jegy', 'naplo', 'baratok'],
    array['kereses', 'beugro', 'baratok', 'evad_kartya'],
    array['musor_ma', 'kereses', 'idopontok_jegy', 'hely_ar_jegy'],
    array['naptar', 'kereses', 'kivansaglista', 'listak'],
    array['musor_ma', 'kivansaglista', 'kovetes', 'baratok'],
    array['musor_ma', 'naplo', 'listak', 'evad_kartya'],
    array['naplo', 'beugro', 'hely_ar_jegy', 'kivansaglista'],
    array['naptar', 'hely_ar_jegy', 'kovetes', 'evad_kartya'],
    array['idopontok_jegy', 'beugro', 'listak', 'kovetes']
  ];
$$;

-- ---------------------------------------------------------------------------
-- 3. The one way in
-- ---------------------------------------------------------------------------

create or replace function public.submit_research_response(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  blocks        text[][] := public.research_maxdiff_blocks();
  kano_answers  text[]   := array['tetszene', 'elvarom', 'mindegy', 'elviselnem', 'zavarna'];
  kano_features text[]   := array['ertesites', 'baratok', 'beugro', 'hely_ar_jegy', 'listak', 'evad'];
  item          jsonb;
  block_index   int;
  block_items   text[];
  best_id       text;
  worst_id      text;
  kano_key      text;
  kano_val      jsonb;
  recent        int;
  new_id        uuid;
begin
  -- A honeypot field the form hides from people. A bot that fills it gets a
  -- cheerful `ok` and no row, which is the outcome least worth investigating.
  if coalesce(payload->>'website', '') <> '' then
    return jsonb_build_object('ok', true);
  end if;

  if jsonb_typeof(payload) <> 'object' then
    raise exception 'payload must be an object' using errcode = 'check_violation';
  end if;
  if pg_column_size(payload) > 12000 then
    raise exception 'payload too large' using errcode = 'check_violation';
  end if;
  if (payload->>'version')::int is distinct from 1 then
    raise exception 'unknown questionnaire version' using errcode = 'check_violation';
  end if;

  if jsonb_typeof(payload->'behaviour') <> 'object' then
    raise exception 'behaviour must be an object' using errcode = 'check_violation';
  end if;

  -- Nine screens, each answered with two different features from that screen.
  if jsonb_typeof(payload->'maxdiff') <> 'array' or jsonb_array_length(payload->'maxdiff') <> array_length(blocks, 1) then
    raise exception 'maxdiff must answer every screen' using errcode = 'check_violation';
  end if;
  for item in select * from jsonb_array_elements(payload->'maxdiff') loop
    block_index := (item->>'block')::int;
    if block_index is null or block_index < 0 or block_index >= array_length(blocks, 1) then
      raise exception 'maxdiff names a screen that does not exist' using errcode = 'check_violation';
    end if;
    -- Postgres slices a 2-D array as a 2-D array; flatten the row to text[].
    select array_agg(x) into block_items from unnest(blocks[block_index + 1 : block_index + 1][1:4]) as x;
    best_id  := item->>'best';
    worst_id := item->>'worst';
    if best_id is null or worst_id is null or best_id = worst_id
       or not (best_id = any(block_items)) or not (worst_id = any(block_items)) then
      raise exception 'maxdiff answer is not two different features from its screen' using errcode = 'check_violation';
    end if;
  end loop;
  -- Each screen answered once.
  if (select count(distinct (e->>'block')) from jsonb_array_elements(payload->'maxdiff') e) <> array_length(blocks, 1) then
    raise exception 'maxdiff answers a screen twice' using errcode = 'check_violation';
  end if;

  -- Kano: every listed feature, both questions, answers from the vocabulary.
  if jsonb_typeof(payload->'kano') <> 'object' then
    raise exception 'kano must be an object' using errcode = 'check_violation';
  end if;
  for kano_key, kano_val in select * from jsonb_each(payload->'kano') loop
    if not (kano_key = any(kano_features)) then
      raise exception 'kano names an unknown feature' using errcode = 'check_violation';
    end if;
    if not ((kano_val->>'f') = any(kano_answers)) or not ((kano_val->>'d') = any(kano_answers)) then
      raise exception 'kano answer outside the vocabulary' using errcode = 'check_violation';
    end if;
  end loop;
  if (select count(*) from jsonb_object_keys(payload->'kano')) <> array_length(kano_features, 1) then
    raise exception 'kano must answer every feature' using errcode = 'check_violation';
  end if;

  -- Thirty a minute is far above friends sharing a link and far below a loop.
  select count(*) into recent
    from public.research_responses
   where submitted_at > now() - interval '1 minute';
  if recent >= 30 then
    raise exception 'too many submissions right now, try again in a minute' using errcode = 'too_many_connections';
  end if;

  insert into public.research_responses
    (client_id, version, source, behaviour, maxdiff, kano, open_answer, email)
  values (
    payload->>'client_id',
    1,
    nullif(left(payload->>'source', 40), ''),
    payload->'behaviour',
    payload->'maxdiff',
    payload->'kano',
    nullif(btrim(payload->>'open_answer'), ''),
    nullif(lower(btrim(payload->>'email')), '')
  )
  returning id into new_id;

  return jsonb_build_object('ok', true, 'id', new_id);
end;
$$;

-- The unique constraint on `client_id` surfaces as 23505 to the page, which
-- tells the respondent they have already answered rather than showing an error.

revoke all on function public.submit_research_response(jsonb) from public;
grant execute on function public.submit_research_response(jsonb) to anon, authenticated;
revoke all on function public.research_maxdiff_blocks() from public;
grant execute on function public.research_maxdiff_blocks() to anon, authenticated;

commit;
