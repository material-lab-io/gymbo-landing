// gy-sk86p2.2: GSAP + ScrollTrigger for the hero rise, in one module that HomeHero imports dynamically, so neither is in
// assets/index.js (a registered price surface). GSAP itself builds into assets/vendor-gsap-<hash>.js (vite.config.ts).
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export function heroRise(el: HTMLElement): () => void {
  const ctx = gsap.context(() => {
    const mm = gsap.matchMedia();
    mm.add({ desk: "(min-width: 600px) and (orientation: landscape)", tab: "(min-width: 600px) and (orientation: portrait)", phone: "(max-width: 599px)" }, (c) => {
      const k = c.conditions?.desk ? "desk" : c.conditions?.tab ? "tab" : "phone";
      // One unit = the hero's own layout unit (HomeHero CSS --u): the composition box width / its unit width.
      const first = el.querySelector<HTMLElement>(".gh-first");
      const u = k === "phone" ? document.documentElement.clientWidth / 390 : (first?.offsetWidth ?? 0) / (k === "desk" ? 1440 : 820);
      gsap.to(el.querySelectorAll(".gh-photo, .gh-fg"), {
        y: -(k === "phone" ? 64 : 120) * u, ease: "none",
        scrollTrigger: { trigger: el, start: "top top", end: k === "phone" ? "+=600" : `+=${(k === "desk" ? 828 : 1056) * u}`, scrub: 0.4, invalidateOnRefresh: true },
      });
    });
  }, el);
  return () => ctx.revert();
}
