// Loads the REAL supabase/functions/waitlist-notify/index.ts under a Deno shim with every network call
// stubbed, replays a list of signup requests IN ONE PROCESS (so state such as "already claimed" persists
// between them), and prints what happened as JSON. Spawned with --experimental-strip-types by
// tests/waitlist-notify.test.mjs so the .ts loads on any node 22.
//   argv[2] = path to the function, argv[3] = JSON { rows: {receipt: {id,name,email,phone}}, requests: [body, ...] }
import { pathToFileURL } from "node:url";
const [, , fnPath, scenarioJson] = process.argv;
const { rows, requests } = JSON.parse(scenarioJson);
const env = {
  WAITLIST_NOTIFY_SECRET: "test-secret", SUPABASE_URL: "https://stub.invalid", SUPABASE_SERVICE_ROLE_KEY: "stub-key",
  RESEND_API_KEY: "stub-resend", WAITLIST_ALERT_TO: "team@example.invalid",
};
let handler;
globalThis.Deno = { env: { get: (k) => env[k] }, serve: (h) => { handler = h; } };

const claimed = new Set();
const calls = { resend: [], claims: [], marks: 0, other: [] };
const logs = [];
console.error = (...a) => logs.push(a.map(String).join(" "));
globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  if (u.startsWith("https://api.resend.com/emails")) {
    const b = JSON.parse(init.body);
    calls.resend.push({ to: b.to, subject: b.subject });
    return new Response(JSON.stringify({ id: "stub-id" }), { status: 200 });
  }
  if (init.method === "PATCH" && u.includes("signup_receipt=eq.")) {
    // The atomic claim. Honour the guard exactly as Postgres would: a row comes back only while
    // confirmation_claimed_at IS NULL. A copy of the function that DROPS the guard sees the row every time.
    const receipt = decodeURIComponent(u.match(/signup_receipt=eq\.([^&]+)/)[1]);
    const guarded = u.includes("confirmation_claimed_at=is.null");
    calls.claims.push({ url: u, method: init.method, body: JSON.parse(init.body), prefer: init.headers?.Prefer });
    const row = rows[receipt];
    if (!row || (guarded && claimed.has(receipt))) return new Response("[]", { status: 200 });
    claimed.add(receipt);
    return new Response(JSON.stringify([{ id: row.id, name: row.name ?? null, email: row.email ?? null, phone: row.phone ?? null, created_at: "2026-01-01T00:00:00Z" }]), { status: 200 });
  }
  if (init.method === "PATCH") { calls.marks++; return new Response(null, { status: 204 }); }
  if (u.includes("select=id&created_at")) return new Response("[]", { status: 200, headers: { "content-range": "0-0/0" } });
  calls.other.push(u);
  return new Response("[]", { status: 200 });
};
await import(pathToFileURL(fnPath).href);
const results = [];
for (const body of requests) {
  const res = await handler(new Request("http://x/", { method: "POST", headers: { "x-waitlist-secret": "test-secret", "content-type": "application/json" }, body: JSON.stringify({ mode: "signup", ...body }) }));
  results.push({ status: res.status, text: await res.text() });
}
console.log(JSON.stringify({ results, resend: calls.resend, claims: calls.claims, marks: calls.marks, other: calls.other, logs }));
