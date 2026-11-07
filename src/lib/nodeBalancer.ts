/**
 * DevHost Cloud - Smart Multi-Node Bin-Packing Load Balancer
 * Assigns customer accounts to the optimal server cluster node using weighted capacity scoring.
 * Alerts Founder when nodes cross the 80% capacity threshold.
 * 100% Edge-Compatible (Cloudflare Workers & Web Standards)
 */

import { sendTelegramAlert } from './adminNotifier';

export interface WhmServerNodeRecord {
  id: string;
  node_code: string;
  node_name: string;
  datacenter_location: string;
  ipv4_address: string;
  whm_hostname: string;
  whm_username: string;
  primary_nameserver?: string;
  secondary_nameserver?: string;
  monthly_node_cost_bdt: number;
  max_cpanel_slots: number;
  used_cpanel_slots: number;
  max_disk_gb: number;
  allocated_disk_gb: number;
  auto_provision_enabled: boolean;
  is_healthy: boolean;
  status_message?: string;
}

export interface NodeSelectionCandidate {
  node: WhmServerNodeRecord;
  loadHealthScore: number; // 0 - 100 (higher means more available headroom)
  slotUtilizationPercent: number;
  diskAllocationPercent: number;
  isNearCapacity: boolean;
}

export interface NodeSelectionResult {
  selectedNode: WhmServerNodeRecord;
  loadHealthScore: number;
  candidates: NodeSelectionCandidate[];
  capacityWarning?: string;
}

/**
 * Computes the Load Health Score (0 - 100)
 * Weighted: 60% available cPanel account slots, 40% available allocated NVMe disk space
 */
export function computeNodeHealthScore(node: WhmServerNodeRecord): {
  score: number;
  slotPercent: number;
  diskPercent: number;
  isNearCapacity: boolean;
} {
  const maxSlots = Math.max(1, node.max_cpanel_slots || 50);
  const usedSlots = Math.max(0, node.used_cpanel_slots || 0);
  const slotUtilizationRatio = Math.min(1, usedSlots / maxSlots);

  const maxDisk = Math.max(1, node.max_disk_gb || 100);
  const allocatedDisk = Math.max(0, node.allocated_disk_gb || 0);
  const diskAllocationRatio = Math.min(1, allocatedDisk / maxDisk);

  const slotScore = (1 - slotUtilizationRatio) * 60;
  const diskScore = (1 - diskAllocationRatio) * 40;
  const finalScore = Math.round(slotScore + diskScore);

  const slotPercent = Math.round(slotUtilizationRatio * 100);
  const diskPercent = Math.round(diskAllocationRatio * 100);
  const isNearCapacity = slotPercent >= 80 || diskPercent >= 80;

  return {
    score: Math.max(0, Math.min(100, finalScore)),
    slotPercent,
    diskPercent,
    isNearCapacity,
  };
}

/**
 * Checks if a node has crossed the 80% capacity threshold and sends a proactive warning
 */
export function checkNodeCapacityThreshold(node: WhmServerNodeRecord): {
  isWarning: boolean;
  message?: string;
} {
  const { isNearCapacity, slotPercent, diskPercent } = computeNodeHealthScore(node);

  if (isNearCapacity) {
    const alert = `⚠️ <b>SERVER CAPACITY WARNING (80% THRESHOLD)</b>\n\n` +
      `• <b>Node:</b> ${node.node_name} (<code>${node.node_code}</code>)\n` +
      `• <b>Location:</b> ${node.datacenter_location}\n` +
      `• <b>Slot Utilization:</b> ${slotPercent}% (${node.used_cpanel_slots}/${node.max_cpanel_slots} accounts)\n` +
      `• <b>Disk Allocation:</b> ${diskPercent}% (${node.allocated_disk_gb}/${node.max_disk_gb} GB)\n\n` +
      `<b>Recommendation:</b> Provision next reseller node in cluster before remaining slots exhaust.`;

    sendTelegramAlert(alert).catch(() => {});
    return { isWarning: true, message: alert };
  }

  return { isWarning: false };
}

/**
 * Weighted Bin-Packing Node Selector: picks the healthiest node with maximum capacity headroom
 */
export function selectOptimalServerNode({
  nodes,
  preferredRegion = 'sg',
  requiredDiskGB = 5,
}: {
  nodes: WhmServerNodeRecord[];
  preferredRegion?: string;
  requiredDiskGB?: number;
}): NodeSelectionResult {
  if (!nodes || nodes.length === 0) {
    // Default fallback node if no database nodes are registered yet
    const fallbackNode: WhmServerNodeRecord = {
      id: 'default-sg1',
      node_code: 'sg1',
      node_name: 'Equinix SG1 Core Cluster',
      datacenter_location: 'Singapore (Equinix SG1)',
      ipv4_address: '103.151.102.45',
      whm_hostname: 'sg1.devhost.cloud',
      whm_username: 'root',
      primary_nameserver: 'ns1.devhost.cloud',
      secondary_nameserver: 'ns2.devhost.cloud',
      monthly_node_cost_bdt: 3500,
      max_cpanel_slots: 50,
      used_cpanel_slots: 12,
      max_disk_gb: 100,
      allocated_disk_gb: 24,
      auto_provision_enabled: true,
      is_healthy: true,
    };
    return {
      selectedNode: fallbackNode,
      loadHealthScore: 78,
      candidates: [
        {
          node: fallbackNode,
          loadHealthScore: 78,
          slotUtilizationPercent: 24,
          diskAllocationPercent: 24,
          isNearCapacity: false,
        },
      ],
    };
  }

  // 1. Filter eligible nodes
  const eligibleNodes = nodes.filter((node) => {
    if (!node.auto_provision_enabled || !node.is_healthy) return false;
    const hasSlot = node.used_cpanel_slots < node.max_cpanel_slots;
    const hasDisk = (node.max_disk_gb - node.allocated_disk_gb) >= requiredDiskGB;
    return hasSlot && hasDisk;
  });

  const targetPool = eligibleNodes.length > 0 ? eligibleNodes : nodes;

  // 2. Score candidates
  const candidates: NodeSelectionCandidate[] = targetPool.map((node) => {
    const { score, slotPercent, diskPercent, isNearCapacity } = computeNodeHealthScore(node);
    // Regional boost if matches preferred region
    const regionMatches =
      node.node_code.toLowerCase().includes(preferredRegion.toLowerCase()) ||
      node.datacenter_location.toLowerCase().includes(preferredRegion.toLowerCase());
    const finalCandidateScore = regionMatches ? score + 10 : score;

    return {
      node,
      loadHealthScore: finalCandidateScore,
      slotUtilizationPercent: slotPercent,
      diskAllocationPercent: diskPercent,
      isNearCapacity,
    };
  });

  // 3. Sort by loadHealthScore descending
  candidates.sort((a, b) => b.loadHealthScore - a.loadHealthScore);

  const bestCandidate = candidates[0];

  let warning: string | undefined;
  if (bestCandidate.isNearCapacity) {
    warning = `Warning: Selected node (${bestCandidate.node.node_code}) has crossed 80% capacity limit.`;
  }

  return {
    selectedNode: bestCandidate.node,
    loadHealthScore: bestCandidate.loadHealthScore,
    candidates,
    capacityWarning: warning,
  };
}
