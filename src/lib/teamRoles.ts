export type TeamRoleId =
  | 'full_admin'
  | 'devops_deployer'
  | 'dns_domain_manager'
  | 'billing_accountant'
  | 'readonly_auditor';

export const TEAM_ROLE_PRESETS: Record<
  TeamRoleId,
  {
    label: string;
    description: string;
    scopes: string[];
    badgeColor: string;
  }
> = {
  full_admin: {
    label: 'Full Organization Admin',
    description: 'Complete access to services, Git CI/CD, DNS, billing, and team management.',
    scopes: [
      'services:read',
      'services:write',
      'git:deploy',
      'env:write',
      'logs:read',
      'dns:write',
      'billing:write',
      'team:manage',
    ],
    badgeColor: 'purple',
  },
  devops_deployer: {
    label: 'DevOps Deployer (Git, .ENV & Logs Only)',
    description: 'Can push releases, manage .env secrets, and inspect logs. Strictly blocked from billing & domain transfers.',
    scopes: ['services:read', 'git:deploy', 'env:write', 'logs:read'],
    badgeColor: 'blue',
  },
  dns_domain_manager: {
    label: 'DNS & Domain Manager',
    description: 'Can edit DNS zone records, SSL certificates, and nameservers. No access to source code or billing.',
    scopes: ['domains:read', 'dns:write', 'ssl:manage'],
    badgeColor: 'emerald',
  },
  billing_accountant: {
    label: 'Billing Accountant (Invoices & Wallet Only)',
    description: 'Can view/pay invoices, download VAT receipts, and top up wallet. No access to servers or code.',
    scopes: ['billing:read', 'billing:write', 'invoices:download'],
    badgeColor: 'amber',
  },
  readonly_auditor: {
    label: 'Read-Only Security Auditor',
    description: 'View-only access to server telemetry, uptime SLA, and audit logs. Cannot modify any settings.',
    scopes: ['services:read', 'logs:read', 'billing:read'],
    badgeColor: 'slate',
  },
};
