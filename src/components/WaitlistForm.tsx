import { useId, useState } from "react";
import { ArrowRight } from "lucide-react";
import { F } from "../forge-ui";
import { getAttributionSource } from "../lib/attribution";
import { ACCESS_SUCCESS_MESSAGE } from "../lib/trialAccess";

type Status = "idle" | "loading" | "done" | "error" | "needs-contact";

export function WaitlistForm() {
  const [status, setStatus] = useState<Status>("idle");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  // Per-INSTANCE id for the contact-rule hint. See the comment at the <span>:
  // this form renders more than once per document, and a literal id would make
  // one instance describe its inputs with another instance's node.
  const contactRuleId = useId();

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
        {ACCESS_SUCCESS_MESSAGE}
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
        // gy-31zk5 / designer R1 — a DELIBERATE one-line widening, named as such
        // rather than arriving as "while we were in there". Without this the
        // field's accessible name comes SOLELY from its placeholder: it works
        // today and it is a side effect of a copy string, so emptying that
        // string in a copy pass leaves the field with no name at all and
        // nothing goes red.
        aria-label="Your name"
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
        aria-describedby={contactRuleId}
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
        aria-describedby={contactRuleId}
        placeholder="Your email"
        value={email}
        onChange={(e) => {
          setEmail(e.target.value);
          if (status === "needs-contact") setStatus("idle");
        }}
        className={field}
        style={fieldStyle}
      />
      {/*
        gy-31zk5 — THE CONTACT RULE, HOISTED OUT OF A PLACEHOLDER (designer,
        2026-09-17; string approved from content on gy-7vbmn).

        🔴 IT WAS IN THE EMAIL PLACEHOLDER AND THEREFORE NOWHERE. The input
        carries aria-label="Your email", and an aria-label WINS over a
        placeholder when the accessible NAME is computed — verified from
        Chromium's own accessibility tree, where the placeholder appears as a
        SUPERSEDED name source and the description was null. So a screen-reader
        user heard "Your email, edit text" and was never told the field was
        optional, at EVERY width — including the hero and footer clusters that
        measured as passing on width. The clipping at 245px was the visible
        half of a defect that was total.

        ONE hint for the PAIR, not one per field: the rule is about phone OR
        email, and stating it on a single input tells whoever reads the other
        one nothing. It is wired to BOTH inputs with aria-describedby, so it
        lands in each field's DESCRIPTION rather than fighting its name.

        🔴 THE ID IS PER-INSTANCE, FROM useId, AND THAT IS LOAD-BEARING.
        WaitlistForm renders more than once per document (the footer form is
        always present, plus whichever cluster is revealed), so a literal id
        would be duplicated and an IDREF resolves to the FIRST match in
        document order — one form would describe its inputs with the OTHER
        form's node. Measured at f3e8f7e: for nav/hero/gallery/pricing the
        revealed panel is earlier and wins, so the FOOTER loses; for the sticky
        bar the footer is earlier, so the REVEALED one loses. It breaks in both
        directions depending on the cluster, which is why the test asserts per
        form rather than picking one.

        It may WRAP on the narrow pricing cluster. That is the point of the
        shape — wrapped text is readable, a clipped placeholder is not.
      */}
      <span
        id={contactRuleId}
        // 🔴 leading-5 IS LOAD-BEARING, NOT TYPOGRAPHY (designer, 2026-09-18).
        // text-[13px] with no line-height inherits 1.5 -> 19.5px, and with
        // gap-3's 12px this row contributed 31.5px. A FRACTIONAL section height
        // makes Playwright's element screenshot round UP, and the capture then
        // takes in ONE ROW OF THE NEXT SECTION — measured on the CI candidate as
        // rgb(250,250,247) on mobile (the bone section below) where the old
        // baseline ends on our own charcoal. Freezing that couples footer-cta to
        // whatever happens to sit underneath it, so the next change THERE reds
        // THIS section with a one-row diff nobody can explain. leading-5 makes
        // it 20 + 12 = 32 integer. Forge has no line-height token, so this is
        // Tailwind's scale, like the gap-3 and px-5 already in this file.
        className="text-[13px] leading-5"
        style={{ color: "var(--g-color-grey-muted-fg-dark)", fontFamily: "var(--font-sans)" }}
      >
        Add a phone number or an email: either one is enough.
      </span>
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
          // Same shape as the hint above, so the same fix: without leading-5
          // this row is 19.5px and re-introduces a fractional height the moment
          // it renders.
          className="text-[13px] leading-5"
          // 🔴 DESTRUCTIVE, NOT MUTED — and this PR is what made that necessary
          // (designer eyes-on of ae2f3ddc6, 2026-09-18).
          //
          // Before the hint existed, this was the only small grey line in the
          // form, so its mere appearance carried the failure. Now a PERMANENT
          // muted hint sits above the button saying almost the same words, and
          // measured from the rendered page the two were byte-identical in
          // presentation: both rgb(184,184,184), both 13px, both weight 400. A
          // visitor who submitted empty saw one more grey line appear below the
          // button, styled exactly like the grey line above it, and nothing
          // said it had not worked.
          //
          // --g-color-status-destructive-dark (#ff6961, forge.css) had no user
          // on this site until now; designer measured it at 7.02:1 on the
          // #0a0a0a ground behind this span, which clears AA and AAA.
          //
          // 🔴 COLOUR IS THE SIGHTED HALF ONLY. It fixes nothing for a screen
          // reader, where the two sentences are still near-duplicates — that is
          // content's restring, and colour must never be the sole carrier of an
          // error (WCAG 1.4.1). role="alert" already carries it non-visually.
          style={{ color: "var(--g-color-status-destructive-dark)", fontFamily: "var(--font-sans)" }}
        >
          Add a phone number or an email so we can reach you.
        </span>
      )}
      {status === "error" && (
        <span className="text-[13px]" style={{ color: "var(--g-color-grey-muted-fg-dark)", fontFamily: "var(--font-sans)" }}>
          Couldn't add you just now. Please try again, or{" "}
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
