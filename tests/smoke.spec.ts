import { test, expect } from '@playwright/test';

/**
 * Smoke + Wave 3 acceptance [F] for getgymbo.com.
 * Runs on both the `desktop` and `mobile` (Pixel 5) projects (see playwright.config.ts).
 * Covers: page renders / no JS errors, nav + hero, pricing, waitlist CTA, footer,
 * plus the current static product imagery and no layout break.
 * There is no theme toggle and no second palette (gy-uesmd, founder ruling 2026-08-12).
 * The HOME page is one black since Damini's 26 Nov round 2 (gy-sk86p2.3); the other pages stay light.
 */

const IGNORE = [
  'analytics.getgymbo.com',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'favicon',
  'og-image',
  'Failed to load resource',
  'net::ERR',
];

test('page renders with no JS errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (IGNORE.some((s) => text.includes(s))) return;
    errors.push(`console: ${text}`);
  });

  await page.goto('/');
  await expect(page).toHaveTitle(/gymbo/i);
  await page.waitForTimeout(800);
  expect(errors, errors.join('\n')).toEqual([]);
});

test('nav and hero render with the headline', async ({ page }) => {
  await page.goto('/');
  const nav = page.getByRole('navigation', { name: 'Main navigation' });
  await expect(nav).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Start free', exact: true })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Log in', exact: true })).toBeVisible();

  // gy-w7x93: this used to pin the words "fitness business" / "from your phone".
  // Hero copy is content-owned and was rewritten by the claim-truth pass
  // (gm-muo, ac308f4), so the assertion went red the first time CI ever ran this
  // file — and a test pinned to superseded copy defends the old wording (rule 15).
  // Wording facts are gated by copy-facts.spec.ts. What THIS test can honestly
  // pin is structure: exactly one h1, on screen, carrying a real sentence.
  const h1 = page.locator('h1');
  await expect(h1).toHaveCount(1);
  // gy-sk86p2.2: the hero sets the h1 in two halves either side of the phone, so the h1 box itself has no height: its halves are what a reader sees.
  for (const half of await h1.locator('span').all()) await expect(half).toBeVisible();
  await expect(h1.locator('span')).toHaveCount(2);
  const headline = ((await h1.textContent()) ?? '').trim();
  expect(headline.length, 'the hero h1 must carry a real headline, not an empty or stub node').toBeGreaterThan(20);
});

// gy-dyu6r.9: the source/dist gate checks exact asset identity; these browser
// assertions prove that all three user-visible slots render the contract.
test('hero and all six gallery screens render approved photoreal device assets', async ({ page }) => {
  await page.goto('/');
  // gy-sk86p2.2: the hero is the approved GYMBO photo with the app playing in the phone (the three-panel art is retired).
  const hero = page.getByTestId('hero-section').locator('.gh-photo img');
  await expect(hero).toBeVisible();
  await expect(hero).toHaveAttribute('src', /\/hero\/photo\.webp/);
  expect(await hero.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);

  const gallery = page.getByTestId('gallery-section').getByTestId('gallery-device-art');
  await expect(gallery).toHaveCount(6);
  for (let index = 0; index < 6; index += 1) {
    const frame = gallery.nth(index);
    await frame.scrollIntoViewIfNeeded();
    await expect(frame.locator('img').last()).toHaveAttribute('src', /iphone-frame-single\.png/);
    await expect.poll(() => frame.locator('img').first().evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);

    const geometry = await frame.evaluate((element) => {
      const aperture = element.querySelector<HTMLElement>('[data-testid="gallery-screen-aperture"]');
      const screen = aperture?.querySelector<HTMLImageElement>('img');
      if (!aperture || !screen) throw new Error('gallery aperture contract missing');
      const style = getComputedStyle(aperture);
      const apertureBox = aperture.getBoundingClientRect();
      const screenBox = screen.getBoundingClientRect();
      return {
        radiusX: Number.parseFloat(style.borderTopLeftRadius.split(' ')[0]),
        radiusY: Number.parseFloat(style.borderTopLeftRadius.split(' ')[1] || style.borderTopLeftRadius),
        expectedRadius: apertureBox.width * 0.1656,
        aperture: { left: apertureBox.left, top: apertureBox.top, right: apertureBox.right, bottom: apertureBox.bottom },
        screen: { left: screenBox.left, top: screenBox.top, right: screenBox.right, bottom: screenBox.bottom },
      };
    });
    expect(Math.abs(geometry.radiusX - geometry.expectedRadius)).toBeLessThan(1);
    expect(Math.abs(geometry.radiusY - geometry.expectedRadius)).toBeLessThan(1);
    expect(geometry.screen.left).toBeGreaterThanOrEqual(geometry.aperture.left - 0.5);
    expect(geometry.screen.top).toBeGreaterThanOrEqual(geometry.aperture.top - 0.5);
    expect(geometry.screen.right).toBeLessThanOrEqual(geometry.aperture.right + 0.5);
    expect(geometry.screen.bottom).toBeLessThanOrEqual(geometry.aperture.bottom + 0.5);
  }
});

