import { PageShell, Prose } from "../components/PageShell";

/* getgymbo.com/privacy — Privacy Policy (gy-k2543.1). Honest v1 reflecting
   actual data practices; review with counsel before scale. */
export function Privacy() {
  return (
    <PageShell>
      <Prose
        title="Privacy policy"
        updated="Last updated 15 July 2026"
        intro="Gymbo is made by Material Lab for independent personal trainers in India. This policy explains what we collect, why, and the choices you have. Plain language, no surprises."
      >
        <section className="flex flex-col gap-3">
          <h2>Who we are</h2>
          <p>Gymbo is a product of Material Lab. You can reach us about privacy at <a href="mailto:damini@materiallab.io">damini@materiallab.io</a>. This policy covers the Gymbo iOS app and the getgymbo.com website.</p>
        </section>

        <section className="flex flex-col gap-3">
          <h2>What we collect</h2>
          <ul>
            <li><strong>Your account.</strong> When you sign up as a trainer, the name and the phone number and/or email you use to sign in.</li>
            <li><strong>Data you enter about your clients.</strong> Client names, contact details, the classes you log, and the payments and balances you record. You enter this information, and you decide what to add.</li>
            <li><strong>Waitlist.</strong> If you join the waitlist on getgymbo.com, the name and email you submit.</li>
            <li><strong>Usage analytics.</strong> Privacy-friendly, cookieless analytics (Umami) — aggregate page views and events, with no personal profiles and no cross-site tracking.</li>
            <li><strong>Technical data.</strong> Standard logs (such as IP address and device or browser type) used to keep the service secure and working.</li>
          </ul>
        </section>

        <section className="flex flex-col gap-3">
          <h2>How we use it</h2>
          <p>To provide and operate Gymbo, maintain your account, respond to support requests, improve the product, keep it secure, and tell you about the service. If you joined the waitlist, we use your email to let you know when it's your turn and share launch updates.</p>
        </section>

        <section className="flex flex-col gap-3">
          <h2>Payments</h2>
          <p>Gymbo helps you <strong>record</strong> the payments your clients make to you (cash or UPI) and keeps the running balance for your bookkeeping. Gymbo does not process payments, move money, or store card or bank details — the payment happens directly between you and your client.</p>
        </section>

        <section className="flex flex-col gap-3">
          <h2>How we share it</h2>
          <p>We do not sell your data. We share it only with service providers who help us run Gymbo (for example, our cloud database, hosting, analytics, and the AI providers described below), under appropriate confidentiality terms, and where required by law. <strong>We never contact your clients.</strong></p>
        </section>

        <section className="flex flex-col gap-3">
          <h2>AI features and the providers behind them</h2>
          <p>Some Gymbo features are powered by third-party AI providers. When you use one of these features, we send only the limited data needed to do the work — nothing more:</p>
          <ul>
            <li><strong>Anthropic (Claude)</strong> powers the in-app AI assistant you can chat with. When you ask it something, we send your question, a short summary of up to five of your clients (their names and class counts, so the assistant has useful context), and the results of any action it takes for you. We do not send your whole client list, and any client you have marked as opted out of AI is left out entirely. This is processed in the United States.</li>
            <li><strong>Groq</strong> powers voice input — when you speak to Gymbo instead of typing, your microphone audio is sent to Groq to turn it into text. Because voice notes can sometimes mention health-related details, we treat this as sensitive information. This is processed in the United States.</li>
          </ul>
          <p><strong>Your control.</strong> You can turn off AI for any individual client. When you do, that client's information is never sent to these providers.</p>
          <p><strong>Retention and training.</strong> We are finalising formal data-processing agreements with Anthropic and Groq. We will update this notice with their specific retention and no-training commitments once those agreements are in force. Until then, these providers process your data only to deliver the feature under their standard commercial terms.</p>
        </section>

        <section className="flex flex-col gap-3">
          <h2>Your clients' information</h2>
          <p>The client records you enter are yours. We process them on your behalf so the app can work. You are responsible for having a lawful basis and any consent needed to store and use your clients' information in Gymbo.</p>
        </section>

        <section className="flex flex-col gap-3">
          <h2>Storage and security</h2>
          <p>Your data is stored on reputable cloud infrastructure, and we use reasonable technical and organisational measures to protect it. No method of storage or transmission is ever 100% secure, but we work to keep your data safe.</p>
        </section>

        <section className="flex flex-col gap-3">
          <h2>Keeping and deleting your data</h2>
          <p>We keep your data while your account is active. You can export your data from the app at any time, and you can ask us to delete your account. After deletion we remove or anonymise your data within a reasonable period, except where we must keep some records to meet legal obligations.</p>
        </section>

        <section className="flex flex-col gap-3">
          <h2>Your choices</h2>
          <p>You can access, correct, export, or delete your data — in the app or by emailing us. If you're on the waitlist and don't want our emails, you can unsubscribe at any time.</p>
        </section>

        <section className="flex flex-col gap-3">
          <h2>Children</h2>
          <p>Gymbo is for professional trainers and is not directed to children. Please don't use Gymbo if you are under 18.</p>
        </section>

        <section className="flex flex-col gap-3">
          <h2>Where we operate</h2>
          <p>Gymbo is operated from India, and your data may be processed there and by our service providers.</p>
        </section>

        <section className="flex flex-col gap-3">
          <h2>Changes to this policy</h2>
          <p>If we make material changes, we'll update this page and the date above. Please check back from time to time.</p>
        </section>

        <section className="flex flex-col gap-3">
          <h2>Contact</h2>
          <p>Questions about your privacy? Email <a href="mailto:damini@materiallab.io">damini@materiallab.io</a>.</p>
        </section>
      </Prose>
    </PageShell>
  );
}
