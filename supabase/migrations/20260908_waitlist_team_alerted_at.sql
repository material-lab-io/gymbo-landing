-- gy-if6mq: the exactly-once marker for waitlist team alerts.
--
-- pm's AC2 constraint: "each signup appears in exactly ONE notification ever",
-- and the marker must survive a redeploy. A column on the row is the only place
-- that is true -- in-memory state dies with the isolate, and deriving it from
-- created_at cannot distinguish "alerted" from "not yet alerted".
--
-- NULL  = this signup has never been included in a team alert.
-- SET   = it has, at this timestamp, and it must never be included again.
--
-- Written ONLY after a send returns 2xx, never before. That ordering is what
-- makes a failed send retryable instead of silently lost: the row stays NULL
-- and the daily sweep picks it up (gy-if6mq AC2 point 4 / AC5 -- the row is the
-- asset). Marking before sending would convert a provider outage into a
-- permanently unnoticed lead, which is the exact defect this bead exists to fix.
alter table public.waitlist
  add column if not exists team_alerted_at timestamptz;

comment on column public.waitlist.team_alerted_at is
  'gy-if6mq: when this signup was included in a team alert (individual or digest). NULL = never alerted; the daily sweep will pick it up. Set only after Resend returns 2xx.';

-- The sweep''s only query shape: unalerted rows, oldest first.
create index if not exists waitlist_team_alerted_at_null_idx
  on public.waitlist (created_at)
  where team_alerted_at is null;
