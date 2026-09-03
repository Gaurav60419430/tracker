import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://moneta-monthly.gaurav-gupta-6041.chatgpt.site'),
  title: 'Money Tees - Monthly Expense Tracker',
  description: 'Know where it goes. Track salary, expenses, pace, and savings in one private dashboard — now as Money Tees.',
  applicationName: 'Money Tees',
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico', sizes: '32x32', type: 'image/x-icon' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
    shortcut: '/favicon.ico',
  },
  manifest: '/site.webmanifest',
  openGraph: {
    title: 'Money Tees - Monthly Expense Tracker',
    description: 'Know where it goes. Track salary, expenses, pace, and savings in one private dashboard.',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'Money Tees monthly expense tracker' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Money Tees - Monthly Expense Tracker',
    description: 'Know where it goes. Track salary, expenses, pace, and savings in one private dashboard.',
    images: ['/og.png'],
  },
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
        {children}
      </body>
    </html>
  );
}
