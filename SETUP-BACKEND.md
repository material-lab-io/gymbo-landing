# Waitlist backend (gy-uh9os)

The waitlist form (`src/components/WaitlistForm.tsx`) POSTs to `/api/waitlist`
(`functions/api/waitlist.js`), a Cloudflare Pages Function that calls the
**Supabase** RPC `public.join_waitlist(...)`. It does **not** insert into the
`waitlist` table directly (gy-rh2rj).

> History: this was originally designed for Cloudflare **D1** (GYM-597), but D1
> provisioning needs a CF token with `D1:Edit` that the Pages-deploy token lacks.
> It was switched to Supabase (the prod project, hardened + verified by coach),
> which also unifies funnel data where the analyst already reports.

## How it works

- The function inlines the **public** Supabase anon key (the same
  `NEXT_PUBLIC_SUPABASE_ANON_KEY` the app ships — not a secret). No CF binding or
  env var is required, so deploys need no extra Cloudflare config.
- Write contract (security-critical — do not change; gy-rh2rj):
  - `POST {SUPABASE_URL}/rest/v1/rpc/join_waitlist` with headers `apikey`,
    `Authorization: Bearer <anon>`, `Content-Type: application/json`, and body
    `{ "p_name", "p_email", "p_phone", "p_source" }`. Empty fields are sent as
    `null`, never `""`, and `p_source` is always present (an absent key would let
    the column default stamp `getgymbo.com` on an unattributed lead).
  - **Why an RPC and not a table insert.** The table has unique indexes on
    `lower(email)` and `phone`. A direct insert made a duplicate answer `409` with
    the index name in the body, so anyone could probe whether a person is on the
    list (an enumeration oracle). `join_waitlist()` swallows the duplicate inside
    Postgres and returns a fresh random uuid (the *receipt*) for a new signup and
    for a known contact alike, so the response cannot tell them apart.
  - **The handler must not branch on a `200`.** New and duplicate are answered by
    one frozen `{ "ok": true }`. `scripts/verify-waitlist-oracle.mjs` (run in CI)
    fails if a new signup and a duplicate ever differ in status, headers or body.
  - Responses: `200` = accepted (new or known: indistinguishable) → function returns
    `200`; SQLSTATE `22023` (invalid input, raised before the table is touched) →
    `400`; anything else, including the function's own `waitlist unavailable`
    (`P0001`, which PostgREST also reports as a `400`) → `502`, and the form shows
    its inline error + pre-filled `mailto` fallback. The form and the function both
    reject a malformed email (`src/lib/emailShape.mjs`) before any call.
  - **The confirmation email.** On every `200` the function fires `waitlist-notify`
    with `{ "mode": "signup", "receipt" }` via `context.waitUntil`, never awaited (so
    a new signup and a duplicate return in the same time). `waitlist-notify` reads
    the contact from the *row* the receipt resolves to, never from the body, claims
    the send atomically (`confirmation_claimed_at`), and is a silent no-op for an
    unknown receipt. It is a Supabase edge function that is deployed **by hand**
    (gy-6nxc0); merging this repo does not deploy it.
  - **Direct table access.** `anon` currently still holds `INSERT` on
    `public.waitlist` (additive step A of gy-rh2rj). gy-rh2rj **step B** revokes it
    and drops the policy, after which `join_waitlist()` is the only anon write path.
    Read the state on gy-rh2rj rather than trusting this line to stay current.
    `anon` has never had `SELECT`, so no email can be read back.
- On success the client fires the Umami event `waitlist_signup` (visit→signup CVR).

## Read entries / verify

Use the Supabase dashboard or service-role key server-side (anon `SELECT` is 401).

The check below **creates a real row** and, if the address is real, sends a real
confirmation. Do not run it against production with a made-up address. Tag it as
an internal test (`"source":"internal-test"`) and ask analyst to exclude the row
(`scripts/waitlist-row-classification.json` in Gymbo-v1), or use the form with a
mailbox we own.

```bash
curl -s -X POST https://getgymbo.com/api/waitlist \
  -H 'Content-Type: application/json' \
  -d '{"name":"t","email":"test+'$(date +%s)'@example.com","source":"internal-test"}'   # expect HTTP 200 {"ok":true}
```

A malformed email is refused before any call and writes nothing, so it is a safe
liveness check: `{"name":"t","email":"nope"}` returns `400 {"error":"valid email required"}`.
