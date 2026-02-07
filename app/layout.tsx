import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { Header } from './Header';
import { WagmiRainbowKitProvider } from './lib/WagmiRainbowKitProvider';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Uniclaw – Safe + Zodiac Roles",
  description: "Deploy Safe smart accounts with scoped Zodiac Roles Modifier permissions for Uniswap swaps",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <WagmiRainbowKitProvider>
          <Header />
          {children}
        </WagmiRainbowKitProvider>
      </body>
    </html>
  );
}
