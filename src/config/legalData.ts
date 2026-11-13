/**
 * Complete Legal, SLA & Operational Policies Dataset
 * Single source of truth for Terms of Service, Privacy Policy, Refund Policy, About, and Contact pages.
 */

export const REFUND_POLICY_DATA = {
  summaryBox:
    '100% Risk-Free Web Hosting: Request a full refund within 30 days of your initial hosting purchase if you are not satisfied—processed back to your bKash, Nagad, or Card within 24–48 hours.',
  guaranteeDays: 30,
  coveredServices: [
    'Starter Pack Hosting (Monthly & Annual plans)',
    'Developer Pro Cloud Hosting (Monthly & Annual plans)',
    'Business Max WooCommerce Hosting (Monthly & Annual plans)',
  ],
  nonRefundableItems: [
    'Domain name registrations (.com, .net, .org, .xyz, .io, .ai, etc.) because ICANN registry wholesale fees are immediate and irreversible.',
    'Domain renewals and inbound domain transfers.',
    'Dedicated IPv4 address allocations once assigned.',
  ],
  ownershipClause:
    'While domain fees cannot be refunded due to registry regulations, you retain 100% legal ownership of your domain and can manage its DNS or transfer it freely to any registrar.',
  abuseException:
    'Accounts terminated for severe Terms of Service violations—including phishing, malware distribution, DDoS botnets, cryptomining, or bulk unsolicited email (SPAM)—forfeit all refund eligibility.',
  refundProcessTime: 'Processed within 24 to 48 business hours back to original bKash, Nagad, Rocket, or Stripe card account.',
};

export const TERMS_OF_SERVICE_DATA = {
  summaryBox:
    'Plain English Summary: 99.9% Global Uptime SLA with 10% credit per 30 minutes of downtime, isolated CloudLinux LVE resource protections, zero price increases on renewal, and strict prohibition of malware and spam.',
  slaGuaranteePercent: '99.9%',
  slaCreditFormula:
    'We guarantee 99.9% network and power availability every calendar month across our Singapore and USA datacenters. If monthly uptime drops below 99.9%, clients receive 10% service credit for every 30 minutes of downtime below the threshold (up to 100% of that month\'s hosting fee).',
  cloudLinuxLvePolicy: {
    description:
      'Each hosting account operates inside an isolated CloudLinux LVE container with dedicated memory, CPU cores, and Inode limits to guarantee neighbor accounts never degrade your performance.',
    starter: '1 GB RAM | 1 Core CPU | 150,000 Inodes | 25 MB/s Disk I/O',
    developerPro: '2 GB RAM | 2 Cores CPU | 300,000 Inodes | 50 MB/s Disk I/O',
    businessMax: '4 GB RAM | 2 Cores (High Freq) | 600,000 Inodes | 100 MB/s Disk I/O',
  },
  prohibitedActivities: [
    'Cryptocurrency mining scripts or intensive background hashing.',
    'Public open proxy relays, Tor exit nodes, and unauthorized VPN tunnels.',
    'Torrent seeding, copyrighted media streaming, and warez distribution.',
    'Unsolicited bulk email (SPAM), email harvesting, and phishing landing pages.',
  ],
  billingLifecycle: {
    invoiceGeneration: 'Renewal invoices are generated 7 days prior to the payment due date.',
    gracePeriod: 'Automated email reminders sent 3 days before and 1 day after the due date.',
    suspension: 'Overdue accounts are automatically suspended 3 days after the due date via WHM API.',
    termination: 'Permanently scheduled for secure data termination and Inode cleanup 14 days after the due date.',
  },
};

export const PRIVACY_POLICY_DATA = {
  summaryBox:
    'Privacy Guarantee: We never sell or monetize your personal information, never inspect your source code or databases, and never store raw credit card numbers or bKash/Nagad PINs on our servers.',
  paymentSecurity:
    'We never store raw credit card numbers, bKash PINs, or Nagad OTPs on our servers. All transactions are processed via encrypted tokenization through official bKash Merchant API, Nagad PGW, or Stripe PCI-DSS Level 1 gateways.',
  codeOwnership:
    'Developers and business owners retain 100% intellectual property rights to all source code, databases, and digital assets hosted on our NVMe clusters. We never train AI models or index your private repositories.',
  dataRetention:
    'Standard HTTP server logs (IP address, user agent, timestamp) are retained for 30 days strictly for DDoS defense and security analysis before automatic purging.',
  gdprRights:
    'Clients may export their data or request permanent account deletion at any time via the DevHost Client Dashboard.',
};

export const CONTACT_DATA = {
  ticketDesk: {
    title: '24/7 Technical Ticket Desk',
    url: '/dashboard?tab=support',
    responseTime: '< 15 minutes average response',
    desc: 'Direct escalation queue handled by senior Linux and DevOps engineers.',
  },
  whatsapp: {
    title: 'Instant WhatsApp Escalation',
    number: '+8801700000000',
    url: 'https://wa.me/8801700000000?text=Hello%20DevHost%20Cloud%20Team!%20I%20have%20an%20inquiry.',
    desc: 'Live chat support for billing verification and urgent pre-sales inquiries.',
  },
  datacenters: [
    {
      name: 'Singapore Equinix SG1 Tier-IV',
      location: 'Singapore (Asia-Pacific)',
      latencyBD: '~35–45 ms to Bangladesh',
      purpose: 'Ultra-low latency for South Asia & Asia-Pacific visitors',
    },
    {
      name: 'USA East (Ashburn, VA Tier-IV)',
      location: 'Virginia (North America)',
      latencyBD: '~190 ms (Global CDN Ready)',
      purpose: 'Optimal for North American and European low-latency reach',
    },
  ],
};

export const ABOUT_DATA = {
  mission:
    'Bridging the gap between the developer agility of Vercel and the open reliability of cPanel—without surprise bandwidth invoices or renewal price traps.',
  story:
    'DevHost Cloud was built by developers who were frustrated by the false dichotomy of modern web hosting: pay exorbitant bandwidth bills on proprietary serverless platforms, or suffer slow, cluttered shared hosts with bait-and-switch renewal rates. We engineered a platform that provides 1-click GitHub Actions zero-downtime CI/CD, isolated CloudLinux NVMe resources, and native bKash/Nagad checkout with locked-in pricing forever.',
  pillars: [
    {
      title: 'Pure PCIe Gen4 NVMe Performance',
      desc: 'Zero spinning hard drives or budget SATA SSDs. 50–100 MB/s dedicated I/O throughput on every tier.',
    },
    {
      title: 'Locked-In Lifetime Renewal Pricing',
      desc: 'We never hike prices on year two. What you sign up for is your locked renewal rate forever.',
    },
    {
      title: 'Senior Engineer Support in English & Bangla',
      desc: 'No automated bots reading scripts. Real systems engineers responding to tickets in under 15 minutes.',
    },
  ],
};
