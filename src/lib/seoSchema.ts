/**
 * DevHost Cloud - Dynamic SEO & JSON-LD Structured Data Generator
 * Computes live pricing ranges, product offers & FAQs for Google Rich Results.
 */

export interface SchemaPlan {
  name: string;
  priceMonthlyBDT: number;
  description: string;
  category?: string;
}

export interface SchemaTld {
  tld: string;
  regPriceBDT: number;
}

/**
 * Generates Google-compliant AggregateOffer Schema with dynamic low/high pricing
 */
export function generateAggregateOfferSchema(
  plans: SchemaPlan[],
  tlds?: SchemaTld[]
) {
  const allPrices = plans.map((p) => p.priceMonthlyBDT).filter((pr) => pr > 0);
  const lowPrice = allPrices.length > 0 ? Math.min(...allPrices) : 200;
  const highPrice = allPrices.length > 0 ? Math.max(...allPrices) : 9800;

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: 'DevHost Cloud NVMe Web & Developer Hosting',
    description:
      'High-performance cloud hosting with zero-downtime GitHub deployment, LiteSpeed caching, AMD EPYC NVMe SSDs in Singapore SG1 and instant bKash/Nagad checkout.',
    brand: {
      '@type': 'Brand',
      name: 'DevHost Cloud',
    },
    offers: {
      '@type': 'AggregateOffer',
      priceCurrency: 'BDT',
      lowPrice: lowPrice,
      highPrice: highPrice,
      offerCount: plans.length + (tlds?.length || 0),
      offers: plans.map((plan) => ({
        '@type': 'Offer',
        name: plan.name,
        price: plan.priceMonthlyBDT,
        priceCurrency: 'BDT',
        priceValidUntil: '2026-12-31',
        availability: 'https://schema.org/InStock',
        url: 'https://devhostcloud.com/pricing',
      })),
    },
  };
}

/**
 * Generates Single Product Schema for a specific hosting plan
 */
export function generateSingleProductSchema(plan: {
  name: string;
  slug: string;
  priceMonthlyBDT: number;
  description: string;
  category: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: `DevHost Cloud - ${plan.name}`,
    description: plan.description,
    sku: `DEVHOST-${plan.slug.toUpperCase()}`,
    offers: {
      '@type': 'Offer',
      price: plan.priceMonthlyBDT,
      priceCurrency: 'BDT',
      priceValidUntil: '2026-12-31',
      availability: 'https://schema.org/InStock',
      url: `https://devhostcloud.com/#pricing`,
    },
  };
}

/**
 * Generates Structured FAQPage Schema
 */
export function generateFaqSchema(faqs: { question: string; answer: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };
}
