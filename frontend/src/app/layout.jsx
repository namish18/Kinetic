import './globals.css';

export const metadata = {
  title: 'Kinetic | Protocol Labs Meritocratic Funding',
  description: 'Proof-of-Build & MSTS Diminishing Returns Scoring Engine for Flow & Protocol Labs Contributors.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-[#0a0a0c] text-white min-h-screen font-sans antialiased selection:bg-cyan-500 selection:text-black">
        {children}
      </body>
    </html>
  );
}