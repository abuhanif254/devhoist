import type { Metadata } from 'next';
import { Plus_Jakarta_Sans, Hind_Siliguri, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { BillingProvider } from '@/context/BillingContext';
import { LanguageProvider } from '@/context/LanguageContext';
import { PortalProvider } from '@/context/PortalContext';
import { SudoGateProvider } from '@/components/security/SudoGateModal';
import CommandPalette from '@/components/common/CommandPalette';
import StackBuilderDrawer from '@/components/checkout/StackBuilderDrawer';
import FloatingConversionDock from '@/components/common/FloatingConversionDock';
import AnalyticsProvider from '@/components/AnalyticsProvider';

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: '--font-sans',
  subsets: ['latin'],
  display: 'swap',
});

const hindSiliguri = Hind_Siliguri({
  variable: '--font-bengali',
  subsets: ['bengali'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-mono',
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://devhostcloud.com'),
  title: {
    default: 'DevHost Cloud | Modern Global Web & Developer Hosting',
    template: '%s | DevHost Cloud',
  },
  description:
    'High-performance developer-first cloud hosting with zero-downtime GitHub deployment, LiteSpeed WordPress caching, NVMe SSDs in USA & Singapore, and local bKash/Nagad payments.',
  keywords: [
    'web hosting bangladesh',
    'developer hosting',
    'nextjs cpanel hosting',
    'nodejs hosting',
    'github auto deploy hosting',
    'litespeed wordpress hosting',
    'bkash hosting',
    'nagad hosting',
    'cheap domain registration bd',
  ],
  authors: [{ name: 'DevHost Cloud Engineering' }],
  creator: 'DevHost Cloud',
  publisher: 'DevHost Cloud Inc.',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: '/favicon.ico',
  },
  openGraph: {
    title: 'DevHost Cloud | Developer Experience of Vercel. Accessibility of cPanel.',
    description:
      'High-performance developer-first cloud hosting with zero-downtime GitHub deployment, LiteSpeed WordPress caching, and instant bKash/Nagad payments.',
    url: 'https://devhostcloud.com',
    siteName: 'DevHost Cloud',
    images: [
      {
        url: '/api/og',
        width: 1200,
        height: 630,
        alt: 'DevHost Cloud NVMe Infrastructure',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DevHost Cloud | High Performance NVMe Hosting',
    description: 'Deploy Next.js, Node.js & WordPress with automated GitHub pipelines.',
    images: ['/api/og'],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const websiteSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'DevHost Cloud',
    url: 'https://devhostcloud.com',
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: 'https://devhostcloud.com/cheap-domain-registration-bd?q={search_term_string}',
      },
      'query-input': 'required name=search_term_string',
    },
  };

  return (
    <html
      lang="en"
      className={`${plusJakartaSans.variable} ${hindSiliguri.variable} ${jetbrainsMono.variable} light`}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  // Purge all legacy dark mode keys so Light Mode is guaranteed as default
                  localStorage.removeItem('devhost-theme');
                  localStorage.removeItem('devhost-theme-v2');
                  localStorage.removeItem('devhost-theme-v3');
                  var t = localStorage.getItem('devhost-theme-v4');
                  if (t === 'dark') {
                    document.documentElement.classList.add('dark');
                    document.documentElement.classList.remove('light');
                  } else {
                    document.documentElement.classList.remove('dark');
                    document.documentElement.classList.add('light');
                  }
                } catch (e) {
                  document.documentElement.classList.remove('dark');
                  document.documentElement.classList.add('light');
                }
              })();
            `,
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
        />
      </head>
      <body className="min-h-screen bg-white text-slate-900 dark:bg-zinc-950 dark:text-zinc-100 font-sans antialiased selection:bg-blue-600 selection:text-white transition-colors duration-200">
        <LanguageProvider>
          <BillingProvider>
            <PortalProvider>
              <SudoGateProvider>
                <AnalyticsProvider>
                {children}
                <CommandPalette />
                <StackBuilderDrawer />
                <FloatingConversionDock />
              </AnalyticsProvider>
              </SudoGateProvider>
            </PortalProvider>
          </BillingProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
