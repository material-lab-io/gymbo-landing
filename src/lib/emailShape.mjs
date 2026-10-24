// gy-e60uc.2 — THE ONE PLACE THAT DECIDES WHAT A WAITLIST EMAIL MUST LOOK LIKE.
//
// Imported by BOTH the browser (src/components/WaitlistForm.tsx) and the Pages Function
// (functions/api/waitlist.js), like sourceSlug.mjs. supabase/functions/waitlist-notify carries a
// byte-identical copy of the block below because a hand-deployed edge function cannot safely
// import from src/; tests/email-shape.test.mjs compares the two blocks so they cannot drift.
//
// WHY THIS EXISTS. Row 29 (09-25 16:52Z) was accepted by a check that only looked for an "@",
// stored, and then Resend answered 422 'Invalid to field': no confirmation was sent, while the
// page said one was. A bare "@" test lets through "a@b" and "a@gmail", and the HTML type=email
// check does too, because "a@b" is valid per the HTML spec.
//
// WHAT IT IS. name@domain.tld: a non-empty local part, at least one dot-separated domain label,
// and a final label of 2+ characters. It deliberately does NOT try to be RFC 5322: quoted local
// parts, comments and IP-literal domains are refused, because a real trainer never types them and
// Resend rejects several of them anyway. It is a floor against typos, not a deliverability check.
// EMAIL_SHAPE-BEGIN
export const EMAIL_MAX_LENGTH = 254;
const EMAIL_BAD = "\\s@,;:<>()\\[\\]\\\\\"";
export const EMAIL_SHAPE = new RegExp("^[^" + EMAIL_BAD + "]+@(?:[^" + EMAIL_BAD + ".]+\\.)+[^" + EMAIL_BAD + ".]{2,}$");
export function looksLikeEmail(value) {
  return typeof value === "string" && value.length <= EMAIL_MAX_LENGTH && EMAIL_SHAPE.test(value);
}
// EMAIL_SHAPE-END

// gy-sl9amm — WHAT A VISITOR PASTES IS NOT ALWAYS WHAT THEY SEE. Autofill, paste from a chat app and some
// phone keyboards add zero-width / bidi marks, a no-break space or a full-width "@" or ".", none of which
// show on screen but all of which fail the shape check above. Normalise BEFORE the check, in the form and
// in the Pages Function, so a dotted address that LOOKS right is not refused for what cannot be seen.
// Outside the EMAIL_SHAPE block on purpose: that block is copied byte-for-byte into the edge function and
// ported to SQL, and the shape rule itself is unchanged.
export function normalizeEmail(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/[​-‏‪-‮⁠﻿]/g, "")
    .trim();
}
