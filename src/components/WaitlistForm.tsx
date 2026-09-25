import { useEffect, useId, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { F } from "../forge-ui";
import { getAttributionSource } from "../lib/attribution";
import {
  ACCESS_SUCCESS_MESSAGE_EMAIL,
  ACCESS_SUCCESS_MESSAGE_PHONE_ONLY,
  EMAIL_SHAPE_ERROR,
  EMAIL_SHAPE_ERROR_WITH_PHONE,
} from "../lib/trialAccess";
import { looksLikeEmail } from "../lib/emailShape.mjs";

type Status = "idle" | "loading" | "done" | "error" | "needs-contact" | "bad-email";

export function WaitlistForm() {
  const [status, setStatus] = useState<Status>("idle");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  // Which follow-up the visitor is told to expect. Set at submit from what they TYPED, never from
  // anything the server said, so it cannot become a membership signal.
  const [phoneOnly, setPhoneOnly] = useState(false);
  // Whether a phone was given when the email was refused, so the error can offer the way out. Captured at
  // submit, so the text does not change under the visitor while they edit.
  const [badEmailHadPhone, setBadEmailHadPhone] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  // The inline error (needs-contact or bad-email; only one is ever shown). Ref: to bring it into view.
  // Id: so the field(s) it is about can name it as their description, not just rely on the live region.
  const errorRef = useRef<HTMLSpanElement>(null);
  const errorId = useId();
  // Per-INSTANCE id for the contact-rule hint. See the comment at the <span>:
  // this form renders more than once per document, and a literal id would make
  // one instance describe its inputs with another instance's node.
  const contactRuleId = useId();

  // gy-e60uc.7: A REFUSED SUBMIT MUST BE SEEN. The error renders under the button, and on a phone the fixed
  // sticky CTA bar covered it (tester, 375x740), while on a tall desktop it sat below the fold, so a failed
  // submit looked like nothing had happened. Focus moves to the field, but focus only scrolls the FIELD into
  // view, not the error beneath the button. block:"nearest" scrolls the least it must, and it honours the root's
  // scroll-padding-bottom (theme.css --gy-sticky-bar-clearance), so the error stops ABOVE the bar. That
  // clearance is the one definition of "the space the bar covers"; do not hard-code a second one here.
  useEffect(() => {
    if (status === "bad-email" || status === "needs-contact") {
      errorRef.current?.scrollIntoView({ block: "nearest" });
    }
  }, [status]);

  // Shared by the client check and a server 400. Keeps every typed value (nothing is cleared) and moves
  // focus to the field that needs fixing, so a keyboard or screen-reader user lands on it.
  function refuseEmail(hadPhone: boolean) {
    setBadEmailHadPhone(hadPhone);
    setStatus("bad-email");
    emailRef.current?.focus();
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    // gy-ds3fn: EITHER identity is enough, but not neither. This mirrors the
    // table's CHECK waitlist_phone_or_email_required rather than being stricter
    // than it — the whole point of this change is that the form stopped being
    // the narrowest link in the chain. Neither field carries `required`, so the
    // browser cannot enforce "email or phone" for us; this does.
    if (!email.trim() && !phone.trim()) {
      setStatus("needs-contact");
      // On ANY refused submit focus goes to the FIRST field the error is about (pm, gy-e60uc.7), so a keyboard or
      // screen-reader user lands where the fix is. This error is about the contact PAIR, and the first contact
      // field is the WhatsApp phone. It used to stay on the submit button that had just been clicked, which left
      // nowhere to act. The malformed-email refusal already focuses the email field (refuseEmail).
      phoneRef.current?.focus();
      return;
    }
    // gy-e60uc.2: an email that is not name@domain.tld is REFUSED here, even when a phone was also
    // given. Accepting it would tell the visitor to check an inbox we cannot send to (row 29). The
    // server re-applies the same rule (functions/api/waitlist.js); this is the inline half.
    if (email.trim() && !looksLikeEmail(email.trim())) {
      refuseEmail(phone.trim() !== "");
      return;
    }
    // Decided before the request: the fields stay editable while it is in flight.
    const gaveEmail = email.trim() !== "";
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
      if (!res.ok) {
        // The server applies the same shape rule. If it refused the email, say so exactly as the form
        // would; never surface a status code or the server's wording. Anything else is a real failure
        // and keeps the error state and the mailto fallback.
        if (res.status === 400 && (await res.json().catch(() => null))?.error === "valid email required") {
          refuseEmail(phone.trim() !== "");
          return;
        }
        throw new Error("bad status");
      }
      // Custom event so the analyst can measure visit→signup CVR (gy-uh9os).
      if (typeof window !== "undefined" && (window as any).umami) {
        (window as any).umami.track("waitlist_signup");
      }
      setPhoneOnly(!gaveEmail);
      setStatus("done");
    } catch {
      // Real error UX (no silent auto-redirect): show an inline error with an
      // explicit, pre-filled mailto fallback so a lead can still reach us.
      setStatus("error");
    }
  }

  if (status === "done") {
    // gy-e60uc.3: the line names the channel we will really use. It used to be channel-neutral
    // (gy-ds3fn) because a phone-only lead was told "we'll email you" and got no email; the founder
    // has since ruled that phone-only leads are reached on WhatsApp by the team, so each branch may
    // say what actually happens. It still names no person, no time and no access promise.
    // role="status" so a screen reader announces the outcome: the form is REPLACED by this line, so
    // focus is otherwise left on a node that no longer exists.
    return (
      <p
        role="status"
        className="text-[15px] py-4"
        style={{ color: "var(--accent)", fontFamily: "var(--font-sans)", fontWeight: 600 }}
      >
        {phoneOnly ? ACCESS_SUCCESS_MESSAGE_PHONE_ONLY : ACCESS_SUCCESS_MESSAGE_EMAIL}
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
    <form
      onSubmit={onSubmit}
      // gy-e60uc.2 (content's ruling): ONE ERROR, ONE VOICE. Without this the browser's own type=email check
      // refuses shapes it dislikes (e.g. "a@gmail,com") with ITS tooltip in ITS wording, while "a@b" and
      // "a@gmail" reach our ratified text: the same mistake would read two ways depending on the typo.
      // The form already does its own email-or-phone and shape checks, so nothing native is relied on.
      // type=email / autocomplete stay on the input, so the mobile keyboard and autofill are unchanged.
      noValidate
      className="w-full max-w-[440px] flex flex-col gap-3"
    >
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
        ref={phoneRef}
        type="tel"
        name="phone"
        autoComplete="tel"
        inputMode="tel"
        aria-label="Your WhatsApp phone number"
        aria-describedby={status === "needs-contact" ? `${contactRuleId} ${errorId}` : contactRuleId}
        placeholder="Your WhatsApp phone number"
        value={phone}
        onChange={(e) => {
          setPhone(e.target.value);
          if (status === "needs-contact") setStatus("idle");
        }}
        className={field}
        style={fieldStyle}
      />
      <input
        ref={emailRef}
        type="email"
        name="email"
        autoComplete="email"
        aria-label="Your email"
        aria-describedby={status === "needs-contact" || status === "bad-email" ? `${contactRuleId} ${errorId}` : contactRuleId}
        aria-invalid={status === "bad-email" ? true : undefined}
        placeholder="Your email"
        value={email}
        onChange={(e) => {
          setEmail(e.target.value);
          if (status === "needs-contact" || status === "bad-email") setStatus("idle");
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
        // gy-e60uc.7 / gy-e60uc.3 (designer): text-wrap: balance so the two lines are comparable. At 375px the
        // ratified wording broke "...either one is / enough." and left a one-word orphan. Balance only moves WHERE
        // the break falls; the line count stays 2, so the row keeps the integer height leading-5 exists for. The
        // span is a flex item of the form's flex-col, so it is blockified and balance applies. Wording untouched.
        style={{ color: "var(--g-color-grey-muted-fg-dark)", fontFamily: "var(--font-sans)", textWrap: "balance" }}
      >
        Add a WhatsApp number or an email: either one is enough.
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
          ref={errorRef}
          id={errorId}
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
          style={{
            color: "var(--g-color-status-destructive-dark)",
            fontFamily: "var(--font-sans)",
            // gy-e60uc.7 (designer): scrollIntoView({block:"nearest"}) stops the moment the error is
            // inside the viewport, which on a tall desktop left its last pixel FLUSH with the viewport
            // edge and read as cut off. scroll-margin-bottom gives that scroll breathing room; nearest
            // honours it exactly as it honours the root's scroll-padding for the sticky bar. A Forge
            // spacing token (24px), not a second hard-coded constant.
            scrollMarginBottom: "var(--g-space-6)",
            // Same reason as the hint above: no one-word orphan ("...reach / you.") on a narrow phone.
            textWrap: "balance",
          }}
        >
          Add a WhatsApp number or an email so we can reach you.
        </span>
      )}
      {status === "bad-email" && (
        <span
          ref={errorRef}
          id={errorId}
          role="alert"
          // Same shape and the same destructive colour as the needs-contact error above, for the same
          // reasons: leading-5 keeps the row an integer height, and colour is never the only carrier
          // (role="alert" announces it).
          className="text-[13px] leading-5"
          style={{
            color: "var(--g-color-status-destructive-dark)",
            fontFamily: "var(--font-sans)",
            // gy-e60uc.7 (designer): scrollIntoView({block:"nearest"}) stops the moment the error is
            // inside the viewport, which on a tall desktop left its last pixel FLUSH with the viewport
            // edge and read as cut off. scroll-margin-bottom gives that scroll breathing room; nearest
            // honours it exactly as it honours the root's scroll-padding for the sticky bar. A Forge
            // spacing token (24px), not a second hard-coded constant.
            scrollMarginBottom: "var(--g-space-6)",
            // Same reason as the hint above: no one-word orphan ("...reach / you.") on a narrow phone.
            textWrap: "balance",
          }}
        >
          {badEmailHadPhone ? EMAIL_SHAPE_ERROR_WITH_PHONE : EMAIL_SHAPE_ERROR}
        </span>
      )}
      {status === "error" && (
        <span className="text-[13px]" style={{ color: "var(--g-color-grey-muted-fg-dark)", fontFamily: "var(--font-sans)" }}>
          Couldn't send your request just now. Try again, or{" "}
          <a
            href={`mailto:hello@getgymbo.com?subject=${encodeURIComponent("Gymbo private alpha access request")}&body=${encodeURIComponent(`Name: ${name}\nWhatsApp number: ${phone}\nEmail: ${email}`)}`}
            className="underline"
            style={{ color: F.white }}
          >
            email us to request access
          </a>
          .
        </span>
      )}
    </form>
  );
}
