import { test, expect } from '@playwright/test';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installScrollRecorder, markScrollRecorder, readScrollLog } from './helpers/scroll-recorder';

/**
 * gy-becxi — the inline waitlist capture, verified as BEHAVIOUR.
 *
 * Damini, 2026-09-07, arriving from Instagram: "I tap on the Join Waitlist
 * button. That scrolls to the bottom of the page to the name and email fields.
 * This journey is a bit annoying."
 *
 * 🔴 THE LOAD-BEARING ASSERTION IN THIS FILE IS THAT scrollY DOES NOT CHANGE.
 * Everything else here — a form appears, a field is focused — is ALSO true of
 * the old behaviour once the page has finished scrolling to the footer. A test
 * that only asserted "a waitlist form is visible after the tap" would have
 * passed against the exact defect this bead exists to remove. The viewport
 * staying put is the only assertion that can tell the two apart.
 */

const WAITLIST_CTA = (loc: string) => `[data-cta="waitlist"][data-cta-location="${loc}"]`;

for (const [page_, loc, label] of [
  ['/', 'hero', 'the App hero — the founder-reported journey'],
  ['/compare/gymbo-vs-wellnessz/', 'compare', 'the compare page hero'],
  // gy-becxi follow-up 2026-09-12: the GALLERY cluster is WRAPPED in App.tsx
  // (<InlineWaitlist> around <PrimaryCTA location="gallery">) but was NOT pinned
  // here. Code coverage without test coverage is how a cluster silently reverts
  // to scrolling — the exact defect this bead removes — so the wrapped set and
  // the tested set must be the same set.
  ['/', 'gallery', 'the gallery cluster'],
] as const) {
  test(`${label}: tapping the waitlist CTA reveals the capture WITHOUT scrolling`, async ({ page }) => {
    await page.goto(page_);
    const cta = page.locator(WAITLIST_CTA(loc));
    await expect(cta).toHaveCount(1);

    // The cluster must be the one wired for reveal. Asserted from the SERVED
    // markup rather than inferred from behaviour, so a cluster that silently
    // fell back to scrolling names itself here instead of failing obscurely
    // three assertions later.
    await expect(cta).toHaveAttribute('data-cta-behaviour', 'reveal');

    await cta.scrollIntoViewIfNeeded();

    // 🔴 SETTLE BEFORE MEASURING, AND SETTLE ON THE CTA ITSELF. Two pre-existing
    // page behaviours land inside a naive measurement window and are NOT this
    // bead: lazy images above the CTA reflow and scroll anchoring compensates
    // (a first draft of this test read 398px of movement the click did not
    // cause), and on /compare the cluster sits in <Reveal>, whose
    // .reveal-on-scroll entry animation is a 0.6s translateY(20px) -> none — it
    // was still running and reported 19.8px, which is that animation to within
    // rounding and not a jump.
    // Both are removed by waiting for the CTA's own box AND scrollY to stop
    // moving. The alternative — widening the tolerance until the noise fits —
    // would have widened it past a 20px real jump too, and a control that
    // cannot fail is not a control.
    await page.waitForLoadState('networkidle');
    await expect.poll(async () => {
      const a = (await cta.boundingBox())!.y;
      const sa = await page.evaluate(() => window.scrollY);
      await page.waitForTimeout(200);
      const b = (await cta.boundingBox())!.y;
      const sb = await page.evaluate(() => window.scrollY);
      return Math.abs(a - b) < 0.5 && sa === sb;
    }, { timeout: 10_000 }).toBe(true);

    // 🔴 THE BEAD, MEASURED AS THE VISITOR EXPERIENCES IT. The property Damini
    // reported is not "scrollY is constant" — it is "the thing I was looking at
    // did not move". Anchoring the assertion to the CTA's own position in the
    // VIEWPORT states exactly that, and is immune to a scroll-anchoring
    // adjustment that moves scrollY and the content together (which is not a
    // jump, and which a raw scrollY assertion cannot tell apart from one).
    const beforeY = (await cta.boundingBox())!.y;
    const beforeScroll = await page.evaluate(() => window.scrollY);

    // 🔴 gy-14rfs: the first CTA assertion below FLAKES IN CI ONLY (first
    // attempt moved 99-458px in 24 of 36 deploy runs on 2026-09-18; the traced
    // retry always passed). Record who moved the page from here on, so the
    // failing attempt names its cause in its own message. Observation only —
    // the 2px limits are unchanged.
    await installScrollRecorder(page);
    await markScrollRecorder(cta, 'before click');

    await cta.click();

    // Two settling beats: long enough that a smooth-scroll would have started
    // and a focus()-induced jump would have landed.
    await page.waitForTimeout(400);
    await markScrollRecorder(cta, 'after click + 400ms');
    const afterY = (await cta.boundingBox())!.y;
    const afterScroll = await page.evaluate(() => window.scrollY);
    const moveLog = await readScrollLog(page);
    expect(Math.abs(afterY - beforeY), `the CTA the visitor tapped must not move in the viewport${moveLog}`).toBeLessThanOrEqual(2);
    expect(Math.abs(afterScroll - beforeScroll), `the page must not scroll when the capture opens${moveLog}`).toBeLessThanOrEqual(2);

    // The capture is revealed, and it is revealed INSIDE this cluster — not the
    // footer form becoming visible because the page moved.
    const panel = page.locator('[role="group"][aria-label="Request access"]').filter({ has: page.locator('input[type="email"]') });
    await expect(panel).toBeVisible();

    // designer item 2: focus the first field, because revealing a form the
    // visitor must then tap into spends the click we set out to save.
    const focused = await page.evaluate(() => {
      const el = document.activeElement as HTMLInputElement | null;
      return el ? { tag: el.tagName, name: el.getAttribute('name') } : null;
    });
    expect(focused, 'reveal must leave focus in the capture, not on the button').toMatchObject({ tag: 'INPUT' });

    // AC2, stated as a measurement rather than a claim: ONE tap from the CTA to
    // a focused, typable field. The old path was tap -> scroll -> tap a field.
    await page.keyboard.type('gy-becxi control');
    const typed = await page.evaluate(() => (document.activeElement as HTMLInputElement)?.value);
    expect(typed, 'the focused field must accept typing with no further tap').toBe('gy-becxi control');
  });
}

/**
 * designer item 3 — the footer form STAYS. This add a capture point; it does not
 * relocate one. People who arrive by scrolling must still find a form there, and
 * #cta is the target of every existing deep link and of the prod smoke suite.
 */
test('the footer capture still exists and is untouched by the reveal (item 3)', async ({ page }) => {
  await page.goto('/');
  const footer = page.locator('#cta');
  await footer.scrollIntoViewIfNeeded();
  await expect(footer).toBeVisible();
  await expect(footer.locator('input[type="email"]')).toBeVisible();
});

