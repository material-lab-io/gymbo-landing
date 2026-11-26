// gy-sk86p2.2 (web_designer): the GYMBO hero Damini approved on the test link (rounds 5-9, 26 Nov), as the home page's hero slot.
// Look: GYMBO word behind the photo phone, tagline split either side of the phone, body + CTAs bottom-left, the phone rises on scroll
// (GSAP ScrollTrigger, bundled = self-hosted), a RetailX-style light sweep on the phone (retailx-wordpress
// wp-content/plugins/retailx-landing/site/sections/outcomes9/section.css, o9sheen), the app playing inside the phone
// (public/hero/screen-loop.*: the screen of assets-src/demos/punch-class-dark.mp4, perspective-mapped), and the photo ending on black
// before the next section (H1, H3). Every layout value is fixed in CSS (no measuring script, no layout shift); --u = 1/1440 of the width
// on laptops and 1/390 on phones, so the composition scales with the window.
// prefers-reduced-motion: no rise, no sweep, no moving word; the screen shows one still frame.
// Strings: src/content/home.ts (HOME.hero); the tagline halves are HOME.hero.title.left / .right, set either side of the phone.
import { useEffect, useRef } from "react";
import { WhatsAppCTA, StartFreeCTA } from "../forge-ui";
import { HOME } from "../content/home";

// Photo box and screen box in photo pixels (photo.webp is 1504 x 1002). Screen box from the homography fit (screen-box2.json, 26 Nov).
const SCREEN = { left: 35.9707, top: 2.5948, width: 19.6809, height: 78.4431 };

