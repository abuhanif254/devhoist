export interface FaqItem {
  question: string;
  answer: string;
}

export const COMPLETE_FAQ_LIST: FaqItem[] = [
  {
    question: 'How does GitHub Auto-Deployment avoid filling up my cPanel storage and Inodes?',
    answer:
      'By building your Next.js or Node.js app on GitHub Actions\' free runner and syncing only the compiled production artifacts via our overwrite script, node_modules bloat is eliminated and old releases are automatically cleaned up—saving up to 80% storage and Inodes.',
  },
  {
    question: 'Can I host custom Next.js, Node.js, Python, and Laravel apps alongside WordPress?',
    answer:
      'Yes. Our Developer Pro and Business Max plans include CloudLinux Node.js Selector (up to Node v22), Python Selector, Composer, Jailed SSH access, and Softaculous 1-Click WordPress on the same cPanel account.',
  },
  {
    question: 'How fast is account activation when paying via bKash or Nagad?',
    answer:
      '100% instant. Our billing portal uses automated bKash and Nagad API callbacks. As soon as your payment succeeds, WHMCS automatically creates your cPanel account and emails your login details within seconds.',
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
