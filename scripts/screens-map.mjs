// Shared slug → source-file map for the "See Gymbo in action" gallery.
// Single source of truth for both optimize-gallery.mjs (build) and
// check-screenshot-freshness.mjs (gy-a73px.15 staleness gate) so the gated
// set can never drift from what actually gets rendered into the site.
export const SCREENS = {
  dashboard: "hero-01-dashboard-clean.png",
  schedule: "organized-01-schedule-day.png",
  payments: "revenue-01-ledger-history.png",
  ai: "extra-ai-assistant.png",
  workouts: "workouts-01-template-fullbody.png",
  export: "revenue-02-export-statement.png",
};
