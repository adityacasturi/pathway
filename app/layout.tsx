import type { Metadata } from "next";
import { Instrument_Serif, Inter, JetBrains_Mono } from "next/font/google";
import { AccentThemeProvider } from "@/components/accent-theme-provider";
import { AppChrome } from "@/components/app-chrome";
import { DEFAULT_ACCENT_COLOR } from "@/lib/config/accent";
import "./globals.css";

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  style: ["normal", "italic"],
  weight: "400",
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
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
  title: "Pathway",
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      data-accent={DEFAULT_ACCENT_COLOR}
      data-scroll-behavior="smooth"
      className={`${instrumentSerif.variable} ${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AccentThemeProvider>
          <AppChrome />
          {children}
        </AccentThemeProvider>
      </body>
    </html>
  );
}
