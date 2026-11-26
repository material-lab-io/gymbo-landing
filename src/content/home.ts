// gy-sk86p2.3 (Damini 26 Nov, STEP 1): EVERY string on the home page ('/') lives in this one file, so marketer's strings land without a
// layout edit. App.tsx and the hero component read from here and hold no copy of their own. A label set to null is not rendered.
// Facts (prices, plan names, URLs, the Start free / Log in labels) still come from src/lib/trialAccess.ts and are imported here, never retyped.
import {
  STATUS_LANGUAGE,
  PRICE_MONTHLY_INR,
  PRICE_ANNUAL_INR_DISPLAY,
  HERO_SMALL_PRINT,
  FINAL_CTA_SUB,
  PRICING_HEADING,
  PRICING_FREE_LINE,
  PRICING_PRO_ANNUAL_LINE,
  PRICING_PAYMENT_LINE,
} from "../lib/trialAccess";

export type PillarCopy = { eyebrow: string | null; title: string; intro: string; bullets: string[]; brief: string };

export const HOME = {
  nav: { why: "Why Gymbo", pricing: "Pricing", faq: "FAQ", backToTop: "Gymbo, back to top", skip: "Skip to content" },

  hero: {
    eyebrow: STATUS_LANGUAGE as string | null,
    // The title renders as `before` + highlighted `highlight` + `after`. highlight: null = one plain line.
    title: { before: "The ", highlight: "business app" as string | null, after: " for independent personal trainers." },
    // The sub renders `lead` in ink and `rest` muted, as live does.
    sub: { lead: "Track payments and balances, see who owes you, and keep clients and classes in one place", rest: ". Built for independent trainers in India." },
    talk: "Talk to the founder",
    smallPrint: HERO_SMALL_PRINT,
    deviceAlt: "Gymbo dashboard, balances, and payment records shown across three phones.",
  },

  why: {
    label: "Why trainers use Gymbo",
    eyebrow: "Why trainers use Gymbo" as string | null,
    heading: "What your training business runs on.",
  },

  // Keyed by the pillar id in App.tsx (which keeps the demo id and surface, the photoreal-device contract).
  pillars: {
    revenue: {
      eyebrow: "01 · The Gymbo ledger",
      title: "Track your revenue",
      intro: "The Gymbo ledger tracks every class you punch and every payment you record, so you can see where each client stands.",
      bullets: [
        "Every balance, clear: credit and classes left, updated the moment you punch a class.",
        "Track every class, payment, and balance.",
        "Cash or UPI recorded, so you don't lose track.",
      ],
      brief: "Record a payment: UPI or cash, and the balance clears.",
    },
    organized: {
      eyebrow: "02 · Your whole roster",
      title: "Get organized",
      intro: "Less busywork, more training. Every client, schedule, and class in one place, not in your head.",
      bullets: [
        "Punch a class in a couple of taps, and balances update themselves",
        "Recurring time slots, sorted by day",
        "No more paper register or notes app",
        "Save a class location and open directions when you need them.",
      ],
      brief: "Your week, classes morning to evening: Ravi, Sara, group, Imran.",
    },
    brand: {
      eyebrow: "03 · Look professional",
      title: "Your brand, your business",
      intro: "Look like the professional you already are. Your name and details on every statement your client sees, plus a QR profile card you can share anywhere.",
      bullets: [
        "PDF statements with your brand name and logo on each one",
        "A shareable QR profile card",
        "Send any client their statement from the app",
      ],
      brief: "Your brand on a clean statement PDF. Share in a tap (India).",
    },
    workouts: {
      eyebrow: "04 · Coaching tools",
      title: "Train smarter",
      intro: "Build workouts, assign them to clients, and track real progress: adherence and per-exercise gains.",
      bullets: [
        "Build and assign workouts from a template library",
        "Track client progress: class history, adherence, per-exercise gains",
        "Get directions to your next class, right from the app",
      ],
      brief: "Build a plan (squat, bench, row) and assign it to a client.",
    },
  } satisfies Record<string, PillarCopy>,

  // The strip under the brand pillar. Icons are layout (App.tsx), keyed by `icon`.
  brandStrip: {
    label: "Your brand, everywhere" as string | null,
    region: "Brand touchpoints",
    chips: [
      { name: "QR profile", icon: "qr" },
      { name: "Share links", icon: "share" },
      { name: "PDF statements", icon: "pdf" },
      { name: "Your logo on client statements", icon: "logo" },
    ],
  },

  gallery: {
    label: "See Gymbo in action",
    eyebrow: "A closer look" as string | null,
    heading: "See Gymbo in action.",
    note: "Screens shown with sample data.",
    controls: "Gallery controls",
    prev: "Show previous Gymbo screen",
    next: "Show next Gymbo screen",
    of: "of",
    region: "See Gymbo in action gallery",
    help: (n: number) => `Use the previous and next buttons, arrow keys, or horizontal swipe to browse all ${n} Gymbo screens.`,
    // Keyed by screenshot slug (App.tsx keeps the slug order).
    screens: {
      dashboard: { caption: "Every client, at a glance", alt: "Gymbo home screen showing a client's punch card: Aadesh, 3 of 10 classes used" },
      schedule: { caption: "Your week, tap to punch", alt: "Gymbo schedule for Wednesday with classes booked at 8 and 10 in the morning" },
      payments: { caption: "Every class and payment, tracked", alt: "Gymbo class history showing ₹45,663 in payments recorded for June" },
      workouts: { caption: "Build and assign workouts", alt: "A full-body strength workout template in Gymbo with squat, bench press and barbell row" },
      ai: { caption: "Ask Gymbo", alt: "The Ask Gymbo chat screen" },
      export: { caption: "Branded statements in a tap", alt: "Exporting a branded client statement as a PDF or CSV in Gymbo" },
    },
  },

  built: {
    label: "Why we built Gymbo",
    eyebrow: "Why we built Gymbo" as string | null,
    heading: "Built in India for Indian trainers",
    body: "WhatsApp threads, paper registers, and mental math can only carry a training business so far. Payments start slipping through the cracks, schedules live in someone's head, and looking professional means building your own invoices from scratch. We built Gymbo to replace all of that: one app that tracks every class and payment, keeps your schedule straight, and makes you look like the business you already are. Your client list stays yours too: Gymbo does not send messages to your clients.",
  },

  pricing: {
    label: "Pricing",
    eyebrow: "Pricing" as string | null,
    heading: PRICING_HEADING,
    plans: [
      { name: "Free", tagline: "Free", note: PRICING_FREE_LINE },
      { name: "Pro", tagline: "Pro", period: "/month", note: PRICING_PRO_ANNUAL_LINE },
    ],
    payment: PRICING_PAYMENT_LINE,
  },

  faq: {
    label: "Frequently asked questions",
    eyebrow: "Questions" as string | null,
    heading: "Everything you might ask." as string | null,
    items: [
      { q: "Is it free?", a: `You can start free. Pro is ₹${PRICE_MONTHLY_INR} a month or ₹${PRICE_ANNUAL_INR_DISPLAY} a year, paid on the web.` },
      { q: "Do my clients need to download anything?", a: "No. Gymbo is for you, the trainer. Your clients just train. You punch the class." },
      { q: "Can I export my clients' records?", a: "Yes. You can export your clients' attendance and payment records from the app whenever you like." },
      { q: "Is there an iPhone app?", a: "Coming soon. Leave your email and we will tell you when it is in the App Store. Until then Gymbo runs in your browser.", waitlist: true },
      { q: "How do payments work?", a: "You record cash or UPI payments yourself. Gymbo keeps the running balance. It doesn't touch your money." },
      { q: "Can I import my existing clients?", a: "On Android Chrome you can add clients from your contacts. On iPhone, add them by hand." },
    ] as { q: string; a: string; waitlist?: boolean }[],
    waitlist: "Tell me when the iPhone app is out",
    compare: "Comparing trainer apps? See how Gymbo compares to WellnessZ →",
  },

  closing: {
    label: "Start free",
    eyebrow: STATUS_LANGUAGE as string | null,
    heading: "Payments, schedules, and clients in one app.",
    sub: FINAL_CTA_SUB,
    talk: "Talk to the founder",
  },

  footer: {
    name: "Gymbo.",
    tagline: "Your business, in your pocket.",
    nav: "Footer navigation",
    groups: [
      { label: "Learn", links: [
        { label: "Guides", href: "/guide/" },
        { label: "Research", href: "/research/state-of-indias-independent-trainers-2026/" },
        { label: "Blog", href: "/blog/" },
      ] },
      { label: "Compare", links: [
        { label: "Gymbo vs WellnessZ", href: "/compare/gymbo-vs-wellnessz/" },
        { label: "Trainerize alternative", href: "/alternatives/trainerize/" },
        { label: "TrueCoach alternative", href: "/alternatives/truecoach/" },
        { label: "Akton alternative", href: "/alternatives/akton/" },
      ] },
      { label: "Help", links: [
        { label: "Support", href: "#support" },
        { label: "Contact", href: "mailto:damini@materiallab.io" },
        { label: "Request video removal", href: "/m/takedown" },
      ] },
      { label: "Legal", links: [
        { label: "Privacy", href: "/privacy/" },
        { label: "Terms", href: "/terms/" },
      ] },
    ],
    support: "Support:",
    copyright: "© 2026 Material Lab.",
    talk: "Talk to the founder",
  },
};
