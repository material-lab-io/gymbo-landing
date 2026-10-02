import { PageShell } from "../components/PageShell";
import { ResourceLeadForm } from "../components/ResourceLeadForm";
import { F, SERIF, SANS } from "../forge-ui";

// getgymbo.com/resources/workout-builder-starter-pack — Resource 1 of marketer's free-resource
// funnel (gy-35awp), implementing gy-hqvr4. Copy is FINAL v7/v6 from gy-wymhs (content,
// 2026-09-10, with the four 2026-09-24 em-dash-free replacements) — do not reword without a new
// content ruling on that bead.
//
// NOT YET PUBLIC: gy-674s8 (the privacy notice does not yet describe this capture) is open, and
// AC5 requires a PM head-SHA authorization before this route goes live. This file exists for
// branch review (designer + tester), not for deploy.
export function ResourceWorkoutBuilderStarterPack() {
  return (
    <PageShell>
      <main id="main" className="max-w-[1100px] mx-auto px-5 md:px-12 py-16 md:py-24 flex flex-col gap-16">
        <section className="flex flex-col md:flex-row gap-12 items-start">
          <div className="flex-1 flex flex-col gap-5">
            <h1
              className="text-[32px] md:text-[44px] leading-tight font-bold"
              style={{ fontFamily: SERIF, color: F.ink }}
            >
              Free Workout Builder Starter Pack
            </h1>
            <p className="text-[17px] md:text-[19px]" style={{ fontFamily: SANS, color: F.inkMuted }}>
              868 exercises with step-by-step instructions, ready to build your own client sessions from.
            </p>

            <ul className="flex flex-col gap-3 mt-2">
              {[
                "868 exercises with step-by-step instructions and images.",
                "Built on the same exercise library that powers the Gymbo app.",
                "No card, no signup fee. Just your email.",
                "First in a set of free tools for independent trainers.",
              ].map((line) => (
                <li key={line} className="flex items-start gap-2 text-[15px]" style={{ fontFamily: SANS, color: F.ink }}>
                  <span aria-hidden="true" style={{ color: F.amber }}>
                    ✓
                  </span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>

          <div
            className="w-full md:w-[440px] flex-shrink-0 rounded-2xl p-6 md:p-8"
            style={{ background: F.charcoal }}
          >
            <ResourceLeadForm />
          </div>
        </section>

        <section
          className="rounded-2xl p-6 md:p-8 text-[15px]"
          style={{ background: F.beigeCard, color: F.inkMuted, fontFamily: SANS }}
        >
          <p>
            Want to run these with your client roster, payments and reminders in one place? Gymbo is in
            private alpha.{" "}
            <a href="/#waitlist" style={{ color: F.amberText, fontWeight: 600, textDecoration: "underline" }}>
              Request access
            </a>
            .
          </p>
        </section>
      </main>
    </PageShell>
  );
}
