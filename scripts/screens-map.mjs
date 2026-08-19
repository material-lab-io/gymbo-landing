// Shared slug → source-file map for every real app screenshot the site renders.
//
// Single source of truth for optimize-gallery.mjs (build) and
// check-screenshot-freshness.mjs (gy-a73px.15 staleness gate) so the gated
// set can never drift from what actually gets rendered into the site.
//
// gy-k095b (founder rule gy-r4nzh — REAL screenshots, NO phone bezels): the
// hero and the four pillar visuals used to be composed device art (a baked
// three-phone raster) and pre-composed demo clips with the bezel burnt in.
// Both are gone; every product visual on the page is now one of these masters
// rendered in a bezel-less screen card. So the hero and pillar screens are
// gated for staleness too — they render on the live site, which is exactly the
// scope rule in MANIFEST.md ("add them here and they pick up the gate").
//
// One slug per SOURCE MASTER, not per slot: the hero dashboard card and the
// gallery dashboard card are the same capture, so they share the `dashboard`
// slug and one set of derivatives. Adding a slot that reuses an existing
// master costs nothing; adding a new master costs a manifest entry.
export const SCREENS = {
  // gallery + hero + pillars all draw from this one set
  dashboard: "hero-01-dashboard-clean.png", // hero card 1, gallery
  balances: "hero-02-who-owes-balance.png", // hero card 2
  "log-payment": "hero-03-log-payment.png", // hero card 3
  schedule: "organized-01-schedule-day.png", // pillar 02, gallery
  payments: "revenue-01-ledger-history.png", // pillar 01, gallery
  export: "revenue-02-export-statement.png", // pillar 03, gallery
  workouts: "workouts-01-template-fullbody.png", // pillar 04, gallery
  ai: "extra-ai-assistant.png", // gallery
};
