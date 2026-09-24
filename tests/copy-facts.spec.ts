import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FAQ } from '../src/App';
import {
  TRIAL_DAYS,
  PRICE_MONTHLY_INR,
  PRICE_ANNUAL_INR_DISPLAY,
  PRICE_ANNUAL_MONTHLY_EQUIVALENT_INR,
  PLATFORM,
  STATUS_LANGUAGE,
  CANCEL_ROUTE,
  DATA_EXPORT_ROUTE,
  DATA_DELETION_ROUTE,
  PURCHASE_ANSWER_RENEW_CANCEL_DATA_EXIT,
  PRICING_LEGIBILITY_LINE,
} from '../src/lib/trialAccess';

/**
 * gm-pzp — the durable fix for the drift that hit repeatedly (#164, #174,
 * and two more stale answers this suite itself caught before merge):
 * index.html's FAQPage JSON-LD is static HTML and cannot import
 * src/lib/trialAccess.ts or src/App.tsx directly, so nothing stopped it
 * silently disagreeing with the rendered page. This file parses index.html's
 * own JSON-LD out of the repo source and cross-checks it against the single
 * source of truth (src/lib/trialAccess.ts) and the rendered FAQ (src/App.tsx's
 * exported FAQ array) byte-for-byte — EVERY entry, not a hand-picked subset,
 * and rejects an orphan JSON-LD question with no App.tsx counterpart too.
 *
 * pm's ruling (gm-pzp, 2026-09-17): src/pages/Terms.tsx and
 * src/pages/Privacy.tsx are legal/compliance copy owned by the product rig.
 * They stay LITERAL TEXT — this suite asserts they still STATE the same
 * facts as the constants, but does not interpolate the constants into them.
 * A fact change makes this go red; a human then edits the legal text
 * deliberately, rather than the wording silently rewriting itself.
 *
 * This does NOT run against a build output — it reads index.html and the
 * .tsx sources from the repo directly, so it catches drift the moment
 * someone hand-edits any of these files, before a build or deploy happens.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const indexHtml = readFileSync(path.resolve(__dirname, '../index.html'), 'utf-8');
const termsSource = readFileSync(path.resolve(__dirname, '../src/pages/Terms.tsx'), 'utf-8');
const privacySource = readFileSync(path.resolve(__dirname, '../src/pages/Privacy.tsx'), 'utf-8');
const appSource = readFileSync(path.resolve(__dirname, '../src/App.tsx'), 'utf-8');

function extractJsonLdBlocks(html: string): Record<string, unknown>[] {
  const blocks: Record<string, unknown>[] = [];
  const re = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html))) {
    blocks.push(JSON.parse(match[1]));
  }
  return blocks;
}

test.describe('copy facts: index.html JSON-LD, Terms and Privacy must not drift from src/lib/trialAccess or App.tsx', () => {
  const blocks = extractJsonLdBlocks(indexHtml);
  const faqPage = blocks.find((b) => b['@type'] === 'FAQPage') as any;
  const softwareApp = blocks.find((b) => b['@type'] === 'SoftwareApplication') as any;

  test('FAQPage and SoftwareApplication JSON-LD blocks are present and parse as valid JSON', () => {
    expect(faqPage).toBeTruthy();
    expect(softwareApp).toBeTruthy();
  });

  test('FAQPage JSON-LD has exactly the same set of questions as App.tsx FAQ — no missing, no orphans', () => {
    const jsonLdQuestions = (faqPage.mainEntity as any[]).map((q) => q.name).sort();
    const appQuestions = FAQ.map((f) => f.q).sort();
    expect(jsonLdQuestions).toEqual(appQuestions);
  });

  for (const entry of FAQ) {
    test(`FAQPage JSON-LD "${entry.q}" answer matches App.tsx's rendered FAQ verbatim`, () => {
      const jsonLdEntry = (faqPage.mainEntity as any[]).find((q) => q.name === entry.q);
      expect(jsonLdEntry, `index.html FAQPage JSON-LD has no question "${entry.q}"`).toBeTruthy();
      expect(jsonLdEntry.acceptedAnswer.text).toBe(entry.a);
    });
  }

  test('SoftwareApplication JSON-LD price matches PRICE_MONTHLY_INR', () => {
    expect(softwareApp.offers.price).toBe(String(PRICE_MONTHLY_INR));
  });

  test('SoftwareApplication JSON-LD operatingSystem matches PLATFORM\'s OS family (iOS)', () => {
    // PLATFORM is the consumer-facing device name ("iPhone"); the schema.org
    // field is the OS family. Both facts come from the same iOS-only ruling,
    // so this only fails if someone adds a second platform to one but not
    // the other, not because the two strings must be identical.
    expect(PLATFORM).toBe('iPhone');
    expect(softwareApp.operatingSystem).toBe('iOS');
  });

  test('meta description states the monthly price and trial length consistently with the constants', () => {
    const match = indexHtml.match(/<meta name="description" content="([^"]*)"\s*\/>/);
    expect(match).toBeTruthy();
    const description = match![1];
    expect(description).toContain(`₹${PRICE_MONTHLY_INR}/mo`);
    expect(description).toContain(`${TRIAL_DAYS}-day free trial for eligible subscribers`);
  });

  test('Terms.tsx states the trial and pricing facts matching the constants (literal legal text, not interpolated)', () => {
    expect(termsSource).toContain(`Your first ${TRIAL_DAYS} days are free`);
    expect(termsSource).toContain(`₹${PRICE_MONTHLY_INR}/month`);
    expect(termsSource).toContain(`₹${PRICE_ANNUAL_INR_DISPLAY} per year`);
    expect(termsSource).toContain(`₹${PRICE_ANNUAL_MONTHLY_EQUIVALENT_INR}/month effective`);
  });

  test('Privacy.tsx states the current status language matching the constant (literal legal text, not interpolated)', () => {
    expect(privacySource).toContain(STATUS_LANGUAGE.toLowerCase());
  });

  // gm-t0e.3 — the purchase-stage renew/cancel/data-exit facts. Asserted
  // individually (not only as the assembled PURCHASE_ANSWER_RENEW_CANCEL_DATA_EXIT
  // paragraph) so the gate catches a drift in one clause even if the others
  // still happen to read correctly.
  test('the FAQ purchase-answer paragraph states the cancel route from CANCEL_ROUTE', () => {
    expect(PURCHASE_ANSWER_RENEW_CANCEL_DATA_EXIT).toContain(CANCEL_ROUTE);
  });

  test('the FAQ purchase-answer paragraph states the data export route from DATA_EXPORT_ROUTE', () => {
    expect(PURCHASE_ANSWER_RENEW_CANCEL_DATA_EXIT).toContain(DATA_EXPORT_ROUTE);
  });

  test('the FAQ purchase-answer paragraph states the data deletion route from DATA_DELETION_ROUTE', () => {
    expect(PURCHASE_ANSWER_RENEW_CANCEL_DATA_EXIT).toContain(DATA_DELETION_ROUTE);
  });

  test('App.tsx FAQ consumes PURCHASE_ANSWER_RENEW_CANCEL_DATA_EXIT, not a hand-written string', () => {
    const entry = FAQ.find((f) => f.q === 'What happens when my trial ends, and can I cancel or get my data out?');
    expect(entry, 'App.tsx FAQ has no purchase-answer entry').toBeTruthy();
    expect(entry!.a).toBe(PURCHASE_ANSWER_RENEW_CANCEL_DATA_EXIT);
  });

  test('App.tsx consumes PRICING_LEGIBILITY_LINE by reference exactly once, not a hand-written string', () => {
    const occurrences = appSource.split('{PRICING_LEGIBILITY_LINE}').length - 1;
    expect(occurrences).toBe(1);
    // AC5 guard: the literal string must not ALSO be hand-written somewhere else in App.tsx.
    expect(appSource).not.toContain(PRICING_LEGIBILITY_LINE);
  });

  test('NEGATIVE CONTROL: CANCEL_ROUTE assertion actually fails on a deliberately wrong route', () => {
    const drifted = PURCHASE_ANSWER_RENEW_CANCEL_DATA_EXIT.split(CANCEL_ROUTE).join('by emailing support');
    expect(drifted).not.toContain(CANCEL_ROUTE);
    expect(() => expect(drifted).toContain(CANCEL_ROUTE)).toThrow();
  });

  test('NEGATIVE CONTROL: the pricing-legibility-line-by-reference check actually fails when the reference is absent', () => {
    const strippedSource = appSource.split('{PRICING_LEGIBILITY_LINE}').join('');
    const occurrences = strippedSource.split('{PRICING_LEGIBILITY_LINE}').length - 1;
    expect(occurrences).not.toBe(1);
    expect(() => expect(occurrences).toBe(1)).toThrow();
  });

  test('NEGATIVE CONTROL: the JSON-LD drift check actually fails on a deliberately wrong string', () => {
    // Proves the assertion mechanism above can fail — a check that can never
    // go red is not a check. Does not touch index.html; mutates an in-memory
    // copy of the real JSON-LD answer and asserts it against the real
    // App.tsx answer, which must NOT be equal.
    const realJsonLdAnswer = (faqPage.mainEntity as any[]).find((q) => q.name === 'Is it free?').acceptedAnswer.text;
    const driftedAnswer = realJsonLdAnswer.replace(String(PRICE_MONTHLY_INR), '999999');
    const realAppAnswer = FAQ.find((f) => f.q === 'Is it free?')!.a;
    expect(driftedAnswer).not.toBe(realAppAnswer);
    expect(() => expect(driftedAnswer).toBe(realAppAnswer)).toThrow();
  });

  test('NEGATIVE CONTROL: the Terms.tsx fact check actually fails on a deliberately wrong string', () => {
    // Same proof, for the literal-text legal-copy assertion CHANGE 1 added:
    // mutates an in-memory copy of the real Terms.tsx source and asserts the
    // real check phrase against it, which must NOT match.
    const driftedSource = termsSource.replace(`₹${PRICE_MONTHLY_INR}/month`, '₹999999/month');
    expect(driftedSource).not.toContain(`₹${PRICE_MONTHLY_INR}/month`);
    expect(() => expect(driftedSource).toContain(`₹${PRICE_MONTHLY_INR}/month`)).toThrow();
  });
});

/**
 * gm-t0e.7 — bulk-import claim correction (gy-5kwas). The real capability is
 * the iOS phone-contacts picker, name + phone only; there is no CSV /
 * spreadsheet / other-app import. These phrases overclaimed it and must not
 * reappear anywhere the home or /compare/gymbo-vs-wellnessz/ pages are built from.
 */
