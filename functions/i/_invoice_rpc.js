// gy-t3aoyv.7.2.2 — the anon read for /i/<token>, the no-login invoice page.
//
// ONE call: invoice_public_page(p_token) (Gymbo-v1 #3656, 8a270cfb2), a SECURITY DEFINER function with EXECUTE to anon ONLY. It returns a CLOSED list of 16
// columns, one row per line item with the invoice-level columns repeated, and ZERO rows for every refusal (malformed, unknown, expired, revoked, orphaned,
// draft, void, client deleted or erased). No id of any kind, no client surname/phone/email, no notes, no trainer contact.
//
// 🔴 THIS CALL IS ALWAYS ANON (pm ruling 22 Nov, binding on gy-t3aoyv.7.2.2). The headers are built ONLY by anonHeaders(): the public anon key as apikey and as the
// bearer. Nothing from the visitor's request (Authorization, Cookie, anything) is ever copied onto it, so a trainer who opens a client's link while signed in
// to Gymbo sees exactly what the client sees, and the function is not given a session it could leak or be confused by. The RPC is revoked from `authenticated`,
// so a session bearer would fail the call outright; that is the second wall, this is the first.
//
// 🔴 NOTHING HERE LOGS THE TOKEN OR THE PATH (compliance condition 9, Q5). A failed call logs its HTTP status and nothing else.
import { supabaseUrl, anonHeaders } from "../m/_shared.js";

export const INVOICE_RPC = "invoice_public_page";
export const TOKEN_RE = /^[A-Za-z0-9_-]{32}$/;

/**
 * Returns one of
 *   { ok: false, reason: "malformed" }  failed the shape check, never reached the database
 *   { ok: false, reason: "upstream" }   the call could not be made or answered something unreadable
 *   { ok: false, reason: "notfound" }   zero rows (every refusal the RPC collapses)
 *   { ok: true, invoice: {...} }
 * The visitor sees ONE refusal for malformed + notfound (no oracle), and an honest "try again" for upstream.
 */
export async function fetchInvoicePage(env, token) {
  if (!TOKEN_RE.test(token)) return { ok: false, reason: "malformed" };

  let res;
  try {
    res = await fetch(`${supabaseUrl(env)}/rest/v1/rpc/${INVOICE_RPC}`, {
      method: "POST",
      headers: anonHeaders(),
      body: JSON.stringify({ p_token: token }),
    });
  } catch {
    console.error("[i] rpc unreachable");
    return { ok: false, reason: "upstream" };
  }
  if (!res.ok) {
    console.error("[i] rpc failed:", res.status);
    return { ok: false, reason: "upstream" };
  }
  const rows = await res.json().catch(() => null);
  if (!Array.isArray(rows)) return { ok: false, reason: "upstream" };
  if (rows.length === 0) return { ok: false, reason: "notfound" };

  const [first] = rows;
  const n = (v) => (v == null ? null : Number(v));
  return {
    ok: true,
    invoice: {
      trainerName: first.trainer_name || "Your trainer",
      clientFirstName: first.client_first_name || null,
      number: first.invoice_number,
      status: first.status,
      issueDate: first.issue_date,
      dueDate: first.due_date || null,
      currency: first.currency || "INR",
      subtotalMinor: n(first.subtotal_minor),
      taxMinor: n(first.tax_minor) || 0,
      totalMinor: n(first.total_minor),
      outstandingMinor: n(first.outstanding_minor) || 0,
      lines: rows
        .filter((r) => r.line_position != null)
        .map((r) => ({
          description: r.line_description,
          quantity: n(r.line_quantity),
          unitMinor: n(r.line_unit_price_minor),
          totalMinor: n(r.line_total_minor),
        })),
    },
  };
}
