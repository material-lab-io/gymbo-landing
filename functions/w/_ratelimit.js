// gy-emboo — an edge rate limit on /w/, so real Cloudflare Pages production
// finally serves live workouts. pm's threat model: gy-emboo's RPC returns a
// UNIFORM refusal for a malformed, unknown, revoked or expired token, which
// is deliberately no oracle for a guesser — but it also means a script can
// hammer /w/ with candidate tokens all day and never see anything different
// happen. This is the first line of defense against that.
//
// 🔴 WHAT THIS IS NOT, STATED PLAINLY SO IT IS NEVER OVERCLAIMED: this is a
// PER-ISOLATE counter, not a global one. Cloudflare may run this Function in
// many isolates across many colos, and each gets its own copy of `hits`. A
// distributed guesser spread across colos, or one that simply waits for a
// fresh isolate, is NOT stopped by this alone. It DOES stop the common,
// cheap case this bead's threat model actually names — one script hammering
// candidate tokens from one connection in a tight loop. A durable, cross-colo
// limit needs a KV namespace, a Durable Object or Cloudflare's native
// rate-limiting binding, all of which need infra provisioning this PR does
// not do. Follow-up, not silently claimed here.
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 20;
// Bound memory in a long-lived isolate: evict the oldest tracked key rather
// than let a distributed sweep grow this map without limit.
const MAX_TRACKED_KEYS = 5_000;

const hits = new Map(); // key -> sorted timestamps (ms) within the current window

export function isRateLimited(key, now = Date.now()) {
  // No key to rate-limit on (no CF-Connecting-IP header, e.g. in a test
  // harness or an unusual proxy path) is not a reason to refuse everyone —
  // fail OPEN on the key, not on the visitor.
  if (!key) return false;

  let arr = hits.get(key);
  if (!arr) {
    if (hits.size >= MAX_TRACKED_KEYS) {
      const oldestKey = hits.keys().next().value;
      if (oldestKey !== undefined) hits.delete(oldestKey);
    }
    arr = [];
    hits.set(key, arr);
  }

  const cutoff = now - WINDOW_MS;
  while (arr.length && arr[0] <= cutoff) arr.shift();

  if (arr.length >= MAX_PER_WINDOW) return true;
  arr.push(now);
  return false;
}

// Test-only. A fresh isolate never shares this state with another, so an
// assertion that depends on being (or not being) rate-limited must not
// depend on requests a PRIOR test made against the same module instance.
export function _resetRateLimitStateForTests() {
  hits.clear();
}
