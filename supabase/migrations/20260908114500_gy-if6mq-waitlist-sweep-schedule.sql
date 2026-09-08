-- 20260908114500_gy-if6mq-waitlist-sweep-schedule.sql
-- gy-if6mq step 4: schedule the daily waitlist sweep.
--
-- WHY THE SWEEP MATTERS, and it is not just the digest: it is the ONLY thing that
-- bounds "the alert failed and nobody ever knew" at ONE DAY instead of forever. A
-- failed individual alert leaves team_alerted_at NULL, and this job picks up anything
-- still NULL. Without it the loop this bead closes has an open end.
--
-- 🔴 THE SECRET IS NOT IN cron.job.command. A raw net.http_post in the schedule would
-- store the shared secret as PLAINTEXT in cron.job, readable by anyone who can select
-- it. Instead this mirrors the house pattern already used by fn_send_trainer_reminders:
-- a settings table with RLS on and no anon access, read by a SECURITY DEFINER function
-- that cron calls by name. Verified before copying: trainer_reminder_settings has
-- relrowsecurity = true and has_table_privilege('anon', ...,'SELECT') = false.
-- supabase_vault is installed but vault.secrets is EMPTY, so the settings-table pattern
-- is the live convention here, not vault.

create table if not exists public.waitlist_notify_settings (
  id         integer primary key default 1 check (id = 1),
  enabled    boolean not null default true,
  ef_url     text,
  ef_secret  text,
  updated_at timestamptz not null default now()
);

alter table public.waitlist_notify_settings enable row level security;
-- No policies on purpose: RLS with zero policies denies everyone except the table
-- owner and service_role. anon/authenticated must never read a shared secret.
revoke all on public.waitlist_notify_settings from anon, authenticated;

comment on table public.waitlist_notify_settings is
  'gy-if6mq: config for the daily waitlist-notify sweep. Holds the Edge Function URL and its shared gate secret so they never appear in cron.job.command. RLS on, no policies, no anon/authenticated grants. `enabled` is the kill switch.';

-- The function cron calls. SECURITY DEFINER so it can read the settings row that
-- callers cannot. It returns a jsonb verdict rather than void: a scheduled job whose
-- outcome cannot be inspected is the same class of defect this bead exists to close.
create or replace function public.fn_waitlist_notify_sweep()
returns jsonb
language plpgsql
security definer
set search_path = public, net, pg_temp
as $fn$
declare
  v_cfg public.waitlist_notify_settings;
  v_request_id bigint;
begin
  select * into v_cfg from public.waitlist_notify_settings where id = 1;

  -- An INERT run must be distinguishable from a run that swept nothing. Returning a
  -- null/empty result for both is how a disabled job reads as a healthy one.
  if v_cfg is null or not v_cfg.enabled or v_cfg.ef_url is null or v_cfg.ef_secret is null then
    return jsonb_build_object('inert', true, 'reason', 'unconfigured_or_disabled', 'dispatched', false);
  end if;

  select net.http_post(
           url     := v_cfg.ef_url,
           headers := jsonb_build_object(
                        'Content-Type', 'application/json',
                        'x-waitlist-secret', v_cfg.ef_secret),
           body    := jsonb_build_object('mode', 'sweep')
         )
    into v_request_id;

  -- pg_net is fire-and-forget: this id is the HANDLE that lets the outcome be joined
  -- back from net._http_response later. It is NOT evidence the mail was sent, and it
  -- must not be read as such.
  return jsonb_build_object('inert', false, 'dispatched', true, 'pg_net_request_id', v_request_id);
end;
$fn$;

revoke all on function public.fn_waitlist_notify_sweep() from public, anon, authenticated;
