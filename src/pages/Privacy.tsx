import { PageShell, Prose } from "../components/PageShell";

/* getgymbo.com/privacy — Privacy Policy (gy-k2543.1). Honest v1 reflecting
   actual data practices; review with counsel before scale. */
export function Privacy() {
  return (
    <PageShell>
      <Prose
        title="Privacy policy"
        updated="Last updated 25 July 2026"
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
            <li><strong>Website analytics.</strong> Privacy-friendly, cookieless analytics (Umami) on getgymbo.com — aggregate page views and events, with no personal profiles and no cross-site tracking.</li>
            <li><strong>Product analytics in the app.</strong> We record how the app is used — screens opened, features used, and errors — with PostHog. So we can tell one trainer's sessions apart, this includes <strong>your own</strong> name and phone number as your account identifier, plus, when an action is about a client, the class or payment amount involved — never anything that identifies that client. Your clients' names, phone numbers, contact details, notes, and internal IDs are never sent. You control this under Settings → Privacy; when it is off, we send no usage events and none of your name, phone number, or activity — the app does still briefly contact PostHog's servers at launch to fetch configuration, which shares your device's IP address but no personal or usage data.</li>
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
          <p>We do not sell your data. We share it only with service providers who help us run Gymbo — our cloud database and hosting (Supabase), sign-in (Google), analytics (Umami on the website, PostHog in the app), and the AI providers described below — under appropriate confidentiality terms, and where required by law. <strong>We never contact your clients.</strong></p>
        </section>

        <section className="flex flex-col gap-3">
          <h2>AI features and the providers behind them</h2>
          <p>Some Gymbo features are powered by specialist AI providers. When you use these features, data needed to provide the feature is sent to the provider. Here is who we use, for what, and the data involved.</p>

          <h3>AI assistant (chat) — Anthropic (Claude)</h3>
          <ul>
            <li><strong>What it does:</strong> answers your questions about your business inside the app.</li>
            <li><strong>What we send:</strong> your typed question, recent conversation history, and current business context such as trainer details, client counts and balances, schedules, and business metrics. Depending on your question, the assistant can use tools that return relevant client records; that can include the active client roster.</li>
            <li><strong>Per-client control:</strong> marking a client as opted out excludes them from automatic context and tool lookups. Text you enter yourself, including a question or conversation history, may still refer to that client.</li>
            <li><strong>Where it's processed:</strong> Anthropic may process commercial API data in the United States, Europe, Asia, and Australia. Its standard storage location is the United States unless an account is configured otherwise.</li>
          </ul>

          <h3>Voice input — Groq</h3>
          <ul>
            <li><strong>What it does:</strong> turns what you speak into text (speech-to-text) so you can add notes and fill fields by voice instead of typing.</li>
            <li><strong>What we send:</strong> the microphone audio you record for that action, which is converted to text.</li>
            <li><strong>A note on sensitive data:</strong> voice notes can sometimes include health-related details about a client. Please avoid dictating information you would not want processed by a third-party provider.</li>
            <li><strong>Where it's processed:</strong> Groq's provider documentation describes United States storage. We do not state an exclusive processing location or a retention commitment here because we do not have an account-specific provider record for either claim.</li>
          </ul>

          <h3>The rest of our infrastructure</h3>
          <ul>
            <li><strong>Supabase</strong> — hosts our database, sign-in, and backend services. Your clients, schedule, payments, and attendance records are stored here, on infrastructure located outside India, in Singapore.</li>
            <li><strong>Google</strong> — used only for Google Sign-In, if you choose it, to authenticate your account.</li>
            <li><strong>PostHog</strong> — product analytics. The iOS app sends this to PostHog's European Union region, so that data is processed in the EU. A data-processing agreement with PostHog is in place.</li>
          </ul>

          <p>You can ask us at any time what data we hold and request its deletion — see "Your choices" below.</p>
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
          <p>Gymbo is operated from India, and your data may be processed there and by our service providers outside India. Specifically: your account and app data are stored in <strong>Singapore</strong> (Supabase); the AI features described above are processed in the <strong>United States</strong> (Anthropic, Groq); app usage analytics are processed in the <strong>European Union</strong> from the iOS app (PostHog); and login SMS is sent from <strong>India</strong> (MSG91).</p>
        </section>

        <section className="flex flex-col gap-3">
          <h2>Changes to this policy</h2>
          <p>If we make material changes, we'll update this page and the date above. Please check back from time to time.</p>
        </section>

        <section className="flex flex-col gap-3">
          <h2>Contact</h2>
          <p>Questions about your privacy? Email <a href="mailto:damini@materiallab.io">damini@materiallab.io</a>.</p>
          <p
            dangerouslySetInnerHTML={{
              __html:
                'To raise a privacy question or grievance, contact Kaushik at <!--email_off--><a href="mailto:grievance@getgymbo.com">grievance@getgymbo.com</a><!--/email_off-->. We aim to respond within 30 days.',
            }}
          />
        </section>
      </Prose>
    </PageShell>
  );
}
