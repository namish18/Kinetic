import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider } from '@/components/ThemeProvider';
import PillNav from '@/components/PillNav';
import { Footer } from '@/components/Footer';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Hexagon, Atom } from 'lucide-react';
import Link from 'next/link';
import { Geist, Baskervville } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({ subsets: ['latin'], variable: '--font-sans' });
const baskerville = Baskervville({ weight: '400', subsets: ['latin'], style: 'italic', variable: '--font-serif' });

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
    <html lang="en" suppressHydrationWarning className={cn("font-sans", geist.variable, baskerville.variable)}>
      <head>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/cal-sans@1.0.1/index.css" />
        <link rel="stylesheet" href="https://api.fontshare.com/v2/css?f[]=matter@400,500,700&f[]=satoshi@400,500,700&display=swap" />
        <link href="https://fonts.googleapis.com/css2?family=Libre+Baskerville:ital,wght@1,400&display=swap" rel="stylesheet" />
      </head>
      <body className="font-sans antialiased bg-background text-foreground min-h-screen flex flex-col">
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
          <header className="fixed top-6 inset-x-0 z-50 px-6 py-2 flex items-center max-w-[95%] md:max-w-5xl mx-auto bg-background/80 backdrop-blur-2xl border border-foreground/10 rounded-full shadow-2xl transition-all duration-300">
            <div className="w-12 md:w-32 flex items-center">
              <Link href="/" className="flex items-center space-x-3 group">
                <div className="w-11 h-11 rounded-full bg-foreground text-background flex items-center justify-center shadow-lg transition-transform hover:scale-110">
                  <Atom className="w-7 h-7 animate-[spin_6s_linear_infinite]" />
                </div>
                <span className="font-heading font-black text-2xl hidden lg:block tracking-tighter uppercase">Kinetic</span>
              </Link>
            </div>
            <div className="flex-1 flex justify-center">
              <PillNav
                items={[
                  { label: 'Home', href: '/' },
                  { label: 'Registry', href: '/registry' },
                  { label: 'Bounties', href: '/bounties' },
                  { label: 'Docs', href: '/docs' },
                  { label: 'Login', href: '/login' },
                  { label: 'Signup', href: '/signup' }
                ]}
                baseColor="hsl(var(--foreground))"
                pillColor="hsl(var(--background))"
                hoveredPillTextColor="hsl(var(--background))"
                pillTextColor="hsl(var(--foreground))"
              />
            </div>
            <div className="w-12 md:w-32 flex justify-end">
              <div className="bg-card rounded-full shadow-sm border p-1 hidden md:block">
                <ThemeToggle />
              </div>
            </div>
          </header>
          <main className="flex-1 w-full flex flex-col">
            {children}
          </main>
          <Footer />
        </ThemeProvider>
      </body>
    </html>
  );
}
