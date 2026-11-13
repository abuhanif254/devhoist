export interface FaqItem {
  question: string;
  answer: string;
}

export const COMPLETE_FAQ_LIST: FaqItem[] = [
  {
    question: 'How does DevHost Deploy keep builds fast without bloating storage or Inodes?',
    answer:
      'Static Next.js, Vite, and React apps deploy straight to R2 Global Edge via GitHub OAuth or Direct ZIP Upload with atomic URL routing, while full-stack SSR and Node.js apps run inside isolated Cloud Compute containers with clean release pruning.',
  },
  {
    question: 'Can I host custom Next.js, Node.js, Python, and Laravel apps alongside WordPress?',
    answer:
      'Yes. Deploy Next.js, Vite, and Node.js apps natively via DevHost Compute Engine & R2 Edge, or run CloudLinux Node.js Selector (up to Node v22), Python Selector, Composer, Jailed SSH, and Softaculous 1-Click WordPress on NVMe cPanel.',
  },
  {
    question: 'How fast is account activation when paying via bKash, Nagad, Wallet, or Stripe?',
    answer:
      '100% instant. Our billing plane uses automated bKash, Nagad, Atomic Wallet, and Stripe webhooks. As soon as your payment succeeds, DevHost Cloud automatically provisions your hosting service or compute app within seconds.',
  },
  {
    question: 'Where are your global servers located, and will my site load fast in Bangladesh and worldwide?',
    answer:
      'We operate tier-3 NVMe SSD servers in Singapore (Equinix) and the USA, paired with LiteSpeed Enterprise Web Server and Cloudflare CDN integration, delivering ~40–55ms latency across South Asia and sub-second loading globally.',
  },
  {
    question: 'Is the Sitejet AI Website Builder really free with all plans?',
    answer:
      'Yes. Every hosting plan includes the built-in cPanel Sitejet AI Builder at zero extra cost, allowing you to generate and customize professional websites using simple text prompts.',
  },
  {
    question: 'How does the Free Zero-Downtime Website Migration work?',
    answer:
      'Simply submit your old hosting details via our Free Migration page. Our engineers transfer your entire cPanel backup, WordPress files, databases, and emails to our NVMe server and help you switch DNS with zero downtime.',
  },
];

export function getFaqPageSchema(faqs: FaqItem[] = COMPLETE_FAQ_LIST) {
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
