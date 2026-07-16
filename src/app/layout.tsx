import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";

import "./globals.css";

import { getSiteTheme } from "@/lib/db/admin";
import { isRtl } from "@/i18n/config";
import { DEFAULT_THEME } from "@/lib/theme";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Gwave",
  description: "The social super-app for growers",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "gwave",
  },
  // Non-Apple counterpart to appleWebApp.capable (the former is deprecated
  // on its own); silences the console warning and enables standalone PWA.
  other: {
    "mobile-web-app-capable": "yes",
  },
  icons: {
    // The Gwave leaf-G mark. favicon.ico (multi-size) is requested
    // unconditionally; the 512 PNG covers high-DPI tabs and apple touch.
    icon: [
      { url: "/favicon.ico", sizes: "48x48" },
      { url: "/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: "/icon-192.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#3B6D11",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [locale, messages, theme] = await Promise.all([
    getLocale(),
    getMessages(),
    getSiteTheme(),
  ]);

  return (
    <html
      lang={locale}
      dir={isRtl(locale) ? "rtl" : "ltr"}
      data-theme={theme === DEFAULT_THEME ? undefined : theme}
      suppressHydrationWarning
    >
      <body className={inter.className}>
        {/* Apply a per-user eye-friendly theme before paint (no flash). */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var t=localStorage.getItem('gwave-appearance');if(t){document.documentElement.setAttribute('data-theme',t);}}catch(e){}",
          }}
        />
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
