# Umami Analytics — CF Workers + D1 Setup

Self-hosted Umami for getgymbo.com, running on Cloudflare Workers with D1 as the database.

## Deploy steps

### 1. Create D1 database

```bash
export CLOUDFLARE_API_TOKEN=<your-token>
export CLOUDFLARE_ACCOUNT_ID=3fdce42aeb5a7fa4ddbd6965eda8efc1

npx wrangler d1 create gymbo-analytics
# Copy the database_id from output → paste into wrangler.toml
```

### 2. Clone Umami and build for CF Workers

```bash
git clone https://github.com/umami-software/umami.git
cd umami
npm install
```

Deploy via Cloudflare Pages (recommended — supports D1 natively):

```bash
npx wrangler pages project create gymbo-analytics
DATABASE_URL="..." npm run build
npx wrangler pages deploy .next --project-name gymbo-analytics
```

Or use the community CF Workers adapter:
https://github.com/umami-software/umami/discussions/2012

### 3. Run database migrations

```bash
npx wrangler d1 execute gymbo-analytics --file=./sql/schema.postgresql.sql --remote
```

### 4. Point analytics.getgymbo.com at the worker

In Cloudflare DNS: add CNAME `analytics` → `gymbo-analytics.pages.dev`

### 5. Create website in Umami dashboard

- Log in at analytics.getgymbo.com (default: admin / umami)
- Change password immediately
- Add website: getgymbo.com
- Copy the Website ID

### 6. Update landing page

In `src/pages/index.astro`, replace `UMAMI_WEBSITE_ID` with the real ID:

```html
<script defer src="https://analytics.getgymbo.com/script.js" data-website-id="YOUR-ID-HERE"></script>
```

## Custom events tracked

| Event | Trigger |
|---|---|
| `cta_try_web_app` | Click "try the web app →" hero button |
| `cta_join_waitlist_hero` | Click "join the waitlist" hero button |
| `waitlist_signup` | Successful waitlist form submission |
