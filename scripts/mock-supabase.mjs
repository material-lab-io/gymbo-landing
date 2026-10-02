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
const BLOCK_C = "cccccccc-1111-2222-3333-666666666666";
const BLOCK_D = "cccccccc-1111-2222-3333-777777777777";
const EX_A = "dddddddd-1111-2222-3333-444444444444";
const EX_B = "dddddddd-1111-2222-3333-555555555555";
const EX_D = "dddddddd-1111-2222-3333-777777777777";

const clip = readFileSync(new URL("../tests/fixtures/clip.mp4", import.meta.url));

// THE STATE. completions starts EMPTY on purpose: if the journey's assertion
// passed against a pre-seeded row it would prove nothing about the tap.
const state = { completions: new Set(), completedAt: null, expired: false, revoked: false, failWrite: false };

const link = () => ({
  id: LINK_ID, assignment_id: ASSIGN_ID,
  expires_at: new Date(Date.now() + (state.expired ? -1000 : 864e5)).toISOString(),
  revoked_at: state.revoked ? new Date().toISOString() : null,
  completed_at: state.completedAt,
});

// Exercise A has a complete, attributable wger clip. Exercise B has NO media at
// all — so the journey also sees AC2's defined empty state in the same page,
// rather than a separate contrived test.
//
// gy-t9mm8 / gy-emboo (2026-09-28): viewRows/sourceRows mirror the two source
// tables shared_workout_page's own body joins server-side (exercise_media_for_app
// then exercise_media by media_id) — this mock's /rest/v1/rpc/shared_workout_page
// handler below does that join itself and returns the RPC's real row shape.
const MEDIA_ID = "eeeeeeee-1111-2222-3333-444444444444";
const viewRows = [{
  exercise_id: EX_A, media_id: MEDIA_ID,
  video_object_path: "wger/clip.mp4", poster_object_path: "wger/clip-poster.jpg",
  author: "Goulart", author_url: "https://wger.de/en/user/goulart", work_title: "Bench Press",
  source_url: "https://wger.de/en/exercise/512/view/", licence_id: "CC-BY-SA-4.0",
  licence_name: "Creative Commons Attribution Share Alike 4",
  licence_url: "https://creativecommons.org/licenses/by-sa/4.0/deed.en",
  modification_note: "Transcoded from H.265/HEVC to H.264 for playback compatibility.",
}];
const sourceRows = [{ id: MEDIA_ID, source: "wger", asset_kind: "video", is_derivative: true }];
// A minimal valid 1x1 white JPEG — the poster only needs to be a servable
// image, not a meaningful one; the journey asserts the `poster` attribute is
// present, not what it depicts.
const posterJpeg = Buffer.from(
  "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/2wBDAQMDAwQDBAgEBAgQCwkLEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBD/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=",
  "base64",
);

