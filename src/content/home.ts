// Strings: marketer strings-v6 (gy-sk86p2.1, /home/kanaba/gymbo-evidence/gtm-gy-sk86p2/strings-v6.md sha fd19b8d8fa85b5ce), pasted with zero wording edits.
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

export type PillarCopy = { title: string; intro: string; bullets: string[] };

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
    // pm ruling 26 Nov 11:0xZ (gy-sk86p2.3): Damini's approved hero has no small print; strings-v4 has no such line. null = not rendered.
    smallPrint: null as string | null,
    deviceAlt: "Gymbo dashboard, balances, and payment records shown across three phones.",
  },

  // Her round 2 (26 Nov): no heading above the features; the page starts at card 1. This label is read by screen readers only.
  why: {
    label: "Why trainers use Gymbo",
  },

  // Keyed by the card id in App.tsx (which keeps the demo id, the photoreal-device contract). Order = cards 1 to 4.
  pillars: {
    revenue: {
      title: "Track your revenue",
      intro: "Punch each class and add each payment. Gymbo shows this month's total and what each client owes or has left.",
      bullets: [
        "You can see a client's credit update the moment you punch a class.",
        "You can record cash and UPI payments in one place.",
        "You can export a client's records as a PDF or CSV file.",
      ],
    },
    organized: {
      title: "Your whole roster in one place",
      intro: "Clients, classes and time slots together, not spread across WhatsApp chats and a diary.",
      bullets: [
        "You can set recurring time slots, sorted by day.",
        "You can save a class location and open directions from it.",
      ],
    },
    brand: {
      title: "Build your brand",
      intro: "What your clients see carries your name.",
      bullets: [
        "You can put your logo or brand name on your PDF statements.",
        "You can send a client their statement to ask for payment.",
        "You can share a profile card with a QR code that opens your WhatsApp or website.",
        "You can add your bio, specialities, Instagram, YouTube and website to that card.",
      ],
    },
    workouts: {
      title: "Build and track workouts",
      intro: "Plan training and see each client's progress.",
      bullets: [
        "You can build workouts from a template library and assign them to clients.",
        "You can share a workout with a client as a link they open without signing in.",
        "You can track each client's adherence to their plan.",
        "You can compare a client's before and after photos side by side.",
      ],
    },
  } satisfies Record<string, PillarCopy>,

  gallery: {
    label: "See Gymbo in action",
    eyebrow: null as string | null,
    heading: "See Gymbo in action",
    note: "Screens show sample data.",
    controls: "Gallery controls",
    // One dot per screen (her round 2: dots, not "1 of 6"). The name a screen reader hears for each dot.
    dot: (n: number, total: number, caption: string) => `Show screen ${n} of ${total}: ${caption}`,
    region: "See Gymbo in action gallery",
    help: (n: number) => `Use the dots, arrow keys, or horizontal swipe to browse all ${n} Gymbo screens.`,
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
    // strings-v6 [Footer]: new last line.
    madeBy: { label: "Made by Material Lab", href: "https://www.materiallab.io/" },
  },
};
