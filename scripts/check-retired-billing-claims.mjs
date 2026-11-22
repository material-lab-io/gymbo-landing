// gy-76z5i / gy-1vd9qy.10.4 (Kaushik ruling 22 Nov, option A): Gymbo on the web has a Free plan and a Pro plan paid on the web with Razorpay.
// There is NO trial and NO App Store billing. This gate fails the build when the BUILT public site (every sitemap page, plus llms.txt and
// pricing.md) says either again. It is the planted-old-claim control for the price gate: tests/retired-billing-claims.test.mjs plants each
// retired phrase and requires red, and `--self-test` does the same on every run of check:copy-output so a gate that stopped seeing fails loud.
//
// WHY A BAN LIST AND NOT A PIN: scripts/check-trial-eligibility.mjs only fails an UNQUALIFIED 7-day promise, so "Eligible subscribers can try
// Gymbo free for 7 days" passes it by design. The ruling makes the whole claim false, so this gate refuses the claim, qualified or not, and the
// App Store billing wording that went with it. Rupee amounts stay with scripts/check-canonical-strings.mjs (price pin + standing price drill).
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { discoverBuiltPages, pageSurfaces } from "./check-no-em-dash.mjs";
import { matchable } from "./text-normalise.mjs";

const TEXT_ENDPOINTS = ["llms.txt", "pricing.md"];

// One entry per retired claim: [id, regex]. Matched on normalised text (dashes, case, whitespace), so "7–day" and "SEVEN-DAY" count.
export const RETIRED = [
  ["trial-7-day", /\b(?:7|seven)\s*[\p{Pd}−]?\s*days?\b[^.!?]{0,40}\btrial\b|\btrial\b[^.!?]{0,40}\b(?:7|seven)\s*[\p{Pd}−]?\s*days?\b|\bfree for (?:7|seven) days\b/iu],
  ["trial-ends", /\bwhen my trial ends\b|\byour (?:7|seven)[\p{Pd}− ]days?\b[^.!?]{0,20}\btrial\b/iu],
  ["introductory-offer", /\bintroductory[\p{Pd}− ]offer\b/iu],
  ["app-store-billing", /\bbill(?:ed|ing)\b[^.!?]{0,40}\b(?:via|through|by)\b[^.!?]{0,12}\b(?:the )?app store\b/iu],
  ["apple-payment-method", /\bapple payment method\b/iu],
  ["iphone-settings-cancel", /\bcancel\b[^.!?]{0,30}\biphone settings\b/iu],
  ["iphone-only", /\biphone[\s\p{Pd}\u2212]+only\b/iu],
  ["private-alpha", /\bprivate alpha\b/iu],
  // marketer claim-truth verdicts on gy-1vd9qy.10.2 (22 Nov): the web app does not load offline (only a two-write outbox), the contact picker is Android Chrome
  // only, "any" browser is untested, and the free plan needs no payment rather than "no card".
  ["works-offline", /\bworks? offline\b|\bwork offline\b/iu],
  ["no-card-needed", /\bno card needed\b/iu],
  ["any-phone-or-laptop", /\bany phone or laptop\b/iu],
  ["import-from-phone-contacts", /\bsaved in your phone'?s contacts\b/iu],
];

// The legal pages describe the IPHONE app's App Store billing truthfully (compliance wording on gy-1vd9qy.10.7, accepted by pm 22 Nov): "On iPhone, the
// App Store takes the payment ... including any introductory offer Apple shows you". Only those two claim kinds are allowed, only on these two routes;
// the 7-day trial, the trial-end wording, iPhone only and private alpha stay banned there too.
export const LEGAL_ROUTES = ["/terms/", "/privacy/"];
export const LEGAL_ALLOWED = ["introductory-offer", "app-store-billing"];
export function scanText(value, route, surface) {
  const text = matchable(value).replace(/[*_`]/g, "");
  const allowed = LEGAL_ROUTES.includes(route) ? LEGAL_ALLOWED : [];
  return RETIRED.filter(([id]) => !allowed.includes(id)).filter(([, re]) => re.test(text)).map(([id, re]) => ({ id, route, surface, snippet: (re.exec(text)?.[0] ?? "").slice(0, 160) }));
}

export function scanBuilt(root = "dist") {
  const { pages } = discoverBuiltPages(root);
  const findings = pages.flatMap(({ route, file }) => pageSurfaces(readFileSync(file, "utf8"), route).flatMap(({ surface, value }) => scanText(value, route, surface)));
  for (const name of TEXT_ENDPOINTS) {
    const file = resolve(root, name);
    if (!existsSync(file)) throw new Error(`${file} is missing; refusing a vacuous pass`);
    findings.push(...scanText(readFileSync(file, "utf8"), `/${name}`, "served text"));
  }
  return { findings, pages };
}

// The standing control: every retired claim, planted in a clean sentence, must be found. Returns the ids that were NOT seen.
export const PLANTED = {
  "trial-7-day": "Eligible subscribers can try Gymbo free for 7 days.",
  "trial-ends": "What happens when my trial ends?",
  "introductory-offer": "Apple determines introductory-offer eligibility.",
  "app-store-billing": "Billed monthly via the App Store.",
  "apple-payment-method": "7 days for eligible subscribers, Apple payment method required",
  "iphone-settings-cancel": "Cancel anytime in your iPhone Settings.",
  "iphone-only": "Built for trainers. iPhone only.",
  "private-alpha": "Gymbo is in private alpha.",
  "works-offline": "Does it work offline? Yes.",
  "no-card-needed": "Start free in your browser. No card needed.",
  "any-phone-or-laptop": "Runs in your browser on any phone or laptop.",
  "import-from-phone-contacts": "If your clients are saved in your phone's contacts, yes.",
};
export function selfTest() {
  const clean = scanText("Start free. Pro is Rs 399 a month, paid on the web with Razorpay. iPhone app coming soon.", "/", "control");
  const missed = RETIRED.map(([id]) => id).filter((id) => !scanText(`Gymbo makes your day easier. ${PLANTED[id]} Thanks.`, "/", "control").some((f) => f.id === id));
  return { missed, cleanFindings: clean };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    const t = selfTest();
    if (t.missed.length || t.cleanFindings.length) {
      console.error(`FAIL: the retired-claim gate's own control is broken (planted claims NOT seen: ${t.missed.join(", ") || "none"}; false findings on clean copy: ${t.cleanFindings.map((f) => f.id).join(", ") || "none"}).`);
      process.exit(1);
    }
    if (args[0] === "--self-test") { console.log(`OK: every one of the ${RETIRED.length} retired claims is seen when planted and clean copy passes.`); process.exit(0); }
    const root = args.length === 2 && args[0] === "--root" ? args[1] : args.length ? null : "dist";
    if (root === null) throw new Error("usage: node scripts/check-retired-billing-claims.mjs [--self-test | --root <built-site-dir>]");
    const { findings, pages } = scanBuilt(root);
    if (findings.length) {
      console.error(`FAIL: ${findings.length} retired trial / App Store billing claim(s) in built output (Kaushik 22 Nov: no trial, Pro is paid on the web):`);
      for (const f of findings) console.error(`  [${f.id}] ${f.route} [${f.surface}]: ${f.snippet}`);
      process.exitCode = 1;
    } else console.log(`OK: no retired trial or App Store billing claim across ${pages.length} built page(s) plus ${TEXT_ENDPOINTS.join(" and ")}; the gate's own control saw all ${RETIRED.length} planted claims.`);
  } catch (error) {
    console.error(`COULD NOT EVALUATE retired billing claims: ${error.message}`);
    process.exitCode = 2;
  }
}