const blocks = [
  { id: BLOCK_A, position: 0, exercise_id: EX_A, exercise_name: "Bench Press", sets: 3, reps: "10", load: "40kg", rest_seconds: 60, notes: null },
  { id: BLOCK_B, position: 1, exercise_id: EX_B, exercise_name: "Plank", sets: 3, reps: null, duration_seconds: 45, load: null, rest_seconds: 30, notes: null },
  // gy-pgxiv (pm's eyes-on round, 2026-09-28): a block with NO linked exercise
  // at all, distinct from Plank's "linked exercise, no media row" case above.
  { id: BLOCK_C, position: 2, exercise_id: null, exercise_name: "Farmer carry", sets: 3, reps: "30m", load: null, rest_seconds: 45, notes: null },
  { id: BLOCK_D, position: 3, exercise_id: EX_D, exercise_name: "Intervals", sets: 3, reps: "45-60-45", duration_seconds: 45, load: null, rest_seconds: 30, notes: null },
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
    // gy-t9mm8 (pm 2026-09-28 eyes-on round) — force the completion write to
    // fail, so the "not saved" (503) state can be SEEN in a real browser
    // instead of only asserted from a unit-level stub.
    if (u.searchParams.has("failwrite")) state.failWrite = u.searchParams.get("failwrite") === "1";
    if (u.searchParams.has("reset")) { state.completions.clear(); state.completedAt = null; state.expired = false; state.revoked = false; state.failWrite = false; }
    return json(res, { ok: true, completions: [...state.completions], completedAt: state.completedAt });
  }

  // Public-bucket URLs (gy-h8a7o.1 — no signing): publicObjectUrl() builds
  // /storage/v1/object/public/<bucket>/<object_path> with each path segment
  // percent-encoded, so these routes match the EXACT shape the page requests.
  if (p === "/storage/v1/object/public/exercise-media/wger/clip.mp4") {
    res.writeHead(200, { "content-type": "video/mp4", "content-length": clip.length, "accept-ranges": "bytes" });
    return res.end(clip);
  }
  if (p === "/storage/v1/object/public/exercise-media/wger/clip-poster.jpg") {
    res.writeHead(200, { "content-type": "image/jpeg", "content-length": posterJpeg.length });
    return res.end(posterJpeg);
  }

  // gy-t9mm8 / gy-emboo: the REAL read path now goes through this RPC, matching
  // shared_workout_page(p_token)'s shape exactly (one row per block, workout
  // columns repeated, block_id NULL for a zero-block workout).
  if (p === "/rest/v1/rpc/shared_workout_page") {
    if (req.method !== "POST") return json(res, [], 404);
    let b = ""; req.on("data", (d) => (b += d));
    return req.on("end", () => {
      let token = null;
      try { token = JSON.parse(b).p_token; } catch {}
      if (token !== TOKEN) return json(res, []);
      const l = link();
      if (l.revoked_at || new Date(l.expires_at).getTime() <= Date.now()) return json(res, []);
      const rows = blocks.map((blk) => {
        const view = viewRows.find((v) => v.exercise_id === blk.exercise_id) || null;
        const src = view ? sourceRows.find((s) => s.id === view.media_id) || null : null;
        return {
          workout_name: "Push day", workout_notes: "Warm up first.",
          completed_at: l.completed_at,
          block_id: blk.id, block_position: blk.position, block_type: "exercise", group_index: null,
          exercise_name: blk.exercise_name, sets: blk.sets, reps: blk.reps, load: blk.load,
          duration_seconds: blk.duration_seconds ?? null, distance_m: null, rest_seconds: blk.rest_seconds,
          block_done: state.completions.has(blk.id),
          source: src ? src.source : null, asset_kind: src ? src.asset_kind : null,
          author: view ? view.author : null, author_url: view ? view.author_url : null,
          work_title: view ? view.work_title : null, source_url: view ? view.source_url : null,
          licence_id: view ? view.licence_id : null, licence_name: view ? view.licence_name : null,
          licence_url: view ? view.licence_url : null,
          is_derivative: src ? src.is_derivative : null, modification_note: view ? view.modification_note : null,
          video_object_path: view ? view.video_object_path : null,
          poster_object_path: view ? view.poster_object_path : null,
        };
      });
      return json(res, rows);
    });
  }

  // gy-b0126.1: the REAL write path, matching set_shared_workout_block_done's
  // and finish_shared_workout's own uniform-boolean contract — the mock's
  // scope check (is this block one of THIS workout's live blocks?) mirrors
  // what the real function does inside a single SQL statement.
  if (p === "/rest/v1/rpc/set_shared_workout_block_done") {
    if (req.method !== "POST") return json(res, false, 404);
    let b = ""; req.on("data", (d) => (b += d));
    return req.on("end", () => {
      if (state.failWrite) { res.writeHead(500).end(); return; }
      let args = {};
      try { args = JSON.parse(b); } catch {}
      const { p_token, p_block_id, p_done } = args;
      const l = link();
      const tokenOk = p_token === TOKEN && !l.revoked_at && new Date(l.expires_at).getTime() > Date.now();
      const blockOk = tokenOk && blocks.some((blk) => blk.id === p_block_id);
      if (!blockOk || p_done === undefined || p_done === null) return json(res, false);
      if (p_done) state.completions.add(p_block_id);
      else state.completions.delete(p_block_id);
      return json(res, true);
    });
  }
  if (p === "/rest/v1/rpc/finish_shared_workout") {
    if (req.method !== "POST") return json(res, false, 404);
    let b = ""; req.on("data", (d) => (b += d));
    return req.on("end", () => {
      if (state.failWrite) { res.writeHead(500).end(); return; }
      let args = {};
      try { args = JSON.parse(b); } catch {}
      const l = link();
      const tokenOk = args.p_token === TOKEN && !l.revoked_at && new Date(l.expires_at).getTime() > Date.now();
      if (!tokenOk) return json(res, false);
      if (!state.completedAt) state.completedAt = new Date().toISOString();
      return json(res, true);
    });
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
  if (p === "/rest/v1/exercise_media_for_app") {
    const ids = (u.searchParams.get("exercise_id") || "").replace(/^in\.\(|\)$/g, "").split(",").filter(Boolean);
    return json(res, viewRows.filter((v) => ids.includes(v.exercise_id)));
  }
  if (p === "/rest/v1/exercise_media") {
    const idsParam = u.searchParams.get("id");
    if (idsParam) {
      const ids = idsParam.replace(/^in\.\(|\)$/g, "").split(",").filter(Boolean);
      return json(res, sourceRows.filter((s) => ids.includes(s.id)));
    }
    return json(res, sourceRows);
  }
  if (p === "/rest/v1/workout_share_block_completions") {
    if (req.method === "POST") {
      let b = ""; req.on("data", (d) => (b += d));
      return req.on("end", () => {
        if (state.failWrite) { res.writeHead(500).end(); return; }
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