// Card art since pm ruling 2 + 13:4xZ on gy-sk86p2.3 (web_designer): the phone only, no headline or caption in the image. Cards 2 and 4
// are dark iOS captures in the photoreal frame; cards 1 (punch-a-class clip) and 3 (branded statement) are demos cropped to the phone.
// gy-v9pwo.4: log-payment's demo (retired claim burned in) stays pulled.
const CROPPED = [['revenue', 'punch-class'], ['brand', 'branded-statement']] as const;
test('every card has phone-only art: two framed captures, and two demos cropped to their phone that play', async ({ page }) => {
  await page.goto('/');
  for (const [id, slug] of [['organized', 'card-week'], ['workouts', 'card-builder']]) {
    const art = page.getByTestId(`pillar-${id}`).getByTestId('gallery-device-art');
    await art.scrollIntoViewIfNeeded();
    await expect(art).toHaveCount(1);
    await expect(art.locator('img').first()).toHaveAttribute('src', `/screens/gallery/${slug}.png`);
    await expect.poll(() => art.locator('img').first().evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);
  }
  await expect(page.getByTestId('pillar-demo')).toHaveCount(2);
  await expect(page.locator('[src*="/demos/log-payment"]')).toHaveCount(0);
  for (const [id, demo] of CROPPED) {
    const crop = page.getByTestId(`pillar-art-crop-${id}`);
    await crop.scrollIntoViewIfNeeded();
    const video = crop.locator('video');
    await expect(video.locator('source')).toHaveAttribute('src', `/demos/${demo}-dark.mp4`);
    const playback = await video.evaluate((v: HTMLVideoElement) => ({ muted: v.muted, loop: v.loop, playsInline: v.playsInline, autoplay: v.autoplay, preload: v.preload }));
    expect(playback).toEqual({ muted: true, loop: true, playsInline: true, autoplay: true, preload: 'metadata' });
    await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.currentTime), { timeout: 10000 }).toBeGreaterThan(0.05);
    // in the 1080 x 1920 scene the burned-in title ends at y 258 and the caption starts at y 1712: neither may be inside the box
    const seen = await crop.evaluate((box) => {
      const b = box.getBoundingClientRect(), s = box.querySelector('video')!.getBoundingClientRect(), k = s.width / 1080;
      return { top: (b.top - s.top) / k, bottom: (b.bottom - s.top) / k };
    });
    expect(seen.top, demo).toBeGreaterThanOrEqual(258);
    expect(seen.bottom, demo).toBeLessThanOrEqual(1712);
  }
});

