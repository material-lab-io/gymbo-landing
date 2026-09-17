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
    expect(description).toContain(`${TRIAL_DAYS} days free`);
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
