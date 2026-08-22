import type { Metadata } from "next";
import { Fraunces, Geist, Geist_Mono, Inter, JetBrains_Mono } from "next/font/google";
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
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${inter.variable} ${fraunces.variable} ${jetbrains.variable}`}
      >
        {children}
      </body>
    </html>
  );
}
