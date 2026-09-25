// Loads the REAL supabase/functions/waitlist-notify/index.ts under a Deno shim with every network call
// stubbed, runs ONE signup request, and prints what happened as JSON. Spawned with
// --experimental-strip-types by tests/waitlist-notify.test.mjs so the .ts loads on any node 22.
//   argv[2] = path to the function, argv[3] = JSON {body}
import { pathToFileURL } from "node:url";
const [, , fnPath, scenarioJson] = process.argv;
const { body } = JSON.parse(scenarioJson);
const env = {
  WAITLIST_NOTIFY_SECRET: "test-secret", SUPABASE_URL: "https://stub.invalid", SUPABASE_SERVICE_ROLE_KEY: "stub-key",
  RESEND_API_KEY: "stub-resend", WAITLIST_ALERT_TO: "team@example.invalid",
};
let handler;
globalThis.Deno = { env: { get: (k) => env[k] }, serve: (h) => { handler = h; } };

const calls = { resend: [], patches: 0 };
const logs = [];
console.error = (...a) => logs.push(a.map(String).join(" "));
globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  if (u.startsWith("https://api.resend.com/emails")) {
    const b = JSON.parse(init.body);
    calls.resend.push({ to: b.to, subject: b.subject });
    return new Response(JSON.stringify({ id: "stub-id" }), { status: 200 });
  }
  if (init.method === "PATCH") { calls.patches++; return new Response(null, { status: 204 }); }
  if (u.includes("select=id&created_at")) return new Response("[]", { status: 200, headers: { "content-range": "0-0/0" } });
  if (u.includes("select=*") && u.includes("limit=1")) {
    return new Response(JSON.stringify([{ id: 99, name: body.name ?? null, email: body.email || null, phone: body.phone ?? null, created_at: "2026-01-01T00:00:00Z" }]), { status: 200 });
  }
  return new Response("[]", { status: 200 });
};
await import(pathToFileURL(fnPath).href);
const res = await handler(new Request("http://x/", { method: "POST", headers: { "x-waitlist-secret": "test-secret", "content-type": "application/json" }, body: JSON.stringify({ mode: "signup", ...body }) }));
console.log(JSON.stringify({ status: res.status, body: await res.json(), resend: calls.resend, patches: calls.patches, logs }));
