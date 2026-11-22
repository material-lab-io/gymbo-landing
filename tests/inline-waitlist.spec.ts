import { test, expect } from '@playwright/test';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openWaitlistForm } from './helpers/waitlist';

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
    const form = await openWaitlistForm(page);
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
const EMAIL_ERR = "That email doesn't look right. Check for typos, then try again.";
const EMAIL_ERR_WITH_PHONE = "That email doesn't look right. Fix it, or clear it and we'll use your WhatsApp number.";
for (const [label, fill] of [
  ['a@b', { email: 'a@b' }],
  ['a@gmail', { email: 'a@gmail' }],
  // Refused by the browser's own type=email check unless the form is noValidate; now OUR text must show for it too.
  ['a@gmail,com', { email: 'a@gmail,com' }],
] as const) {
  test(`malformed email is refused at the form, no request sent: ${label} (gy-e60uc.2)`, async ({ page }) => {
    await page.goto('/');
    const posts: string[] = [];
    await page.route('**/api/waitlist', async (route) => {
      posts.push(route.request().url());
      await route.fulfill({ status: 200, body: '{}' });
    });
    const form = await openWaitlistForm(page);
    await form.locator('input[type="email"]').fill(fill.email);
    await form.locator('button[type="submit"]').click();
    await expect(form.getByRole('alert')).toHaveText(EMAIL_ERR);
    await expect(form.locator('input[type="email"]')).toHaveAttribute('aria-invalid', 'true');
    // Focus lands on the field to fix, and NOTHING the visitor typed is cleared (content's ruling).
    await expect(form.locator('input[type="email"]')).toBeFocused();
    await expect(form.locator('input[type="email"]')).toHaveValue(fill.email);
    // Give a wrongly-permitted request time to happen before asserting it did not.
    await page.waitForTimeout(400);
    expect(posts, 'a malformed email must not be posted').toEqual([]);
    await expect(page.getByRole('status').filter({ hasText: /request received/i })).toHaveCount(0);
    // Editing the field clears the error, like the needs-contact one.
    await form.locator('input[type="email"]').fill('a@b.co');
    await expect(form.getByRole('alert')).toHaveCount(0);
  });
}

/**
 * gy-sl9amm (founder, 24 Oct 2026): ANY ONE contact field is enough. A malformed email must not hold up a visitor who
 * gave a number (this reverses the gy-e60uc.2 "still refused with a phone" case), and the stray email is NOT posted.
 * Symmetric for a too-short number next to a good email. A lone bad value is still refused inline. Dotted emails post.
 * /api/waitlist is stubbed with a 200: no row is created.
 */
for (const [label, fill, expectPost, successText] of [
  ['bad email + phone -> phone only', { email: 'a@b', phone: '9876543210' }, { email: '', phone: '9876543210' }, /whatsapp you/i],
  ['dotted email only', { email: 'servant.id@gmail.com' }, { email: 'servant.id@gmail.com', phone: '' }, /check your inbox/i],
  ['phone only', { phone: '9876543210' }, { email: '', phone: '9876543210' }, /whatsapp you/i],
  ['both', { email: 'servant.id@gmail.com', phone: '9876543210' }, { email: 'servant.id@gmail.com', phone: '9876543210' }, /check your inbox/i],
  ['short phone + good email -> email only', { email: 'a.b@c.co', phone: '123' }, { email: 'a.b@c.co', phone: '' }, /check your inbox/i],
] as const) {
  test(`any one contact field is enough: ${label} (gy-sl9amm)`, async ({ page }) => {
    await page.goto('/');
    const bodies: any[] = [];
    await page.route('**/api/waitlist', async (route) => {
      bodies.push(route.request().postDataJSON());
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });
    const form = await openWaitlistForm(page);
    if ('email' in fill) await form.locator('input[type="email"]').fill(fill.email);
    if ('phone' in fill) await form.locator('input[type="tel"]').fill(fill.phone);
    await form.locator('button[type="submit"]').click();
    await expect(page.getByRole('status').filter({ hasText: successText })).toBeVisible();
    expect(bodies).toHaveLength(1);
    expect(bodies[0]).toMatchObject(expectPost);
  });
}

test('a lone too-short phone is refused inline, nothing posted (gy-sl9amm)', async ({ page }) => {
  await page.goto('/');
  const posts: string[] = [];
  await page.route('**/api/waitlist', async (route) => { posts.push(route.request().url()); await route.fulfill({ status: 200, body: '{}' }); });
  const form = await openWaitlistForm(page);
  await form.locator('input[type="tel"]').fill('123');
  await form.locator('button[type="submit"]').click();
  await expect(form.getByRole('alert')).toHaveText("That number looks too short. Check it, or add an email instead.");
  await expect(form.locator('button[type="submit"]')).toBeEnabled();
  await page.waitForTimeout(300);
  expect(posts).toEqual([]);
});

