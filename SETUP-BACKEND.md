# Waitlist backend (gy-uh9os)

The waitlist form (`src/components/WaitlistForm.tsx`) POSTs to `/api/waitlist`
(`functions/api/waitlist.js`), a Cloudflare Pages Function that inserts into the
**Supabase** `waitlist` table via REST.

> History: this was originally designed for Cloudflare **D1** (GYM-597), but D1
> provisioning needs a CF token with `D1:Edit` that the Pages-deploy token lacks.
> It was switched to Supabase (the prod project, hardened + verified by coach),
> which also unifies funnel data where the analyst already reports.

## How it works

- The function inlines the **public** Supabase anon key (the same
  `NEXT_PUBLIC_SUPABASE_ANON_KEY` the app ships — not a secret). No CF binding or
  env var is required, so deploys need no extra Cloudflare config.
- Insert contract (security-critical — do not change):
  - `POST {SUPABASE_URL}/rest/v1/waitlist`
  - headers: `apikey`, `Authorization: Bearer <anon>`, `Content-Type: application/json`,
    `Prefer: return=minimal`
  - body: `{ "name": "...", "email": "..." }` (the `source` column auto-defaults)
  - **Plain insert only.** Do NOT add `Prefer: resolution=ignore-duplicates` or
    `return=representation` — both require `SELECT`, which RLS returns `401` for by
    design (so anon can never read emails back); `representation` would leak emails.
  - Responses: `201` = joined → function returns `201`; `409` = already on the
    list → function returns `200` (success); anything else → `502`, and the form
    shows its inline error + pre-filled `mailto` fallback.
- On success the client fires the Umami event `waitlist_signup` (visit→signup CVR).

## Read entries / verify

Use the Supabase dashboard or service-role key server-side (anon `SELECT` is 401).

```bash
curl -s -X POST https://getgymbo.com/api/waitlist \
  -H 'Content-Type: application/json' \
  -d '{"name":"t","email":"test+'$(date +%s)'@example.com"}'   # expect HTTP 201
```
