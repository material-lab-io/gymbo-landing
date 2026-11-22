// gy-t3aoyv.7.2.2 — GET getgymbo.com/i/<token>: the no-login invoice page a trainer shares with a client on WhatsApp.
//
// Copies functions/w/ (rate limit, anon RPC wrapper, no-JS, refusal shape) and adds compliance's 12 conditions (gy-t3aoyv.7.2, 22 Nov):
//   - VIEW-ONLY. No form, no button, no cookie, no script, no pay link, no "I have paid", no client input of any kind. POST is answered 405 (after the throttle).
//   - Headers on EVERY response from this route, refusals and 429 included: Cache-Control private, no-store; X-Robots-Tag noindex, nofollow; Referrer-Policy
//     no-referrer; a CSP that allows NO script, font, image, frame or form target (a third-party tag cannot be added by accident).
//   - It says "Invoice", never "Tax invoice" (the INV series is not a GST tax invoice, Q4 is open with Kaushik), and carries no GSTIN, address, phone, UPI or
//     bank line: the page shows the amount due and who it is from, nothing that collects or instructs payment (Q6).
//   - The footer line is compliance's, one sentence, with the trainer's name: "Sent by <name> using Gymbo. How Gymbo handles this: getgymbo.com/privacy" (Q7;
//     Damini D3 owns the final wording, the line and the link must exist).
//   - No Open Graph card (pm: OG off for invoices): a WhatsApp preview would copy the invoice into a third party's card.
//   - The token is never logged and never echoed into the HTML (no og:url, no canonical, no self link). Logs carry a reason word only.
//   - The RPC is ALWAYS called as anon, whoever the visitor is (see _invoice_rpc.js).
import { esc } from "../m/_shared.js";
import { rootVars } from "../_forge.js";
import { fetchInvoicePage } from "./_invoice_rpc.js";
import { isRateLimited } from "./_ratelimit.js";

const CSS = `
:root{${rootVars(["brand-amber-500", "brand-amber-text-light", "brand-marigold-500", "grey-muted-fg-dark", "grey-muted-fg-light", "neutral-dark-0", "neutral-dark-1", "neutral-dark-3", "neutral-dark-fg", "neutral-light-0", "neutral-light-1", "neutral-light-3", "neutral-light-fg", "status-green-fill-dark", "status-green-text"])}--bg:var(--g-color-neutral-light-0);--card:var(--g-color-neutral-light-1);--fg:var(--g-color-neutral-light-fg);--muted:var(--g-color-grey-muted-fg-light);--brand:var(--g-color-brand-amber-text-light);
  --line:var(--g-color-neutral-light-3);--rule:var(--g-color-brand-amber-500);--done:var(--g-color-status-green-text)}
@media (prefers-color-scheme:dark){:root{--bg:var(--g-color-neutral-dark-0);--card:var(--g-color-neutral-dark-1);--fg:var(--g-color-neutral-dark-fg);
  --muted:var(--g-color-grey-muted-fg-dark);--brand:var(--g-color-brand-marigold-500);--line:var(--g-color-neutral-dark-3);--rule:var(--g-color-brand-marigold-500);--done:var(--g-color-status-green-fill-dark)}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font-family:'Open Sans',system-ui,sans-serif;font-size:14px;line-height:1.55}
.wrap{max-width:560px;margin:0 auto;padding:20px 16px 56px}
h1{font-family:Merriweather,Georgia,serif;font-size:24px;margin:0 0 2px}
.num{color:var(--muted);font-size:12px;margin:0 0 14px}
.rule{height:2px;background:var(--rule);border:0;margin:0 0 16px}
.meta{margin:0 0 18px;display:grid;grid-template-columns:auto 1fr;gap:2px 14px;font-size:13px}
.meta dt{color:var(--muted)}.meta dd{margin:0;overflow-wrap:anywhere}
table{width:100%;border-collapse:collapse;margin:0 0 8px}
th{font-size:12px;font-weight:700;color:var(--muted);text-align:left;padding:0 0 6px}
th.r,td.r{text-align:right;white-space:nowrap;padding-left:12px}
td{padding:10px 0;border-top:1px solid var(--line);vertical-align:top;overflow-wrap:anywhere}
td .q{display:block;color:var(--muted);font-size:12px}
.amt{font-variant-numeric:tabular-nums}
.tot{margin:0 0 18px;display:grid;grid-template-columns:1fr auto;gap:4px 0;font-size:13px}
.tot dt{color:var(--muted)}.tot dd{margin:0;text-align:right;padding-left:12px}
.tot .grand{font-weight:700;font-size:15px;color:var(--fg);border-top:1px solid var(--line);padding-top:8px}
.due{background:var(--card);border-radius:20px;padding:16px;display:flex;justify-content:space-between;align-items:baseline;gap:12px}
.due b{font-size:20px}
.due.paid{justify-content:center;color:var(--done);font-weight:700}
.state{background:var(--card);border-radius:20px;padding:24px;text-align:center}
.state h1{font-size:20px}.sub{color:var(--muted);font-size:12px;margin:0}
.notice{margin-top:28px;font-size:12px;color:var(--muted);text-align:center}
.notice a{color:var(--muted)}
`;

// ONE place for the response headers, applied to every response this route sends. A header set that only the happy path carries is how a refusal page ends up cached.
export const HEADERS = {
  "content-type": "text/html; charset=utf-8",
  "cache-control": "private, no-store",
  "x-robots-tag": "noindex, nofollow",
  "referrer-policy": "no-referrer",
  "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  "x-content-type-options": "nosniff",
};

