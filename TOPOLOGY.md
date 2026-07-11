# Gymbo Agent Topology
> Last updated: 2026-06-15  
> Covers both GT2 (this machine) and Mac (ssh mac → gt) nodes of the mesh

---

## Machine Map

```
╔══════════════════════════════════════════════════════════════════════════════════╗
║                              GT2  (hub node)                                   ║
║                                                                                 ║
║  ┌─────────────────────────┐   ┌─────────────────────────┐                     ║
║  │     PRODUCT LAYER       │   │    MARKETING LAYER      │                     ║
║  │                         │   │                         │                     ║
║  │  ┌──────┐  ┌──────────┐ │   │  ┌─────────┐           │                     ║
║  │  │  pm  │  │researcher│ │   │  │marketing│           │                     ║
║  │  └──┬───┘  └────┬─────┘ │   │  └────┬────┘           │                     ║
║  │     │           │feeds  │   │       │                 │                     ║
║  │     │◄──────────┘       │   │  ┌────┴────┐ ┌───────┐ │                     ║
║  └─────┼───────────────────┘   │  │marketer │ │landing│ │                     ║
║        │                       │  └─────────┘ └───────┘ │                     ║
║  ┌─────┼───────────────────┐   │  ┌─────────┐ ┌───────┐ │                     ║
║  │     │   DEV LAYER       │   │  │ content │ │ pull  │ │                     ║
║  │     ▼                   │   │  └─────────┘ └───┬───┘ │                     ║
║  │  ┌──────┐  ┌─────────┐  │   │  ┌─────────┐     │     │                     ║
║  │  │coach │  │ trainee │  │   │  │  push   │◄────┘     │                     ║
║  │  └──┬───┘  └─────────┘  │   │  └─────────┘           │                     ║
║  │     │dispatches         │   └─────────────────────────┘                     ║
║  └─────┼───────────────────┘                                                   ║
║        │                       ┌─────────────────────────┐                     ║
║        │                       │    OBSERVABILITY        │                     ║
║  ┌─────┼───────────────────┐   │                         │                     ║
║  │     │  DATA LAYER       │   │  ┌─────────┐ ┌───────┐ │                     ║
║  │     │                   │   │  │watchdog │ │herald │ │                     ║
║  │  ┌──┴─────┐             │   │  └─────────┘ └───────┘ │                     ║
║  │  │analyst │             │   │  ┌─────────┐ ┌───────┐ │                     ║
║  │  └────────┘             │   │  │  uxr    │ │analyst│ │                     ║
║  └───────────────────────  ┘   │  └─────────┘ └───────┘ │                     ║
║                                └─────────────────────────┘                     ║
╚══════════════════════════════════════════════════════════════════════════════════╝
                                        │
                         ───── mesh / gt mail ──────
                                        │
╔══════════════════════════════════════════════════════════════════════════════════╗
║                              MAC  (satellite node)                             ║
║                                                                                 ║
║  ┌─────────────────────────────────────────────────────────────────────────┐   ║
║  │                      iOS CLIENT LAYER                                   │   ║
║  │                                                                         │   ║
║  │    ┌──────────┐         ┌──────────┐         ┌──────────┐              │   ║
║  │    │  ios_dev │◄───────►│  tester  │◄────────│  pm      │ (GT2→Mac)   │   ║
║  │    └──────────┘         └──────────┘          └──────────┘              │   ║
║  │           ▲                                                              │   ║
║  │           │                                                              │   ║
║  │    ┌──────────┐                                                          │   ║
║  │    │ designer │  (UI/UX, Figma, iOS guardrails)                         │   ║
║  │    └──────────┘                                                          │   ║
║  └─────────────────────────────────────────────────────────────────────────┘   ║
╚══════════════════════════════════════════════════════════════════════════════════╝
```

---

## Ownership Table

