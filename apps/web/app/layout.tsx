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
      <body className={inter.className}>
        <AuthProvider>
          <div className="flex min-h-screen flex-col bg-background">
            <SiteHeader />
            <main className="container mx-auto flex-1 px-4 py-6">{children}</main>
            <footer className="border-t py-6 text-center text-sm text-muted-foreground">
              Built for cyclists who love data-driven training.
            </footer>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
