// Shared slug → source-file map for every real app screenshot the site renders.
//
// Single source of truth for optimize-gallery.mjs (build) and
// check-screenshot-freshness.mjs (gy-a73px.15 staleness gate) so the gated
// set can never drift from what actually gets rendered into the site.
//
// gy-dyu6r.6: these masters feed the framed gallery apertures and the four
// screen-only Forge pillars. The hero uses its approved baked MockupWorld
// composition, whose capture provenance is preserved by the licensed pipeline.
// Every master rendered directly on the live site remains freshness-gated.
//
// One slug per SOURCE MASTER, not per slot: the hero dashboard card and the
// gallery dashboard card are the same capture, so they share the `dashboard`
// slug and one set of derivatives. Adding a slot that reuses an existing
// master costs nothing; adding a new master costs a manifest entry.
export const SCREENS = {
  // gallery + pillars draw from this one set; the baked hero uses the first
  // three captures through the preserved composition pipeline.
  dashboard: "hero-01-dashboard-clean.png", // hero composition, gallery
  balances: "hero-02-who-owes-balance.png", // hero composition, gallery
  "log-payment": "hero-03-log-payment.png", // hero composition, gallery
  schedule: "organized-01-schedule-day.png", // pillar 02, gallery
  payments: "revenue-01-ledger-history.png", // pillar 01, gallery
  export: "revenue-02-export-statement.png", // pillar 03, gallery
  workouts: "workouts-01-template-fullbody.png", // pillar 04, gallery
  ai: "extra-ai-assistant.png", // gallery
};
