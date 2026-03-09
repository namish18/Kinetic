import "./globals.css";
import { ThemeProvider } from "./context/ThemeContext";

export const metadata = {
  title: "Kinetic — Decentralized Open-Source Funding",
  description:
    "Fund the code that powers the world. Kinetic is a decentralized platform that rewards open-source contributors through algorithmic value scoring and quadratic voting.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/cal-sans@1.0.1/index.css"
        />
        <link
          rel="stylesheet"
          href="https://api.fontshare.com/v2/css?f[]=satoshi@1&f[]=matter@1&display=swap"
        />
      </head>
      <body className="dark" suppressHydrationWarning>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