const compareSource = readFileSync(path.resolve(__dirname, '../src/pages/CompareWellnessZ.tsx'), 'utf-8');
const compareHtml = readFileSync(path.resolve(__dirname, '../compare/gymbo-vs-wellnessz/index.html'), 'utf-8');
const trialAccessSource = readFileSync(path.resolve(__dirname, '../src/lib/trialAccess.ts'), 'utf-8');

const BANNED_IMPORT_PHRASES = [
  'in minutes',
  'rather than re-typing',
  'bring your roster over',
  'bulk client import',
  'import your clients',
];
const IMPORT_SURFACES: Record<string, string> = {
  'index.html': indexHtml,
  'src/App.tsx': appSource,
  'src/lib/trialAccess.ts': trialAccessSource,
  'src/pages/CompareWellnessZ.tsx': compareSource,
  'compare/gymbo-vs-wellnessz/index.html': compareHtml,
};
const HOME_IMPORT_ANSWER =
  "If your clients are saved in your phone's contacts, yes. Gymbo adds each client's name and phone number.";
const COMPARE_IMPORT_ANSWER =
  "Not directly. Gymbo can't import from WellnessZ or a spreadsheet. If your clients are saved in your phone's contacts, it can add them with their name and phone number.";

function offendingImportPhrases(surfaces: Record<string, string>): string[] {
  const hits: string[] = [];
  for (const [file, text] of Object.entries(surfaces)) {
    for (const phrase of BANNED_IMPORT_PHRASES) {
      if (text.toLowerCase().includes(phrase)) hits.push(`${file}: "${phrase}"`);
    }
  }
  return hits;
}

