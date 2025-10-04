import type { Metadata } from 'next';
import { Inter } from 'next/font/google';

import './globals.css';
import { AuthProvider } from '../components/auth-provider';
import { SiteHeader } from '../components/site-header';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Cycling Custom Metrics',
  description:
    'Upload Garmin FIT files, compute custom cycling analytics, and explore extensible metrics.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-background antialiased`}>
        <AuthProvider>
          <div className="relative flex min-h-screen flex-col overflow-hidden">
            <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.18),_rgba(59,130,246,0)_55%)]" />
            <div className="pointer-events-none absolute -left-32 top-1/2 -z-10 h-96 w-96 -translate-y-1/2 rounded-full bg-primary/10 blur-3xl" />
            <SiteHeader />
            <main className="container mx-auto flex-1 px-4 pb-12 pt-8 sm:pt-12">{children}</main>
            <footer className="border-t bg-background/80 py-8 text-center text-sm text-muted-foreground backdrop-blur">
              Built for cyclists who love data-driven training.
            </footer>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
