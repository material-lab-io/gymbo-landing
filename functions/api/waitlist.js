// Cloudflare Pages Function — POST /api/waitlist → store in D1 (binding: DB).
// GYM-597 waitlist backend.
export async function onRequestPost(context) {
  try {
    const body = await context.request.json().catch(() => ({}));
    const email = String(body.email || "").trim();
    const name = String(body.name || "").trim();
    if (!email || !email.includes("@")) {
      return Response.json({ error: "valid email required" }, { status: 400 });
    }
    await context.env.DB.prepare(
      "INSERT INTO waitlist (name, email) VALUES (?, ?)"
    ).bind(name, email).run();
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: "failed to join" }, { status: 500 });
  }
}