test.describe('gm-t0e.7: no bulk-import overclaim on the home or /compare/gymbo-vs-wellnessz/ sources', () => {
  test('none of the banned import phrases appear in any source that builds those pages', () => {
    expect(offendingImportPhrases(IMPORT_SURFACES)).toEqual([]);
  });

  test('home FAQ answer is the phone-contacts answer, byte-identical in App.tsx and JSON-LD', () => {
    expect(FAQ.find((f) => f.q === 'Can I import my existing clients?')!.a).toBe(HOME_IMPORT_ANSWER);
    const faqPage = extractJsonLdBlocks(indexHtml).find((b) => b['@type'] === 'FAQPage') as any;
    const ld = (faqPage.mainEntity as any[]).find((q) => q.name === 'Can I import my existing clients?');
    expect(ld.acceptedAnswer.text).toBe(HOME_IMPORT_ANSWER);
  });

  test('compare FAQ answer is identical in CompareWellnessZ.tsx and its JSON-LD twin', () => {
    expect(compareSource).toContain(`a: ${JSON.stringify(COMPARE_IMPORT_ANSWER)}`);
    const faqPage = extractJsonLdBlocks(compareHtml).find((b) => b['@type'] === 'FAQPage') as any;
    const ld = (faqPage.mainEntity as any[]).find((q) => q.name === 'Can I move my clients from WellnessZ to Gymbo?');
    expect(ld.acceptedAnswer.text).toBe(COMPARE_IMPORT_ANSWER);
  });

  test('NEGATIVE CONTROL: reintroducing one banned phrase in memory makes the check go red', () => {
    const mutated = { ...IMPORT_SURFACES, 'src/App.tsx': appSource.replace(HOME_IMPORT_ANSWER, 'Yes. Bring your current roster over in minutes.') };
    const hits = offendingImportPhrases(mutated);
    expect(hits).toContain('src/App.tsx: "in minutes"');
    expect(() => expect(hits).toEqual([])).toThrow();
  });
});
