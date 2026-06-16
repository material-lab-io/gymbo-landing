# Waitlist backend setup (GYM-597)

The waitlist form (`src/components/WaitlistForm.tsx`) POSTs to `/api/waitlist`
(`functions/api/waitlist.js`), which inserts into a Cloudflare **D1** database
(binding `DB`). Until D1 is provisioned, the form **falls back to a mailto capture**
(no lead lost).

## One-time provisioning (needs a CF token with **D1:Edit** — the current
## Pages-deploy token does NOT have it; use the dashboard or a fuller token):

```bash
npx wrangler d1 create gymbo-waitlist          # prints database_id
npx wrangler d1 execute gymbo-waitlist --remote --file=./schema.sql
```

Then uncomment the `[[d1_databases]]` block in `wrangler.toml`, paste the
`database_id`, and redeploy. The form auto-upgrades from mailto → D1 (no code change).

Read entries: `npx wrangler d1 execute gymbo-waitlist --remote --command "SELECT * FROM waitlist"`