| Agent | Machine | Owns | Reports to / Feeds |
|---|---|---|---|
| **pm** | GT2 | Requirements, ACs, sprint plan, tickets, milestone tracking | Human / overseer |
| **coach** | GT2 | Backend (Next.js API, Supabase, migrations), architecture | pm |
| **researcher** | GT2 | Competitor tracking, market sizing, persona research | pm, coach, marketing |
| **marketing** | GT2 | getgymbo.com landing (Vite/GSAP), brand assets, social, ASO | pm, marketer |
| **marketer** | GT2 | GTM strategy, positioning, messaging, campaigns | marketing, pm |
| **content** | GT2 | Brand voice, blog posts, case studies, email copy | marketer |
| **landing** | GT2 | Astro getgymbo.com build, waitlist form | marketing, marketer |
| **pull** | GT2 | SEO keyword briefs | content, marketer |
| **push** | GT2 | Content distribution, Product Hunt | marketer |
| **analyst** | GT2 | Supabase + Umami analytics queries, product health reports | coach, pm |
| **uxr** | GT2 | UX research, design briefs, usability audits | pm, designer |
| **trainee** | GT2 | Implementation tasks (delegated by coach) | coach |
| **watchdog** | GT2 | Prod monitoring, Linear issue creation, micro-PRs | coach |
| **herald** | GT2 | Daily PM digest to kaushik + damini (cron 05:58 IST) | autonomous |
| **video** | GT2 | Video content | marketing, marketer |
| **android_dev** | GT2 | Android client | coach |
| **trainer** | GT2 | Training content / curriculum | coach |
| **ios_dev** | Mac | iOS Swift app (SwiftUI, MVVM, XcodeGen, TestFlight) | pm, coach |
| **tester** | Mac | iOS QA — bug filing, test-fix loop, UAT sign-off | pm, ios_dev |
| **designer** | Mac | iOS UI/UX, Figma, design guardrails (L0-L6) | pm, uxr |

---

## Work Ownership Boundaries (strict)

### Feature development flow
```
pm (writes ACs) → ios_dev (builds) → tester (QA) → pm (sign-off)
                ↘ coach (backend dep) ↗
```

### Bug flow
```
tester (detects + files bead) → ios_dev (fixes) → tester (re-tests)
watchdog (auto-detects prod) → coach / ios_dev (fixes)
```

### Marketing flow
```
researcher (competitive intel) → marketer (strategy) → marketing (execution)
                                                     → content (copy)
                                                     → landing (Astro impl)
                                                     → push (distribution)
```

### Design flow
```
pm (feature brief) → uxr (UX research + brief) → designer (iOS UI)
                                               → marketing (web/brand)
```

### Analytics flow
```
analyst (queries Supabase + Umami) → coach (product decisions)
                                   → pm (requirements priority)
```

---

## Communication Protocol

All cross-agent communication goes through gt beads + mail:

```bash
# Structured handoff (survives session death)
gt mail send gymbo/crew/<agent> --subject "..." --body "..."

# Non-critical ping (ephemeral)
gt nudge gymbo/crew/<agent>

# Cross-machine (GT2 → Mac) — same commands, mail routes over mesh
gt mail send gymbo/crew/ios_dev --subject "..."
gt mail send gymbo/crew/tester --subject "..."
gt mail send gymbo/crew/designer --subject "..."
```

**Rule:** Use mail for handoffs, decisions, and work assignments. Use nudge for status pings.

---

## Strict "Do Not Cross" Rules

| Agent | Must NOT do |
|---|---|
| pm | Write code, execute tests, query analytics directly |
| coach | Own iOS UI decisions, create marketing copy |
| ios_dev | Make product/feature decisions, file Linear tickets |
| tester | Fix code, make feature decisions, write product copy |
| designer | Make backend decisions, write marketing copy |
| researcher | Make GTM strategy decisions, write feature tickets |
| marketing | Own GTM strategy (marketer does), write feature specs |
| analyst | Modify schema, create Linear tickets, make product decisions |
| watchdog | Create non-draft PRs, make architecture decisions |

---

## MLDS Cross-Rig Note

`material_lab_ds/crew/gymbo_web` (GT2, MLDS rig) previously owned the Vite/GSAP
landing page. That mandate has migrated to `gymbo/crew/marketing`. The gymbo_web
workspace in MLDS is the reference/source for prior design work; new work lives
in the gymbo rig.