test('reduced motion renders the cropped card demos as posters without autoplay', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.getByTestId('pillar-demo').locator('video')).toHaveCount(0);
  // gy-sk86p2.2: the hero keeps its <video> element but never plays it: it holds the poster.
  const heroClip = page.getByTestId('hero-section').locator('video');
  await expect(heroClip).toHaveAttribute('poster', '/hero/screen-poster.jpg');
  await expect.poll(() => heroClip.evaluate((v: HTMLVideoElement) => v.paused)).toBe(true);
  const posters = page.getByTestId('pillar-demo-poster');
  await expect(posters).toHaveCount(2);
  for (let i = 0; i < CROPPED.length; i += 1) await expect(posters.nth(i)).toHaveAttribute('src', `/demos/${CROPPED[i][1]}-dark.png`);
  await expect(page.locator('#why [data-testid="gallery-device-art"]')).toHaveCount(2);
});

test('a pre-seeded theme localStorage value is ignored — there is no theme switch (gy-uesmd)', async ({ page }) => {
  // Regression for the founder-visible bug: gy-31moh removed the theme
  // toggle but left the no-flash script + dark palette in place, so anyone
  // with a stale gymbo-theme='dark' from before the toggle was removed got
  // stuck on a dark site with no way to escape it. Both are now deleted
  // outright — getgymbo.com never reads gymbo-theme and never sets
  // data-theme, so a pre-seeded 'dark' value must have zero effect.
  await page.addInitScript(() => localStorage.setItem('gymbo-theme', 'light'));
  await page.goto('/');
  const html = page.locator('html');
  await expect(html).not.toHaveAttribute('data-theme', /.+/);
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(15, 15, 15)'); // the home page's one black (gy-sk86p2.3)
});

// ── Damini round 2 (gy-sk86p2.3, 26 Nov) ─────────────────────────────────────

// Every painted background on the page is dark. A surface counts as light when it is opaque enough to be seen and its luminance is high,
// and it is bigger than a button (the yellow CTAs, the dots and the numerals are accents, not sections).
const lightSections = (page: import('@playwright/test').Page) =>
  page.evaluate(() => {
    const bad: string[] = [];
    for (const el of Array.from(document.querySelectorAll<HTMLElement>('body, body *'))) {
      const m = getComputedStyle(el).backgroundColor.match(/rgba?\(([\d.]+), ([\d.]+), ([\d.]+)(?:, ([\d.]+))?\)/);
      if (!m || Number(m[4] ?? 1) < 0.5) continue;
      const lum = (0.2126 * Number(m[1]) + 0.7152 * Number(m[2]) + 0.0722 * Number(m[3])) / 255;
      const r = el.getBoundingClientRect();
      if (lum > 0.35 && r.width * r.height > 40_000) bad.push(`${el.tagName}.${el.getAttribute('data-testid') ?? ''} ${m[0]}`);
    }
    return bad;
  });

test('round 2: the whole home page is black, with no light section and no features heading', async ({ page }) => {
  await page.goto('/');
  expect(await lightSections(page)).toEqual([]);
  await expect(page.getByText('What your training business runs on.')).toHaveCount(0);
  // control: the detector sees a light section when there is one
  await page.evaluate(() => { (document.querySelector('#faq') as HTMLElement).style.background = '#fafaf7'; });
  expect((await lightSections(page)).join()).toContain('SECTION');
});

test('round 2: four numbered cards in her order, drawn on the dark art, and no ticker', async ({ page }) => {
  await page.goto('/');
  const why = page.locator('#why');
  await expect(why.getByRole('heading', { level: 2 })).toHaveText([
    'Track your revenue', 'Your whole roster in one place', 'Build your brand', 'Build and track workouts',
  ]);
  await expect(why.locator('[data-testid^="pillar-numeral-"]')).toHaveText(['1', '2', '3', '4']);
  for (const id of ['revenue', 'organized', 'brand', 'workouts']) {
    // gy-0ho2lx: a card is drawn on the colour its art was composed on (src/figure-surface.ts), or the figure shows as a box.
    await expect(why.getByTestId(`pillar-${id}`)).toHaveCSS('background-color', 'rgb(10, 10, 10)');
  }
  await expect(page.locator('.marquee-track, [aria-label="Brand touchpoints"]')).toHaveCount(0);
});

