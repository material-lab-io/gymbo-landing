// gy-f3limw.1 -- loads the REAL waitlist-notify index.ts with an in-memory stand-in for the two launch tables.
// argv[2]=fn path, argv[3]=JSON { recipients:[{id,name,email}], priorSends:[{waitlist_id,send_no}], env:{}, requests:[body] }
// The stand-in enforces what Postgres enforces: UNIQUE(waitlist_id,send_no) -> 409 and CHECK send_no IN (1,2) -> 400.
import { pathToFileURL } from "node:url";
const [, , fnPath, scenarioJson] = process.argv;
const sc = JSON.parse(scenarioJson);
const env = {
  WAITLIST_NOTIFY_SECRET: "test-secret", SUPABASE_URL: "https://stub.invalid", SUPABASE_SERVICE_ROLE_KEY: "stub-key",
  RESEND_API_KEY: "stub-resend", WAITLIST_ALERT_TO: "team@example.invalid", ...(sc.env ?? {}),
};
let handler;
globalThis.Deno = { env: { get: (k) => env[k] }, serve: (h) => { handler = h; } };
const sends = (sc.priorSends ?? []).map((s) => ({ ...s }));
const resend = []; const rpcCalls = []; const insertAttempts = [];
const logs = []; console.error = (...a) => logs.push(a.map(String).join(" "));
globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  if (u.startsWith("https://api.resend.com/emails")) {
    const b = JSON.parse(init.body);
    if ((sc.resendFailFor ?? []).includes(b.to[0])) return new Response("boom", { status: 500 });
    resend.push({ to: b.to, subject: b.subject, html: b.html, headers: b.headers ?? null });
    return new Response(JSON.stringify({ id: "msg-" + resend.length }), { status: 200 });
  }
  if (u.includes("/rest/v1/rpc/waitlist_launch_recipients")) {
    const { p_send_no } = JSON.parse(init.body); rpcCalls.push(p_send_no);
    const out = sc.recipients.filter((r) => !sends.some((s) => s.waitlist_id === r.id && s.send_no >= p_send_no));
    return new Response(JSON.stringify(out), { status: 200 });
  }
  if (init.method === "POST" && u.includes("/rest/v1/waitlist_launch_sends")) {
    const b = JSON.parse(init.body); insertAttempts.push(b);
    if (![1, 2].includes(b.send_no)) return new Response("check", { status: 400 });
    if (sends.some((s) => s.waitlist_id === b.waitlist_id && s.send_no === b.send_no)) return new Response("dup", { status: 409 });
    sends.push({ waitlist_id: b.waitlist_id, send_no: b.send_no });
    return new Response(null, { status: 201 });
  }
  if (init.method === "PATCH") return new Response(null, { status: 204 });
  return new Response("[]", { status: 200 });
};
await import(pathToFileURL(fnPath).href);
const results = [];
for (const body of sc.requests) {
  const res = await handler(new Request("http://x/", { method: "POST", headers: { "x-waitlist-secret": "test-secret", "content-type": "application/json" }, body: JSON.stringify({ mode: "launch", ...body }) }));
  results.push({ status: res.status, json: JSON.parse(await res.text()) });
}
console.log(JSON.stringify({ results, resend, rpcCalls, insertAttempts, sends, logs }));
