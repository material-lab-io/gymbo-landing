// gy-t9mm8 — separate config: the client journey needs the Cloudflare Pages
// EMULATOR (which runs functions/), not `vite preview`, which serves only static
// files and would 404 every route this bead adds.
import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  testMatch: /client-journey\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  // A phone is where this link is actually opened.
  projects: [{ name: "mobile", use: { ...devices["Pixel 5"] } }],
});