// The server applies the same rule. If it refuses an address the form let through, the visitor sees the SAME
// inline text (never a status code or the server's wording); any other failure keeps the old error + mailto.
for (const [label, phone, expected] of [
  ['email only', '', EMAIL_ERR],
  ['email and phone', '9876543210', EMAIL_ERR_WITH_PHONE],
] as const) {
  test(`a server refusal of the email shows the same inline text (${label}) (gy-e60uc.2)`, async ({ page }) => {
    await page.goto('/');
    await page.route('**/api/waitlist', (route) => route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'valid email required' }) }));
    const form = await openWaitlistForm(page);
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
  const form = await openWaitlistForm(page);
  await form.locator('input[type="email"]').fill('a@b.co');
  await form.locator('button[type="submit"]').click();
  await expect(form.getByText(/that didn't send\. what you typed is still here/i)).toBeVisible();
  // gy-sl9amm: a failed send is announced to a screen reader, like the validation errors are.
  await expect(form.getByRole('alert')).toContainText(/that didn't send/i);
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
      const form = await openWaitlistForm(page);
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
      // BREATHING ROOM (designer, on the live build): "visible" is not enough. On a 900px desktop the error used to
      // end at y=900, flush against the viewport edge with its descenders touching it, which reads as cut off. The
      // last pixel of the error must clear whatever is below it (the viewport edge, or the sticky bar on a phone)
      // by at least 16px.
      const errBox = (await alert.boundingBox())!;
      const clearance = Math.min(barTop, vh) - (errBox.y + errBox.height);
      expect(clearance, `the error has only ${clearance.toFixed(1)}px between it and the ${barTop < vh ? 'sticky bar' : 'viewport bottom'}; it reads as cut off below 16px`).toBeGreaterThanOrEqual(16);
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
  ['the iPhone FAQ panel', async (page: import('@playwright/test').Page) => openWaitlistForm(page)],
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

/**
 * gy-e60uc.7 focus ruling (pm 23:11Z): on ANY refused submit, focus moves to the FIRST field the error is about, so
 * a keyboard or screen-reader user lands where the fix is. An empty submit is about the contact PAIR, and the first
 * contact field is the WhatsApp phone field. Before this, focus stayed on the submit button that had just been
 * clicked, leaving nowhere to act. document.activeElement is asserted (a focus RING is not drawn for a pointer
 * click, so "is there a ring" would say nothing). /api/waitlist is intercepted: no row, nothing sent.
 */
for (const [label, fill, expectedField] of [
  ['an empty submit', {}, 'phone'],
  ['a malformed email', { email: 'a@b' }, 'email'],
] as const) {
  test(`focus lands on the first field the error is about after ${label} (gy-e60uc.7)`, async ({ page }) => {
    await page.route('**/api/waitlist', (route) => route.fulfill({ status: 200, body: '{}' }));
    await page.goto('/');
    const form = await openWaitlistForm(page);
    if ('email' in fill) await form.locator('input[type="email"]').fill(fill.email);
    if ('phone' in fill) await form.locator('input[type="tel"]').fill(fill.phone);
    await form.locator('button[type="submit"]').click();
    await expect(form.getByRole('alert')).toBeVisible();
    const active = await page.evaluate(() => {
      const a = document.activeElement as HTMLElement | null;
      return a ? { tag: a.tagName.toLowerCase(), name: a.getAttribute('name') } : null;
    });
    expect(active, `focus after ${label} should be on the "${expectedField}" input, not on ${JSON.stringify(active)}`).toEqual({ tag: 'input', name: expectedField });
  });
}

/**
 * gy-sl9amm — Kaushik 24 Oct 2026 11:46 IST: "they couldn't just enter the phone number and sign up anyway ... they
 * should be allowed to optionally enter any field and sign up." This REPLACES the gy-e60uc.7 case "a malformed email
 * WITH a phone => error + focus on the email", which encoded the gy-e60uc.2 ruling that the founder reversed. A
 * malformed email next to a valid number now submits PHONE-ONLY: success is shown, no error, no focus trap, and the
 * stray email is not posted.
 * PLANTED CONTROL: the second test is the old dead-end's input with NO phone. It must still be refused with focus on
 * the email and NO post, so the first test cannot pass by accepting everything, and reinstating the old rule (refuse
 * with a phone) turns the first test RED (no post, an alert instead of the success line).
 */
test('a malformed email WITH a phone submits phone-only: no error, no focus trap (gy-sl9amm, supersedes gy-e60uc.7 case)', async ({ page }) => {
  const bodies: any[] = [];
  await page.route('**/api/waitlist', async (route) => { bodies.push(route.request().postDataJSON()); await route.fulfill({ status: 200, body: '{}' }); });
  await page.goto('/');
  const form = await openWaitlistForm(page);
  await form.locator('input[type="email"]').fill('a@b');
  await form.locator('input[type="tel"]').fill('9876543210');
  await form.locator('button[type="submit"]').click();
  await expect(page.getByRole('status').filter({ hasText: /whatsapp you/i })).toBeVisible();
  await expect(page.getByRole('alert').filter({ hasText: /doesn't look right/i })).toHaveCount(0);
  expect(bodies).toHaveLength(1);
  expect(bodies[0]).toMatchObject({ email: '', phone: '9876543210' });
});

test('PLANTED CONTROL: the same malformed email with NO phone is still refused, focus on the email, no post (gy-sl9amm)', async ({ page }) => {
  const posts: string[] = [];
  await page.route('**/api/waitlist', async (route) => { posts.push(route.request().url()); await route.fulfill({ status: 200, body: '{}' }); });
  await page.goto('/');
  const form = await openWaitlistForm(page);
  await form.locator('input[type="email"]').fill('a@b');
  await form.locator('button[type="submit"]').click();
  await expect(form.getByRole('alert')).toBeVisible();
  await expect(form.locator('input[type="email"]')).toBeFocused();
  await expect(form.locator('button[type="submit"]')).toBeEnabled();
  await page.waitForTimeout(300);
  expect(posts).toEqual([]);
});

test('after an empty submit the visitor can type straight into the focused field (gy-e60uc.7)', async ({ page }) => {
  await page.route('**/api/waitlist', (route) => route.fulfill({ status: 200, body: '{}' }));
  await page.goto('/');
  const form = await openWaitlistForm(page);
  await form.locator('button[type="submit"]').click();
  await expect(form.getByRole('alert')).toBeVisible();
  await page.keyboard.type('9876543210');
  await expect(form.locator('input[type="tel"]')).toHaveValue('9876543210');
  // Typing clears the error, as it does today.
  await expect(form.getByRole('alert')).toHaveCount(0);
});

/**
 * gy-e60uc.7 / gy-e60uc.3 (designer): NO ONE-WORD ORPHAN. At 375px the hint broke "...either one is / enough." and the
 * empty-submit error broke "...so we can reach / you.": a second line of a single short word, centred under the form.
 * text-wrap: balance moves WHERE the break falls (the wording is content's and is untouched). This measures the actual
 * rendered lines of each text and requires the last line to be at least 40% as wide as the widest one; an orphan is
 * ~10-15%. Measured from Range client rects, so it sees the wrap the visitor sees, not the CSS that was written.
 */
async function lineWidths(loc: import('@playwright/test').Locator) {
  return loc.evaluate((el) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    const byTop = new Map<number, { l: number; r: number }>();
    for (const r of Array.from(range.getClientRects())) {
      if (r.width < 1) continue;
      const k = Math.round(r.top);
      const cur = byTop.get(k);
      byTop.set(k, cur ? { l: Math.min(cur.l, r.left), r: Math.max(cur.r, r.right) } : { l: r.left, r: r.right });
    }
    return [...byTop.entries()].sort((a, b) => a[0] - b[0]).map(([, v]) => Math.round(v.r - v.l));
  });
}
for (const [what, trigger, target] of [
  ['the contact hint', 'idle', 'hint'],
  ['the empty-submit error', 'empty', 'alert'],
  ['the malformed-email error', 'bad-email', 'alert'],
] as const) {
  test(`${what} has no one-word orphan at 375px (gy-e60uc.7)`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'the orphan is a narrow-phone wrap');
    await page.setViewportSize({ width: 375, height: 740 });
    await page.route('**/api/waitlist', (route) => route.fulfill({ status: 200, body: '{}' }));
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const form = await openWaitlistForm(page);
    if (trigger === 'bad-email') await form.locator('input[type="email"]').fill('a@b');
    if (trigger !== 'idle') await form.locator('button[type="submit"]').click();
    const el = target === 'hint' ? form.getByText('Add a WhatsApp number or an email: either one is enough.') : form.getByRole('alert');
    await expect(el).toBeVisible();
    const widths = await lineWidths(el);
    expect(widths.length, `${what} rendered no lines`).toBeGreaterThan(0);
    if (widths.length > 1) {
      const widest = Math.max(...widths);
      const last = widths[widths.length - 1];
      expect(last / widest, `${what} wraps into lines of ${JSON.stringify(widths)}px: the last is only ${Math.round((last / widest) * 100)}% of the widest, an orphan`).toBeGreaterThanOrEqual(0.4);
    }
  });
}


test('the error is named as the description of the field it is about (gy-e60uc.7)', async ({ page }) => {
  await page.route('**/api/waitlist', (route) => route.fulfill({ status: 200, body: '{}' }));
  await page.goto('/');
  const form = await openWaitlistForm(page);
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
  const form = await openWaitlistForm(page);
  await form.locator('input[type="email"]').fill('first.last+tag@sub.example.co.in');
  await form.locator('button[type="submit"]').click();
  await expect.poll(() => posts.length).toBe(1);
  await expect(page.getByRole('status').filter({ hasText: /request received/i })).toHaveText('Request received. Check your inbox for a confirmation.');
});

test('the phone field says WhatsApp, and keeps "phone" in its accessible name (gy-e60uc.3)', async ({ page }) => {
  await page.goto('/');
  await openWaitlistForm(page);
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
  const form = page.locator('[role="group"][aria-label="Request access"]').first().locator('form');
  await form.locator('button[type="submit"]').click();
  await expect(form.getByRole('alert')).toHaveText('Nothing to reach you on yet. Add a WhatsApp number or an email.');
});











