// waitlist-notify (gy-if6mq) — the notification path for getgymbo.com waitlist signups.
//
// WHY THIS EXISTS. WaitlistForm.tsx has always told the visitor "Request received.
// We'll email you when your access is ready." NOTHING EVER SENT THAT EMAIL, to anyone.
// Two real leads (17 Aug, 21 Aug) sat unnoticed for three weeks as a result.
//
// WHY AN EDGE FUNCTION AND NOT THE PAGES FUNCTION. functions/api/waitlist.js runs with
// the PUBLIC anon key, and anon SELECT on public.waitlist returns 401/42501 BY DESIGN
// (coach: so no email can ever be read back). Measured, with a positive control -- a
// nonexistent table returns 404/PGRST205 through the same key, so the 401 is a real
// per-table denial. Without SELECT there is no rolling count, no exactly-once marker
// and no digest. This runtime already holds RESEND_API_KEY (three sibling functions use
// it) and can hold a service-role credential, so the notification logic belongs here.
// Deploy with verify_jwt=false; the shared secret header is the gate, exactly as
// send-trainer-reminder-email does.
//
// TWO MODES, ONE FUNCTION:
//   {mode:"signup", name, email}  fired from waitlist.js on its 201 branch only.
//   {mode:"sweep"}                the daily reconciliation. Sends the digest when we are
//                                 over threshold, AND -- crucially -- picks up any signup
//                                 whose individual alert failed. That sweep is what stops
//                                 a failed send becoming a permanently unnoticed lead.

const RESEND_ENDPOINT = "https://api.resend.com/emails"

// gy-if6mq AC2 point 1: a CONFIG VALUE, not a literal. Kaushik set 10/day today and
// said the number moves once real volume exists.
const THRESHOLD = Number(Deno.env.get("WAITLIST_ALERT_THRESHOLD") ?? "10")

// AC2 point 3, no flapping: we are in digest mode if ANY of the last 3 days exceeded
// the threshold, so returning to individual requires 3 consecutive days under it.
// Derived from created_at rather than stored, so there is no mode state to get stuck.
const FLAP_WINDOW_DAYS = 3

const TEAM = (Deno.env.get("WAITLIST_ALERT_TO") ?? "kaushik@materiallab.io,damini@materiallab.io")
  .split(",").map((s) => s.trim()).filter(Boolean)

// A2 (Kaushik, 2026-09-08): getgymbo.com is the intended sending domain -- a stranger
// must trust this mail, and materiallab.io undercuts that. It is NOT yet verified on
// Resend (resend._domainkey.getgymbo.com is ABSENT; mail.materiallab.io is PRESENT), so
// the whole path is proved on the verified domain and this ONE VALUE flips when the DNS
// lands. That is a config change, not rework.
const FROM = Deno.env.get("RESEND_FROM_EMAIL") ?? "no-reply@mail.materiallab.io"

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status, headers: { "Content-Type": "application/json" },
  })
}

interface Row { id: number; name: string | null; email: string; created_at: string }

async function db(path: string, init: RequestInit = {}): Promise<Response> {
  const url = Deno.env.get("SUPABASE_URL")
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  if (!url || !key) throw new Error("supabase_env_missing")
  return await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key, Authorization: `Bearer ${key}`,
      "Content-Type": "application/json", ...(init.headers ?? {}),
    },
  })
}

// AC6: Resend's real status must reach the caller, never be swallowed. A non-2xx
// returns an error WITH the provider status and the body is logged. A path that can
// only ever report success has not been shown to detect anything.
async function sendMail(to: string[], subject: string, html: string) {
  const resendKey = Deno.env.get("RESEND_API_KEY")
  if (!resendKey) {
    console.error("[waitlist-notify] RESEND_API_KEY not set")
    return { ok: false as const, status: 0, error: "resend_not_configured" }
  }
  const res = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: `Gymbo <${FROM}>`, to, subject, html }),
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => "<unreadable>")
    console.error("[waitlist-notify] Resend FAILED", res.status, detail)
    return { ok: false as const, status: res.status, error: "send_failed", detail }
  }
  // Copied from send-trainer-reminder-email (gy-6hauk ii): read the message id rather
  // than discard the body. A malformed body must not turn an accepted send into a
  // reported failure -- res.ok already means Resend took it.
  let id: string | undefined
  try {
    const b = await res.json()
    id = typeof b?.id === "string" ? b.id : undefined
    if (!id) console.error("[waitlist-notify] Resend response had no string id", b)
  } catch (err) {
    console.error("[waitlist-notify] Resend response was not JSON", err)
  }
  return { ok: true as const, status: res.status, id }
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