/**
 * 🔴 N1 — THE RE-POINTED NEGATIVE CONTROL (gy-w77x3 D6, designer 2026-09-16).
 *
 * WHAT THIS TEST USED TO ASSERT, AND WHY ITS SPECIMEN IS GONE. Until D3 this
 * slot held "an unwrapped waitlist CTA still scrolls, so the change is
 * additive", and it pointed at the mobile sticky bar — the one waitlist CTA
 * gy-becxi deliberately left alone, because an inline panel beneath a fixed
 * viewport-bottom bar renders off-screen. D1 solved that (the panel opens
 * UPWARD) and D3 wrapped the nav and pricing buttons, so every
 * data-cta="waitlist" control on / is now inside a cluster BY CONSTRUCTION.
 * There is no unwrapped specimen left to point at. A re-pointed control with no
 * history reads to the next person as if it had always meant this, so: it did
 * not, and the change is deliberate.
 *
 * THE FALLBACK ITSELF IS NOW UNTESTED, AND THAT IS A DECISION RATHER THAN AN
 * OVERSIGHT. useWaitlistCtaAction still returns scrollToId("cta") when the
 * context is null, and that branch is what keeps this change additive. Proving
 * it needs a component render outside a provider — a React harness this repo
 * does not have (the .mjs tests cover Pages Functions; Playwright asserts the
 * served page). designer ruled 2026-09-16 that a second harness for one branch
 * nobody can reach through the UI is cost without coverage, and that the branch
 * is now guarded by ARCHITECTURE: a null context is only reachable from a call
 * site that does not exist. If a React harness ever lands for other reasons,
 * assert the fallback then — that is a condition, not a promise.
 *
 * WHAT IS GUARDED INSTEAD IS THE PROPERTY THAT HAS ACTUALLY RECURRED TWICE. Not
 * "the fallback broke" — it never has — but "a waitlist control exists that
 * nobody routed through the shared symbol". gy-becxi shipped and MISSED THREE
 * CONTROLS; this bead exists because someone counted them afterwards. That
 * failure has a live specimen you can seed today, which the old control no
 * longer does.
 *
 * N1 is the DOM half: every element carrying data-cta="waitlist" on the served
 * page reports behaviour "reveal". After D3 that is ALL of them, so this is a
 * complete assertion rather than a sample, and it goes red the moment somebody
 * adds an unwrapped one. Its structural blind spot — a hand-rolled button that
 * carries no data-cta at all — is exactly how the three missed controls
 * survived, and is covered by N2 below, not here.
 */
test('N1: every waitlist CTA on the served page reveals in place (no unwrapped survivor)', async ({ page }) => {
  await page.goto('/');
  const ctas = await page.evaluate(() =>
    [...document.querySelectorAll('[data-cta="waitlist"]')].map((el) => ({
      location: el.getAttribute('data-cta-location'),
      behaviour: el.getAttribute('data-cta-behaviour'),
      html: el.outerHTML.slice(0, 120),
    })),
  );

  // POSITIVE CONTROL. An empty query passes .every() vacuously, and a selector
  // typo or a page that failed to hydrate would produce exactly that. The six
  // are hero, gallery, nav, footer (sticky bar) and two pricing cards — one
  // cluster per card, per designer.
  expect(ctas.length, 'positive control: the page must actually carry waitlist CTAs').toBeGreaterThanOrEqual(6);

  const notRevealing = ctas.filter((c) => c.behaviour !== 'reveal');
  expect(
    notRevealing,
    'every waitlist CTA must reveal its capture in place. A "scroll" here means a control was added or unwrapped without a cluster — the exact defect gy-becxi shipped with, three times over.',
  ).toEqual([]);
});

/**
 * 🔴 N2 — THE SOURCE-LEVEL HALF, BECAUSE N1 IS STRUCTURALLY BLIND TO THE
 * HAND-ROLL (gy-w77x3 D6, designer 2026-09-16).
 *
 * A raw <button onClick={() => scrollToId("cta")}> carries NO data-cta at all,
 * so it is invisible to a DOM query BY CONSTRUCTION. That is precisely how two
 * of the three controls in this bead's description survived gy-becxi: they were
 * never attributes to begin with, so no attribute gate could see them. This is
 * the same class as the iOS PageHeader hand-copy (gy-ruy1h) — a gate over
 * VALUES or ATTRIBUTES cannot see a re-implementation that simply does not
 * carry them.
 *
 * So this reads the SOURCES, not the page: every scrollToId("cta") call site
 * must be the shared hook in forge-ui.tsx, or a NAMED exception below. An
 * unnamed one fails, and the failure message is the file and the line.
 */
