/**
 * Cloud VPS & Custom Server Configurator Dataset & Calculation Engine
 * Strict pricing matrices and resource limits for DevHost Cloud KVM VPS.
 */

import { convertBdtToUsd } from '@/config/constants';

export interface VpsTier {
  id: string;
  pid: number;
  name: string;
  popular?: boolean;
  cpu: string;
  cpuCores: number;
  ram: string;
  ramGB: number;
  storage: string;
  storageGB: number;
  bandwidth: string;
  ipv4: string;
  monthlyBDT: number;
  monthlyUSD: number;
  features: string[];
}

export const VPS_PRECONFIGURED_TIERS: VpsTier[] = [
  {
    id: 'cloud-kvm-1',
    pid: 101,
    name: 'Cloud KVM-1',
    popular: false,
    cpu: '2 vCPU Cores',
    cpuCores: 2,
    ram: '4 GB DDR5 RAM',
    ramGB: 4,
    storage: '60 GB Pure NVMe SSD',
    storageGB: 60,
    bandwidth: '2 TB High-Speed Bandwidth',
    ipv4: '1 Dedicated IPv4',
    monthlyBDT: 1450,
    monthlyUSD: 12.08,
    features: [
      'KVM Hardware Virtualization',
      'PCIe Gen4 NVMe 3,500 MB/s',
      'Root SSH & Custom ISO Install',
      'Singapore & USA Tier-IV Datacenters',
      'Free Automated Weekly Snapshot',
      '10 Gbps Redundant Uplink',
    ],
  },
  {
    id: 'cloud-kvm-2',
    pid: 102,
    name: 'Cloud KVM-2',
    popular: true,
    cpu: '4 vCPU Cores',
    cpuCores: 4,
    ram: '8 GB DDR5 RAM',
    ramGB: 8,
    storage: '120 GB Pure NVMe SSD',
    storageGB: 120,
    bandwidth: '4 TB High-Speed Bandwidth',
    ipv4: '1 Dedicated IPv4',
    monthlyBDT: 2750,
    monthlyUSD: 22.92,
    features: [
      'High-Concurrency Production Ready',
      'PCIe Gen4 NVMe 3,500 MB/s',
      'Root SSH & Custom ISO Install',
      'Singapore & USA Tier-IV Datacenters',
      'Free Automated Weekly Snapshot',
      '10 Gbps Redundant Uplink',
      'Docker & Kubernetes MicroK8s Ready',
    ],
  },
  {
    id: 'cloud-kvm-4',
    pid: 103,
    name: 'Cloud KVM-4',
    popular: false,
    cpu: '6 vCPU Cores',
    cpuCores: 6,
    ram: '16 GB DDR5 RAM',
    ramGB: 16,
    storage: '240 GB Pure NVMe SSD',
    storageGB: 240,
    bandwidth: '8 TB High-Speed Bandwidth',
    ipv4: '1 Dedicated IPv4',
    monthlyBDT: 5200,
    monthlyUSD: 43.33,
    features: [
      'Multi-Tenant E-Commerce Scale',
      'PCIe Gen4 NVMe 3,500 MB/s',
      'Root SSH & Custom ISO Install',
      'Singapore & USA Tier-IV Datacenters',
      'Free Automated Weekly Snapshot',
      '10 Gbps Redundant Uplink',
      'Enterprise Redis & PostgreSQL Tuning',
    ],
  },
  {
    id: 'cloud-kvm-8',
    pid: 104,
    name: 'Cloud KVM-8',
    popular: false,
    cpu: '8 vCPU Cores',
    cpuCores: 8,
    ram: '32 GB DDR5 RAM',
    ramGB: 32,
    storage: '480 GB Pure NVMe SSD',
    storageGB: 480,
    bandwidth: '16 TB High-Speed Bandwidth',
    ipv4: '1 Dedicated IPv4 + IPv6 Subnet',
    monthlyBDT: 9800,
    monthlyUSD: 81.67,
    features: [
      'Heavy AI/Data Cluster & Large SaaS',
      'PCIe Gen4 NVMe 3,500 MB/s',
      'Dedicated vCPU Pinning Guarantee',
      'Singapore & USA Tier-IV Datacenters',
      'Daily Automated JetBackup Snapshots',
      '10 Gbps Redundant Uplink',
      'Direct Priority Engineering Ticket Queue',
    ],
  },
];