// ── email bodies ───────────────────────────────────────────────────────────────
// Design lifted verbatim from ops/listmonk/templates/waitlist-welcome.html: table
// layout that survives real mail clients, brand mark, palette, Space Mono, footer
// provenance. That is the expensive part and it did not need redoing.
//
// 🔴 THREE STRINGS AND ONE HREF CHANGED, and the reason each had to:
//  - the original CTA was <a href="https://app.getgymbo.com">try the web app</a>.
//    app.getgymbo.com returns HTTP 530 (measured; getgymbo.com returns 200 as the
//    control). It is the killed web PWA. Sending a confirmation whose only button
//    is a dead page would put a SECOND broken promise inside the fix for the first,
//    so THE CTA IS REMOVED rather than repointed -- the iOS app is also 404 on the
//    App Store in IN and US, so there is genuinely nothing to link to yet.
//  - "you're on the gymbo waitlist" / "you're in": they are NOT in, and "waitlist"
//    fails voice guide s3's evidence-backed-queue test (4 rows in 11 weeks), the
//    same condition that failed on gy-tjqwg. gy-a9fkv put "Request access" and
//    "Gymbo is in private alpha" live across all 22 pages this morning; a mail
//    contradicting the page someone just submitted is the defect that bead closed.
//  - {{ .Subscriber.Name }} / {{ .UnsubscribeURL }} are Listmonk Go-template syntax
//    and Listmonk is not deployed.
//
// WORDING IS LANDING-DRAFTED AND I AM SAYING SO RATHER THAN LETTING IT PASS AS
// RATIFIED. Content owns the final strings against voice guide v9.
function confirmationHtml(name: string): string {
  const hi = name ? `hey ${esc(name)},` : "hey,"
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/><title>your gymbo access request</title></head>
<body style="margin:0;padding:0;background:#2d2d2d;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#2d2d2d;"><tr>
<td align="center" style="padding:40px 20px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
<tr><td align="center" style="padding-bottom:32px;">
<div style="width:48px;height:48px;border-radius:50%;background:#f8623a;color:#2d2d2d;font-family:'Space Mono',monospace;font-weight:bold;font-size:20px;line-height:48px;text-align:center;">G</div>
</td></tr>
<tr><td align="center" style="font-family:'Space Mono','Courier New',monospace;font-size:22px;font-weight:bold;color:#f8623a;letter-spacing:3px;padding-bottom:24px;">gymbo</td></tr>
<tr><td align="center" style="font-family:'Space Mono','Courier New',monospace;font-size:15px;color:#ebebe6;line-height:1.6;padding-bottom:8px;">${hi}</td></tr>
<tr><td align="center" style="font-family:'Space Mono','Courier New',monospace;font-size:14px;color:#ebebe6;line-height:1.7;padding-bottom:32px;">
we have your request. gymbo is in private alpha right now, and we will email you the moment your access is ready.
</td></tr>
<tr><td style="border-top:1px solid rgba(235,235,230,0.1);padding-top:24px;"></td></tr>
<tr><td align="center" style="font-family:'Space Mono','Courier New',monospace;font-size:11px;color:#888;line-height:1.6;">
you are receiving this because you requested access at <a href="https://getgymbo.com" style="color:#f8623a;text-decoration:none;">getgymbo.com</a>
</td></tr>
</table></td></tr></table></body></html>`
}

function rowsTable(rows: Row[]): string {
  return rows.map((r) =>
    `<tr><td style="padding:6px 10px;border-bottom:1px solid #eee;font-family:monospace;font-size:13px;">${r.id}</td>` +
    `<td style="padding:6px 10px;border-bottom:1px solid #eee;font-size:13px;">${esc(r.name ?? "")}</td>` +
    `<td style="padding:6px 10px;border-bottom:1px solid #eee;font-size:13px;">${esc(r.email)}</td>` +
    `<td style="padding:6px 10px;border-bottom:1px solid #eee;font-size:12px;color:#666;">${esc(r.created_at)}</td></tr>`
  ).join("")
}

function teamHtml(rows: Row[], digest: boolean): string {
  const lead = digest
    ? `<p style="font-size:14px;">${rows.length} new waitlist signups. Grouped because the last ${FLAP_WINDOW_DAYS} days went over the ${THRESHOLD}/day threshold.</p>`
    : `<p style="font-size:14px;">A new waitlist signup on getgymbo.com.</p>`
  return `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;color:#222;">
${lead}
<table cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin-top:12px;">
<tr><th align="left" style="padding:6px 10px;border-bottom:2px solid #333;font-size:12px;">id</th>
<th align="left" style="padding:6px 10px;border-bottom:2px solid #333;font-size:12px;">name</th>
<th align="left" style="padding:6px 10px;border-bottom:2px solid #333;font-size:12px;">email</th>
<th align="left" style="padding:6px 10px;border-bottom:2px solid #333;font-size:12px;">created_at (UTC)</th></tr>
${rowsTable(rows)}
</table>
<p style="font-size:12px;color:#666;margin-top:20px;">gy-if6mq &middot; sent by waitlist-notify</p>
</body></html>`
}

// ── mode logic ─────────────────────────────────────────────────────────────────

// AC2 point 3 (no flapping), derived rather than stored: digest mode is ON if ANY of
// the last FLAP_WINDOW_DAYS days exceeded the threshold. Returning to individual
// therefore requires FLAP_WINDOW_DAYS consecutive days under it, with no mode flag
// that can get stuck in the wrong state across a redeploy.
async function inDigestMode(): Promise<boolean> {
  for (let d = 0; d < FLAP_WINDOW_DAYS; d++) {
    const to = new Date(Date.now() - d * 86_400_000).toISOString()
    const from = new Date(Date.now() - (d + 1) * 86_400_000).toISOString()
    const res = await db(
      `waitlist?select=id&created_at=gte.${from}&created_at=lt.${to}`,
      { headers: { Prefer: "count=exact", Range: "0-0" } },
    )
    if (!res.ok) throw new Error(`count_failed_${res.status}`)
    const total = Number((res.headers.get("content-range") ?? "0/0").split("/")[1] ?? 0)
    if (total > THRESHOLD) return true
  }
  return false
}

async function unalerted(): Promise<Row[]> {
  const res = await db("waitlist?select=id,name,email,created_at&team_alerted_at=is.null&order=created_at.asc")
  if (!res.ok) throw new Error(`select_failed_${res.status}`)
  return await res.json() as Row[]
}

// ONLY after a 2xx. See the migration comment: marking before sending converts a
// provider outage into a permanently unnoticed lead.
async function markAlerted(ids: number[]): Promise<void> {
  if (ids.length === 0) return
  const res = await db(`waitlist?id=in.(${ids.join(",")})`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ team_alerted_at: new Date().toISOString() }),
  })
  if (!res.ok) {
    // Loud, because the consequence is a REPEATED alert rather than a lost one.
    console.error("[waitlist-notify] mark_failed", res.status, await res.text().catch(() => ""))
    throw new Error(`mark_failed_${res.status}`)
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405)

  // The gate, same as send-trainer-reminder-email: an internal server-to-server call.
  const expected = Deno.env.get("WAITLIST_NOTIFY_SECRET")
  if (!expected || req.headers.get("x-waitlist-secret") !== expected) {
    return json({ error: "unauthorized" }, 401)
  }

  let body: { mode?: string; name?: string; email?: string }
  try { body = await req.json() } catch { return json({ error: "bad_json" }, 400) }
  const mode = body.mode ?? "signup"

  try {
    if (mode === "signup") {
      const email = String(body.email ?? "").trim()
      if (!email.includes("@")) return json({ error: "valid email required" }, 400)
      const name = String(body.name ?? "").trim()

      // AC1 IS ALWAYS INDIVIDUAL AND IMMEDIATE. pm was explicit: the threshold governs
      // the TEAM alert only. You cannot batch a confirmation addressed to different
      // people, so "group into a single email" must never leak into this send.
      const conf = await sendMail([email], "your gymbo access request", confirmationHtml(name))

      // The team half. Over threshold we send nothing now and leave the row unmarked;
      // the sweep groups it. That is how a signup lands in exactly ONE notification.
      const digest = await inDigestMode()
      let team: Awaited<ReturnType<typeof sendMail>> | null = null
      let alerted = 0
      if (!digest) {
        const lookup = await db(
          `waitlist?select=id,name,email,created_at&email=eq.${encodeURIComponent(email)}` +
          `&order=created_at.desc&limit=1`,
        )
        const found = lookup.ok ? await lookup.json() as Row[] : []
        if (found.length > 0) {
          team = await sendMail(TEAM, `gymbo waitlist: ${found[0].email}`, teamHtml(found, false))
          if (team.ok) { await markAlerted([found[0].id]); alerted = 1 }
        }
      }
      // AC5 / AC2 point 4: the row is the asset. This function NEVER deletes or
      // rolls back a signup, and waitlist.js ignores this response entirely.
      return json({
        ok: true, mode: "signup", digest_mode: digest,
        confirmation: { sent: conf.ok, status: conf.status, id: conf.ok ? conf.id : undefined },
        team_alert: team ? { sent: team.ok, status: team.status } : { deferred_to_digest: digest },
        alerted,
      }, conf.ok ? 200 : 502)
    }

    if (mode === "sweep") {
      // The daily reconciliation, and it does double duty: it sends the digest when we
      // are over threshold, AND it recovers any signup whose individual alert failed --
      // those rows are still NULL, so they cannot be missed for more than a day. This is
      // what closes the "failed alert = permanently unnoticed lead" window.
      const rows = await unalerted()
      if (rows.length === 0) return json({ ok: true, mode: "sweep", skipped: "nothing_unalerted" })
      const digest = await inDigestMode()
      const subject = rows.length === 1
        ? `gymbo waitlist: ${rows[0].email}`
        : `gymbo waitlist: ${rows.length} new signups`
      const sent = await sendMail(TEAM, subject, teamHtml(rows, digest || rows.length > 1))
      if (!sent.ok) return json({ ok: false, mode: "sweep", error: sent.error, status: sent.status }, 502)
      await markAlerted(rows.map((r) => r.id))
      return json({ ok: true, mode: "sweep", digest_mode: digest, alerted: rows.length, ids: rows.map((r) => r.id) })
    }

    return json({ error: "unknown_mode", mode }, 400)
  } catch (err) {
    console.error("[waitlist-notify] unhandled", err)
    return json({ error: String(err) }, 500)
  }
})

