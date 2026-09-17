import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FAQ } from '../src/App';
import {
  TRIAL_DAYS,
  PRICE_MONTHLY_INR,
  PRICE_ANNUAL_MONTHLY_EQUIVALENT_INR,
  PLATFORM,
} from '../src/lib/trialAccess';

/**
 * gm-pzp — the durable fix for the drift that hit TWICE (#164, #174):
 * index.html's FAQPage JSON-LD is static HTML and cannot import
 * src/lib/trialAccess.ts or src/App.tsx directly, so nothing stopped it
 * silently disagreeing with the rendered page. This file parses index.html's
 * own JSON-LD out of the built source and cross-checks it against the
 * single source of truth (src/lib/trialAccess.ts) and the rendered FAQ
 * (src/App.tsx's exported FAQ array) byte-for-byte.
 *
 * This does NOT run against a build output — it reads index.html from the
 * repo directly, so it catches drift the moment someone hand-edits either
 * file, before a build or deploy even happens.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const INDEX_HTML_PATH = path.resolve(__dirname, '../index.html');
const indexHtml = readFileSync(INDEX_HTML_PATH, 'utf-8');

function extractJsonLdBlocks(html: string): Record<string, unknown>[] {
  const blocks: Record<string, unknown>[] = [];
  const re = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html))) {
    blocks.push(JSON.parse(match[1]));
  }
  return blocks;
}

function faqAnswerFromApp(question: string): string {
  const entry = FAQ.find((f) => f.q === question);
  if (!entry) throw new Error(`App.tsx FAQ has no question "${question}" — update this test, not the assertion below`);
  return entry.a;
}

function faqAnswerFromJsonLd(faqPage: any, question: string): string {
  const entry = (faqPage.mainEntity as any[]).find((q) => q.name === question);
  if (!entry) throw new Error(`index.html FAQPage JSON-LD has no question "${question}"`);
  return entry.acceptedAnswer.text as string;
}

test.describe('copy facts: index.html JSON-LD must not drift from src/lib/trialAccess or App.tsx', () => {
  const blocks = extractJsonLdBlocks(indexHtml);
  const faqPage = blocks.find((b) => b['@type'] === 'FAQPage');
  const softwareApp = blocks.find((b) => b['@type'] === 'SoftwareApplication');

  test('FAQPage JSON-LD blocks are present and parse as valid JSON', () => {
    expect(faqPage).toBeTruthy();
    expect(softwareApp).toBeTruthy();
  });

  for (const question of ['Is it free?', 'Does it work offline?', 'Which phones does it support?']) {
    test(`FAQPage JSON-LD "${question}" answer matches App.tsx's rendered FAQ verbatim`, () => {
      expect(faqAnswerFromJsonLd(faqPage, question)).toBe(faqAnswerFromApp(question));
    });
  }

  test('SoftwareApplication JSON-LD price matches PRICE_MONTHLY_INR', () => {
    expect((softwareApp as any).offers.price).toBe(String(PRICE_MONTHLY_INR));
  });

  test('SoftwareApplication JSON-LD operatingSystem matches PLATFORM\'s OS family (iOS)', () => {
    // PLATFORM is the consumer-facing device name ("iPhone"); the schema.org
    // field is the OS family. Both facts come from the same iOS-only ruling,
    // so this only fails if someone adds a second platform to one but not
    // the other, not because the two strings must be identical.
    expect(PLATFORM).toBe('iPhone');
    expect((softwareApp as any).operatingSystem).toBe('iOS');
  });

  test('meta description states the monthly price and trial length consistently with the constants', () => {
    const match = indexHtml.match(/<meta name="description" content="([^"]*)"\s*\/>/);
    expect(match).toBeTruthy();
    const description = match![1];
    expect(description).toContain(`₹${PRICE_MONTHLY_INR}/mo`);
    expect(description).toContain(`${TRIAL_DAYS} days free`);
  });

  test('NEGATIVE CONTROL: this drift check actually fails on a deliberately wrong string', () => {
    // Proves the assertion mechanism above can fail — a check that can never
    // go red is not a check. Does not touch index.html; mutates an in-memory
    // copy of the real JSON-LD answer and asserts it against the real
    // App.tsx answer, which must NOT be equal.
    const realJsonLdAnswer = faqAnswerFromJsonLd(faqPage, 'Is it free?');
    const driftedAnswer = realJsonLdAnswer.replace(String(PRICE_MONTHLY_INR), '999999');
    expect(driftedAnswer).not.toBe(faqAnswerFromApp('Is it free?'));
    expect(() => expect(driftedAnswer).toBe(faqAnswerFromApp('Is it free?'))).toThrow();
  });
});
