import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Use",
  description: "The terms governing use of SoccerRadar — accounts, content, and what our predictions do and don't promise.",
  alternates: { canonical: "/terms" },
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

export default function TermsOfUsePage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-10">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Terms of Use</h1>
        <p className="text-sm text-muted-foreground">Last updated: September 8, 2026</p>
      </div>

      <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm leading-relaxed">
        <p className="font-semibold text-foreground">SoccerRadar is informational and entertainment content, not betting advice.</p>
        <p className="mt-1 text-muted-foreground">
          Predictions reflect statistical probability, not certainty. Nothing on this site is betting, financial, or
          professional advice, and we accept no responsibility for decisions made using it, including any wagers
          placed. If you choose to bet, do so responsibly, within your means, only where legal in your jurisdiction,
          and only if you are of legal age to do so.
        </p>
      </div>

      <Section title="Acceptance of these terms">
        <p>
          By using SoccerRadar (&ldquo;the site&rdquo;), you agree to these Terms of Use. If you don&apos;t agree, please don&apos;t use the
          site. We may update these terms as the site evolves — continued use after a change means you accept the
          update.
        </p>
      </Section>

      <Section title="What SoccerRadar is">
        <p>
          SoccerRadar publishes AI-generated football match predictions across a range of statistical markets
          (outcome, goals, corners, and others), along with a public track record grading every prediction against
          what actually happened. It is a prediction and analysis tool, not a bookmaker, sportsbook, or gambling
          operator — we don&apos;t accept wagers, hold funds, or facilitate betting of any kind.
        </p>
      </Section>

      <Section title="Accounts">
        <p>
          Creating an account is optional and free. You&apos;re responsible for the accuracy of information you provide
          and for activity under your account. Don&apos;t use another person&apos;s account without permission, and let us
          know at{" "}
          <a href="mailto:support@socceradar.site" className="font-medium text-primary underline underline-offset-2">
            support@socceradar.site
          </a>{" "}
          if you believe your account has been compromised.
        </p>
      </Section>

      <Section title="Bookings and public content">
        <p>
          A &ldquo;Booking&rdquo; is a personal list of picks you assemble from our predictions, purely for tracking and
          sharing — not a real wager, and no money changes hands through it. If you choose to make a Booking or
          Collection public, its title, picks, and your username become visible to other visitors and may appear in
          site features like the Top Bookings leaderboard.
        </p>
        <p>
          Don&apos;t use public content (booking titles, usernames, comments where applicable) for anything abusive,
          illegal, or misleading. We may remove public content or restrict an account that violates this without
          notice.
        </p>
      </Section>

      <Section title="Acceptable use">
        <ul className="list-disc space-y-1 pl-5">
          <li>Don&apos;t attempt to disrupt, overload, or scrape the site in a way that harms its availability for others.</li>
          <li>Don&apos;t attempt to circumvent account, rate-limit, or access controls.</li>
          <li>Don&apos;t use the site to violate any applicable law, including gambling laws in your jurisdiction.</li>
        </ul>
      </Section>

      <Section title="No warranty">
        <p>
          The site and its predictions are provided &ldquo;as is,&rdquo; without warranty of any kind. We don&apos;t guarantee
          the accuracy, completeness, or availability of any prediction, statistic, or feature — see our{" "}
          <Link href="/accuracy" className="font-medium text-primary underline underline-offset-2">
            Track Record
          </Link>{" "}
          page for how our predictions have actually performed, published transparently either way.
        </p>
      </Section>

      <Section title="Limitation of liability">
        <p>
          To the fullest extent permitted by law, SoccerRadar and its operators aren&apos;t liable for any loss or
          damage arising from your use of the site or reliance on any prediction, including financial losses from
          bets placed based on information found here.
        </p>
      </Section>

      <Section title="Advertising and third parties">
        <p>
          The site is supported by advertising, including Google AdSense. See our{" "}
          <Link href="/privacy" className="font-medium text-primary underline underline-offset-2">
            Privacy Policy
          </Link>{" "}
          for details on cookies, advertising, and the other third-party services we rely on.
        </p>
      </Section>

      <Section title="Changes to the service">
        <p>
          We may add, change, or remove features (including specific prediction markets) at any time as the site
          evolves.
        </p>
      </Section>

      <p className="text-sm text-muted-foreground">
        Questions about these terms? Email{" "}
        <a href="mailto:support@socceradar.site" className="font-medium text-primary underline underline-offset-2">
          support@socceradar.site
        </a>
        .
      </p>
    </main>
  );
}