// gy-sk86p2.5 (Damini 27 Nov): "come outside of the card top aligned with the number 1, do this for all cards." What can be wrong: the
// title back inside its card or running onto it, beside the wrong side of the number, or not level with the number's visible top.
// "Top" is read from the PAINTED PIXELS (the number's highest lit row against the title's first capital): canvas text metrics passed a
// layout that was 7 px off on screen.
// With the fix the capitals sit 0.6 to 2.7 px under the number top (ascenders about level); the failed layout was 4 to 5 px above.
const CARD_IDS = ['revenue', 'organized', 'brand', 'workouts'];

const placement = (page: import('@playwright/test').Page, id: string) =>
  page.evaluate((id) => {
    const num = document.querySelector<HTMLElement>(`[data-testid="pillar-numeral-${id}"]`)!;
    const title = document.querySelector<HTMLElement>(`[data-testid="pillar-band-${id}"] h2`)!;
    const card = document.querySelector<HTMLElement>(`[data-testid="pillar-${id}"]`)!;
    const t = title.getBoundingClientRect(), n = num.getBoundingClientRect(), k = card.getBoundingClientRect();
    const first = document.createRange();
    first.setStart(title.firstChild!, 0);
    first.setEnd(title.firstChild!, 1);
    const c = first.getBoundingClientRect();
    return {
      inCard: card.contains(title) || t.bottom > k.top + 0.5,
      beside: t.left >= n.right - 0.5,
      inside: t.right <= k.right + 0.5,
      number: { x: n.left, y: n.top + scrollY, width: n.width, height: n.height / 2 },
      capital: { x: c.left, y: t.top + scrollY, width: c.width, height: c.bottom - t.top },
    };
  }, id);

// The page y of the highest lit row inside a box (the page is black; the number and the title are light).
async function inkTop(page: import('@playwright/test').Page, clip: { x: number; y: number; width: number; height: number }) {
  const png = (await page.screenshot({ fullPage: true, clip, scale: 'css', animations: 'disabled' })).toString('base64');
  const row = await page.evaluate(async (data) => {
    const img = new Image();
    img.src = `data:image/png;base64,${data}`;
    await img.decode();
    const canvas = Object.assign(document.createElement('canvas'), { width: img.width, height: img.height });
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    const px = ctx.getImageData(0, 0, img.width, img.height).data;
    for (let i = 0; i < px.length; i += 4) if (0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2] > 90) return Math.floor(i / 4 / img.width);
    return -1;
  }, png);
  return row < 0 ? null : clip.y + row;
}

async function titleProblems(page: import('@playwright/test').Page) {
  const bad: string[] = [];
  for (const id of CARD_IDS) {
    const p = await placement(page, id);
    if (p.inCard) bad.push(`${id}: the title is not above its card`);
    if (!p.beside) bad.push(`${id}: the title is not beside its number`);
    if (!p.inside) bad.push(`${id}: the title runs past the card edge`);
    const title = await inkTop(page, p.capital), number = await inkTop(page, p.number);
    // nothing lit where the letter or the number should be is a problem too, never a pass
    if (title === null || number === null) bad.push(`${id}: nothing is painted for the ${title === null ? 'title' : 'number'}`);
    else if (Math.abs(title - number) > 3.5) bad.push(`${id}: the title top is ${Math.round(title - number)} px from the number top`);
  }
  return bad;
}

test('round 3: every card title is outside its card, top-aligned with its number', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const width of [320, 390, 820, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    // the fixed nav and phone bar would paint over the pixels being read
    await page.addStyleTag({ content: 'nav[aria-label="Main navigation"],[data-fixed-chrome]{visibility:hidden!important}' });
    await page.evaluate(() => document.fonts.ready);
    expect(await titleProblems(page), `card titles at ${width}`).toEqual([]);
  }
  // controls: the detector reports a title that sits 7 px high (the layout web_designer failed), and one pushed onto the card
  await page.addStyleTag({ content: '.gy-title{margin-top:0!important}' });
  expect((await titleProblems(page)).join()).toContain('from the number top');
  await page.addStyleTag({ content: '.gy-card-body{margin-top:-130px}' });
  expect((await titleProblems(page)).join()).toContain('not above its card');
});

