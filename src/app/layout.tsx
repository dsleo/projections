import type { Metadata } from 'next';
import { Source_Sans_3, Source_Serif_4, JetBrains_Mono } from 'next/font/google';
import 'katex/dist/katex.min.css';
import './globals.css';
import { AnalysisProvider } from '@/components/AnalysisContext';

const sourceSans = Source_Sans_3({
  variable: '--font-source-sans',
  subsets: ['latin'],
  display: 'swap',
});

const sourceSerif = Source_Serif_4({
  variable: '--font-source-serif',
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
        className={`${sourceSans.variable} ${sourceSerif.variable} ${jetbrainsMono.variable} antialiased`}
      >
        <AnalysisProvider>{children}</AnalysisProvider>
      </body>
    </html>
  );
}