export interface ControlPanelOption {
  id: string;
  name: string;
  tag: string;
  monthlyCostBDT: number;
  monthlyCostUSD: number;
  description: string;
}

export const VPS_CONTROL_PANELS: ControlPanelOption[] = [
  {
    id: 'raw_ssh',
    name: 'Ubuntu 24.04 / AlmaLinux 9',
    tag: 'Raw SSH (No Panel)',
    monthlyCostBDT: 0,
    monthlyCostUSD: 0,
    description: 'Clean minimal OS with SSH root keys. Zero RAM overhead for Docker/Node/Go.',
  },
  {
    id: 'free_panel',
    name: 'CloudPanel / CyberPanel',
    tag: 'Pre-installed (Free)',
    monthlyCostBDT: 0,
    monthlyCostUSD: 0,
    description: 'Lightweight PHP/Node stack management with free Let’s Encrypt SSL and Nginx proxy.',
  },
  {
    id: 'directadmin',
    name: 'DirectAdmin Personal',
    tag: 'DirectAdmin License',
    monthlyCostBDT: 600,
    monthlyCostUSD: 5.0,
    description: 'Full web hosting control panel supporting up to 10 domains with low RAM footprint.',
  },
  {
    id: 'cpanel_solo',
    name: 'cPanel/WHM Solo Cloud',
    tag: 'cPanel Cloud License',
    monthlyCostBDT: 1850,
    monthlyCostUSD: 15.42,
    description: 'Industry-standard cPanel/WHM environment with 1 user account and full WHM root tools.',
  },
];

export const VPS_CONFIGURATOR_RANGES = {
  cpu: { min: 2, max: 16, step: 2, unitPriceBDT: 350 },
  ram: { min: 4, max: 64, step: 4, unitPriceBDT: 150 },
  storage: { min: 60, max: 500, step: 20, unitPriceBDTPer10GB: 50 },
  annualDiscountRate: 0.15, // 15% OFF for annual billing on VPS
};

/**
 * Calculates custom VPS price based on formula:
 * totalVpsMonthlyBDT = (cpuCores * 350) + (ramGB * 150) + ((storageGB / 10) * 50) + panelCost
 */
export function calculateCustomVpsPrice({
  cpuCores,
  ramGB,
  storageGB,
  panelId,
  isAnnual = false,
}: {
  cpuCores: number;
  ramGB: number;
  storageGB: number;
  panelId: string;
  isAnnual?: boolean;
}) {
  const panel = VPS_CONTROL_PANELS.find((p) => p.id === panelId) || VPS_CONTROL_PANELS[0];
  const cpuCost = cpuCores * VPS_CONFIGURATOR_RANGES.cpu.unitPriceBDT;
  const ramCost = ramGB * VPS_CONFIGURATOR_RANGES.ram.unitPriceBDT;
  const storageCost = (storageGB / 10) * VPS_CONFIGURATOR_RANGES.storage.unitPriceBDTPer10GB;
  const panelCost = panel.monthlyCostBDT;

  const baseMonthlyBDT = cpuCost + ramCost + storageCost + panelCost;
  const effectiveMonthlyBDT = isAnnual
    ? Math.round(baseMonthlyBDT * (1 - VPS_CONFIGURATOR_RANGES.annualDiscountRate))
    : baseMonthlyBDT;

  const annualTotalBDT = effectiveMonthlyBDT * 12;
  const annualSavingsBDT = baseMonthlyBDT * 12 - annualTotalBDT;

  const baseMonthlyUSD = convertBdtToUsd(baseMonthlyBDT);
  const effectiveMonthlyUSD = convertBdtToUsd(effectiveMonthlyBDT);
  const annualTotalUSD = convertBdtToUsd(annualTotalBDT);

  return {
    baseMonthlyBDT,
    effectiveMonthlyBDT,
    annualTotalBDT,
    annualSavingsBDT,
    baseMonthlyUSD,
    effectiveMonthlyUSD,
    annualTotalUSD,
    panel,
  };
}
