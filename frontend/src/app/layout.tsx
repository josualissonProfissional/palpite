import type { Metadata } from "next";
import { Barlow, Barlow_Condensed } from "next/font/google";
import { CreatorFooter } from "@/components/palpite/creator-footer";
import { ThemeProvider } from "@/components/palpite/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const barlow = Barlow({
  variable: "--font-barlow",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const barlowCondensed = Barlow_Condensed({
  variable: "--font-barlow-condensed",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Palpitô | Copa do Mundo",
  description: "Palpitô: bolão da Copa do Mundo com grupos, jogos e ranking ao vivo.",
  icons: {
    icon: "/logo/logo-apenas-desenho-sem-fundo.svg",
    shortcut: "/logo/logo-apenas-desenho-sem-fundo.svg",
    apple: "/logo/logo-apenas-desenho-sem-fundo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={`${barlow.variable} ${barlowCondensed.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <ThemeProvider>
          <TooltipProvider>
            {children}
            <CreatorFooter />
            <Toaster richColors position="top-right" />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
