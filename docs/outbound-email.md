# Gymbo outbound email

Status: **Resend selected, not yet provisioned or sender-authenticated.**

Cloudflare Email Service was evaluated and declined because its current product is
transactional-only. The tracked Listmonk scaffold was evaluated and declined on
2026-08-31: it was not deployed, pointed at a retired Supabase project, expected a
nonexistent `waitlist.phone` column, omitted Postgres, and would have collided with
the existing service on port 9000. The decision record and evidence live on bead
`gm-d5d`.

## Scope and safety

- The first proof is one internal seed to `nyx@materiallab.io`.
- `scripts/send-resend-seed.mjs` hard-codes that recipient and requires both
  `--send` and the exact confirmation phrase.
- The script never reads Supabase and no waitlist row moves to Resend.
- No DNS change and no real-user send is authorized by this setup.
- Future real-user mail requires a new PM-approved campaign brief, content ruling,
  suppression review, and QA evidence.

## Human provisioning gate

Resend requires a human to create an account. A Material Lab administrator must:

1. Create or identify the Material Lab-owned Resend team for Gymbo.
2. Add `updates.getgymbo.com` as the sending domain with open and click tracking
   disabled.
3. Copy the exact provider-generated DNS records to `gm-d5d` for PM review.
   Do not apply them yet.
4. After the domain verifies, create a sending-only API key restricted to
   `updates.getgymbo.com`. Never commit or print the key.

The expected DNS *types* are a Resend return-path MX, a return-path SPF TXT, and a
provider-generated DKIM TXT. Their names and values are deliberately not guessed
here. Preserve the existing apex SPF and the single apex DMARC record; do not add a
second SPF or DMARC record.

## Seed procedure

```bash
npm run email:seed:test
npm run email:seed

# Inject RESEND_API_KEY through the approved secret path; do not paste it into Git.
export GYMBO_EMAIL_SEED_CONFIRM=SEND_SEED_TO_NYX_ONLY
npm run email:seed -- --send
```

After delivery, QA must inspect the received message, record SPF/DKIM/DMARC results,
and capture the delivered 390px render before `gm-d5d` can close.
