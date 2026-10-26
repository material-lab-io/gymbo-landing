import { PageShell, Prose } from "../components/PageShell";

/* getgymbo.com/founding-partner-terms (gm-39e / gy-l6hra.10). Text is contractbot's
   ML-TRM-GYMBO-2026-001 v1.3.1 part B, verbatim. Legal text: do not reword; copy
   questions go to contractbot. Unlisted: noindex, out of the sitemap, no nav link. */
export function FoundingPartnerTerms() {
  return (
    <PageShell>
      <Prose
        title="Gymbo Founding Design Partner: full terms"
        intro="Issued by Material Lab Private Limited, the company that builds and runs Gymbo (GSTIN 29AAUCM0118Q1ZQ, Bengaluru, India). Signed for Material Lab by Damini Rathi. You don't sign anything. These terms cover your card, your code and your 6 months of Gymbo Pro."
      >
        <section className="flex flex-col gap-3">
          <h2>What you get</h2>
          <ul>
            <li>6 months of Gymbo Pro, free. The 6 months start the day you redeem your code. We will tell you where and how. Your code works once.</li>
            <li>No payment and no card details. Nothing turns into a paid plan on its own. Before your 6 months end, we'll tell you your options. You only pay if you choose to.</li>
            <li>The code is yours alone. It can't be sold, passed on or swapped for cash.</li>
          </ul>
        </section>

        <section className="flex flex-col gap-3">
          <h2>What we ask in return</h2>
          <ul>
            <li>One genuine collab reel about Gymbo, posted within one month of the issue date on your card. Your honest view, in your own words. We won't script it or ask to approve it.</li>
            <li>Post it as a collab with Gymbo, or label it clearly, for example &quot;Collab with Gymbo&quot; at the start of the caption. Indian advertising rules (ASCI) ask for this whenever something is given for a post.</li>
            <li>If there is no reel within the month, we may end your Pro early. Tell us if something gets in the way and we'll work it out with you.</li>
            <li>We may reshare your reel and credit you. Ask us to stop and we'll stop new reshares.</li>
            <li>Keep unreleased features private. Please don't share screenshots or details of features we haven't announced. Once a feature is public, this no longer applies. You're always free to say you use Gymbo.</li>
          </ul>
        </section>

        <section className="flex flex-col gap-3">
          <h2>Testing phase</h2>
          <ul>
            <li>Features may change, move or be removed, and things can break.</li>
            <li>Gymbo is provided as it is while we test. Keep your own copy of anything you can't afford to lose. We'll tell you before any planned data reset and give you a way to export first.</li>
          </ul>
        </section>

        <section className="flex flex-col gap-3">
          <h2>Your clients' data</h2>
          <ul>
            <li>You choose what client details to add, and you confirm your clients agreed to it. Add only what you need, and take extra care with health details.</li>
            <li>We use it only to run Gymbo for you, under the Gymbo privacy policy (<a href="/privacy/">getgymbo.com/privacy</a>). We don't sell it. It stays yours to export or delete.</li>
          </ul>
        </section>

        <section className="flex flex-col gap-3">
          <h2>Ending it</h2>
          <ul>
            <li>You can stop using Gymbo at any time.</li>
            <li>We may cancel a code if it's misused (shared, sold, or used to harm Gymbo or other users) or under the reel term above. We'll tell you why and give you 30 days to export your data.</li>
          </ul>
        </section>

        <section className="flex flex-col gap-3">
          <h2>Fine print</h2>
          <ul>
            <li>These terms sit alongside the Gymbo terms of service (<a href="/terms/">getgymbo.com/terms</a>). Where the two differ, these terms apply to your 6 months.</li>
            <li>If we change these terms, we'll tell you first. A change can't shorten your 6 months.</li>
            <li>Governed by the laws of India, courts at Bengaluru. If something goes wrong, write to us first and we'll try to sort it out within 30 days.</li>
            <li>Questions: <a href="mailto:damini@materiallab.io">damini@materiallab.io</a>. Privacy concerns: <a href="mailto:damini@materiallab.io">damini@materiallab.io</a> or <a href="mailto:kaushik@materiallab.io">kaushik@materiallab.io</a>.</li>
          </ul>
        </section>

        <p className="text-[13px]">Terms version 1.3.2, 26 October 2026.</p>
      </Prose>
    </PageShell>
  );
}
