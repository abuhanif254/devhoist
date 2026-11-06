import type { Metadata } from 'next';
import { isSupabaseConfigured, getServiceSupabase } from './supabase';

export interface SeoRouteConfig {
  route_path: string;
  meta_title: string;
  meta_description: string;
  keywords: string[];
  canonical_path: string;
  og_title: string;
  og_subtitle: string;
  robots_directive?: string;
  schema_type: 'Product' | 'WebApplication' | 'FAQPage' | 'TechArticle' | 'Organization';
}

const DEFAULT_SEO_CONFIGS: Record<string, SeoRouteConfig> = {
  '/': {
    route_path: '/',
    meta_title: 'DevHost Cloud — Vercel-Grade Developer Hosting with cPanel & bKash',
    meta_description: 'Next-generation NVMe hosting in Bangladesh. Auto-deploy Git repos to LiteSpeed cPanel with automated bKash/Nagad checkout and zero-downtime containers.',
    keywords: ['web hosting bangladesh', 'cpanel hosting bd', 'nextjs cpanel hosting', 'bkash hosting', 'developer cloud bd'],
    canonical_path: 'https://devhostcloud.com',
    og_title: 'DevHost Cloud — Developer-First Cloud Platform',
    og_subtitle: 'Deploy Next.js, Node.js & WordPress with instant bKash checkout and Singapore NVMe speed.',
    schema_type: 'WebApplication',
  },
  '/nodejs-hosting': {
    route_path: '/nodejs-hosting',
    meta_title: 'High-Speed Node.js Hosting in Bangladesh — LiteSpeed NVMe & Passenger',
    meta_description: 'Deploy Next.js, Express, and Node.js 22 LTS with CloudLinux Passenger on Singapore NVMe storage. Instant bKash activation with zero node_modules bloat.',
    keywords: ['nodejs hosting bangladesh', 'nextjs hosting bd', 'passenger cpanel hosting', 'fast nodejs cloud'],
    canonical_path: 'https://devhostcloud.com/nodejs-hosting',
    og_title: 'Node.js NVMe Cloud Hosting | DevHost',
    og_subtitle: 'Sub-40ms latency in Bangladesh with automated GitHub webhooks and zero storage bloat.',
    schema_type: 'Product',
  },
  '/wordpress-hosting-bangladesh': {
    route_path: '/wordpress-hosting-bangladesh',
    meta_title: 'Fastest WordPress Hosting in Bangladesh — LiteSpeed Enterprise & Redis',
    meta_description: 'Supercharge your WordPress & WooCommerce store with LiteSpeed Enterprise Web Server, Redis Object Cache, free SSL, and daily offsite backups.',
    keywords: ['wordpress hosting bangladesh', 'litespeed hosting bd', 'woocommerce cloud', 'fast wordpress bd'],
    canonical_path: 'https://devhostcloud.com/wordpress-hosting-bangladesh',
    og_title: 'LiteSpeed WordPress Hosting | DevHost',
    og_subtitle: 'Achieve 99/100 Google PageSpeed scores with LiteSpeed Enterprise and Redis caching.',
    schema_type: 'Product',
  },
  '/cloud-vps': {
    route_path: '/cloud-vps',
    meta_title: 'NVMe Cloud VPS in Singapore & USA — KVM Virtualization & Root Access',
    meta_description: 'High-performance Cloud VPS servers with dedicated NVMe storage, BDIX-optimized routes, 1Gbps uplink, full root access, and automated instant OS provisioning.',
    keywords: ['vps hosting bangladesh', 'cloud vps bd', 'singapore vps', 'kvm vps root access'],
    canonical_path: 'https://devhostcloud.com/cloud-vps',
    og_title: 'Enterprise Cloud VPS | DevHost',
    og_subtitle: 'Dedicated KVM virtualization in Singapore SG1 and USA Equinix datacenters.',
    schema_type: 'Product',
  },
  '/cheap-domain-registration-bd': {
    route_path: '/cheap-domain-registration-bd',
    meta_title: 'Domain Registration Bangladesh — Instant .com, .net, .org with bKash',
    meta_description: 'Register and transfer global domain names with instant bKash activation, free WHOIS privacy, 2-Step verification lock, and RFC-validated DNS editor.',
    keywords: ['domain registration bangladesh', 'cheap domain bd', 'buy com domain bkash', 'domain registrar bd'],
    canonical_path: 'https://devhostcloud.com/cheap-domain-registration-bd',
    og_title: 'Domain Portfolio & Registrar Suite | DevHost',
    og_subtitle: 'Protect your brand with WHOIS privacy, DNSSEC, and instant EPP transfer states.',
    schema_type: 'Product',
  },
  '/docs': {
    route_path: '/docs',
    meta_title: 'Developer Documentation & Runbooks | DevHost Cloud Engineering Hub',
    meta_description: 'Context-aware developer tutorials for Next.js, Node.js, Laravel, WordPress, and Cloudflare DNS with real-time customer account variable injection.',
    keywords: ['cpanel tutorials', 'nextjs cpanel deploy guide', 'developer documentation bd', 'hosting knowledge base'],
    canonical_path: 'https://devhostcloud.com/docs',
    og_title: 'Engineering Knowledgebase & Runbooks | DevHost',
    og_subtitle: 'Copy-paste deployment workflows with live account variables and terminal scripts.',
    schema_type: 'TechArticle',
  },
};