const CSS = `
.gh{--u:calc(100vw / 1440);position:relative;z-index:1;background:#0f0f0f;color:#fff;height:calc(1208*var(--u));overflow-x:clip;overflow-y:visible}
.gh-first{position:relative;height:calc(828*var(--u))}
.gh-stage{position:absolute;inset:0;overflow:visible}
.gh-photo,.gh-fg{position:absolute;left:calc(15.899*var(--u));top:calc(211.72*var(--u));width:calc(1440*var(--u));height:calc(959.36*var(--u));will-change:transform;backface-visibility:hidden}
.gh-photo img,.gh-fg img{display:block;width:100%;height:100%}
.gh-photo{-webkit-mask-image:linear-gradient(transparent,#000 calc(150*var(--u)),#000 calc(100% - calc(170*var(--u))),transparent),linear-gradient(90deg,transparent,#000 calc(110*var(--u)),#000 calc(100% - calc(110*var(--u))),transparent);-webkit-mask-composite:source-in;mask-image:linear-gradient(transparent,#000 calc(150*var(--u)),#000 calc(100% - calc(170*var(--u))),transparent),linear-gradient(90deg,transparent,#000 calc(110*var(--u)),#000 calc(100% - calc(110*var(--u))),transparent);mask-composite:intersect}
.gh-fg{z-index:3;pointer-events:none}
.gh-fg img{filter:drop-shadow(0 calc(26*var(--u)) calc(34*var(--u)) rgba(0,0,0,.78)) drop-shadow(0 0 calc(22*var(--u)) rgba(0,0,0,.7))}
.gh-scr{position:absolute;left:${SCREEN.left}%;top:${SCREEN.top}%;width:${SCREEN.width}%;height:${SCREEN.height}%;object-fit:fill;will-change:transform;-webkit-mask:url(/hero/screen-mask.png) 0 0/100% 100% no-repeat;mask:url(/hero/screen-mask.png) 0 0/100% 100% no-repeat}
.gh-shine{position:absolute;inset:0;overflow:hidden;-webkit-mask:url(/hero/phone.webp) 0 0/100% 100% no-repeat;mask:url(/hero/phone.webp) 0 0/100% 100% no-repeat}
.gh-shine::before{content:"";will-change:transform;position:absolute;top:0;bottom:0;left:0;width:40%;background:linear-gradient(105deg,transparent,rgb(255 255 255 / .26) 50%,transparent);transform:translateX(-120%);animation:gh-sheen 7s cubic-bezier(.22,.9,.3,1) infinite 1.2s}
@keyframes gh-sheen{0%{transform:translateX(-120%)}16%{transform:translateX(260%)}100%{transform:translateX(260%)}}
html.gh-scrolling .gh-shine{visibility:hidden}
.gh-word{font-family:"Open Sans",system-ui,sans-serif;font-weight:800;line-height:1;white-space:nowrap;color:#fff;background:radial-gradient(ellipse 62% 150% at 50% -25%,#ffffff 0%,#f4f4f4 42%,#b4b4b4 100%);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
.gh-big{position:absolute;z-index:2;margin:0;left:calc(38.246*var(--u));top:calc(-45.9722*var(--u));font-size:calc(355.08*var(--u))}
.gh-mq{display:none}
.gh-h1{position:absolute;z-index:4;margin:0;left:0;top:calc(292*var(--u));width:100%;font-family:"Open Sans",system-ui,sans-serif;font-weight:400;text-transform:uppercase;line-height:1.1;letter-spacing:0;font-size:calc(52.201*var(--u));text-shadow:0 1px 12px rgba(0,0,0,.85)}
.gh-h1 span{position:absolute;top:0;white-space:nowrap}
.gh-ta{left:calc(50.7799*var(--u))} .gh-tb{left:calc(875.041*var(--u))}
.gh-col{position:absolute;z-index:4;left:calc(56*var(--u));bottom:calc(40*var(--u));width:calc(420*var(--u))}
.gh-body{margin:0;font-family:"Open Sans",system-ui,sans-serif;font-size:calc(24*var(--u));line-height:1.4;font-weight:600;max-width:calc(380*var(--u));text-shadow:0 1px 12px rgba(0,0,0,.9),0 0 3px rgba(0,0,0,.8)}
.gh-dock{display:flex;gap:14px;margin-top:calc(24*var(--u))}
.gh-dock > a{white-space:nowrap}
.gh-dock .gh-ghost{background:rgba(15,15,15,.86)}
@keyframes gh-slide{from{transform:translateX(0)}to{transform:translateX(-50%)}}
@media (max-width:820px){
 .gh{--u:calc(100vw / 390);height:auto;overflow:visible}
 .gh-first{height:auto;min-height:calc(100svh - 72px);display:flex;flex-direction:column}
 .gh-h1{position:relative;order:0;top:auto;padding:calc(18*var(--u)) calc(24*var(--u)) 0;font-size:calc(17.7991*var(--u));text-shadow:none;white-space:nowrap}
 .gh-h1 span{position:static}
 .gh-stage{position:relative;inset:auto;order:1;width:100%;height:calc(500*var(--u));overflow:hidden;-webkit-mask-image:linear-gradient(#000 calc(100% - calc(70*var(--u))),transparent);mask-image:linear-gradient(#000 calc(100% - calc(70*var(--u))),transparent)}
 .gh-big{display:none}
 .gh-mq{display:block;position:absolute;z-index:2;left:calc(12*var(--u));top:calc(-10*var(--u))}
 .gh-track{display:flex;width:max-content;animation:gh-slide 16s linear infinite;will-change:transform}
 .gh-track span{font-size:calc(180*var(--u));padding-right:calc(64*var(--u))}
 .gh-photo,.gh-fg{left:calc(-135.18*var(--u));top:calc(74*var(--u));width:calc(705.38*var(--u));height:calc(469.94*var(--u))}
 .gh-photo{-webkit-mask-image:linear-gradient(transparent,#000 calc(40*var(--u)),#000 calc(100% - calc(60*var(--u))),transparent);mask-image:linear-gradient(transparent,#000 calc(40*var(--u)),#000 calc(100% - calc(60*var(--u))),transparent)}
 .gh-fg img{filter:drop-shadow(0 calc(12*var(--u)) calc(16*var(--u)) rgba(0,0,0,.78)) drop-shadow(0 0 calc(10*var(--u)) rgba(0,0,0,.7))}
 .gh-col{position:static;order:2;width:auto;flex:1;display:flex;flex-direction:column;justify-content:flex-end;padding:calc(36*var(--u)) calc(24*var(--u)) calc(24*var(--u))}
 .gh-body{font-size:calc(16*var(--u));max-width:none;text-shadow:none}
 .gh-dock{margin-top:calc(20*var(--u));gap:10px}
}
@media (prefers-reduced-motion:reduce){.gh-track{animation:none}.gh-shine{display:none}}
`;

