#!/usr/bin/env node
// gy-t9mm8 — a STATEFUL stand-in for Supabase, for the end-to-end journey only.
//
// WHY STATEFUL, AND IT IS THE WHOLE POINT. The bead's anti-goal is "do not write
// tests that pass without the feature working". A mock that cheerfully returns
// 201 to every write would let the journey go green while the tick-off never
// persisted — the exact class of defect this rig has been finding all week. So
// this keeps real state: the journey ticks an exercise, RELOADS, and the tick
// has to still be there, which is only true if the POST genuinely happened and
// carried the right ids.
//
// It implements only the PostgREST subset these Functions actually use.
import { createServer } from "node:http";
import { readFileSync } from "node:fs";

const TOKEN = process.env.MOCK_TOKEN || "abcdefghijklmnopqrstuvwxyz01";
const LINK_ID = "aaaaaaaa-1111-2222-3333-444444444444";
const ASSIGN_ID = "bbbbbbbb-1111-2222-3333-444444444444";
const WORKOUT_ID = "ffffffff-1111-2222-3333-444444444444";
const BLOCK_A = "cccccccc-1111-2222-3333-444444444444";
const BLOCK_B = "cccccccc-1111-2222-3333-555555555555";
const EX_A = "dddddddd-1111-2222-3333-444444444444";
const EX_B = "dddddddd-1111-2222-3333-555555555555";

const clip = readFileSync(new URL("../tests/fixtures/clip.mp4", import.meta.url));

// THE STATE. completions starts EMPTY on purpose: if the journey's assertion
// passed against a pre-seeded row it would prove nothing about the tap.
const state = { completions: new Set(), completedAt: null, expired: false, revoked: false };

const link = () => ({
  id: LINK_ID, assignment_id: ASSIGN_ID,
  expires_at: new Date(Date.now() + (state.expired ? -1000 : 864e5)).toISOString(),
  revoked_at: state.revoked ? new Date().toISOString() : null,
  completed_at: state.completedAt,
});

// Exercise A has a complete, attributable wger clip. Exercise B has NO media at
// all — so the journey also sees AC2's defined empty state in the same page,
// rather than a separate contrived test.
const media = [{
  id: "eeeeeeee-1111-2222-3333-444444444444", exercise_id: EX_A,
  source: "wger", asset_kind: "video", availability: "available", author: "Goulart",
  source_url: "https://wger.de/en/exercise/512/view/", licence_id: "CC-BY-SA-4.0",
  licence_name: "Creative Commons Attribution Share Alike 4",
  licence_url: "https://creativecommons.org/licenses/by-sa/4.0/deed.en",
  object_path: "wger/clip.mp4", is_derivative: true,
  modification_note: "Transcoded from H.265/HEVC to H.264 for playback compatibility.",
}];

const blocks = [
  { id: BLOCK_A, position: 0, exercise_id: EX_A, exercise_name: "Bench Press", sets: 3, reps: "10", load: "40kg", rest_seconds: 60, notes: null },
  { id: BLOCK_B, position: 1, exercise_id: EX_B, exercise_name: "Plank", sets: 3, reps: "45s", load: null, rest_seconds: 30, notes: null },
];

const json = (res, body, status = 200) => {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
};

const server = createServer((req, res) => {
  const u = new URL(req.url, "http://x");
  const p = u.pathname;

  // Test-only control plane, so the journey can flip the link to expired and
  // SEE the refusal in the same browser rather than trusting a unit test.
  if (p === "/__control") {
    if (u.searchParams.has("expire")) state.expired = u.searchParams.get("expire") === "1";
    if (u.searchParams.has("revoke")) state.revoked = u.searchParams.get("revoke") === "1";
    if (u.searchParams.has("reset")) { state.completions.clear(); state.completedAt = null; state.expired = false; state.revoked = false; }
    return json(res, { ok: true, completions: [...state.completions], completedAt: state.completedAt });
  }

  if (p === "/storage/v1/object/sign/exercise-media/wger/clip.mp4" && req.method === "POST")
    return json(res, { signedURL: "/object/public/clip.mp4?token=stub" });
  if (p === "/storage/v1/object/public/clip.mp4") {
    res.writeHead(200, { "content-type": "video/mp4", "content-length": clip.length, "accept-ranges": "bytes" });
    return res.end(clip);
  }

  if (p === "/rest/v1/workout_share_links") {
    if (req.method === "PATCH") {
      let b = ""; req.on("data", (d) => (b += d));
      return req.on("end", () => {
        try { state.completedAt = JSON.parse(b).completed_at; } catch {}
        res.writeHead(204).end();
      });
    }
    const t = u.searchParams.get("token");
    return json(res, t === `eq.${TOKEN}` ? [link()] : []);
  }
  if (p === "/rest/v1/workout_assignments") return json(res, [{ workout_id: WORKOUT_ID }]);
  if (p === "/rest/v1/workouts") return json(res, [{ name: "Push day", notes: "Warm up first." }]);
  if (p === "/rest/v1/workout_blocks") {
    // 🔴 THE FILTERS ARE HONOURED, and that is not pedantry — gy-nm6ii added a
    // SCOPED lookup (id + workout_id) to answer "is this block in this workout?".
    // A mock that ignores filters and returns every row answers "2 rows" to a
    // single-id query, which is nothing PostgREST would ever say. The stand-in
    // has to behave like the thing it stands in for or the journey is measuring
    // the mock, not the feature.
    const eq = (k) => (u.searchParams.get(k) || "").replace(/^eq\./, "");
    const wantId = u.searchParams.has("id") ? eq("id") : null;
    const wantWorkout = u.searchParams.has("workout_id") ? eq("workout_id") : null;
    let rows = blocks;
    if (wantId) rows = rows.filter((b) => b.id === wantId);
    if (wantWorkout) rows = wantWorkout === WORKOUT_ID ? rows : [];
    return json(res, rows);
  }
  if (p === "/rest/v1/exercise_media") return json(res, media);
  if (p === "/rest/v1/workout_share_block_completions") {
    if (req.method === "POST") {
      let b = ""; req.on("data", (d) => (b += d));
      return req.on("end", () => {
        try {
          const { block_id } = JSON.parse(b);
          // The unique index is the real dedupe; a Set mirrors it so a double
          // tap cannot look like two events here either.
          if (state.completions.has(block_id)) { res.writeHead(409).end(); return; }
          state.completions.add(block_id);
        } catch {}
        res.writeHead(201).end();
      });
    }
    return json(res, [...state.completions].map((block_id) => ({ block_id })));
  }
  return json(res, [], 404);
});

const port = Number(process.env.MOCK_PORT || 0);
server.listen(port, "127.0.0.1", () => {
  console.log(`MOCK_SUPABASE_PORT=${server.address().port}`);
});
