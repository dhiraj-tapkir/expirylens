import type { Metadata } from "next";
import { Bricolage_Grotesque, IBM_Plex_Sans } from "next/font/google";
import Dock from "@/components/Dock";
import Reticle from "@/components/Reticle";
import "./globals.css";

const bricolage = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-bricolage" });
const plex = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-plex" });

export const metadata: Metadata = {
  title: "ExpiryLens",
  description: "Expiry-day settlement surveillance for Indian index derivatives",
};

// runs before the page paints, so a day-mode visitor never sees a dark flash
const themeScript = `
try {
  var saved = localStorage.getItem("expirylens-theme");
  var day = saved ? saved === "day" : window.matchMedia("(prefers-color-scheme: light)").matches;
  document.documentElement.dataset.theme = day ? "day" : "night";
} catch (e) {}
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${bricolage.variable} ${plex.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen antialiased">
        {children}
        <Dock />
        <Reticle />
      </body>
    </html>
  );
}