/**
 * Fetch dynamic SEO route configuration with fallback
 */
export async function getRouteSeoConfig(path: string): Promise<SeoRouteConfig> {
  const fallback = DEFAULT_SEO_CONFIGS[path] || DEFAULT_SEO_CONFIGS['/'];

  if (!isSupabaseConfigured()) return fallback;

  try {
    const db = getServiceSupabase();
    const { data } = await db
      .from('cms_seo_routes')
      .select('*')
      .eq('route_path', path)
      .maybeSingle();

    if (data) {
      return {
        route_path: data.route_path,
        meta_title: data.meta_title,
        meta_description: data.meta_description,
        keywords: data.keywords || fallback.keywords,
        canonical_path: data.canonical_path || fallback.canonical_path,
        og_title: data.og_title || fallback.og_title,
        og_subtitle: data.og_subtitle || fallback.og_subtitle,
        robots_directive: data.robots_directive,
        schema_type: data.schema_type || fallback.schema_type,
      };
    }
  } catch (err) {
    console.warn(`[SEO Engine] Failed to fetch SEO for ${path}:`, err);
  }

  return fallback;
}

/**
 * Build Next.js Metadata object dynamically from database
 */
export async function generateDynamicMetadata(path: string): Promise<Metadata> {
  const config = await getRouteSeoConfig(path);

  return {
    title: config.meta_title,
    description: config.meta_description,
    keywords: config.keywords,
    alternates: {
      canonical: config.canonical_path,
    },
    openGraph: {
      title: config.og_title,
      description: config.og_subtitle,
      url: config.canonical_path,
      siteName: 'DevHost Cloud',
      images: [
        {
          url: `/api/og?title=${encodeURIComponent(config.og_title)}&desc=${encodeURIComponent(config.og_subtitle)}`,
          width: 1200,
          height: 630,
          alt: config.meta_title,
        },
      ],
      locale: 'en_US',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: config.og_title,
      description: config.og_subtitle,
    },
    robots: config.robots_directive || 'index, follow, max-image-preview:large',
  };
}

/**
 * Generate rich JSON-LD structured data for search engine rich snippets
 */
export function generateJsonLdSchema(
  schemaType: 'WebApplication' | 'Product' | 'TechArticle' | 'FAQPage' | 'Organization',
  routePath: string,
  extraData?: any
) {
  const baseUrl = 'https://devhostcloud.com';

  // 1. Organization & WebSite Root Schema
  if (schemaType === 'Organization' || schemaType === 'WebApplication') {
    return {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'Organization',
          '@id': `${baseUrl}/#organization`,
          name: 'DevHost Cloud Bangladesh',
          url: baseUrl,
          logo: `${baseUrl}/favicon.ico`,
          sameAs: ['https://github.com/abuhanif254/devhoist'],
          contactPoint: {
            '@type': 'ContactPoint',
            telephone: '+8801789234567',
            contactType: 'Customer Support',
            areaServed: 'BD',
            availableLanguage: ['en', 'bn'],
          },
        },
        {
          '@type': 'WebSite',
          '@id': `${baseUrl}/#website`,
          url: baseUrl,
          name: 'DevHost Cloud',
          publisher: { '@id': `${baseUrl}/#organization` },
          potentialAction: {
            '@type': 'SearchAction',
            target: `${baseUrl}/docs?q={search_term_string}`,
            'query-input': 'required name=search_term_string',
          },
        },
      ],
    };
  }

  // 2. Product & AggregateOffer Schema
  if (schemaType === 'Product') {
    return {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: extraData?.name || 'DevHost High-Speed NVMe Hosting',
      description: extraData?.description || 'Developer-first cloud hosting with automated GitHub deploy and LiteSpeed caching in Bangladesh.',
      image: `${baseUrl}/api/og?title=DevHost%20Cloud`,
      brand: {
        '@type': 'Brand',
        name: 'DevHost Cloud',
      },
      offers: {
        '@type': 'AggregateOffer',
        priceCurrency: 'BDT',
        lowPrice: '200',
        highPrice: '1450',
        offerCount: '4',
        availability: 'https://schema.org/InStock',
        seller: {
          '@type': 'Organization',
          name: 'DevHost Cloud',
        },
      },
    };
  }

  // 3. TechArticle & HowTo Schema for Documentation
  if (schemaType === 'TechArticle') {
    return {
      '@context': 'https://schema.org',
      '@type': 'TechArticle',
      headline: extraData?.title || 'How to Deploy Next.js to cPanel',
      description: extraData?.summary || 'Step-by-step developer guide with zero node_modules storage bloat.',
      author: {
        '@type': 'Organization',
        name: 'DevHost Cloud Engineering Team',
      },
      publisher: {
        '@type': 'Organization',
        name: 'DevHost Cloud',
        logo: {
          '@type': 'ImageObject',
          url: `${baseUrl}/favicon.ico`,
        },
      },
      datePublished: extraData?.createdAt || new Date().toISOString(),
      dateModified: extraData?.updatedAt || new Date().toISOString(),
    };
  }

  // 4. FAQPage Schema
  if (schemaType === 'FAQPage' && extraData?.faqs) {
    return {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: extraData.faqs.map((f: any) => ({
        '@type': 'Question',
        name: f.question_en || f.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: f.answer_en || f.answer,
        },
      })),
    };
  }

  return null;
}
