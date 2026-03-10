import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider } from '@/components/ThemeProvider';
import PillNav from '@/components/PillNav';
import { Footer } from '@/components/Footer';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Hexagon } from 'lucide-react';
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: 'Kinetic - Decentralized Open-Source Funding',
  description: 'Your commits deserve capital. Fund the code that runs the world.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className={cn("font-sans", geist.variable)}>
      <head>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/cal-sans@1.0.1/index.css" />
        <link rel="stylesheet" href="https://api.fontshare.com/v2/css?f[]=matter@400,500,700&f[]=satoshi@400,500,700&display=swap" />
      </head>
      <body className="font-sans antialiased bg-background text-foreground min-h-screen flex flex-col">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <header className="fixed top-6 left-1/2 -translate-x-1/2 z-50 px-6 py-2 flex justify-between items-center max-w-[95%] md:max-w-7xl mx-auto w-full bg-background/40 backdrop-blur-xl border border-white/10 rounded-full shadow-2xl">
            <div className="w-24 hidden md:block"></div>
            <div className="flex-1 flex justify-center">
              <PillNav
                logo={<Hexagon className="w-full h-full text-white dark:text-black fill-foreground animate-[spin_4s_linear_infinite]" />}
                items={[
                  { label: 'Home', href: '/' },
                  { label: 'Dashboard', href: '/dashboard' },
                  { label: 'Org Dashboard', href: '/org-dashboard' },
                  { label: 'Registry', href: '/registry' },
                  { label: 'Bounties', href: '/bounties' },
                  { label: 'Docs', href: '/docs' }
                ]}
                baseColor="hsl(var(--card))"
                pillColor="hsl(var(--muted))"
                hoveredPillTextColor="hsl(var(--foreground))"
                pillTextColor="hsl(var(--muted-foreground))"
              />
            </div>
            <div className="w-24 pointer-events-auto flex justify-end">
              <div className="bg-card rounded-full shadow-sm border p-1 hidden md:block">
                <ThemeToggle />
              </div>
            </div>
          </header>
          <main className="flex-1 flex flex-col">
            {children}
          </main>
          <Footer />
        </ThemeProvider>
      </body>
    </html>
  );
}
