// Strings: marketer strings-v3 (gy-sk86p2.1, /home/kanaba/gymbo-evidence/gtm-gy-sk86p2/strings-v3.md sha 775ef98c960e695b), pasted with zero wording edits.
// gy-sk86p2.3 (Damini 26 Nov, STEP 1): EVERY string on the home page ('/') lives in this one file, so marketer's strings land without a
// layout edit. App.tsx and the hero component read from here and hold no copy of their own. A label set to null is not rendered.
// Facts (prices, plan names, URLs, the Start free / Log in labels) still come from src/lib/trialAccess.ts and are imported here, never retyped.
import {
  PRICE_MONTHLY_INR,
  PRICE_ANNUAL_INR_DISPLAY,
  PRICING_FREE_LINE,
  PRICING_PRO_ANNUAL_LINE,
  PRICING_PAYMENT_LINE,
} from "../lib/trialAccess";

export type PillarCopy = { eyebrow: string | null; title: string; intro: string; bullets: string[]; brief: string };

export const HOME = {
  nav: { why: "Why Gymbo", pricing: "Pricing", faq: "FAQ", backToTop: "Gymbo, back to top", skip: "Skip to content" },

  hero: {
    eyebrow: null as string | null,
    // The word above the tagline (round 7/8 hero, gy-de3dbt.11). web_designer's hero component (gy-sk86p2.2) owns how it looks.
    word: "GYMBO" as string | null,
    // The tagline is ONE sentence in two halves (web_designer's hero sets them either side of the phone; a plain hero joins them with a space).
    // Same words as strings-v3 'Business App for Personal Coaches': the split is layout data, not a wording change.
    title: { left: "Business App for", right: "Personal Coaches" },
    // The sub renders `lead` in ink and `rest` muted.
    sub: { lead: "See who owes you, how many classes each client has left, and what came in this month.", rest: "" },
    talk: "Talk to the founder",
    // pm ruling 26 Nov 11:0xZ (gy-sk86p2.3): Damini's approved hero has no small print; marketer drops the line in strings-v4. null = not rendered.
    smallPrint: null as string | null,
    deviceAlt: "Gymbo dashboard, balances, and payment records shown across three phones.",
  },

  why: {
    label: "Why trainers use Gymbo",
    eyebrow: null as string | null,
    heading: "What your training business runs on.",
  },

  // Keyed by the pillar id in App.tsx (which keeps the demo id and surface, the photoreal-device contract).
  pillars: {
    revenue: {
      eyebrow: null,
      title: "Track your revenue",
      intro: "Punch each class and add each payment. Gymbo shows this month's total and what each client owes or has left.",
      bullets: [
        "Credit and classes left update the moment you punch a class.",
        "Cash and UPI payments in one record.",
      ],
      brief: "Record a payment: UPI or cash, and the balance clears.",
    },
    organized: {
      eyebrow: null,
      title: "Your whole roster in one place",
      intro: "Clients, classes and time slots together, not spread across WhatsApp chats and a diary.",
      bullets: [
        "Recurring time slots, sorted by day.",
        "A client asks how many classes are left: check their count and reply.",
        "Save a class location and open directions from it.",
      ],
      brief: "Your week, classes morning to evening: Ravi, Sara, group, Imran.",
    },
    brand: {
      eyebrow: null,
      title: "Build your brand",
      intro: "What your clients see carries your name.",
      bullets: [
        "PDF statements with your logo or brand name on each one.",
        "A QR profile card you can share anywhere.",
        "Send a client their statement from the app to ask for payment.",
      ],
      brief: "Your brand on a clean statement PDF. Share in a tap (India).",
    },
    workouts: {
      eyebrow: null,
      title: "Build and track workouts",
      intro: "Plan training and see each client's progress.",
      bullets: [
        "Build and assign workouts from a template library.",
        "Track client progress: adherence and per-exercise gains.",
        "Class history for each client.",
      ],
      brief: "Build a plan (squat, bench, row) and assign it to a client.",
    },
  } satisfies Record<string, PillarCopy>,

  // The strip under the brand pillar. Icons are layout (App.tsx), keyed by `icon`.
  brandStrip: {
    label: null as string | null,
    region: "Brand touchpoints",
    // strings-v2 [Card 3: ticker], one item per chip, in its order. Sources per item: strings-v2 'Ticker sources'.
    chips: [
      { name: "PDF client statements", icon: "pdf" },
      { name: "Your logo on statements", icon: "logo" },
      { name: "Brand name on statements", icon: "brandname" },
      { name: "Share statements in-app", icon: "share" },
      { name: "Export records as CSV", icon: "csv" },
      { name: "QR profile card", icon: "qr" },
      { name: "QR opens your WhatsApp", icon: "whatsapp" },
      { name: "Share your profile card", icon: "card" },
      { name: "Instagram and YouTube links", icon: "social" },
      { name: "Your website link", icon: "website" },
      { name: "Specialities and bio", icon: "bio" },
    ],
  },

  gallery: {
    label: "See Gymbo in action",
    eyebrow: null as string | null,
    heading: "See Gymbo in action",
    note: "Screens show sample data.",
    controls: "Gallery controls",
    prev: "Show previous Gymbo screen",
    next: "Show next Gymbo screen",
    of: "of",
    region: "See Gymbo in action gallery",
    help: (n: number) => `Use the previous and next buttons, arrow keys, or horizontal swipe to browse all ${n} Gymbo screens.`,
    // Keyed by screenshot slug (App.tsx keeps the slug order).
    screens: {
      dashboard: { caption: "Classes left, client by client", alt: "Gymbo home screen showing a client's punch card: Aadesh, 3 of 10 classes used" },
      schedule: { caption: "Your week, tap to punch", alt: "Gymbo schedule for Wednesday with classes booked at 8 and 10 in the morning" },
      payments: { caption: "What came in, month by month", alt: "Gymbo class history showing ₹45,663 in payments recorded for June" },
      workouts: { caption: "Build and assign workouts", alt: "A full-body strength workout template in Gymbo with squat, bench press and barbell row" },
      ai: { caption: "Ask Gymbo", alt: "The Ask Gymbo chat screen" },
      export: { caption: "A statement with your name on it", alt: "Exporting a branded client statement as a PDF or CSV in Gymbo" },
    },
  },

  built: {
    label: "Why we built Gymbo",
    eyebrow: null as string | null,
    heading: "Built in India for Indian trainers",
    body: "Trainers keep session counts in their head, payments in UPI history and schedules in WhatsApp. Classes go uncounted and payments get missed. Gymbo keeps classes, payments and schedule in one place, with your name on what clients see. Gymbo does not message your clients.",
  },

  pricing: {
    label: "Pricing",
    eyebrow: null as string | null,
    heading: "Start free and upgrade when you are ready.",
    plans: [
      { name: "Free", tagline: "Free", note: PRICING_FREE_LINE },
      { name: "Pro", tagline: "Pro", period: "/month", note: PRICING_PRO_ANNUAL_LINE },
    ],
    payment: PRICING_PAYMENT_LINE,
  },

  faq: {
    label: "Frequently asked questions",
    eyebrow: null as string | null,
    heading: null as string | null,
    items: [
      { q: "Is it free?", a: `Yes, to start. Pro is ₹${PRICE_MONTHLY_INR} a month or ₹${PRICE_ANNUAL_INR_DISPLAY} a year, paid on the web.` },
      { q: "Do my clients need to download anything?", a: "No: you punch the class and your clients just train." },
      { q: "Can I export my clients' records?", a: "Yes: attendance and payment records, from the app, any time." },
      { q: "Is there an iPhone app?", a: "Coming soon: until then Gymbo runs in your browser. Leave your email and we will tell you when it is in the App Store.", waitlist: true },
      { q: "How do payments work?", a: "You record cash and UPI payments. Gymbo keeps the running balance and never touches your money." },
      { q: "Can I import my existing clients?", a: "On Android Chrome, add clients from your contacts. On iPhone, add them by hand." },
    ] as { q: string; a: string; waitlist?: boolean }[],
    waitlist: "Tell me when the iPhone app is out",
    compare: "See how Gymbo compares to WellnessZ", // the arrow after it is layout (App.tsx)
  },

  closing: {
    label: "Start free",
    eyebrow: null as string | null,
    heading: "You coach, Gymbo keeps your business records.",
    sub: "Start free in your browser, no payment needed.",
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
