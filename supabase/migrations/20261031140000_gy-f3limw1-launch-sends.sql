-- gy-f3limw.1 campaign-1 launch notice. NOT APPLIED ANYWHERE; apply only on the functional stack until pm activates.
-- The 2-sends-ever cap lives HERE, in the store, not in operator care.
create table if not exists public.waitlist_launch_sends (
  waitlist_id bigint not null references public.waitlist(id) on delete cascade,
  send_no smallint not null check (send_no in (1, 2)),
  claimed_at timestamptz not null default now(),
  resend_message_id text,
  primary key (waitlist_id, send_no)
);
alter table public.waitlist_launch_sends enable row level security;
revoke all on public.waitlist_launch_sends from public, anon, authenticated;

-- Recipients: email present, not opted out (gy-iuu8t.1), no earlier-or-equal send already claimed.
-- BLOCKED (gy-e60uc.4.1): the hard-bounce / complaint exclusion cannot be written until that bead creates the
-- columns. Until it lands, the activation checklist MUST NOT be signed (compliance C3). Do not add a guess here.
create or replace function public.waitlist_launch_recipients(p_send_no int)
returns table (id bigint, name text, email text)
language sql security definer set search_path = public as $$
  select w.id, w.name, w.email
  from public.waitlist w
  where p_send_no in (1, 2)
    and nullif(btrim(w.email), '') is not null
    and w.opted_out_at is null
    and not exists (select 1 from public.waitlist_launch_sends s where s.waitlist_id = w.id and s.send_no >= p_send_no);
$$;
revoke all on function public.waitlist_launch_recipients(int) from public, anon, authenticated;
grant execute on function public.waitlist_launch_recipients(int) to service_role;
