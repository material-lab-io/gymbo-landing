// AEO how-to pillars (gy-k2543.13). Same `Post` shape as the blog; rendered by
// ArticlePage at /guide/<slug>/. Copy is owned by content —
// crew/content/output/guide-pillar-1-run-business-india-2026-06-25.md is the
// locked exemplar; pillars 2-4 (get-clients / schedule / get-organized) land here
// as content finalizes them. The per-slug guide/<slug>/index.html carries the
// hand-authored FAQPage + HowTo JSON-LD (content ships both blocks verbatim).
// Byline is founder-confirmed: "Kaushik Naarayan, founder of Gymbo, building with
// independent trainers in India" — carried across all pillars, no invented creds.
import type { Post } from "../blog/posts";

const runBusiness: Post = {
  slug: "run-personal-training-business-india",
  title: "how to run a personal training business in india",
  // 40-60w direct answer, placed in the standfirst slot for AEO extractability.
  dek: "To run a personal training business in India as an independent trainer, you need five systems: a client list, a schedule, session tracking, payment tracking, and simple billing. Most trainers start with WhatsApp, a diary, and UPI — and move to a single app once they pass ~15 clients and the admin gets heavy.",
  date: "2026-07-15",
  metaTitle: "How to Run a Personal Training Business in India | Gymbo",
  metaDescription:
    "The five systems an independent personal trainer in India needs — client list, schedule, session tracking, payments, and billing — the order to build them, and when to move off WhatsApp and a diary.",
  faq: [
    {
      q: "What does an independent personal trainer need to run their business?",
      a: "Five systems: a client list, a schedule, session tracking, payment tracking, and simple billing. Most Indian trainers run these on WhatsApp, a paper diary, and UPI at first, then move to a single app once admin gets heavy past around 15 clients.",
    },
    {
      q: "Can I run my training business on WhatsApp and a diary?",
      a: "Yes, and it's the right place to start — it's free and frictionless for a small roster. It tends to break down around 15 clients, when payments and session counts get hard to track from memory and month-end reconciliation becomes guesswork.",
    },
    {
      q: "How do personal trainers in India take payments?",
      a: "Most use UPI (GPay, PhonePe, or any UPI app) — it's near-universal, instant, and free for the payer. The key is to record each payment against the client and package so your balances stay accurate, rather than leaving it in a chat history.",
    },
    {
      q: "Do I need GST as a personal trainer in India?",
      a: "It depends on your turnover and registration status — check current thresholds with a tax professional. If you are registered, being able to issue a GST-ready statement to clients keeps you compliant and looks professional.",
    },
    {
      q: "When should I move from a notebook to an app?",
      a: "A practical signal: when you're no longer sure who's paid, who owes, and who's down to their last session — usually around 15 active clients. That's when the time you spend reconstructing the month outweighs the cost of a tool that does it for you.",
    },
  ],
  // Body markdown (no H1, no FAQ, no JSON-LD — those render/embed separately).
  // The quick-answer lives in `dek`; the byline line opens the body so the named
  // author + last-updated date are visible (ArticlePage runs with showDate=false).
  // TODO(pillars 2-4): restore the inline "how much to charge" link to
  // /guide/get-clients-personal-trainer-india once that pillar ships (dropped now
  // to avoid shipping an internal 404).
  bodyMd: `*Last updated: 15 July 2026 · By Kaushik Naarayan, founder of Gymbo, building with independent trainers in India*

India's fitness market is growing fast — from about **₹16,200 crore in 2024 toward ₹37,700 crore by 2030, roughly 15% a year**, and it's overwhelmingly made up of small, independent operators rather than big chains *(Deloitte × Health & Fitness Association, India Fitness Market Report 2025)*. If you train clients on your own, you're not on the edge of this market — you're the centre of it. This guide covers the systems that keep a one-person training business running, the order to build them in, and where each one tends to break.

(There's no reliable public count of how many independent personal trainers India has — the registers don't publish one — so we won't quote a number we can't stand behind. But every trainer we've worked with runs some version of the same five systems below.)

## the five systems every one-person training business needs

| System | What it covers | The free-stack version | What breaks past ~15 clients |
|---|---|---|---|
| **Client list** | Who your clients are, goals, package, rate | Memory + a notebook | You can't hold it all in your head |
| **Schedule** | Who trains when; cancellations and no-shows | WhatsApp + diary | Double-bookings, forgotten sessions |
| **Session tracking** | Sessions done, sessions left per client | Tally marks in a diary | The count drifts; disputes start |
| **Payment tracking** | Who's paid, who owes, who's on credit | UPI app + memory | Month-end becomes guesswork |
| **Billing** | Clean receipts/statements, GST if you need it | Manual / none | Looks unprofessional; hard to reconcile |

The free stack — WhatsApp, a paper diary, and UPI — runs all five informally, and it works well for a small roster. The trouble starts when the systems need to talk to each other ("she paid for 12, used 9, so 3 left, renewal due"). That's when you become the integration layer, and that's the work that doesn't scale.

## how to set it up, step by step

**1. Put your whole client list in one place.** Name, phone, goal, package size, and per-session rate for every client. This is the foundation — everything else hangs off it.

**2. Decide your packages and rates clearly.** Per-session or monthly packages, written down once, so you're not re-quoting from memory.

**3. Track every session the day it happens.** Log it immediately — sessions done and sessions remaining per client. A count you update later is a count you'll get wrong.

**4. Record payments against the client, not in a chat.** Every payment tied to a client and a package, so the balance (paid minus used) is always current. Get paid over **UPI**, which now runs over **23 billion transactions a month in India** *(NPCI, May 2026)* — your clients already use it.

**5. Send clean receipts and statements.** A simple, professional statement (GST-ready if you're registered) closes the loop and makes you look like the business you are.

**6. Review weekly.** Five minutes: who's due to renew, who owes, who's been quiet. This is how you stop revenue leaking before it happens.

## doing this without drowning in admin

You can run all six steps on WhatsApp, a diary, and UPI — and for your first several clients, you should. It's free and you already know it.

Past ~15 clients, the manual version starts costing you hours a week and the occasional missed payment. At that point a single app that keeps the client list, schedule, session counts, and payment balances in one place — and reconciles them for you — earns its keep. **Gymbo** is one such app, built specifically for the independent trainer in India: you log a session in one tap, balances update themselves, and payments and GST-ready statements live alongside each client. It's the admin/tracking/payment layer, so your time goes to training, not bookkeeping.

If you run a *gym* rather than train clients yourself, you need facility software instead — members, staff, branches — which is a different tool. (We compare that case honestly in [Akton vs Gymbo](/alternatives/akton).)`,
};

export const PILLARS: Post[] = [runBusiness];

export function pillarBySlug(slug: string): Post | undefined {
  return PILLARS.find((p) => p.slug === slug);
}
