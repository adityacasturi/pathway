import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { cookies } from "next/headers";
import { AppChrome } from "@/components/app-chrome";
import { Providers } from "@/app/providers";
import {
  DEFAULT_ACCENT_COLOR,
  type AccentColor,
} from "@/lib/config/accent";
import { loadAppearancePreferences } from "@/lib/settings/load-appearance-preferences";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { isMaintenanceMode } from "@/lib/config/maintenance-mode";
import "./globals.css";

/** Hex approximation of `--paper` for mobile browser chrome and overscroll. */
const BROWSER_THEME_COLOR = "#f9fafb";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

function getMetadataBase() {
  const configuredUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.VERCEL_PROJECT_PRODUCTION_URL ??
    "http://localhost:3000";
  return new URL(configuredUrl.startsWith("http") ? configuredUrl : `https://${configuredUrl}`);
}

export const metadata: Metadata = {
  metadataBase: getMetadataBase(),
  applicationName: "Pathway",
  title: {
    default: "Pathway",
    template: "%s · Pathway",
  },
  description: "Internship application tracker.",
  icons: {
    icon: [
      { url: "/icon.png?v=pathway-20260512", sizes: "32x32", type: "image/png" },
      { url: "/brand/pathway-favicon-512.png?v=pathway-20260512", sizes: "512x512", type: "image/png" },
    ],
    shortcut: [{ url: "/icon.png?v=pathway-20260512", sizes: "32x32", type: "image/png" }],
    apple: [{ url: "/apple-icon.png?v=pathway-20260512", sizes: "512x512", type: "image/png" }],
  },
  openGraph: {
    title: "Pathway",
    description: "Internship application tracker.",
    type: "website",
    images: [
      {
        url: "/brand/pathway-social-card-black-on-white-1600x900.png",
        width: 1600,
        height: 900,
        alt: "Pathway",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Pathway",
    description: "Internship application tracker.",
    images: ["/brand/pathway-social-card-black-on-white-1600x900.png"],
  },
};

async function getLayoutChrome(): Promise<{ accentColor: AccentColor; userEmail: string | null }> {
  try {
    const cookieStore = await cookies();
    const hasAuthCookie = cookieStore
      .getAll()
      .some((c) => c.name.startsWith("sb-") && c.name.includes("auth-token"));
    if (!hasAuthCookie) {
      return { accentColor: DEFAULT_ACCENT_COLOR, userEmail: null };
    }

    const { supabase, user } = await getAuthenticatedUser();
    if (!user) {
      return { accentColor: DEFAULT_ACCENT_COLOR, userEmail: null };
    }

    const appearance = await loadAppearancePreferences(supabase, user.id);
    return {
      accentColor: appearance.accentColor,
      userEmail: user.email ?? null,
    };
  } catch {
    return { accentColor: DEFAULT_ACCENT_COLOR, userEmail: null };
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const maintenance = isMaintenanceMode();
  const { accentColor, userEmail } = maintenance
    ? { accentColor: DEFAULT_ACCENT_COLOR, userEmail: null }
    : await getLayoutChrome();

  return (
    <html
      lang="en"
      data-accent={accentColor}
      data-scroll-behavior="smooth"
      className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <head>
        <meta name="theme-color" content={BROWSER_THEME_COLOR} />
      </head>
      <body className="flex min-h-full flex-col overscroll-none">
        <Providers>
          <AppChrome userEmail={userEmail} maintenance={maintenance}>
            {children}
          </AppChrome>
        </Providers>
      </body>
    </html>
  );
}
