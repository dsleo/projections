import type { Metadata } from 'next';
import { Inter, Poppins, Source_Code_Pro } from 'next/font/google';
import 'katex/dist/katex.min.css';
import './globals.css';
import { AnalysisProvider } from '@/components/AnalysisContext';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  display: 'swap',
});

const poppins = Poppins({
  variable: '--font-poppins',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

const sourceCodePro = Source_Code_Pro({
  variable: '--font-source-code-pro',
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Projections',
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
        className={`${inter.variable} ${poppins.variable} ${sourceCodePro.variable} antialiased`}
      >
        <AnalysisProvider>{children}</AnalysisProvider>
      </body>
    </html>
  );
}