test('N2: no hand-rolled scroll-to-capture outside the shared hook (source-level)', () => {
  const root = path.resolve(fileURLToPath(new URL('../src', import.meta.url)));

  const walk = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)],
    );
  const sources = walk(root).filter((f) => /\.(tsx?|jsx?)$/.test(f));

  // 🔴 THE NAMED ALLOW-LIST. A deliberate exception is a line someone can read
  // and disagree with; an accidental one is a line nobody knew was there. Each
  // entry names the file, a substring that identifies the specific control, and
  // WHY it is not a waitlist CTA.
  const ALLOWED: { file: string; marker: string; why: string }[] = [
    // The footer "Support" entry was removed by #190 (App Review 1.5): "Support"
    // now links to the support CONTACT (#support), not to the request-access
    // form, so it no longer calls scrollToId at all. That settles the content
    // question this entry left open.
    // PageShell.tsx's header "Request access" (was "Get Gymbo") is deliberately NOT here and needs no
    // entry: it is an <a href="/#cta"> that NAVIGATES. It does not call
    // scrollToId, so it is out of this gate's scope by construction, and
    // designer ruled that revealing there would be a different control wearing
    // the same label.
  ];

  // 🔴 COMMENTS ARE NOT CALL SITES, AND THIS TEST'S OWN POSITIVE CONTROL CAUGHT
  // ME ASSUMING THEY WERE. A first pass matched raw lines and reported TWO hits
  // in forge-ui.tsx: the hook, and a PROSE line documenting the duplication the
  // hook removed (`trackCta(...); scrollToId("cta")` inside a comment). Left
  // alone, a gate that counts prose can be silenced by editing a comment and
  // tripped by writing one — neither of which changes what the page does.
  // Comment bodies are blanked to spaces rather than deleted, so a violation
  // still reports its real line number. String state is tracked because '//'
  // inside a URL literal is not a comment opener.
  const blankComments = (src: string): string => {
    let out = '';
    let mode: 'code' | 'line' | 'block' | 'str' = 'code';
    let quote = '';
    for (let i = 0; i < src.length; i++) {
      const c = src[i];
      const n = src[i + 1];
      if (mode === 'code') {
        if (c === '/' && n === '/') { mode = 'line'; out += '  '; i++; continue; }
        if (c === '/' && n === '*') { mode = 'block'; out += '  '; i++; continue; }
        if (c === '"' || c === "'" || c === '`') { mode = 'str'; quote = c; }
        out += c;
      } else if (mode === 'line') {
        if (c === '\n') { mode = 'code'; out += c; } else out += ' ';
      } else if (mode === 'block') {
        if (c === '*' && n === '/') { mode = 'code'; out += '  '; i++; continue; }
        out += c === '\n' ? c : ' ';
      } else {
        if (c === '\\') { out += c + (n ?? ''); i++; continue; }
        if (c === quote) mode = 'code';
        out += c;
      }
    }
    return out;
  };

  const hits: { file: string; line: number; text: string }[] = [];
  for (const file of sources) {
    const rel = path.relative(path.resolve(root, '..'), file);
    const raw = readFileSync(file, 'utf8').split('\n');
    const lines = blankComments(readFileSync(file, 'utf8')).split('\n');
    lines.forEach((text, i) => {
      if (/scrollToId\(\s*["'`]cta["'`]\s*\)/.test(text)) hits.push({ file: rel, line: i + 1, text: raw[i].trim() });
    });
  }

  // POSITIVE CONTROL, and it is not decoration: a glob that matched nothing, a
  // regex that stopped matching, or a rename of scrollToId would all make the
  // violation list empty — a pass that means "I looked at nothing". The shared
  // hook in forge-ui.tsx is the one call site that must ALWAYS be found.
  const canonical = hits.filter((h) => h.file === 'src/forge-ui.tsx');
  expect(sources.length, 'positive control: the source walk must find files').toBeGreaterThan(5);
  expect(
    canonical.length,
    'positive control: the shared hook in forge-ui.tsx must be found. Zero here means this scanner is reading nothing and its silence is worthless.',
  ).toBe(1);

  const violations = hits
    .filter((h) => h.file !== 'src/forge-ui.tsx')
    .filter((h) => !ALLOWED.some((a) => h.file === a.file && h.text.includes(a.marker)));

  expect(
    violations.map((v) => `${v.file}:${v.line}  ${v.text.slice(0, 100)}`),
    'a hand-rolled scrollToId("cta") is a waitlist CTA that no attribute gate can see — route it through useWaitlistCtaProps / WaitlistPlainButton, or add a NAMED entry to ALLOWED above saying why it is not one.',
  ).toEqual([]);

  // The allow-list is itself pinned: an entry whose specimen has been deleted or
  // renamed must fail rather than sit there granting a permission nobody uses —
  // a stale exemption is how a gate quietly widens.
  for (const a of ALLOWED) {
    expect(
      hits.some((h) => h.file === a.file && h.text.includes(a.marker)),
      `the allow-list entry for ${a.file} (${a.marker}) matches nothing any more — delete it rather than leave a permission with no specimen.`,
    ).toBe(true);
  }
});

/**
 * item 4 — ONE submitted form, not two. Both captures must post through the same
 * component to the same endpoint. Two forms that can diverge is how one of them
 * silently stops working; gy-if6mq's confirmation mail and team alert hang off
 * this single endpoint (AC6), so a second submit path would send a lead into a
 * hole with no mail and no alert.
 */
test('the revealed capture posts to the same endpoint as the footer one (item 4, AC6)', async ({ page }) => {
  await page.goto('/');
  const posts: string[] = [];
  await page.route('**/api/waitlist', async (route) => {
    posts.push(route.request().url());
    await route.fulfill({ status: 200, body: '{}' });
  });

  // gy-14rfs: this test also flakes in CI only (10 first-attempt failures in
  // 36 deploy runs, all "posts.length 0, expected 1" after 5s). The log below
  // says whether the tap reached a hydrated button and where the page went.
  const heroCta = page.locator(WAITLIST_CTA('hero'));
  await installScrollRecorder(page);
  await markScrollRecorder(heroCta, 'before click');
  await heroCta.click();
  // 🔴 ADDRESSED BY ROLE, NOT BY "the group that contains an email input". On
  // success WaitlistForm REPLACES the fields with the confirmation line, so a
  // locator filtered on the email input stops matching the moment the thing it
  // is there to check happens — it would report "not found" for a submit that
  // worked perfectly.
  const panel = page.locator('[role="group"][aria-label="Request access"]').first();
  await panel.locator('input[type="email"]').fill('gy-becxi-control@example.invalid');
  await panel.locator('button[type="submit"]').click();

  // The message is only known after the wait, so it is attached on failure;
  // the assertion itself is unchanged.
  try {
    await expect.poll(() => posts.length).toBe(1);
  } catch (e) {
    await markScrollRecorder(heroCta, 'poll timed out');
    const where = await page.evaluate(() => `url=${location.href} activeInPanels=${[...document.querySelectorAll('[role="group"][aria-label="Request access"]')].map((g) => g.contains(document.activeElement)).join(',')}`);
    (e as Error).message += `\n${where}${await readScrollLog(page)}`;
    throw e;
  }
  expect(new URL(posts[0]).pathname).toBe('/api/waitlist');
  await expect(panel.getByText(/request received/i)).toBeVisible();
});

/**
 * gy-e60uc.3 — the success line BRANCHES on what the visitor typed, and each branch says what really
 * happens next. The test above matches /request received/i, which BOTH lines satisfy, so it cannot tell
 * the branches apart; these assert the exact ratified strings. /api/waitlist is intercepted with a stub
 * 200: NO row is created and nothing is sent.
 *
 * 'both' pins the key: an email that is non-empty after trim selects the EMAIL branch even when a phone
 * is also given, because the confirmation mail is what that visitor will actually receive.
 */
const SUCCESS_EMAIL = 'Request received. Check your inbox for a confirmation.';
const SUCCESS_PHONE_ONLY = "Request received. We'll WhatsApp you on the number you gave us.";
for (const [label, fill, expected] of [
  ['email only', { email: 'gy-e60uc3-control@example.invalid' }, SUCCESS_EMAIL],
  ['phone only', { phone: '9876543210' }, SUCCESS_PHONE_ONLY],
  ['both (email wins)', { email: 'gy-e60uc3-control@example.invalid', phone: '9876543210' }, SUCCESS_EMAIL],
  ['whitespace email + phone (phone-only)', { email: '   ', phone: '9876543210' }, SUCCESS_PHONE_ONLY],
] as const) {
  test(`waitlist success line, ${label}: exact ratified string, announced as a status (gy-e60uc.3)`, async ({ page }) => {
    await page.goto('/');
    const posts: string[] = [];
    await page.route('**/api/waitlist', async (route) => {
      posts.push(route.request().url());
      await route.fulfill({ status: 200, body: '{}' });
    });
    const form = page.locator('form:has(input[name="phone"])').last();
    await form.scrollIntoViewIfNeeded();
    if ('email' in fill) await form.locator('input[type="email"]').fill(fill.email);
    if ('phone' in fill) await form.locator('input[type="tel"]').fill(fill.phone);
    await form.locator('button[type="submit"]').click();
    await expect.poll(() => posts.length).toBe(1);
    const status = page.getByRole('status').filter({ hasText: /request received/i });
    await expect(status).toHaveText(expected);
    await expect(status).toHaveCount(1);
  });
}

/**
 * gy-e60uc.2 — an email that is not name@domain.tld is refused AT THE FORM with an inline error and NO request
 * (row 29: accepted by an "@"-only check, then Resend 422'd it, and the visitor was told to check an inbox we
 * could not send to). Note the HTML type=email check ACCEPTS "a@b", so the browser alone would not have caught
 * it. NEGATIVE CONTROL and LIVENESS live together: the valid case must post, or "refused" would be a blanket no.
 * /api/waitlist is intercepted with a stub 200: no row is created, nothing is sent.
 */
const EMAIL_ERR = "That email doesn't look right. Check it and try again.";
const EMAIL_ERR_WITH_PHONE = "That email doesn't look right. Fix it, or clear it to use your WhatsApp number.";
for (const [label, fill] of [
  ['a@b', { email: 'a@b' }],
  ['a@gmail', { email: 'a@gmail' }],
  // Refused by the browser's own type=email check unless the form is noValidate; now OUR text must show for it too.
  ['a@gmail,com', { email: 'a@gmail,com' }],
  ['malformed email WITH a phone (still refused)', { email: 'a@b', phone: '9876543210' }],
] as const) {
  test(`malformed email is refused at the form, no request sent: ${label} (gy-e60uc.2)`, async ({ page }) => {
    await page.goto('/');
    const posts: string[] = [];
    await page.route('**/api/waitlist', async (route) => {
      posts.push(route.request().url());
      await route.fulfill({ status: 200, body: '{}' });
    });
    const form = page.locator('form:has(input[name="phone"])').last();
    await form.scrollIntoViewIfNeeded();
    await form.locator('input[type="email"]').fill(fill.email);
    if ('phone' in fill) await form.locator('input[type="tel"]').fill(fill.phone);
    await form.locator('button[type="submit"]').click();
    await expect(form.getByRole('alert')).toHaveText('phone' in fill ? EMAIL_ERR_WITH_PHONE : EMAIL_ERR);
    await expect(form.locator('input[type="email"]')).toHaveAttribute('aria-invalid', 'true');
    // Focus lands on the field to fix, and NOTHING the visitor typed is cleared (content's ruling).
    await expect(form.locator('input[type="email"]')).toBeFocused();
    await expect(form.locator('input[type="email"]')).toHaveValue(fill.email);
    if ('phone' in fill) await expect(form.locator('input[type="tel"]')).toHaveValue(fill.phone);
    // Give a wrongly-permitted request time to happen before asserting it did not.
    await page.waitForTimeout(400);
    expect(posts, 'a malformed email must not be posted').toEqual([]);
    await expect(page.getByRole('status').filter({ hasText: /request received/i })).toHaveCount(0);
    // Editing the field clears the error, like the needs-contact one.
    await form.locator('input[type="email"]').fill('a@b.co');
    await expect(form.getByRole('alert')).toHaveCount(0);
  });
}

// The server applies the same rule. If it refuses an address the form let through, the visitor sees the SAME
// inline text (never a status code or the server's wording); any other failure keeps the old error + mailto.
for (const [label, phone, expected] of [
  ['email only', '', EMAIL_ERR],
  ['email and phone', '9876543210', EMAIL_ERR_WITH_PHONE],
] as const) {
  test(`a server refusal of the email shows the same inline text (${label}) (gy-e60uc.2)`, async ({ page }) => {
    await page.goto('/');
    await page.route('**/api/waitlist', (route) => route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'valid email required' }) }));
    const form = page.locator('form:has(input[name="phone"])').last();
    await form.scrollIntoViewIfNeeded();
    // "a@b.co" passes the form's own check, so this reaches the (stubbed) server.
    await form.locator('input[type="email"]').fill('a@b.co');
    if (phone) await form.locator('input[type="tel"]').fill(phone);
    await form.locator('button[type="submit"]').click();
    const alert = form.getByRole('alert');
    await expect(alert).toHaveText(expected);
    await expect(alert).not.toContainText(/400|422|502|resend|validation|invalid to field/i);
    await expect(form.locator('input[type="email"]')).toBeFocused();
    await expect(form.locator('input[type="email"]')).toHaveValue('a@b.co');
  });
}

