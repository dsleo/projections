import type { Metadata } from 'next';
import { IBM_Plex_Sans, STIX_Two_Text, JetBrains_Mono } from 'next/font/google';
import 'katex/dist/katex.min.css';
import './globals.css';
import { AnalysisProvider } from '@/components/AnalysisContext';

const plexSans = IBM_Plex_Sans({
  variable: '--font-ibm-plex-sans',
  subsets: ['latin'],
  display: 'swap',
});

const stixSerif = STIX_Two_Text({
  variable: '--font-stix-two-text',
  subsets: ['latin'],
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-jetbrains-mono',
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'FourFold',
  description: 'Audience‑ready scientific summaries, grounded in your paper.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${plexSans.variable} ${stixSerif.variable} ${jetbrainsMono.variable} antialiased`}
      >
        <AnalysisProvider>{children}</AnalysisProvider>
      </body>
    </html>
  );
}
