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
  title: 'Moneta — Monthly Expense Tracker',
  description: 'A private, intelligent monthly expense tracker for salary, spending, budgets, and savings.',
  openGraph: {
    title: 'Moneta — Monthly Expense Tracker',
    description: 'Money, under control. Track salary, spending, budgets, and savings in one private dashboard.',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'Moneta — Money, under control.' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Moneta — Monthly Expense Tracker',
    description: 'Money, under control. Track salary, spending, budgets, and savings in one private dashboard.',
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
