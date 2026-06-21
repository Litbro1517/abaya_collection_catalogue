import type { Metadata } from "next";
import { Playfair_Display, Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeInjector } from "@/components/ThemeInjector";
import { db } from '@/lib/db';

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  // Try to read favicon and catalog name from DB for SSR metadata
  let faviconUrl = "/logo.svg"; // default fallback
  let catalogName = "Abaya Collection Chic";

  try {
    const settings = await db.catalogSettings.findFirst();
    if (settings?.favicon) {
      faviconUrl = settings.favicon;
    }
    if (settings) {
      // Get catalog name from the related catalog
      const catalog = await db.catalog.findFirst({
        where: { id: settings.catalogId },
        select: { name: true },
      });
      if (catalog?.name) catalogName = catalog.name;
    }
  } catch {
    // DB not available (first deploy, etc.) — use defaults
  }

  // Resolve metadataBase from DB or fallback to production URL
  let metadataBaseUrl = 'https://abaya-collection-catalogue-9dum.vercel.app';
  try {
    const seoRow = await db.settings.findUnique({ where: { key: '__seo_metadata__' } });
    if (seoRow?.value) {
      const parsed = JSON.parse(seoRow.value);
      if (parsed.canonicalUrl) metadataBaseUrl = parsed.canonicalUrl;
    }
  } catch {
    // DB not available — use default
  }

  return {
    metadataBase: new URL(metadataBaseUrl),
    title: `${catalogName} — Catalogue`,
    description: "Découvrez notre collection exclusive d'abayas, robes et ensembles. Commandez via WhatsApp, Messenger et plus.",
    icons: {
      icon: faviconUrl,
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body
        className={`${playfair.variable} ${inter.variable} antialiased bg-background text-foreground`}
      >
        {/* ── GTM removed: migrated to Cloudflare Zaraz ── */}
        <ThemeInjector />
        <TooltipProvider>
          {children}
        </TooltipProvider>
        <Toaster position="bottom-right" richColors />
      </body>
    </html>
  );
}