test('a generic server failure keeps the existing error state and its mailto fallback (gy-e60uc.2)', async ({ page }) => {
  await page.goto('/');
  await page.route('**/api/waitlist', (route) => route.fulfill({ status: 502, contentType: 'application/json', body: JSON.stringify({ error: 'failed to join' }) }));
  const form = page.locator('form:has(input[name="phone"])').last();
  await form.scrollIntoViewIfNeeded();
  await form.locator('input[type="email"]').fill('a@b.co');
  await form.locator('button[type="submit"]').click();
  await expect(form.getByText(/couldn't send your request just now/i)).toBeVisible();
  await expect(form.getByRole('link', { name: /email us to request access/i })).toHaveAttribute('href', /^mailto:hello@getgymbo\.com/);
  // NOT mistaken for the email error.
  await expect(form.getByText(/doesn't look right/i)).toHaveCount(0);
});

/**
 * gy-e60uc.7 — a refused submit must be SEEN. tester at 89f7dfb4: on a 375x740 phone the inline error rendered
 * UNDER the fixed sticky CTA bar, and on a 900px-tall desktop below the fold, so a failed submit looked like
 * nothing had happened. On an invalid submit the error, and the field it is about, must be inside the visible
 * viewport and not covered by the sticky bar. The bar is `md:hidden`, so only the phone case has one to hit.
 * /api/waitlist is intercepted (stub 200): no row is created, nothing is sent.
 */
for (const [label, project, viewport] of [
  ['375x740 phone', 'mobile', { width: 375, height: 740 }],
  ['1280x900 desktop', 'desktop', { width: 1280, height: 900 }],
] as const) {
  for (const [what, fill, expected] of [
    ['a malformed email', { email: 'a@b' }, /doesn't look right/i],
    ['neither email nor phone', {}, /Add a WhatsApp number or an email/i],
  ] as const) {
    test(`the refusal is visible and not covered by the sticky bar: ${what} at ${label} (gy-e60uc.7)`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== project, `the ${label} case runs in the ${project} project`);
      await page.setViewportSize(viewport);
      await page.route('**/api/waitlist', (route) => route.fulfill({ status: 200, body: '{}' }));
      await page.goto('/');
      // Lazy images above the footer reflow the page after load; measure only once they have.
      await page.waitForLoadState('networkidle');
      const form = page.locator('form:has(input[name="phone"])').last();
      await form.scrollIntoViewIfNeeded();
      // POSITION THE FORM DETERMINISTICALLY: put the submit button's bottom edge just above the fold (on a phone,
      // just above where the sticky bar starts). That is the reported situation, and it is where a 20px error
      // beneath the button lands UNDER the bar / below the fold unless something scrolls it into view. Without
      // this the outcome depended on where scrollIntoViewIfNeeded happened to leave the page, and the control
      // was flaky in both directions.
      // Wait for scrollIntoViewIfNeeded's own (possibly smooth) scroll to finish, THEN move instantly, then wait
      // for the position to stop changing. Measuring while a smooth scroll is still in flight put the button
      // ~19px off target in an earlier draft.
      const settle = async () => {
        let last = -1;
        await expect.poll(async () => { const y = await page.evaluate(() => window.scrollY); const same = y === last; last = y; return same; }, { intervals: [100, 100, 100, 100], timeout: 5000 }).toBe(true);
      };
      await settle();
      await page.evaluate((target) => {
        const forms = document.querySelectorAll('form');
        const btn = [...forms].filter((f) => f.querySelector('input[name="phone"]')).pop()!.querySelector('button[type="submit"]')!;
        window.scrollBy({ top: btn.getBoundingClientRect().bottom - target, behavior: 'instant' });
      }, project === 'mobile' ? viewport.height - 100 : viewport.height - 8);
      await settle();
      if ('email' in fill) await form.locator('input[type="email"]').fill(fill.email);
      await form.locator('button[type="submit"]').click();
      const alert = form.getByRole('alert');
      await expect(alert).toHaveText(expected);
      // Let any scroll settle before measuring where things ended up.
      await page.waitForTimeout(600);
      const bar = page.locator('[data-fixed-chrome="sticky-cta"]');
      const barTop = (await bar.isVisible()) ? (await bar.boundingBox())!.y : viewport.height;
      const vh = page.viewportSize()!.height;
      for (const [name, loc] of [['the error', alert], ['the submit button', form.locator('button[type="submit"]')]] as const) {
        const box = (await loc.boundingBox())!;
        expect(box.y, `${name} starts above the top of the viewport`).toBeGreaterThanOrEqual(0);
        expect(box.y + box.height, `${name} ends below the viewport (${vh}px)`).toBeLessThanOrEqual(vh);
        expect(box.y + box.height, `${name} is covered by the sticky bar (bar top ${barTop}px)`).toBeLessThanOrEqual(barTop + 0.5);
      }
      // The bar's own hit-test: the point at the error's centre must be the error, not the bar.
      const eb = (await alert.boundingBox())!;
      const topmost = await page.evaluate(([x, y]) => (document.elementFromPoint(x, y) as HTMLElement | null)?.closest('[data-fixed-chrome]')?.getAttribute('data-fixed-chrome') ?? null, [eb.x + eb.width / 2, eb.y + eb.height / 2] as const);
      expect(topmost, 'the topmost element at the error is the sticky bar').toBeNull();
    });
  }
}

// The OTHER places the same form appears (gy-e60uc.7): the revealed panels under the hero and pricing CTAs, and the
// sticky bar's own capture, which expands UPWARD inside a fixed container. Same rule: a refused submit is visible
// and the sticky bar does not cover it. Phone-sized only, because that is where the bar exists.
async function expectRefusalSeen(page: import('@playwright/test').Page, form: import('@playwright/test').Locator, bad: string) {
  await form.locator('input[type="email"]').fill(bad);
  await form.locator('button[type="submit"]').click();
  const alert = form.getByRole('alert');
  await expect(alert).toHaveText(/doesn't look right/i);
  await page.waitForTimeout(600);
  const vh = page.viewportSize()!.height;
  const bar = page.locator('[data-fixed-chrome="sticky-cta"]');
  const insideBar = await alert.evaluate((el) => !!el.closest('[data-fixed-chrome]'));
  const barTop = !insideBar && (await bar.isVisible()) ? (await bar.boundingBox())!.y : vh;
  const box = (await alert.boundingBox())!;
  expect(box.y, 'the error starts above the viewport').toBeGreaterThanOrEqual(0);
  expect(box.y + box.height, `the error is covered by the sticky bar (bar top ${barTop}px) or below the fold (${vh}px)`).toBeLessThanOrEqual(Math.min(barTop, vh) + 0.5);
}

for (const [label, prepare] of [
  ['the hero panel', async (page: import('@playwright/test').Page) => {
    await page.locator(WAITLIST_CTA('hero')).click();
    return page.locator('[role="group"][aria-label="Request access"]').first().locator('form');
  }],
  ['the pricing panel', async (page: import('@playwright/test').Page) => {
    const cta = page.locator(WAITLIST_CTA('pricing')).first();
    await cta.scrollIntoViewIfNeeded();
    await cta.click();
    return page.locator('[role="group"][aria-label="Request access"]').first().locator('form');
  }],
  ["the sticky bar's own capture", async (page: import('@playwright/test').Page) => {
    await page.evaluate(() => window.scrollTo(0, window.innerHeight * 1.2));
    const bar = page.locator('[data-fixed-chrome="sticky-cta"]');
    await expect(bar).toBeVisible();
    await bar.locator('[data-cta="waitlist"]').click();
    return bar.locator('form');
  }],
] as const) {
  test(`a refused submit is seen in ${label} at 375x740 (gy-e60uc.7)`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'the sticky bar only exists on a phone');
    await page.setViewportSize({ width: 375, height: 740 });
    await page.route('**/api/waitlist', (route) => route.fulfill({ status: 200, body: '{}' }));
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const form = await prepare(page);
    await expect(form).toBeVisible();
    await expectRefusalSeen(page, form, 'a@b');
  });
}

test('the error is named as the description of the field it is about (gy-e60uc.7)', async ({ page }) => {
  await page.route('**/api/waitlist', (route) => route.fulfill({ status: 200, body: '{}' }));
  await page.goto('/');
  const form = page.locator('form:has(input[name="phone"])').last();
  await form.scrollIntoViewIfNeeded();
  const email = form.locator('input[type="email"]');
  const before = await email.getAttribute('aria-describedby');
  await email.fill('a@b');
  await form.locator('button[type="submit"]').click();
  const alert = form.getByRole('alert');
  await expect(alert).toBeVisible();
  const errorId = await alert.getAttribute('id');
  expect(errorId, 'the error needs an id to be referenced').toBeTruthy();
  // The contact-rule hint stays, and the error is ADDED to the description, on the field that is wrong.
  const during = await email.getAttribute('aria-describedby');
  expect(during).toContain(before!);
  expect(during!.split(' ')).toContain(errorId!);
  // The accessible description resolves to both texts (it is computed from the referenced nodes).
  const desc = await email.evaluate((el) => (el.getAttribute('aria-describedby') ?? '').split(' ').map((id) => document.getElementById(id)?.textContent?.trim()).join(' | '));
  expect(desc).toMatch(/either one is enough/);
  expect(desc).toMatch(/doesn't look right/);
  // Editing the field clears the error and drops it from the description.
  await email.fill('a@b.co');
  await expect(alert).toHaveCount(0);
  expect(await email.getAttribute('aria-describedby')).toBe(before);
});

test('LIVENESS: a well-formed email passes the shape check and posts (gy-e60uc.2)', async ({ page }) => {
  await page.goto('/');
  const posts: string[] = [];
  await page.route('**/api/waitlist', async (route) => {
    posts.push(route.request().url());
    await route.fulfill({ status: 200, body: '{}' });
  });
  const form = page.locator('form:has(input[name="phone"])').last();
  await form.scrollIntoViewIfNeeded();
  await form.locator('input[type="email"]').fill('first.last+tag@sub.example.co.in');
  await form.locator('button[type="submit"]').click();
  await expect.poll(() => posts.length).toBe(1);
  await expect(page.getByRole('status').filter({ hasText: /request received/i })).toHaveText('Request received. Check your inbox for a confirmation.');
});

test('the phone field says WhatsApp, and keeps "phone" in its accessible name (gy-e60uc.3)', async ({ page }) => {
  await page.goto('/');
  const phone = page.locator('input[name="phone"]').last();
  // Placeholder and aria-label are byte-identical: the only visible label is the placeholder, so the
  // accessible name contains the visible text by construction (WCAG 2.5.3).
  await expect(phone).toHaveAttribute('placeholder', 'Your WhatsApp phone number');
  await expect(phone).toHaveAttribute('aria-label', 'Your WhatsApp phone number');
  // Nothing about the input's kind or autofill changed.
  await expect(phone).toHaveAttribute('type', 'tel');
  await expect(phone).toHaveAttribute('autocomplete', 'tel');
  const hint = page.getByText('Add a WhatsApp number or an email: either one is enough.').last();
  await expect(hint).toBeVisible();
  // Empty submit -> the ratified error, announced as an alert.
  const form = page.locator('form:has(input[name="phone"])').last();
  await form.scrollIntoViewIfNeeded();
  await form.locator('button[type="submit"]').click();
  await expect(form.getByRole('alert')).toHaveText('Add a WhatsApp number or an email so we can reach you.');
});

/**
 * 🔴 THE preventScroll CONTROL, AND WHY IT NEEDS ITS OWN SETUP.
 *
 * Removing `preventScroll` from the reveal's focus() call is the subtlest way to
 * break this bead: the capture still opens, the field is still focused, and the
 * page silently jumps again — the original defect, wearing the fix's clothes.
 * Mutation-testing the change showed the general tests above catch that removal
 * in only ONE of four browser/page combinations, because a field that happens to
 * be inside the viewport is not scrolled to even by default focus. The guard is
 * only exercised when the revealed field falls BELOW the fold.
 *
 * So this test creates that condition deliberately, and it is also the realistic
 * one: a visitor on a phone with the CTA partway down the screen, where the
 * panel necessarily opens past the bottom edge. Verified to fail when
 * preventScroll is removed, on both projects.
 */
test('the capture opens below the fold without the page chasing it (preventScroll control)', async ({ page }) => {
  await page.goto('/');
  const cta = page.locator(WAITLIST_CTA('hero'));
  const viewport0 = page.viewportSize()!;
  await page.waitForLoadState('networkidle');

  // Put the CTA hard against the BOTTOM edge, so the panel that opens under it
  // is entirely below the fold and default focus behaviour would HAVE to scroll
  // to reach the field.
  //
  // 🔴 TWO OBVIOUS WAYS TO DO THIS DO NOT WORK, and both produced a control that
  // could not fail:
  //   scrollIntoView({ block: 'end' }) — a no-op here. The hero CTA is near the
  //     TOP of the document, so there is nothing to scroll; scrollY stayed 0,
  //     the revealed field landed in view at y=606 of an 812px viewport, and
  //     plain focus() had nothing to scroll to.
  //   scrollBy(bottom - innerHeight) — negative at scrollY 0, so also a no-op.
  // The CTA cannot be moved DOWN to the fold; the fold has to be brought UP to
  // it. Shrinking the viewport to just below the CTA does that deterministically
  // on any page, at any scroll position.
  const ctaBottom = (await cta.boundingBox())!.y + (await cta.boundingBox())!.height;
  await page.setViewportSize({ width: viewport0.width, height: Math.round(ctaBottom) + 12 });
  await page.waitForTimeout(200);
  await expect.poll(async () => {
    const a = (await cta.boundingBox())!.y;
    await page.waitForTimeout(200);
    return Math.abs(a - (await cta.boundingBox())!.y) < 0.5;
  }, { timeout: 10_000 }).toBe(true);

  const viewport = page.viewportSize()!;
  const boxBefore = (await cta.boundingBox())!;
  // The setup is asserted, not assumed — see above for what happens when it
  // silently does not hold.
  expect(boxBefore.y, 'setup: the CTA must sit against the bottom edge so the panel opens off-screen')
    .toBeGreaterThan(viewport.height - 80);
  const scrollBefore = await page.evaluate(() => window.scrollY);

  // 🔴 gy-14rfs: this assertion FLAKES IN CI ONLY (first attempt scrolled 487px,
  // retry passed; 0 of 205 local runs reproduce it). A flaky test uploads no
  // report and the trace is recorded on the RETRY, so the failing attempt left
  // no evidence. Record who moved the page, so the next flake names its cause
  // in its own failure message instead of being retried away.
  await installScrollRecorder(page);
  await markScrollRecorder(cta, 'before tap');

  // 🔴 A TAP AT THE CTA'S OWN COORDINATES, NOT locator.click(). Playwright's
  // click scrolls its target into view FIRST, and it honours scroll-padding.
  // gy-w77x3 B7 added a 92px scroll-padding-bottom below md (so a focused
  // control clears the sticky bar), and this setup deliberately parks the CTA
  // 12px from the bottom edge, inside that band. Measured: locator.click()
  // then scrolled 278px BEFORE the reveal ran (focus still on <body>), 20/20
  // red. That scroll is the harness, not the page. A visitor's tap does not
  // scroll first, and mouse.click at the box centre does not either.
  await page.mouse.click(boxBefore.x + boxBefore.width / 2, boxBefore.y + boxBefore.height / 2);
  await page.waitForTimeout(400);

  const boxAfter = (await cta.boundingBox())!;
  const scrollAfter = await page.evaluate(() => window.scrollY);
  const scrollLog = await readScrollLog(page);
  expect(Math.abs(scrollAfter - scrollBefore),
    `focusing a below-the-fold field must not scroll the page${scrollLog}`,
  ).toBeLessThanOrEqual(2);
  expect(Math.abs(boxAfter.y - boxBefore.y), 'the CTA must stay exactly where the visitor tapped it').toBeLessThanOrEqual(2);
});

/**
 * 🔴 THE INLINE CAPTURE MUST NOT BE NARROWER THAN THE ONE IT MIRRORS.
 *
 * Both captures are the SAME WaitlistForm (item 4), so a width difference is
 * pure containing-block accident — and it is not cosmetic. A first pass wrapped
 * the form in a plain p-5 panel, which cost 40px and, on a 375px phone, clipped
 * the email placeholder: 276px of text into 255px of field. The half that gets
 * cut is the part that says email is OPTIONAL, on the capture a visitor arriving
 * from Instagram actually reaches — so a lead who has already typed a phone
 * number is left reading a field that looks required.
 *
 * I had assumed that clipping was pre-existing. MEASURING BOTH FORMS showed the
 * footer field had 19px of headroom and did not clip, and that the inline panel
 * had introduced it. This test is the assumption turned into a measurement.
 */
test('the inline capture is no narrower than the footer capture (measured, both viewports)', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  const innerWidth = (sel: string) =>
    page.locator(sel).evaluate((el: HTMLInputElement) => {
      const cs = getComputedStyle(el);
      return el.getBoundingClientRect().width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    });

  await page.locator('#cta').scrollIntoViewIfNeeded();
  const footer = await innerWidth('#cta input[type="email"]');

  await page.locator(WAITLIST_CTA('hero')).click();
  await page.waitForTimeout(400);
  const inline = await innerWidth('[role="group"][aria-label="Request access"] input[type="email"]');

  expect(inline, 'the revealed capture must give the fields at least as much room as the footer one')
    .toBeGreaterThanOrEqual(footer);

  // And the placeholder that carries the "optional" hint must actually fit.
  const fits = await page
    .locator('[role="group"][aria-label="Request access"] input[type="email"]')
    .evaluate((el: HTMLInputElement) => {
      const cs = getComputedStyle(el);
      const ctx = document.createElement('canvas').getContext('2d')!;
      ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      const avail = el.getBoundingClientRect().width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      return ctx.measureText(el.placeholder).width <= avail;
    });
  expect(fits, 'the email placeholder must not clip — the clipped half is the word "optional"').toBe(true);
});

/**
 * 🔴 THE PANEL MUST FIT ON THE SCREEN — THE DIRECTION EVERY OTHER WIDTH
 * ASSERTION IN THIS FILE IS BLIND TO (gy-w77x3 D7, 2026-09-17).
 *
 * The measured-width test above asks whether the field is WIDE ENOUGH, because
 * a too-narrow capture clipped the word "optional" out of the email hint once
 * before. That is one side of a two-sided property, and the D7 captures found
 * the other side: the nav panel rendered from -20px to 395px on a 375px phone —
 * forty pixels wider than the screen, fields cut off at BOTH edges — and every
 * test in this file passed, because a panel that is too wide is comfortably
 * wide enough.
 *
 * The cause is worth stating because it will recur: the panel reclaims the page
 * gutter with `-mx-5` and `w-[calc(100%+40px)]`, and for an ABSOLUTELY
 * POSITIONED panel that percentage resolves against the nearest positioned
 * ancestor — the sticky <nav> — not against the box its padding came from.
 * Same class as everything else on this bead: a value computed against a
 * different frame than the one it is read in.
 *
 * So this measures every cluster's revealed panel against the viewport itself.
 * Verified red before it was trusted: with the pre-fix nav geometry restored it
 * reports nav at -20..395 and fails.
 */
test('every revealed capture fits inside the viewport (the too-wide direction)', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  const vw = page.viewportSize()!.width;

  const offenders: string[] = [];
  const measured: string[] = [];
  for (const loc of ['hero', 'gallery', 'nav', 'pricing', 'footer'] as const) {
    const cta = page.locator(`[data-cta="waitlist"][data-cta-location="${loc}"]`).first();
    // 🔴 THE STICKY BAR IS PHONE-ONLY, AND ITS ABSENCE MUST NOT LOOK LIKE A
    // PASS. Two things were wrong in the first version of this loop: it clicked
    // the bar blindly and hung for 30s on desktop, and the obvious guard —
    // count() === 0 — does not work, because `md:hidden` is display:none and
    // the element is still IN THE DOM at desktop width. Visibility is the
    // question being asked, so visibility is what is measured. Absence is
    // allowed for exactly one control at exactly one width; anything else
    // absent is a failure, because a control that vanished is the silent
    // revert this file exists to catch.
    if (!(await cta.isVisible())) {
      expect(
        loc === 'footer' && vw >= 768,
        `${loc} has no VISIBLE CTA on this viewport (${vw}px) — only the phone-only sticky bar may be hidden, and only on desktop`,
      ).toBe(true);
      continue;
    }
    measured.push(loc);
    await cta.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    await cta.click();
    await page.waitForTimeout(400);
    const box = await page
      .locator('[role="group"][aria-label="Request access"]')
      .first()
      .evaluate((el) => {
        const r = el.getBoundingClientRect();
        return { left: Math.round(r.left), right: Math.round(r.right) };
      });
    // A half-pixel of subpixel rounding is not an overflow; 2px of slack keeps
    // this a report of real overhang rather than of layout arithmetic.
    if (box.left < -2 || box.right > vw + 2) offenders.push(`${loc}: ${box.left}..${box.right} (viewport 0..${vw})`);
    await page.reload();
    await page.waitForLoadState('networkidle');
  }

  // Positive control: naming which clusters were actually measured turns a
  // vacuous pass (every locator missing, nothing measured, green) into a
  // failure.
  //
  // 🔴 BUT IT IS NOT THE ASSERTION THAT FIRES FIRST, AND I ONLY KNOW THAT
  // BECAUSE I PRODUCED THE STATE INSTEAD OF REASONING ABOUT IT (designer's R-C
  // step 3, 2026-09-18). Mutating forge-ui so no control renders data-cta
  // "waitlist" at all, the failure comes from the PER-CLUSTER VISIBILITY guard
  // above — "hero has no VISIBLE CTA on this viewport" — which is strictly
  // better, because it names the cluster. This count never got the chance.
  //
  // It is kept, not deleted, because it covers a DIFFERENT broken state the
  // visibility guard permits by design: every cluster legitimately skipped (all
  // hidden at desktop width) would walk the loop to the end with nothing
  // measured and pass. Recorded so the next reader does not credit this line
  // with catching the empty-page case — that one belongs to the guard above.
  expect(measured.length, 'positive control: at least four clusters must have been measured').toBeGreaterThanOrEqual(4);

  expect(
    offenders,
    'a capture that hangs off the screen edge has its fields cut, and no width assertion that only checks for "wide enough" can see it',
  ).toEqual([]);
});

/**
 * 🔴 THE WRAPPED SET IS PINNED AS A SET, NOT AS A LIST OF CASES — gy-becxi
 * follow-up, 2026-09-12.
 *
 * The per-cluster tests above prove that each cluster they NAME reveals. They
 * say nothing about a cluster nobody remembered to name: forgetting to wrap one
 * degrades it silently to the pre-gy-becxi scroll behaviour, which is the defect
 * this bead exists to remove.
 *
 * waitlistReveal.ts used to claim that "tests/inline-waitlist.test.mjs pins the
 * wrapped set by reading the sources". THAT FILE NEVER EXISTED — the claim was
 * written alongside the intent and the control was never built, so the silence
 * it described as bounded was in fact unbounded. This is that control, and it
 * reads the SERVED MARKUP rather than the sources: a source grep would pass on a
 * wrapper that renders but fails to provide the context, which is the failure
 * most worth catching.
 *
 * It asserts an EXACT map, and BOTH failure directions are demonstrated, not
 * assumed:
 *   · a cluster that LOSES its wrapper -> gallery flips "reveal" to "scroll" and
 *     this fails. That is the silent revert, and it is the one worth catching.
 *   · a NEW CTA at a valid location, unwrapped -> an extra key appears
 *     ("cta-section": "scroll") and this fails.
 *
 * 🔴 WHAT THIS TEST DOES *NOT* CONTROL, stated so nobody credits it with more
 * than it does: a CTA at an UNKNOWN location cannot reach this assertion at all,
 * because CtaLocation (forge-ui.tsx) is a CLOSED UNION and tsc rejects it first.
 * My first attempt at the second direction used location="selftestprobe" and the
 * test PASSED — not because the test is weak, but because the probe was a type
 * error, the build never emitted it, and I was measuring a stale dist. The type
 * system owns that direction; this test owns the two above. A control's claimed
 * scope has to match its demonstrated scope, which is the whole reason the
 * comment this replaces was wrong.
 */
test('the reveal/scroll behaviour of EVERY waitlist CTA on / is pinned as a set', async ({ page }) => {
  await page.goto('/');
  const EXPECTED: Record<string, 'reveal' | 'scroll'> = {
    hero: 'reveal',
    gallery: 'reveal',
    // gy-w77x3 D1 — the mobile sticky bar reveals too, and its panel opens
    // UPWARD. It was the one control gy-becxi deliberately skipped, because a
    // panel below a fixed viewport-bottom bar renders off-screen; that is a
    // different shape, not a different decision.
    footer: 'reveal',
    // gy-w77x3 D3 — the two hand-styled "Request access" buttons (formerly "Get Gymbo"). These read
    // 'scroll' until 2026-09-16 with a comment saying the ruling waited on AC1
    // (which control Damini actually tapped). D5 retired that dependency: if
    // every waitlist control reveals AND shares one label, whichever one she
    // tapped is fixed. So this is now a RULING, not a recorded non-decision.
    nav: 'reveal',
    pricing: 'reveal',
  };
  const found = await page.evaluate(() =>
    Object.fromEntries(
      [...document.querySelectorAll('[data-cta="waitlist"]')].map((el) => [
        el.getAttribute('data-cta-location'),
        el.getAttribute('data-cta-behaviour'),
      ]),
    ),
  );
  expect(
    found,
    'every waitlist CTA on / must have a DECLARED behaviour. A new location here means someone added a CTA without deciding whether it reveals; an absent one means a cluster lost its wrapper and silently reverted to scrolling.',
  ).toEqual(EXPECTED);
});

/**
 * gy-w77x3 AC4 — no waitlist-opening "Request access" button on / may be untracked.
 *
 * The set test above cannot see this: it keys on location, so ONE tracked
 * pricing button hides any number of untracked siblings. This counts every
 * visible-label match instead, and requires the untracked count to be zero
 * with at least one match found (so an empty page cannot pass it).
 *
 * gy-7vbmn renamed the nav and pricing buttons from "Get Gymbo" to "Request
 * access", which is ALSO the label of the form's own submit button. The submit
 * button is deliberately not a waitlist CTA (it submits; it opens nothing), so
 * the label alone no longer identifies the set. The PROPERTY is: a "Request
 * access" button OUTSIDE a <form> opens or scrolls to the waitlist, and must be
 * tracked. The exclusion gets its own positive control, so a page where the
 * form vanished cannot pass by excluding nothing.
 */
test('every "Request access" button outside a form on / is a tracked waitlist CTA', async ({ page }) => {
  await page.goto('/');
  const { openers, submits, untracked } = await page.evaluate(() => {
    const labelled = [...document.querySelectorAll('button')].filter((b) => b.textContent?.trim() === 'Request access');
    const openers = labelled.filter((b) => !b.closest('form'));
    return {
      openers: openers.length,
      submits: labelled.filter((b) => b.closest('form')).length,
      untracked: openers
        .filter((b) => b.getAttribute('data-cta') !== 'waitlist' || !b.getAttribute('data-cta-location'))
        .map((b) => b.outerHTML.slice(0, 120)),
    };
  });
  expect(openers, 'positive control: the page must actually contain Request access buttons outside a form').toBeGreaterThan(1);
  expect(submits, 'positive control for the exclusion: the form submit button must exist, or excluding it proves nothing').toBeGreaterThan(0);
  expect(untracked, 'a Request access button fires no waitlist_cta_click, so the funnel numbers silently exclude it').toEqual([]);
});

// The attributes above are a label; this proves the click EMITS. umami is absent
// off production hostnames (#110), so it is stubbed to record calls.
test('clicking nav and pricing "Request access" emits waitlist_cta_click with its location', async ({ page }) => {
  await page.addInitScript(() => {
    (window as any).__tracked = [];
    (window as any).umami = { track: (name: string, data: unknown) => (window as any).__tracked.push({ name, data }) };
  });
  await page.goto('/');
  await page.locator('[data-cta="waitlist"][data-cta-location="nav"]').click();
  // Since gy-w77x3 the nav REVEALS an overlay panel, which on a phone covers
  // the page below it -- including this pricing button. Close it the way a
  // visitor would (B2) before tapping on; the tracking under test is unchanged.
  await page.keyboard.press('Escape');
  await page.locator('[data-cta="waitlist"][data-cta-location="pricing"]').first().click();
  const tracked = await page.evaluate(() => (window as any).__tracked);
  expect(tracked).toEqual([
    { name: 'waitlist_cta_click', data: { location: 'nav' } },
    { name: 'waitlist_cta_click', data: { location: 'pricing' } },
  ]);
});
