import { useEffect, useId, useRef, useState } from "react";
import { F } from "../forge-ui";
import { getAttributionSource } from "../lib/attribution";
import { looksLikeEmail } from "../lib/emailShape.mjs";

// gy-hqvr4 — capture form for Resource 1 (Workout Builder Starter Pack).
//
// Scope, settled on gy-wymhs: EMAIL ONLY (marketer AC8, 2026-09-22 11:53Z) — no Name field, not
// hidden, not optional. source only, no visitor ids (pm ruling, gy-wymhs 2026-09-24T17:00Z,
// "(b) store source only"): resource_landing_view/resource_form_started dedup by resource_id +
// a 24h local timestamp, with NO funnel_visit_id — that id was retired the same ruling that
// narrowed the DB column, and reviving it here would reopen exactly what (b) closed.
//
// Posts to POST /api/resource-lead (gy-p3ebo AC3/AC5, PR #200). The server's `access_granted`
// is the ONLY thing that may say the submission succeeded — a 2xx with no explicit
// access_granted===true is treated as a refusal, matching the handler's own rule.

const RESOURCE_ID = "workout-builder-starter-pack";

// 🔴 PENDING gy-674s8 (privacy notice does not yet describe this capture). "v1" matches the
// convention PR #200's own test suite uses (tests/resource-lead.test.mjs). Bump this the day the
// notice ships a numbered version, and bump it again on any later wording change — the version is
// what lets a later dispute ask "which notice did they see", not the live page's current text.
const DELIVERY_CONSENT_NOTICE_VERSION = "v1";
const MARKETING_CONSENT_NOTICE_VERSION = "v1";

const LANDING_VIEW_KEY = `gymbo.resource_landing_view.${RESOURCE_ID}`;
const FORM_STARTED_KEY = `gymbo.resource_form_started.${RESOURCE_ID}`;
const DEDUP_WINDOW_MS = 24 * 60 * 60 * 1000;

function track(event: string) {
  try {
    if (typeof window !== "undefined" && (window as any).umami) {
      (window as any).umami.track(event, { resource_id: RESOURCE_ID });
    }
  } catch {
    /* analytics must never break the page */
  }
}

/** Emits once per resource_id per 24h, using a plain local timestamp — no visitor id. */
function emitOncePerDay(storageKey: string, event: string) {
  try {
    const last = window.localStorage.getItem(storageKey);
    const now = Date.now();
    if (last && now - Number(last) < DEDUP_WINDOW_MS) return;
    window.localStorage.setItem(storageKey, String(now));
    track(event);
  } catch {
    // localStorage unavailable (private mode, SSR) — emit once per load as the fallback rather
    // than lose the signal entirely; never throw.
    track(event);
  }
}

type Status = "idle" | "loading" | "done" | "error" | "bad-email" | "consent-required";

