import type { Metadata } from "next";
import localFont from "next/font/local";
import { Geist_Mono } from "next/font/google";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { CookieConsent } from "@/components/cookie-consent";
import { AdSettingsProvider } from "@/components/ad-settings-provider";
import { AccountProvider } from "@/components/account-provider";
import { createSupabaseReadClient } from "@/lib/supabase/client";
import "./globals.css";

const ADSENSE_CLIENT_ID = "ca-pub-8047973291517576";

const THEME_INIT_SCRIPT = `(function(){try{var s=localStorage.getItem('theme');var d=s?s==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;if(d)document.documentElement.classList.add('dark');}catch(e){}})();`;

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
  title: "SoccerRadar — AI Match Predictions",
  description: "Confidence-scored predictions across 16 top global football leagues.",
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
