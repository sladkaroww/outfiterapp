import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Analytics } from "@/components/analytics";
import { AppDock } from "@/components/app-dock";
import { AppStateProvider } from "@/components/app-state";
import { CookieConsent } from "@/components/cookie-consent";
import { Providers } from "@/components/providers";
import { siteUrl } from "@/lib/site";

const DESCRIPTION =
  "Share outfits, react to looks and keep a private digital wardrobe. Inspiration from real people, in one place.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  applicationName: "outfiter.",
  title: {
    default: "outfiter. — Your style, your story",
    template: "%s — outfiter.",
  },
  description: DESCRIPTION,
  keywords: ["outfits", "fashion", "wardrobe", "style", "social", "lookbook"],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "outfiter.",
    locale: "en_US",
    title: "outfiter. — Your style, your story",
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: "outfiter. — Your style, your story",
    description: DESCRIPTION,
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f6f3ee",
  colorScheme: "light",
};

/**
 * Yamada UI (Emotion) renders its global `<style>` tags inside <body> during
 * SSR but inserts them into <head> on the client. Moving them once, before the
 * deferred Next.js bundles hydrate, keeps the trees identical. This must stay a
 * one-shot script: a MutationObserver here makes the Next.js dev server trigger
 * a full Fast Refresh reload in a loop.
 */
const HOIST_EMOTION_STYLES = `(function(){var n=document.querySelectorAll("body style[data-emotion]");for(var i=0;i<n.length;i++)document.head.appendChild(n[i]);})();`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link
          rel="preload"
          href="/fonts/AlloVariable.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      </head>
      <body suppressHydrationWarning>
        <a className="skip-link" href="#main-content">Skip to content</a>
        <ClerkProvider>
          <Providers>
            <AppStateProvider>
              {children}
              <AppDock />
              <CookieConsent />
              <Analytics />
            </AppStateProvider>
          </Providers>
        </ClerkProvider>
        <script dangerouslySetInnerHTML={{ __html: HOIST_EMOTION_STYLES }} />
      </body>
    </html>
  );
}
