import { PageShell, Prose } from "../components/PageShell";

/* getgymbo.com/terms — Terms of Service (gy-k2543.1). Honest v1; review with
   counsel before scale. */
export function Terms() {
  return (
    <PageShell>
      <Prose
        title="Terms of service"
        updated="Last updated 22 November 2026"
        intro="These terms govern your use of Gymbo, made by Material Lab. By using Gymbo, you agree to them."
      >
        <section className="flex flex-col gap-3">
          <h2>Agreement</h2>
          <p>By creating an account or using Gymbo, you agree to these terms. If you don't agree, please don't use the service.</p>
        </section>

        <section className="flex flex-col gap-3">
          <h2>The service</h2>
          <p>Gymbo is software for independent personal trainers to punch classes, track payments and balances, schedule, and manage their clients. It's available on iPhone and on the web at app.getgymbo.com, and is in active development, so features may be added, changed, or removed.</p>
        </section>

        <section className="flex flex-col gap-3">
          <h2>Your account</h2>
          <p>You're responsible for your account and for keeping your sign-in secure. Please give accurate information and let us know if you suspect any unauthorised use.</p>
        </section>

        <section className="flex flex-col gap-3">
          <h2>Your responsibilities</h2>
          <ul>
            <li>You're responsible for the client information you enter, and for having any consent or lawful basis needed to store and use it.</li>
            <li>Use Gymbo lawfully. Don't attempt to break, overload, or reverse-engineer the service, and don't resell or misuse it.</li>
          </ul>
        </section>

        <section className="flex flex-col gap-3">
          <h2>Plans and payment</h2>
          <p>Gymbo is free to start. On the Free plan you can view and export your data. Gymbo Pro lets you add and edit your clients and use the rest of the app. There is no free trial on the web: you choose Pro when you want it, and you pay then.</p>
          <p>Gymbo Pro costs ₹399 per month or ₹2,999 per year (₹250 per month effective), both including GST. On the web you pay through Razorpay. On iPhone, the App Store takes the payment and handles billing under Apple's terms, including any introductory offer Apple shows you when you subscribe. Subscriptions are billed in advance and renew until you cancel. On the web, cancel anytime in Settings. On iPhone, cancel in your Apple ID subscriptions. Access continues until the end of the period you have paid for. Prices may change, with notice.</p>
          <p>Gymbo records the payments you log between you and your clients. It does not process those payments or handle your money.</p>
        </section>

        <section className="flex flex-col gap-3">
          <h2>Your data</h2>
          <p>Your data is yours. We don't claim ownership of it; you grant us only the limited rights needed to operate the service for you. How we handle data is described in our <a href="/privacy/">Privacy Policy</a>.</p>
        </section>

        {/* gy-93n31 — the licence the research page's Dataset structured data cites
            (license -> https://getgymbo.com/terms/#research). Founder decision: ALL
            RIGHTS RESERVED, not Creative Commons. Placed directly AFTER "Your data" on
            purpose: that clause says we don't claim ownership of data, and a reader
            arriving from the Dataset link must not take it as the licence for what WE
            publish. Wording by content (accepted by pm, legal-accuracy read by
            compliance); the two em dashes in the draft became sentence breaks per the
            gy-pkioo voice cleanup of this page, no words changed. The id is load-bearing:
            renaming it silently breaks the structured-data citation. */}
        <section id="research" className="flex flex-col gap-3">
          <h2>Research and published content</h2>
          <p>Reports, articles, and datasets we publish on getgymbo.com are © Material Lab, with all rights reserved. That's different from your client data, which we don't claim any ownership of. See Your data, above.</p>
          <p>You're welcome to quote briefly, with attribution and a link back to the source page. Please don't republish, redistribute, or build derivative datasets from what we publish without asking us first. Email <a href="mailto:damini@materiallab.io">damini@materiallab.io</a>.</p>
        </section>

        <section className="flex flex-col gap-3">
          <h2>Availability</h2>
          <p>Gymbo is provided on an "as is" and "as available" basis. We work hard to keep it reliable, but we can't guarantee it will always be uninterrupted or error-free, and features may change as the product evolves.</p>
        </section>

        <section className="flex flex-col gap-3">
          <h2>Liability</h2>
          <p>To the maximum extent permitted by law, Gymbo and Material Lab are not liable for indirect, incidental, or consequential damages, and our total liability is limited to the amount you paid us in the twelve months before the claim.</p>
        </section>

        <section className="flex flex-col gap-3">
          <h2>Termination</h2>
          <p>You can stop using Gymbo at any time. We may suspend or end access if these terms are breached.</p>
        </section>

        <section className="flex flex-col gap-3">
          <h2>Changes to these terms</h2>
          <p>We may update these terms. If we make material changes, we'll update this page and the date above; continuing to use Gymbo means you accept the updated terms.</p>
        </section>

        <section className="flex flex-col gap-3">
          <h2>Governing law</h2>
          <p>These terms are governed by the laws of India.</p>
        </section>

        <section className="flex flex-col gap-3">
          <h2>Contact</h2>
          <p>Questions about these terms? Email <a href="mailto:damini@materiallab.io">damini@materiallab.io</a>.</p>
        </section>
      </Prose>
    </PageShell>
  );
}
