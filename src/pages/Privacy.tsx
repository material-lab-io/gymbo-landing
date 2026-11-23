import { PageShell, Prose } from "../components/PageShell";

/* getgymbo.com/privacy — Privacy Policy (gy-k2543.1). Honest v1 reflecting
   actual data practices; review with counsel before scale. */
export function Privacy() {
  return (
    <PageShell>
      <Prose
        title="Privacy policy"
        updated="Last updated 23 November 2026"
        intro="Gymbo is made by Material Lab for independent personal trainers in India. This policy explains what we collect, why, and the choices you have. Plain language, no surprises."
      >
        <section className="flex flex-col gap-3">
          <h2>Who we are</h2>
          <p>Gymbo is a product of Material Lab. You can reach us about privacy at <a href="mailto:damini@materiallab.io">damini@materiallab.io</a>. This policy covers the Gymbo iOS app, the Gymbo web app (app.getgymbo.com), and the getgymbo.com website.</p>
        </section>

        <section className="flex flex-col gap-3">
          <h2>What we collect</h2>
          <ul>
            <li><strong>Your account.</strong> When you sign up as a trainer, the name and the phone number and/or email you use to sign in.</li>
            <li><strong>How you found us.</strong> If you arrive from a link or campaign, we record which one (a short source or campaign code, or a referral code) when you create your account. We use it to count where sign-ups come from and to credit referrals. It holds no free text, no URL and no contact details. We keep it until you delete your account.</li>
            <li><strong>Shared invoice links.</strong> When a trainer sends a client an invoice link, anyone who has the link can open a page with the trainer's name, the client's first name, the invoice number, the dates, the items and amounts, and what is still due. It shows no phone number, email or notes, and needs no sign-in. The link stops working after 30 days, when the trainer sends a new link or cancels it, or when the trainer deletes the client or their own account. Gymbo does not count or track who opens it.</li>
            <li><strong>Messages when you leave Pro.</strong> When you cancel Pro you can send Kaushik, the founder, a short message about what was missing. We keep the message and your account ID for up to 12 months, then delete them, or sooner if you delete your account. We use the message only to improve Gymbo.</li>
            <li><strong>Data you enter about your clients.</strong> Client names, contact details, notes and goals, the classes you punch, and the payments and balances you record. You enter this information, and you decide what to add.</li>
            <li><strong>Waitlist and access requests.</strong> If you join the waitlist or request access on getgymbo.com, the name and the phone number and/or email you submit.</li>
            <li><strong>Website analytics.</strong> Privacy-friendly, cookieless analytics (Umami) on getgymbo.com: aggregate page views and events, with no personal profiles and no cross-site tracking.</li>
            <li><strong>Product analytics in the app.</strong> We record how the app is used (screens opened, features used, and errors) with PostHog. So we can tell one trainer's sessions apart, this includes a stable user ID for your Gymbo account, plus <strong>your own</strong> name and phone number, and, when an action is about a client, figures such as the payment amount, the number of classes added, or the class balance left, but never anything that identifies that client. Your clients' names, phone numbers, contact details, notes, and internal IDs are never sent. You control this under Settings → Privacy; when it is off, we send no usage events and none of your name, phone number, or activity. The app does still briefly contact PostHog's servers at launch to fetch configuration, which shares your device's IP address but no personal or usage data.</li>
            <li><strong>Technical data.</strong> Standard logs (such as IP address and device or browser type) used to keep the service secure and working.</li>
            {/* DEPENDANT: the takedown form (functions/m/takedown.js, gy-wwr2e.57) points readers HERE for
                how service logs treat their IP address. Do not remove or reword this item so that it
                stops naming IP address; tests/cross-page-references.test.mjs enforces it. */}
          </ul>
        </section>

        <section className="flex flex-col gap-3">
          <h2>How we use it</h2>
          <p>To provide and operate Gymbo, maintain your account, respond to support requests, improve the product, keep it secure, and tell you about the service. If you joined our waitlist or asked for access, we use your email to tell you about Gymbo and to share launch updates, and you can unsubscribe at any time.</p>
        </section>

        <section className="flex flex-col gap-3">
          <h2>Payments</h2>
          <p>Gymbo helps you <strong>record</strong> the payments your clients make to you (cash or UPI) and keeps the running balance for your bookkeeping. Gymbo does not process payments, move money, or store card or bank details. The payment happens directly between you and your client. This is about the payments between you and your clients. Gymbo Pro, our own subscription, is paid separately: see "Payments for Gymbo Pro" below.</p>
        </section>

        <section className="flex flex-col gap-3">
          <h2>Payments for Gymbo Pro</h2>
          <ul>
            <li><strong>What it does:</strong> takes your payment when you subscribe to Gymbo Pro on the web. Razorpay's checkout window opens over the page. You enter your card, UPI or bank details there. Gymbo does not see or store them.</li>
            <li><strong>What we send:</strong> your Gymbo account ID and the plan you chose. Razorpay also gets your payment and contact details straight from you, and your device's IP address when the checkout window opens.</li>
            <li><strong>What we keep:</strong> the plan, its status, the renewal dates (and, for App Store subscribers, the end date of any introductory offer), and Razorpay's subscription ID, with your account. We delete them when your account is deleted.</li>
            <li><strong>What Razorpay keeps:</strong> Razorpay keeps its own payment records under its own <a href="https://razorpay.com/privacy/" rel="noopener noreferrer">privacy policy</a> and the rules that apply to it. Cancelling or deleting your Gymbo account stops future charges. It does not erase those records.</li>
          </ul>
        </section>

        <section className="flex flex-col gap-3">
          <h2>How we share it</h2>
          <p>We do not sell your data. We share it only with service providers who help us run Gymbo: our cloud database and hosting (Supabase), email delivery (Resend), sign-in (Google), payment collection for Gymbo Pro on the web (Razorpay), analytics (Umami on the website, PostHog in the app), and the AI providers described below, under appropriate confidentiality terms, and where required by law. <strong>Gymbo does not send messages to your clients.</strong></p>
        </section>

        <section className="flex flex-col gap-3">
          <h2>AI features and the providers behind them</h2>
          <p>Some Gymbo features are powered by specialist AI providers. When you use these features, a limited amount of your data is sent to the provider so they can return a result. We only send what the feature needs, not your whole client list. Here is exactly who we use, for what, and what we send them.</p>

          <h3>Ask Gymbo (AI chat): Anthropic (Claude)</h3>
          <ul>
            <li><strong>What it does:</strong> answers your questions about your business inside the app.</li>
            <li><strong>What we send:</strong> your typed question, and a short summary of your business that goes with every question. The summary has your name and business name, how many clients you have, your top five clients by balance (name and classes left), how many clients are overdue, the client names on your schedule for today and the next six days, your collections and attendance totals for the last seven days, and the notes you asked Gymbo to remember. It is the same on every question. If you use the microphone in Ask Gymbo, your speech is first turned into text by Groq (see Voice input: Groq) and then sent as your question.</li>
            <li><strong>What Gymbo reads when a question needs more:</strong> while it answers, Gymbo reads from your account a client's name, balance, rate, amount due and recent payments (dates and amounts), your schedule, your totals, and your profile. It reads only what the question needs, and a single lookup is limited to 25 clients. It does not read client phone numbers, client notes, health records or photos. When you ask Gymbo to make a change, such as adding a client or recording a payment, it sends the details of that change.</li>
            <li><strong>Per-client control:</strong> any client you mark as opted out of AI is <strong>never</strong> included in what we send.</li>
            <li><strong>Where it's processed:</strong> on Anthropic's infrastructure, located outside India, in the United States.</li>
            <li><strong>Retention:</strong> your data is processed to answer your question and is handled under Anthropic's commercial terms. We are putting a formal data-processing agreement in place with Anthropic; once it is finalised we will update this notice with the specific retention terms.</li>
          </ul>

          <h3>Voice input: Groq</h3>
          <ul>
            <li><strong>What it does:</strong> turns what you speak into text (speech-to-text) so you can add notes and fill fields by voice instead of typing.</li>
            <li><strong>What we send:</strong> the microphone audio you record for that action, which is converted to text. Voice notes, and the microphone in the web app, send your recording to our servers, which pass it to Groq to be converted to text. Our servers do not keep the recording. In the iOS app, the microphone in Ask Gymbo is different: it sends your recording from your phone straight to Groq, without passing through our servers.</li>
            <li><strong>A note on sensitive data:</strong> voice notes can sometimes include health-related details about a client. Please avoid dictating information you would not want processed by a third-party provider.</li>
            <li><strong>Where it's processed:</strong> on Groq's infrastructure, located outside India, in the United States.</li>
            <li><strong>Retention:</strong> Groq has signed a zero-data-retention agreement with us. Your audio is processed to produce the transcription and is not retained or used to train models.</li>
          </ul>

          <h3>Workout notes: Anthropic (Claude)</h3>
          <ul>
            <li><strong>What it does:</strong> reads a workout note you type or speak and turns it into exercises you can review and edit before you save.</li>
            <li><strong>What we send:</strong> the text of your note (for a spoken note, the text made from your voice). When you ask to change an existing plan, we also send that plan's title, length and exercises.</li>
            <li><strong>A note on your clients:</strong> the per-client AI opt-out does not cover what you type or say in a note. If you say a client's name or a health detail, it is sent. Please avoid dictating information you would not want processed by a third-party provider.</li>
            <li><strong>Where it's processed:</strong> on Anthropic's infrastructure, located outside India, in the United States.</li>
            <li><strong>Retention:</strong> we keep the note text and the result with your account so you can open and edit them, and we delete them when your account is deleted. Anthropic processes your note to read it and handles it under Anthropic's commercial terms. We are putting a formal data-processing agreement in place with Anthropic; once it is finalised we will update this notice with the specific retention terms.</li>
          </ul>

          <h3>The rest of our infrastructure</h3>
          <ul>
            <li><strong>Supabase</strong>: hosts our database, sign-in, and backend services. Your clients, schedule, payments, and attendance records are stored here, on infrastructure located outside India, in Singapore.</li>
            <li><strong>Resend</strong>: delivers the emails we send you (sign-in codes, PIN-reset codes, reminders and account notices).</li>
            <li><strong>Google</strong>: used only for Google Sign-In, if you choose it, to authenticate your account.</li>
            <li><strong>Razorpay</strong>: takes the payment when you subscribe to Gymbo Pro on the web. See "Payments for Gymbo Pro" above.</li>
            <li><strong>PostHog</strong>: product analytics. The iOS app sends this to PostHog's European Union region, so that data is processed in the EU. A data-processing agreement with PostHog is in place.</li>
          </ul>

          <p>You can ask us at any time what data we hold and request its deletion (see "Your choices" below).</p>
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
          <p>We keep your data while your account is active. You can export your clients' attendance and payment records from the app at any time, and you can ask us to delete your account in the app.</p>
          <p>If you join the waitlist or request access, we keep the details you submit in our database for up to 180 days after your request or our last contact with you, whichever is later, and then delete them from it. When you submit, we also email your name and contact details to two members of our team and send you a confirmation email; those emails are not part of the 180 days and are kept until we delete them. You can ask us to delete your details at any time.</p>
        </section>

        <section className="flex flex-col gap-3">
          <h2>Your choices</h2>
          <p>You can access, correct, export, or delete your data, in the app or by emailing us. If you joined our waitlist or asked for access, you can unsubscribe from our emails or ask us to delete your details at any time.</p>
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
                'To raise a privacy question or grievance, contact us at <!--email_off--><a href="mailto:damini@materiallab.io">damini@materiallab.io</a> or <a href="mailto:kaushik@materiallab.io">kaushik@materiallab.io</a><!--/email_off-->. We aim to respond within 30 days.',
            }}
          />
          <p>
            If you appear in an exercise video shown in Gymbo, or you hold rights in one, you can ask us to remove it with our{" "}
            <a href="/m/takedown">video removal request form</a>, and we stop serving that video from our servers while we review your request. A takedown stops new delivery from our servers. Copies that were already cached on a CDN or on a device may remain available until their cache lifetime ends, which is up to one year for the exercise images and videos.
          </p>
        </section>
      </Prose>
    </PageShell>
  );
}