test('round 2: the closing line is one line on iPad and desktop', async ({ page }) => {
  for (const width of [768, 820, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    const lines = await page.getByTestId('closing-heading').evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { lines: Math.round(r.height / parseFloat(getComputedStyle(el).lineHeight)), fits: el.scrollWidth <= el.clientWidth + 1 && r.right <= innerWidth };
    });
    expect(lines, `closing line at ${width}`).toEqual({ lines: 1, fits: true });
  }
});

test('round 2: no horizontal scroll, and every control is at least 44 px', async ({ page }) => {
  for (const width of [375, 390, 820, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), `overflow at ${width}`).toBeLessThanOrEqual(0);
    const small = await page.evaluate(() =>
      Array.from(document.querySelectorAll<HTMLElement>('a[href], button, summary'))
        .filter((el) => !el.classList.contains('sr-only') && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden')
        .map((el) => ({ name: (el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 40), r: el.getBoundingClientRect() }))
        .filter(({ r }) => r.width > 1 && (r.width < 43.5 || r.height < 43.5))
        .map(({ name, r }) => `${name} ${Math.round(r.width)}x${Math.round(r.height)}`),
    );
    expect(small, `targets under 44 px at ${width}`).toEqual([]);
  }
});

// R2-E (gy-sk86p2.4): the whole phone, the line and both buttons are on the first screen, under the nav, on iPhone, iPad and laptop.
test('round 2: the hero phone is never cut and both buttons are on the first screen', async ({ page }) => {
  for (const [width, height] of [[390, 844], [768, 1024], [820, 1180], [1024, 1366], [1024, 768], [1180, 820], [1366, 1024], [1280, 720], [1440, 900]]) {
    await page.setViewportSize({ width, height });
    await page.goto('/');
    const r = await page.evaluate((width) => {
      const box = (s: string) => document.querySelector(s)!.getBoundingClientRect();
      const nav = box('nav[aria-label="Main navigation"]'), phone = box('video.gh-scr'), line = box('.gh-body');
      const buttons = Array.from(document.querySelectorAll('.gh-dock > a'), (a) => a.getBoundingClientRect());
      return {
        phone: phone.height > 100 && phone.top >= nav.bottom - 0.5 && phone.bottom <= innerHeight + 0.5 && phone.left >= -0.5 && phone.right <= innerWidth + 0.5,
        line: line.top >= nav.bottom - 0.5 && line.bottom <= innerHeight + 0.5,
        buttons: buttons.length === 2 && buttons.every((b) => b.bottom <= innerHeight + 0.5 && b.right <= innerWidth + 0.5),
        oneLine: width < 600 || Math.abs(buttons[0].top - buttons[1].top) < 1,
      };
    }, width);
    expect(r, `first screen at ${width}x${height}`).toEqual({ phone: true, line: true, buttons: true, oneLine: true });
  }
});

test('round 2: the footer links back to Material Lab', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('footer').getByRole('link', { name: 'Made by Material Lab' })).toHaveAttribute('href', 'https://www.materiallab.io/');
});

test('retired demo-frame badges are absent', async ({ page }) => {
  await page.goto('/');
  // gy-jaooz: "travel-aware" / "AI navigate" badges were removed from the pillar
  // demo artwork; the not-yet-shipped items now live as normal bullets with a
  // "coming soon" tag after the sentence.
  // scoped to the pillars: the hero small print and the iPhone FAQ say "coming soon" about the iPhone app, on purpose (gy-1vd9qy.10.4)
  const why = page.locator('#why');
  await why.scrollIntoViewIfNeeded();
  await expect(page.locator('[data-coming-soon]')).toHaveCount(0);
  await expect(why.getByText(/travel-aware/i)).toHaveCount(0);
  await expect(why.getByText('coming soon')).toHaveCount(0);
});

