// gy-t9mm8 AC5 — ONE end-to-end journey, in a real browser, as a real client.
//
// FOUNDER-DIRECTED BALANCE, and the anti-goal comes first: DO NOT WRITE TESTS
// THAT PASS WITHOUT THE FEATURE WORKING. So this is deliberately not a suite of
// element-existence assertions. It is the actual journey — open a link you were
// sent, watch an exercise, tick it off — and every assertion is one that FAILS
// if the corresponding piece is broken:
//
//   · the page is opened in a FRESH context with no storage and no history,
//     because "no login required" is only proven from a device that has never
//     seen Gymbo. A logged-in browser would prove nothing.
//   · the video is asserted to have actually DECODED A FRAME, not merely to
//     exist in the DOM. An <video> with a dead src passes an existence check.
//   · the tick is asserted AFTER A RELOAD, so it can only pass if the write
//     genuinely reached the database. This is the assertion that makes a
//     no-op mock impossible to hide behind.
import { test, expect } from "@playwright/test";

const BASE = process.env.PAGES_URL!;
const TOKEN = process.env.MOCK_TOKEN || "abcdefghijklmnopqrstuvwxyz01";
const CONTROL = process.env.MOCK_URL!;

test("a client opens a shared link, watches an exercise and ticks it off", async ({ browser }) => {
  await fetch(`${CONTROL}/__control?reset=1`);

  // A DEVICE THAT HAS NEVER SEEN GYMBO. No storage state, no cookies, no history.
  const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await ctx.newPage();

  await page.goto(`${BASE}/w/${TOKEN}`);

  // AC1 — the workout is simply there, with nothing to sign in to.
  await expect(page.getByRole("heading", { name: "Push day" })).toBeVisible();
  await expect(page.getByText("Bench Press")).toBeVisible();
  await expect(page.getByText("3 × 10 @ 40kg")).toBeVisible();
  // Nothing anywhere that asks the client who they are.
  expect(await page.locator("input[type=email], input[type=tel], textarea").count()).toBe(0);

  // AC2 — the video really plays. currentTime advancing past zero means frames
  // were decoded; readyState alone can be satisfied by metadata only.
  const video = page.locator("video").first();
  await expect(video).toHaveAttribute("playsinline", "");
  await expect(video).toHaveAttribute("loop", "");
  await page.waitForFunction(
    () => {
      const v = document.querySelector("video") as HTMLVideoElement | null;
      return !!v && v.readyState >= 2 && v.currentTime > 0;
    },
    undefined,
    { timeout: 15_000 },
  );

  // AC3 — the credit is on screen next to the clip it belongs to.
  await expect(page.getByText("Goulart")).toBeVisible();
  await expect(page.getByText(/Creative Commons Attribution Share Alike 4/)).toBeVisible();

  // AC2 NEG — the second exercise has no media, and says so rather than showing
  // a broken player. Same page, same journey: this is what the client sees.
  await expect(page.getByText("Plank")).toBeVisible();
  await expect(page.getByText("No video for this exercise.")).toBeVisible();

  // THE TICK. Then reload — this is the assertion that cannot be faked.
  await page.getByRole("button", { name: "Mark done" }).first().click();
  await page.waitForURL(`${BASE}/w/${TOKEN}`);
  await page.reload();
  await expect(page.getByRole("button", { name: "✓ Done" })).toBeVisible();

  // And the trainer's half of the founder ask: "reply to the trainer that it's done".
  await page.getByRole("button", { name: "I finished this workout" }).click();
  await page.reload();
  await expect(page.getByText(/Workout complete/)).toBeVisible();

  await ctx.close();
});

test("AC1 NEG: a tampered token is refused in a real browser", async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await ctx.newPage();
  const res = await page.goto(`${BASE}/w/zzzzzzzzzzzzzzzzzzzzzzzzzzzz`);
  expect(res?.status()).toBe(404);
  await expect(page.getByText("This link is not available")).toBeVisible();
  // No workout content may leak on a refusal.
  await expect(page.getByText("Bench Press")).toHaveCount(0);
  await ctx.close();
});

test("AC1 NEG: an EXPIRED link is refused in a real browser", async ({ browser }) => {
  await fetch(`${CONTROL}/__control?expire=1`);
  const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await ctx.newPage();
  const res = await page.goto(`${BASE}/w/${TOKEN}`);
  expect(res?.status()).toBe(404);
  await expect(page.getByText("This link is not available")).toBeVisible();
  await fetch(`${CONTROL}/__control?expire=0`);
  await ctx.close();
});

test("AC4: the deployed page carries no server credential", async ({ request }) => {
  const res = await request.get(`${BASE}/w/${TOKEN}`);
  const body = await res.text();
  // Positive control first: if we cannot find something we KNOW is on the page,
  // the absence below means nothing.
  expect(body).toContain("Push day");
  expect(body).not.toContain("service_role");
  expect(body).not.toContain(process.env.SUPABASE_SERVICE_ROLE_KEY || "__unset__");
});
