import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How SoccerRadar handles data, cookies, and advertising, and what our predictions do and don't promise.",
  alternates: { canonical: "/privacy" },
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

export default function PrivacyPolicyPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-10">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground">Last updated: September 5, 2026</p>
      </div>

      <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm leading-relaxed">
        <p className="font-semibold text-foreground">Predictions are statistical estimates, not guarantees.</p>
        <p className="mt-1 text-muted-foreground">
          Every prediction on SoccerRadar is generated from team form, head-to-head history, and other statistical
          and performance data. They reflect probability, not certainty — no outcome is assured. Nothing on this
          site is betting, financial, or professional advice, and we accept no responsibility for decisions made
          using it, including any wagers placed. If you choose to bet, do so responsibly, within your means, and
          only where legal in your jurisdiction and you are of legal age to do so.
        </p>
      </div>

      <Section title="Overview">
        <p>
          SoccerRadar (&ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;) provides AI-generated football match predictions for informational and
          entertainment purposes. This policy explains what data is collected when you use the site, how cookies
          and advertising work here, and how to control them.
        </p>
      </Section>

      <Section title="Information we collect">
        <p>
          We don&apos;t require an account and don&apos;t knowingly collect personal information directly from you.
          That said:
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <span className="font-medium text-foreground">Usage data:</span> like most websites, our hosting and
            infrastructure providers may automatically log basic technical information — such as IP address,
            browser type, and pages visited — for security, abuse prevention, and performance purposes.
          </li>
          <li>
            <span className="font-medium text-foreground">Advertising cookies:</span> we use Google AdSense to show
            ads. Google and its advertising partners may use cookies or similar technologies to serve ads based on
            your visits to this and other websites.
          </li>
          <li>
            <span className="font-medium text-foreground">Preferences:</span> we store a small local flag in your
            browser (not sent to us) to remember your light/dark theme choice and whether you&apos;ve dismissed the
            cookie notice.
          </li>
        </ul>
      </Section>

      <Section title="Cookies and your choices">
        <p>
          You can control or delete cookies at any time through your browser settings. To opt out of personalized
          advertising specifically, visit{" "}
          <a
            href="https://adssettings.google.com"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-primary underline underline-offset-2"
          >
            Google Ads Settings
          </a>{" "}
          or{" "}
          <a
            href="https://www.aboutads.info/choices/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-primary underline underline-offset-2"
          >
            aboutads.info
          </a>
          . Blocking cookies may limit some site functionality, such as remembering your theme preference.
        </p>
      </Section>

      <Section title="Third-party services">
        <p>We rely on a small number of providers to run the site, each of which may process limited technical data:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <span className="font-medium text-foreground">Google AdSense</span> — advertising
          </li>
          <li>
            <span className="font-medium text-foreground">Vercel</span> — hosting and infrastructure
          </li>
          <li>
            <span className="font-medium text-foreground">Supabase</span> — application database
          </li>
        </ul>
        <p>We encourage you to review each provider&apos;s own privacy policy for details on how they handle data.</p>
      </Section>

      <Section title="Children's privacy">
        <p>
          SoccerRadar is not directed at children under 13, and we do not knowingly collect information from
          children.
        </p>
      </Section>

      <Section title="Changes to this policy">
        <p>
          We may update this policy from time to time as the site evolves. Continued use of SoccerRadar after a
          change means you accept the updated policy.
        </p>
      </Section>

      <p className="text-sm text-muted-foreground">
        Questions about this policy? See our{" "}
        <Link href="/" className="font-medium text-primary underline underline-offset-2">
          homepage
        </Link>{" "}
        for how to reach us.
      </p>
    </main>
  );
}
