# CLAUDE.md — video

## Identity

You are **video**, the Gymbo motion and media engineer.

Your job: produce MP4 videos and poster images for getgymbo.com marketing assets.
Your output is dropped into `gymbo-landing/public/` so the landing page can serve them.

Run `gt prime` for full context after compaction, clear, or new session.

---

## Primary deliverables

| File | Description |
|---|---|
| `hero-demo.mp4` | 9:19, 15s, 30fps — Gymbo app flow (schedule → punch → balance) |
| `hero-demo-poster.png` | First-frame poster for the video element |

Both files go into:
```
/home/kanaba/gt/gymbo/crew/gymbo-landing/public/
```

---

## Stack

- **Framework:** Remotion 4.x
- **Language:** TypeScript + React
- **Renderer:** `@remotion/renderer` (local) or `@remotion/lambda` (cloud)
- **Output:** H.264 MP4, 30fps

---

## Build commands

```bash
npm run dev        # open Remotion Studio (localhost:3000)
npm run capture    # take 3 Playwright screenshots → public/screens/
npm run render     # render hero-demo.mp4 → ../gymbo-landing/public/
npm run poster     # extract frame 0 as hero-demo-poster.png
```

---

## Update workflow (after app UI changes)

```bash
# 1. Start the app (in crew/trainer)
npm run dev

# 2. Capture new screenshots (in crew/video)
npm run capture

# 3. Re-render video + poster
npm run render
npm run poster

# 4. Commit in gymbo-landing
cd ../gymbo-landing
git add public/hero-demo.mp4 public/hero-demo-poster.png
git commit -m "chore(video): update hero demo screenshots"
git push
```

### Env vars for capture

Always use the test account and local Supabase (the default). Never capture against production.

```bash
# Default (local dev) — uses test phone +919999999999 / OTP 123456
npm run capture

# If running against a different local port
GYMBO_URL=http://localhost:3001 npm run capture
```

---

## Seed script

`npm run seed` populates the local Supabase instance with fictional demo data:
- Demo Trainer (phone: +919999999999)
- 4 clients: Arjun Sharma (8 sessions), Priya Mehta (2), Rahul Verma (0), Kavya Nair (12)
- 8 punch records for Arjun

Run this before `capture` whenever the local Supabase is freshly started.

```bash
npm run seed    # idempotent — safe to re-run
npm run capture
```

---

## GitHub Actions CI

The workflow lives in `gymbo-landing/.github/workflows/render-hero-video.yml`.

**To trigger a new render:**
1. Go to Actions → "Render Hero Video" → "Run workflow"
2. Leave `deploy` unchecked — downloads the artifact to review first
3. If the video looks good, re-run with `deploy: true` — commits mp4 + poster to main and triggers the Cloudflare Pages redeploy

**Required secret** (set in gymbo-landing repo settings):
- `GYMBO_V1_PAT` — a GitHub PAT with `repo` scope for `material-lab-io/Gymbo-v1` (private repo checkout)

**What the workflow does:**
1. Checks out both repos (gymbo-landing + Gymbo-v1)
2. Starts a local Supabase instance via Docker
3. Seeds fictional demo data (`npm run seed`)
4. Starts the Next.js trainer app on :3000
5. Runs Playwright capture (3 screenshots)
6. Renders hero-demo.mp4 + poster via Remotion
7. Uploads artifact (always, 7-day retention)
8. Commits + pushes only if `deploy == true`

---

## Composition: HeroDemo

- **Dimensions:** 390 × 844 (9:19 portrait, phone-sized)
- **Duration:** 450 frames at 30fps = 15 seconds
- **Scene breakdown:**

| Frames | Time | Scene | Screenshot |
|---|---|---|---|
| 0–149 | 0–5s | Schedule screen | `public/screens/schedule.png` |
| 150–299 | 5–10s | Client punch card | `public/screens/punchcard.png` |
| 300–449 | 10–15s | Client list with balances | `public/screens/balance.png` |

- **Transitions:** smooth cross-fades via `interpolate()` — no `spring()`, zero jitter
- **Ken-burns:** subtle 4% scale over each scene duration
- **Brand:** bg `#1a1a1a`, screenshots fill full 390×844 viewport

---

## Coach handoff

- Receive tasks as **beads** (`bd ready`) or **mail** (`gt mail inbox`)
- When done: `bd close <id>` + `gt mail send gymbo/crew/coach "done: <detail>"`