export function ResourceLeadForm() {
  const [email, setEmail] = useState("");
  const [deliveryConsent, setDeliveryConsent] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [startedTracked, setStartedTracked] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const consentRef = useRef<HTMLInputElement>(null);
  const errorRef = useRef<HTMLSpanElement>(null);
  const errorId = useId();

  useEffect(() => {
    emitOncePerDay(LANDING_VIEW_KEY, "resource_landing_view");
  }, []);

  useEffect(() => {
    if (status === "bad-email" || status === "consent-required") {
      errorRef.current?.scrollIntoView({ block: "nearest" });
    }
  }, [status]);

  function noteFormStarted() {
    if (startedTracked) return;
    setStartedTracked(true);
    emitOncePerDay(FORM_STARTED_KEY, "resource_form_started");
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!looksLikeEmail(email.trim())) {
      setStatus("bad-email");
      emailRef.current?.focus();
      return;
    }
    if (!deliveryConsent) {
      setStatus("consent-required");
      consentRef.current?.focus();
      return;
    }

    setStatus("loading");
    try {
      const res = await fetch("/api/resource-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resource_id: RESOURCE_ID,
          email: email.trim(),
          delivery_consent: true,
          delivery_consent_notice_version: DELIVERY_CONSENT_NOTICE_VERSION,
          marketing_consent: marketingConsent,
          marketing_consent_notice_version: marketingConsent ? MARKETING_CONSENT_NOTICE_VERSION : undefined,
          source: getAttributionSource() ?? undefined,
        }),
      });
      const body = await res.json().catch(() => null);
      // The gate is the server's answer, never the request's — a 2xx with no explicit
      // access_granted===true is a refusal (mirrors functions/api/resource-lead.js's own rule).
      if (!res.ok || !body || body.ok !== true || body.access_granted !== true) {
        throw new Error("refused");
      }
      setStatus("done");
    } catch {
      setStatus("error");
    }
  }

  if (status === "done") {
    return (
      <p role="status" className="text-[15px] py-4" style={{ color: F.ink, fontFamily: "var(--font-sans)", fontWeight: 600 }}>
        Check your email — we'll send you the starter pack once you confirm.
      </p>
    );
  }

  const field = "w-full rounded-xl px-5 h-12 text-[14px] outline-none transition-colors gy-focus-ring-dark";
  const fieldStyle = {
    background: "var(--g-color-neutral-dark-1)",
    border: "1px solid var(--g-color-grey-placeholder-dark)",
    color: F.white,
    fontFamily: "var(--font-sans)",
  } as const;

  return (
    <form onSubmit={onSubmit} noValidate className="w-full max-w-[440px] flex flex-col gap-3">
      <input
        ref={emailRef}
        type="email"
        name="email"
        autoComplete="email"
        aria-label="Your email"
        aria-describedby={status === "bad-email" ? errorId : undefined}
        aria-invalid={status === "bad-email" ? true : undefined}
        placeholder="Your email"
        value={email}
        onChange={(e) => {
          setEmail(e.target.value);
          noteFormStarted();
          if (status === "bad-email") setStatus("idle");
        }}
        className={field}
        style={fieldStyle}
      />

      {status === "bad-email" && (
        <span ref={errorRef} id={errorId} role="alert" className="text-[13px]" style={{ color: F.red, fontFamily: "var(--font-sans)" }}>
          That email doesn't look right. Check it and try again.
        </span>
      )}

      <label className="flex items-start gap-2 text-[13px]" style={{ color: F.boneMuted, fontFamily: "var(--font-sans)" }}>
        <input
          ref={consentRef}
          type="checkbox"
          checked={deliveryConsent}
          aria-describedby={status === "consent-required" ? errorId : undefined}
          aria-invalid={status === "consent-required" ? true : undefined}
          onChange={(e) => {
            setDeliveryConsent(e.target.checked);
            noteFormStarted();
            if (status === "consent-required") setStatus("idle");
          }}
          className="mt-0.5"
        />
        <span>I consent to Gymbo sending me the Workout Builder Starter Pack by email.</span>
      </label>

      {status === "consent-required" && (
        <span id={errorId} role="alert" className="text-[13px]" style={{ color: F.red, fontFamily: "var(--font-sans)" }}>
          Please check the box so we can send you the starter pack.
        </span>
      )}

      <label className="flex items-start gap-2 text-[13px]" style={{ color: F.boneMuted, fontFamily: "var(--font-sans)" }}>
        <input
          type="checkbox"
          checked={marketingConsent}
          onChange={(e) => {
            setMarketingConsent(e.target.checked);
            noteFormStarted();
          }}
          className="mt-0.5"
        />
        <span>I'd also like occasional emails about Gymbo's business tools for trainers. (Optional. You'll get the starter pack either way.)</span>
      </label>

      <button
        type="submit"
        disabled={status === "loading"}
        className="h-12 rounded-xl text-[14px] font-semibold transition-opacity disabled:opacity-60"
        style={{ background: F.amber, color: F.onCta, fontFamily: "var(--font-sans)" }}
      >
        {status === "loading" ? "Sending…" : "Send me the starter pack"}
      </button>

      {status === "error" && (
        <span role="alert" className="text-[13px]" style={{ color: F.red, fontFamily: "var(--font-sans)" }}>
          Something went wrong. Please try again, or email{" "}
          <a href="mailto:damini@materiallab.io" style={{ color: F.red, textDecoration: "underline" }}>
            damini@materiallab.io
          </a>
          .
        </span>
      )}

      <p className="text-[12px]" style={{ color: F.boneMuted, fontFamily: "var(--font-sans)" }}>
        By submitting this form, your email is stored to send you this resource. See our{" "}
        <a href="/privacy/" style={{ color: F.boneMuted, textDecoration: "underline" }}>
          privacy policy
        </a>{" "}
        for details.
      </p>
    </form>
  );
}
