import { PageShell, Prose } from "../components/PageShell";

/* getgymbo.com/terms — Terms of Service (gy-k2543.1). Honest v1; review with
   counsel before scale. */
export function Terms() {
  return (
    <PageShell>
      <Prose
        title="Terms of service"
        updated="Last updated 24 July 2026"
        intro="These terms govern your use of Gymbo, made by Material Lab. By using Gymbo, you agree to them."
      >
        <section className="flex flex-col gap-3">
          <h2>Agreement</h2>
          <p>By creating an account or using Gymbo, you agree to these terms. If you don't agree, please don't use the service.</p>
        </section>

        <section className="flex flex-col gap-3">
          <h2>The service</h2>
          <p>Gymbo is software for independent personal trainers to log sessions, track payments and balances, schedule, and manage their clients. It's available on iOS and is in active development, so features may be added, changed, or removed.</p>
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
          <p>Your first 7 days are free. After that, plans are: Monthly at ₹399/month (billed monthly); and Annual at ₹2,999 per year (₹250/month effective). Subscriptions are billed in advance and renew until you cancel. You can cancel anytime, and access continues until the end of your paid period. Prices may change, with notice. Gymbo records the payments you log between you and your clients — it does not process those payments or handle your money.</p>
        </section>

        <section className="flex flex-col gap-3">
          <h2>Your data</h2>
          <p>Your data is yours. We don't claim ownership of it; you grant us only the limited rights needed to operate the service for you. How we handle data is described in our <a href="/privacy/">Privacy Policy</a>.</p>
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