const shell = (title, body, status = 200, extra = {}) =>
  new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><meta name="robots" content="noindex,nofollow"><meta name="referrer" content="no-referrer">
<style>${CSS}</style></head><body><div class="wrap">${body}</div></body></html>`,
    { status, headers: { ...HEADERS, ...extra } },
  );

// One refusal for malformed, unknown, expired, revoked, draft, void and a deleted client. Never says which: "expired" would tell a guesser a real link once lived there.
const refusal = () =>
  shell("Link not available", `<div class="state">
<h1>This link is not available</h1>
<p class="sub">It may have expired or been replaced. Ask the sender for a new one.</p>
</div>`, 404);

// An upstream failure is independent of the token, so it is no oracle, and telling a client "not available" about a real link would be false.
const unavailable = () =>
  shell("Try again", `<div class="state">
<h1>We could not load this invoice</h1>
<p class="sub">Please try again in a moment.</p>
</div>`, 503);

const tooManyRequests = () =>
  shell("Too many requests", `<div class="state">
<h1>Too many requests</h1>
<p class="sub">Please wait a moment and try again.</p>
</div>`, 429);

// Minor units to a display amount. INR is the product's currency: the rupee sign and Indian digit grouping (1,23,456.50). Any other currency code is shown as its code.
export function money(minor, currency = "INR") {
  const neg = minor < 0;
  const abs = Math.abs(minor);
  const whole = Math.trunc(abs / 100);
  const frac = abs % 100;
  const grouped = new Intl.NumberFormat("en-IN").format(whole);
  const text = frac ? `${grouped}.${String(frac).padStart(2, "0")}` : grouped;
  return `${neg ? "-" : ""}${currency === "INR" ? "₹" : `${currency} `}${text}`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
// "2026-11-22" to "22 Nov 2026" by string, never through Date (no timezone can move the day).
export function day(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ""));
  return m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1] || ""} ${m[1]}`.replace("  ", " ") : "";
}

const STATUS = { issued: "Unpaid", partially_paid: "Partly paid", paid: "Paid" };

function render(inv) {
  const cur = inv.currency;
  const rows = inv.lines.map((l) => `<tr><td>${esc(l.description || "")}${l.quantity != null && l.unitMinor != null ? `<span class="q">${esc(`${l.quantity} × ${money(l.unitMinor, cur)}`)}</span>` : ""}</td><td class="r amt">${esc(money(l.totalMinor ?? 0, cur))}</td></tr>`).join("");
  const paid = inv.outstandingMinor <= 0;
  return `<h1>Invoice</h1>
<p class="num">${esc(inv.number || "")}</p>
<hr class="rule">
<dl class="meta">
<dt>From</dt><dd>${esc(inv.trainerName)}</dd>
${inv.clientFirstName ? `<dt>Bill to</dt><dd>${esc(inv.clientFirstName)}</dd>` : ""}
<dt>Issued</dt><dd>${esc(day(inv.issueDate))}</dd>
${inv.dueDate ? `<dt>Due</dt><dd>${esc(day(inv.dueDate))}</dd>` : ""}
<dt>Status</dt><dd>${esc(STATUS[inv.status] || "")}</dd>
</dl>
<table><thead><tr><th scope="col">Item</th><th scope="col" class="r">Amount</th></tr></thead><tbody>${rows}</tbody></table>
<dl class="tot">
<dt>Subtotal</dt><dd class="amt">${esc(money(inv.subtotalMinor ?? 0, cur))}</dd>
${inv.taxMinor > 0 ? `<dt>Tax</dt><dd class="amt">${esc(money(inv.taxMinor, cur))}</dd>` : ""}
<dt class="grand">Total</dt><dd class="grand amt">${esc(money(inv.totalMinor ?? 0, cur))}</dd>
</dl>
${paid ? `<div class="due paid">Paid in full</div>` : `<div class="due"><span>Amount due</span><b class="amt">${esc(money(inv.outstandingMinor, cur))}</b></div>`}
<p class="notice">Sent by ${esc(inv.trainerName)} using Gymbo. How Gymbo handles this: <a href="https://getgymbo.com/privacy" rel="noopener noreferrer">getgymbo.com/privacy</a></p>`;
}

export async function onRequestGet({ env, params, request }) {
  const ip = request?.headers?.get?.("CF-Connecting-IP") || null;
  if (isRateLimited(ip ? `i-get:${ip}` : null)) {
    console.error("[i] rate limited");
    return tooManyRequests();
  }
  const r = await fetchInvoicePage(env, String(params.token || ""));
  if (!r.ok) {
    console.error("[i] refused:", r.reason);
    return r.reason === "upstream" ? unavailable() : refusal();
  }
  return shell("Invoice", render(r.invoice));
}

// View-only: there is nothing to POST. Throttled first, exactly like /w/ (a script must not get a free, unthrottled probe by switching method).
export async function onRequestPost({ request }) {
  const ip = request?.headers?.get?.("CF-Connecting-IP") || null;
  if (isRateLimited(ip ? `i-post:${ip}` : null)) {
    console.error("[i] rate limited");
    return tooManyRequests();
  }
  return shell("Not allowed", `<div class="state">
<h1>This page is view-only</h1>
</div>`, 405, { allow: "GET" });
}
