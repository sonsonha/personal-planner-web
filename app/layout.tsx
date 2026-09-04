import type { Metadata } from "next";
import { Fraunces, Geist, Geist_Mono, Inter, JetBrains_Mono } from "next/font/google";
import { ThemeProvider } from "@/lib/theme";
import { THEME_BOOT_SCRIPT } from "@/lib/theme-boot";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Personal OS — Calendar Planner",
  description: "Plan tasks against real time and keep your week in sync.",
  icons: {
    icon: [
      { url: "/favicon.png", type: "image/png", sizes: "64x64" },
      { url: "/favicon-192.png", type: "image/png", sizes: "192x192" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  openGraph: {
    title: "Personal OS — Calendar Planner",
    description: "Plan tasks against real time and keep your week in sync.",
    images: ["/personal-os-social-preview.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Personal OS — Calendar Planner",
    description: "Plan tasks against real time and keep your week in sync.",
    images: ["/personal-os-social-preview.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${inter.variable} ${fraunces.variable} ${jetbrains.variable}`}
      >
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
