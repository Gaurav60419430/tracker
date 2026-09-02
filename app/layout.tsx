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
  title: 'Nivara - Monthly Expense Tracker',
  description: 'Know where it goes. Track salary, expenses, pace, and savings in one private dashboard.',
  openGraph: {
    title: 'Nivara - Monthly Expense Tracker',
    description: 'Know where it goes. Track salary, expenses, pace, and savings in one private dashboard.',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'Nivara monthly expense tracker' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Nivara - Monthly Expense Tracker',
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