test('pricing shows the Free and Pro plans and their numbers (option A, no trial)', async ({ page }) => {
  await page.goto('/');
  const pricing = page.locator('#pricing');
  await pricing.scrollIntoViewIfNeeded();
  await expect(pricing.getByRole('heading', { name: 'Free', exact: true })).toBeVisible();
  await expect(pricing.getByRole('heading', { name: 'Pro', exact: true })).toBeVisible();
  // the old Monthly / Annual / Quarterly cards are gone
  for (const gone of ['Monthly', 'Annual', 'Quarterly']) await expect(pricing.getByRole('heading', { name: gone, exact: true })).toHaveCount(0);
  for (const amount of ['₹0', '₹399']) await expect(pricing.getByText(amount, { exact: true })).toBeVisible();
  await expect(pricing.getByText(/₹2,999 a year/)).toBeVisible();
  await expect(pricing.getByText('Pro is paid on the web with Razorpay.')).toBeVisible();
  await expect(pricing.getByText(/trial/i)).toHaveCount(0);
  await expect(pricing.locator('a[data-cta="start-free"]')).toHaveCount(2);
});

test('gallery dots make every product screen reachable, with no "1 of 6" counter', async ({ page }) => {
  await page.goto('/');
  const gallery = page.getByRole('region', { name: 'See Gymbo in action gallery' });
  await gallery.scrollIntoViewIfNeeded();
  const dots = page.getByTestId('gallery-dot');
  await expect(dots).toHaveCount(6);
  await expect(page.getByText(/\b\d of 6\b/).filter({ visible: true })).toHaveCount(0);
  await expect(dots.nth(0)).toHaveAttribute('aria-current', 'true');
  const pageY = await page.evaluate(() => scrollY);
  for (const index of [3, 5, 0]) {
    await dots.nth(index).click();
    await expect(gallery.locator(`[data-gallery-index="${index}"]`)).toBeInViewport({ ratio: 0.9 });
    // the strip's own scroll event must not move the current dot off the one just pressed
    await page.waitForTimeout(300);
    await expect(dots.nth(index)).toHaveAttribute('aria-current', 'true');
    await expect(page.locator('[data-testid="gallery-dot"][aria-current="true"]')).toHaveCount(1);
  }
  await expect(gallery.getByText('Build and assign workouts', { exact: true })).toHaveCount(1);
  expect(Math.abs((await page.evaluate(() => scrollY)) - pageY), 'a dot moves the strip, not the page').toBeLessThan(80);
});

test('the closing CTA section offers Start free and the founder, and carries no form', async ({ page }) => {
  await page.goto('/');
  const cta = page.locator('#cta');
  await cta.scrollIntoViewIfNeeded();
  await expect(cta).toBeVisible();
  await expect(cta.getByRole('link', { name: 'Start free', exact: true })).toBeVisible();
  await expect(cta.getByText(/talk to the founder/i)).toBeVisible();
  await expect(cta.locator('form')).toHaveCount(0);
});

test('footer present, and no web-app references remain', async ({ page }) => {
  await page.goto('/');
  const footer = page.locator('footer');
  await footer.scrollIntoViewIfNeeded();
  await expect(footer.getByText(/2026 Material Lab/i)).toBeVisible();
  await expect(page.locator('a[href="https://app.getgymbo.com"]')).toHaveCount(0);
});

// gy-sk86p2.3 (Damini round 2): "we use Merryweather only for the numbers". Replaces the older rule that the h1 and headings were serif.
test('Merriweather is used for the card numerals only; the hero and every heading are sans', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-testid^="pillar-numeral-"]')).toHaveCount(4);
  await expect(page.getByTestId('hero-section').locator('.gh-body')).toHaveCount(1);
  const serif = await page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>('body *'))
      .filter((el) => el.getClientRects().length > 0 && Array.from(el.childNodes).some((n) => n.nodeType === 3 && n.textContent!.trim()))
      .filter((el) => /^"?Merriweather/i.test(getComputedStyle(el).fontFamily))
      .map((el) => (el.textContent ?? '').trim()),
  );
  expect(serif).toEqual(['1', '2', '3', '4']);
});