export function HomeHero({ prefersReduced }: { prefersReduced: boolean }) {
  const root = useRef<HTMLElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const { left, right } = HOME.hero.title;
  const word = HOME.hero.word ?? "GYMBO";

  // Reduced motion: the screen loop stays on its poster (a content frame); otherwise it plays.
  useEffect(() => {
    const v = video.current;
    if (!v) return;
    if (prefersReduced) { v.pause(); return; }
    v.play().catch(() => { /* autoplay refused: the poster stays */ });
  }, [prefersReduced]);

  // The sweep repaints the masked phone layer every frame, so it hides while the page scrolls.
  useEffect(() => {
    if (prefersReduced) return;
    const h = document.documentElement;
    let t: ReturnType<typeof setTimeout> | undefined;
    const on = () => { h.classList.add("gh-scrolling"); clearTimeout(t); t = setTimeout(() => h.classList.remove("gh-scrolling"), 250); };
    addEventListener("scroll", on, { passive: true });
    return () => { removeEventListener("scroll", on); clearTimeout(t); h.classList.remove("gh-scrolling"); };
  }, [prefersReduced]);

  // The rise: photo + phone move up as the page scrolls through the hero (scrubbed). GSAP loads only when motion is allowed.
  useEffect(() => {
    if (prefersReduced || !root.current) return;
    let undo = () => {};
    let gone = false;
    import("./heroMotion").then(({ heroRise }) => { if (!gone && root.current) undo = heroRise(root.current); });
    return () => { gone = true; undo(); };
  }, [prefersReduced]);

  return (
    <header ref={root} data-testid="hero-section" className="gh">
      <style>{CSS}</style>
      <div className="gh-first">
        <div className="gh-stage">
          <p className="gh-big gh-word" aria-hidden="true">{word}</p>
          <div className="gh-mq" aria-hidden="true"><div className="gh-track"><span className="gh-word">{word}</span><span className="gh-word">{word}</span></div></div>
          <div className="gh-photo"><img src="/hero/photo.webp" alt={HOME.hero.deviceAlt} width={1504} height={1002} decoding="async" {...{ fetchpriority: "high" as const }} /></div>
          <div className="gh-fg" aria-hidden="true">
            <img src="/hero/phone.webp" alt="" width={1504} height={1002} decoding="async" />
            <video ref={video} className="gh-scr" muted loop playsInline autoPlay={!prefersReduced} preload="metadata" poster="/hero/screen-poster.jpg" width={296} height={786}>
              <source src="/hero/screen-loop.webm" type="video/webm" />
              <source src="/hero/screen-loop.mp4" type="video/mp4" />
            </video>
            {prefersReduced ? null : <div className="gh-shine" />}
          </div>
        </div>
        <h1 className="gh-h1"><span className="gh-ta">{left}</span>{right ? " " : null}{right ? <span className="gh-tb">{right}</span> : null}</h1>
        <div className="gh-col">
          <p className="gh-body">{HOME.hero.sub.lead}{HOME.hero.sub.rest}</p>
          <div className="gh-dock">
            <StartFreeCTA size="lg" position="hero" />
            <WhatsAppCTA dark size="lg" location="hero" variant="secondary" glyph={false} className="gh-ghost">{HOME.hero.talk}</WhatsAppCTA>
          </div>
        </div>
      </div>
    </header>
  );
}
