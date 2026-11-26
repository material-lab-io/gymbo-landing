// gy-sk86p2.2: GSAP + ScrollTrigger for the hero rise, in one module that HomeHero imports dynamically, so GSAP ships in its own
// chunk (not in assets/index.js, a registered price surface: minified GSAP names such as "Power4,rs" read as a price there).
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export function heroRise(el: HTMLElement): () => void {
  const ctx = gsap.context(() => {
    const mm = gsap.matchMedia();
    mm.add({ desk: "(min-width: 821px)", phone: "(max-width: 820px)" }, (c) => {
      const desk = Boolean(c.conditions?.desk);
      const u = document.documentElement.clientWidth / (desk ? 1440 : 390);
      gsap.to(el.querySelectorAll(".gh-photo, .gh-fg"), {
        y: -(desk ? 150 : 64) * u, ease: "none",
        scrollTrigger: { trigger: el, start: "top top", end: desk ? `+=${828 * u}` : "+=600", scrub: 0.4, invalidateOnRefresh: true },
      });
    });
  }, el);
  return () => ctx.revert();
}
