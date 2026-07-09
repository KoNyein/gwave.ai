import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";

import "./globals.css";

import { getSiteTheme } from "@/lib/db/admin";
import { DEFAULT_THEME } from "@/lib/theme";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "gwave.ai",
  description: "The social super-app for growers",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "gwave",
  },
  icons: {
    icon: "/favicon.svg",
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
      data-theme={theme === DEFAULT_THEME ? undefined : theme}
      suppressHydrationWarning
    >
      <body className={inter.className}>
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