/**
 * gy-e9h9y — THE WHATSAPP PRIMARY MUST BE A REAL LINK, NOT A FAKE ONE.
 *
 * 🔴 WHY THIS ASSERTS THE TAG NAME. Every other CTA assertion in this file
 * checks a LABEL. A <button onClick={window.open}> wearing the same amber
 * styling and the same words passes all of them, while breaking cmd/middle-click
 * "open in new tab", right-click "copy link address", and screen-reader
 * announcement — silently, because nothing visible changes.
 *
 * 🔴 AND WHY IT ADDRESSES data-cta, NOT a[href*="wa.me"]. The first version of
 * this test used the href selector and PASSED against a deliberately seeded fake
 * link, because `.first()` matched a DIFFERENT, still-real anchor further down
 * the page (the footer contact link). It was asserting "some wa.me anchor
 * exists" — true both before and after the defect. A control must fire on the
 * specific element under test, or it is measuring something else and reporting
 * it as the thing you asked about.
 *
 * It deliberately does not assert CTA wording: copy PRs #104/#121 are open and
 * this shape composes with whichever lands.
 */
test('the hero WhatsApp CTA is a real anchor, and the hero Start free is a real anchor with a full hit target (gy-e9h9y, option A)', async ({ page }) => {
  await page.goto('/');

  const primary = page.locator('[data-cta="whatsapp"][data-cta-location="hero"]');
  await expect(primary).toHaveCount(1);
  // The discriminating assertion: a fake link would be a BUTTON here.
  expect(await primary.evaluate((el) => el.tagName)).toBe('A');
  await expect(primary).toHaveAttribute('href', /wa\.me/);
  await expect(primary).toHaveAttribute('target', '_blank');
  await expect(primary).toHaveAttribute('rel', 'noopener noreferrer');

  // Start free is the primary: a real link into the app sign-up, never a text link, with a full hit target.
  const start = page.locator('a[data-cta="start-free"][data-cta-position="hero"]');
  await expect(start).toHaveCount(1);
  expect(await start.evaluate((el) => el.tagName)).toBe('A');
  await expect(start).toHaveAttribute('href', 'https://app.getgymbo.com/signup?src=landing');
  const box = await start.boundingBox();
  expect(box, 'Start free must render a real box, not inline text').not.toBeNull();
  expect(box!.height, 'Start free must keep a full-size hit target').toBeGreaterThanOrEqual(44);
});

/**
 * gy-e9h9y — THE TWO WHATSAPP CTAs ON THE HOME PAGE MUST SAY THE SAME THING.
 *
 * The hero read "Talk to us" while the footer read "Talk to the founder": one
 * button, two names, and "us" does not say who answers. Content ruled the label
 * (spec on gy-e9h9y, 2026-09-21). This asserts PARITY, not the wording, on
 * purpose: the words are content-owned and will change again, and pinning them
 * here is what turned two smoke assertions red the first time CI ever ran this
 * file (gy-w7x93). What must never happen is the two drifting apart silently.
 */
test('the hero and footer WhatsApp CTAs carry the same label (gy-e9h9y)', async ({ page }) => {
  await page.goto('/');
  const hero = page.locator('[data-cta="whatsapp"][data-cta-location="hero"]');
  const footer = page.locator('[data-cta="whatsapp"][data-cta-location="cta-section"]');
  // Both must exist, or "equal" below would be comparing two empty locators.
  await expect(hero).toHaveCount(1);
  await expect(footer).toHaveCount(1);
  const label = async (l: typeof hero) => ((await l.textContent()) ?? '').replace(/\s+/g, ' ').trim();
  const heroLabel = await label(hero);
  expect(heroLabel.length, 'the hero WhatsApp CTA must carry a visible label').toBeGreaterThan(0);
  expect(heroLabel).toBe(await label(footer));
});
