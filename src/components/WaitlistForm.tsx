import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { F } from "../forge-ui";
import { getAttributionSource } from "../lib/attribution";

type Status = "idle" | "loading" | "done" | "error" | "needs-contact";

export function WaitlistForm() {
  const [status, setStatus] = useState<Status>("idle");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    // gy-ds3fn: EITHER identity is enough, but not neither. This mirrors the
    // table's CHECK waitlist_phone_or_email_required rather than being stricter
    // than it — the whole point of this change is that the form stopped being
    // the narrowest link in the chain. Neither field carries `required`, so the
    // browser cannot enforce "email or phone" for us; this does.
    if (!email.trim() && !phone.trim()) {
      setStatus("needs-contact");
      return;
    }
    setStatus("loading");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // gy-0v33y: the source is read from the session, not from the URL —
        // by now the visitor may be several client-side navigations past the
        // tagged landing URL. The server re-normalises whatever we send; this
        // value is client-asserted and is attribution, never authorisation.
        body: JSON.stringify({ name, email, phone, source: getAttributionSource() }),
      });
      if (!res.ok) throw new Error("bad status");
      // Custom event so the analyst can measure visit→signup CVR (gy-uh9os).
      if (typeof window !== "undefined" && (window as any).umami) {
        (window as any).umami.track("waitlist_signup");
      }
      setStatus("done");
    } catch {
      // Real error UX (no silent auto-redirect): show an inline error with an
      // explicit, pre-filled mailto fallback so a lead can still reach us.
      setStatus("error");
    }
  }

  if (status === "done") {
    // gy-ds3fn / pm ruling: CHANNEL-NEUTRAL on purpose. The previous line said
    // "we'll email you", which became false the moment this form could accept a
    // phone-only signup — so the field and this line had to ship together, never
    // one then the other. It deliberately does NOT promise a text either: our SMS
    // delivery is unproven (gy-odma3, sms_delivery_log silent for 22.9 days on
    // prod), and swapping one lie for another is not a fix. It also survives the
    // next change to the field set without needing a re-edit.
    return (
      <p
        className="text-[15px] py-4"
        style={{ color: "var(--accent)", fontFamily: "var(--font-sans)", fontWeight: 600 }}
      >
        You're on the list — we'll be in touch when your access is ready.
      </p>
    );
  }

  const field =
    "w-full rounded-xl px-5 h-12 text-[14px] outline-none transition-colors gy-focus-ring-dark";
  // gy-lgaz6 — WCAG 1.4.11 (non-text UI boundary, 3:1). This form renders on the
  // charcoal CTA section (App.tsx / CompareWellnessZ.tsx, background F.charcoal
  // #0a0a0a), so the white IS correct here — it is the CONTRAST that was not.
  // Measured before: fill rgba(255,255,255,0.04) -> #141414, border
  // rgba(255,255,255,0.10) -> #2c2c2c, giving 1.32:1 against the fill and 1.24:1
  // against the section. Both fail 3:1, and the fill is 1.06:1 against the
  // section, so nothing delineated the control at all.
  // Fixed with SOLID Forge tokens rather than a higher alpha: reaching 3:1 by
  // alpha needs ~0.33, which is both a visible redesign and an invented alpha
  // step — and inventing sanctioned alpha steps is a Forge decision, not this
  // file's (gy-vfrha AC4).
  //   background -> --g-color-neutral-dark-1 (#141414), byte-identical to what
  //                 rgba(255,255,255,0.04) already composited to on #0a0a0a.
  //   border     -> --g-color-grey-placeholder-dark (#808080), 4.66:1 vs the
  //                 fill and 5.01:1 vs the section. It is the QUIETEST Forge
  //                 token that conforms, so the subtle look survives.
  const fieldStyle = {
    background: "var(--g-color-neutral-dark-1)",
    border: "1px solid var(--g-color-grey-placeholder-dark)",
    color: F.white,
    fontFamily: "var(--font-sans)",
  } as const;

  return (
    <form onSubmit={onSubmit} className="w-full max-w-[440px] flex flex-col gap-3">
      <input
        type="text"
        name="name"
        autoComplete="name"
        placeholder="Your name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className={field}
        style={fieldStyle}
      />
      <input
        type="tel"
        name="phone"
        autoComplete="tel"
        inputMode="tel"
        aria-label="Your phone number"
        placeholder="Your phone number"
        value={phone}
        onChange={(e) => {
          setPhone(e.target.value);
          if (status === "needs-contact") setStatus("idle");
        }}
        className={field}
        style={fieldStyle}
      />
      <input
        type="email"
        name="email"
        autoComplete="email"
        aria-label="Your email"
        placeholder="Your email (optional if you gave a number)"
        value={email}
        onChange={(e) => {
          setEmail(e.target.value);
          if (status === "needs-contact") setStatus("idle");
        }}
        className={field}
        style={fieldStyle}
      />
      <button
        type="submit"
        disabled={status === "loading"}
        className="inline-flex items-center justify-center gap-2.5 px-8 h-12 rounded-xl text-[14px] transition-all hover:opacity-90 active:scale-[0.97] disabled:opacity-60 gy-focus-ring-on-cta"
        style={{
          background: "var(--accent)",
          color: "var(--accent-foreground)",
          fontWeight: 600,
          fontFamily: "var(--font-sans)",
        }}
      >
        {status === "loading" ? "Sending…" : "Request access"}
        {status !== "loading" && <ArrowRight size={16} aria-hidden="true" />}
      </button>
      {status === "needs-contact" && (
        <span
          role="alert"
          className="text-[13px]"
          style={{ color: "var(--g-color-grey-muted-fg-dark)", fontFamily: "var(--font-sans)" }}
        >
          Add a phone number or an email so we can reach you.
        </span>
      )}
      {status === "error" && (
        <span className="text-[13px]" style={{ color: "var(--g-color-grey-muted-fg-dark)", fontFamily: "var(--font-sans)" }}>
          Couldn't add you just now — please try again, or{" "}
          <a
            href={`mailto:hello@getgymbo.com?subject=${encodeURIComponent("join the gymbo waitlist")}&body=${encodeURIComponent(`name: ${name}\nphone: ${phone}\nemail: ${email}`)}`}
            className="underline"
            style={{ color: F.white }}
          >
            email us to join
          </a>
          .
        </span>
      )}
    </form>
  );
}
