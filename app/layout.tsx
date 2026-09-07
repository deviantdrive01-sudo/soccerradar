import type { Metadata } from "next";
import Script from "next/script";
import localFont from "next/font/local";
import { Geist_Mono } from "next/font/google";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { CookieConsent } from "@/components/cookie-consent";
import { AdSettingsProvider } from "@/components/ad-settings-provider";
import { AccountProvider } from "@/components/account-provider";
import { createSupabaseReadClient } from "@/lib/supabase/client";
import { SITE_URL, SITE_TAGLINE } from "@/lib/site";
import "./globals.css";

const ADSENSE_CLIENT_ID = "ca-pub-8047973291517576";
const GA_MEASUREMENT_ID = "G-5DW3J6DCD0";
const SITE_NAME = "SoccerRadar";
const SITE_DESCRIPTION = `${SITE_TAGLINE} AI-generated football predictions across 16 top global leagues, backed by a public, verifiable track record. No cherry-picking, nothing held back.`;

const THEME_INIT_SCRIPT = `(function(){try{var s=localStorage.getItem('theme');var d=s?s==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;if(d)document.documentElement.classList.add('dark');}catch(e){}})();`;

// Organization + WebSite structured data — lets Google associate the logo
// with the site for knowledge-panel/rich-result branding. logo must be an
// absolute URL per Google's guidelines.
const ORGANIZATION_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: SITE_NAME,
  url: SITE_URL,
  logo: `${SITE_URL}/logo-light.svg`,
};

const WEBSITE_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: SITE_NAME,
  url: SITE_URL,
};

const generalSans = localFont({
  src: [
    { path: "./fonts/GeneralSans-Variable.woff2", weight: "300 700", style: "normal" },
    { path: "./fonts/GeneralSans-VariableItalic.woff2", weight: "300 700", style: "italic" },
  ],
  variable: "--font-general-sans",
  fallback: ["Helvetica", "Arial", "sans-serif"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — AI Match Predictions`,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  keywords: [
    "football predictions",
    "soccer predictions",
    "AI match predictions",
    "over 2.5 goals prediction",
    "correct score prediction",
    "football betting tips",
  ],
  robots: { index: true, follow: true },
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: `${SITE_NAME} — AI Match Predictions`,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
  },
  twitter: {
    card: "summary",
    title: `${SITE_NAME} — AI Match Predictions`,
    description: SITE_DESCRIPTION,
  },
  other: {
    "google-adsense-account": ADSENSE_CLIENT_ID,
  },
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const supabase = createSupabaseReadClient();
  const { data: adSettings } = await supabase.from("ad_settings").select("*").eq("id", 1).single();

  return (
    <html
      lang="en"
      className={`${generalSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script
          async
          src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT_ID}`}
          crossOrigin="anonymous"
        />
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(ORGANIZATION_JSON_LD) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(WEBSITE_JSON_LD) }}
        />
        <Script async src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`} strategy="afterInteractive" />
        <Script id="ga4-init" strategy="afterInteractive">
          {`window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_MEASUREMENT_ID}');`}
        </Script>
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <AdSettingsProvider
          settings={
            adSettings
              ? {
                  houseWeight: adSettings.house_weight,
                  googleEnabled: adSettings.google_enabled,
                  houseVideoPath: adSettings.house_video_path,
                  houseClickUrl: adSettings.house_click_url,
                }
              : null
          }
        >
          <AccountProvider>
            <SiteHeader />
            {children}
            <SiteFooter />
            <CookieConsent />
          </AccountProvider>
        </AdSettingsProvider>
      </body>
    </html>
  );
}
