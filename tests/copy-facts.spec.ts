import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FAQ } from '../src/App';
import {
  PRICE_MONTHLY_INR,
  PRICE_ANNUAL_INR_DISPLAY,
  PRICE_ANNUAL_MONTHLY_EQUIVALENT_INR,
  STATUS_LANGUAGE,
  PRICING_PAYMENT_LINE,
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

  test('SoftwareApplication JSON-LD operatingSystem is Web (gy-1vd9qy.10.4: live on the web, the iPhone app is coming soon)', () => {
    expect(softwareApp.operatingSystem).toBe('Web');
  });

  test('meta description states the monthly price and says start free, with no trial claim', () => {
    const match = indexHtml.match(/<meta name="description" content="([^"]*)"\s*\/>/);
    expect(match).toBeTruthy();
    const description = match![1];
    expect(description).toContain(`₹${PRICE_MONTHLY_INR}/mo`);
    expect(description).toContain('Start free');
    expect(description.toLowerCase()).not.toContain('trial');
  });

  // Terms.tsx is legal copy (pm ruling gm-pzp): this goes red until compliance edits the text. It asserts the prices, and that the
  // retired trial / App Store billing wording is GONE (gy-1vd9qy.10.4, no trial on the web).
  test('Terms.tsx states the prices and no longer promises a trial or App Store billing (literal legal text, not interpolated)', () => {
    expect(termsSource).toContain(`₹${PRICE_MONTHLY_INR}/month`);
    expect(termsSource).toContain(`₹${PRICE_ANNUAL_INR_DISPLAY} per year`);
    expect(termsSource).toContain(`₹${PRICE_ANNUAL_MONTHLY_EQUIVALENT_INR}/month effective`);
    expect(termsSource).not.toMatch(/free for 7 days|introductory[- ]offer|App Store/i);
  });

  test('Privacy.tsx states the current status language matching the constant (literal legal text, not interpolated)', () => {
    expect(privacySource).toContain(STATUS_LANGUAGE.toLowerCase());
  });

  test('App.tsx states the payment line once, from PRICING_PAYMENT_LINE (Pro is paid on the web)', () => {
    expect(appSource.split('{PRICING_PAYMENT_LINE}').length - 1).toBe(1);
    expect(appSource).not.toContain(PRICING_PAYMENT_LINE);
  });

  // gy-5kwas part 2 (compliance C1/C2): routes and deletion/export behaviour with no verified operation behind
  // them must not come back. Scans the sources that carry the purchase answer and the cancel route.
  // gy-5kwas FAQ swap (content 28 Oct): the home FAQ no longer offers privacy reassurance or a never-contact promise
  // while DPDP defects gy-wwr2e.27 / gy-66y9r.4 are open; these three must not come back.
  const BANNED = ['contacting us', 'anonymise', 'export your data', 'get my data out', 'Is my client data private', 'export it anytime', 'we never contact your clients', 'we never contact them directly'];
  const bannedIn = (text: string) => { const t = text.toLowerCase(); return BANNED.filter((b) => t.includes(b.toLowerCase())); };
  const pricingMd = readFileSync(path.resolve(__dirname, '../public/pricing.md'), 'utf-8');

  test('gy-5kwas: no unverified-route or over-claim phrase in the purchase answer, App, Privacy, index.html, pricing.md', () => {
    const surfaces: Record<string, string> = {
      app: appSource, privacy: privacySource, index: indexHtml, pricing: pricingMd,
    };
    for (const [name, text] of Object.entries(surfaces)) expect(bannedIn(text), name).toEqual([]);
  });

  test('NEGATIVE CONTROL: the guard fails when ANY ONE of the FAQ-swap phrases is reintroduced (on every guarded surface)', () => {
    for (const phrase of ['Is my client data private', 'export it anytime', 'we never contact your clients', 'we never contact them directly']) {
      expect(bannedIn('Some copy. ' + phrase + '?'), phrase).toEqual([phrase]);
      for (const text of [appSource, privacySource, indexHtml, pricingMd]) expect(bannedIn(text + ' ' + phrase), phrase).toContain(phrase);
    }
  });

  test('NEGATIVE CONTROL: the guard is case-insensitive, so the sentence-initial forms that shipped in Privacy and the home about paragraph are caught', () => {
    expect(bannedIn('We never contact your clients.')).toEqual(['we never contact your clients']);
    expect(bannedIn('Your client list stays yours too: we never contact them directly.')).toEqual(['we never contact them directly']);
    expect(bannedIn('Gymbo does not send messages to your clients.')).toEqual([]);
  });

  test('gy-5kwas: the never-contact sentences say what Gymbo does as sender, byte-for-byte (content 28 Oct)', () => {
    expect(appSource).toContain('Your client list stays yours too: Gymbo does not send messages to your clients.');
    expect(privacySource).toContain('Gymbo does not send messages to your clients.');
  });

  test('the home FAQ answers the export question and the JSON-LD carries the same question and answer byte-for-byte', () => {
    const q = "Can I export my clients' records?", a = "Yes. You can export your clients' attendance and payment records from the app whenever you like.";
    expect(appSource).toContain(`{ q: "${q}", a: "${a}" }`);
    expect(indexHtml).toContain(`"name": "${q}"`);
    expect(indexHtml).toContain(`"text": "${a}"`);
    expect(a).not.toContain('\u2014');
  });

  test('NEGATIVE CONTROL: the payment-line-by-reference check actually fails when the reference is absent', () => {
    const strippedSource = appSource.split('{PRICING_PAYMENT_LINE}').join('');
    const occurrences = strippedSource.split('{PRICING_PAYMENT_LINE}').length - 1;
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
