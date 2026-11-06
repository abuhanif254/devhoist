'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Globe,
  Radio,
  Activity,
  Zap,
  RotateCw,
  Play,
  Pause,
  Layers,
  MapPin,
  Lock,
  Cpu,
  Flame,
  CheckCircle2,
} from 'lucide-react';

interface SecurityNode {
  id: string;
  city: string;
  country: string;
  flag: string;
  facility: string;
  lat: number;
  lng: number;
  latencyToBD: string;
  scrubbingCapacity: string;
  uptime: string;
  hardware: string;
  cableRoute: string;
  color: string;
  protectionLayers: string[];
}

const SECURITY_NODES: SecurityNode[] = [
  {
    id: 'dhaka',
    city: 'Dhaka',
    country: 'Bangladesh',
    flag: '🇧🇩',
    facility: 'Direct BDIX Edge & Local DDoS Scrubbing',
    lat: 23.8103,
    lng: 90.4125,
    latencyToBD: '4ms (Direct BDIX)',
    scrubbingCapacity: '200 Gbps Local BDIX Scrubbing',
    uptime: '100%',
    hardware: 'Dual AMD EPYC 9654 • Hardware FlowSpec • Imunify360 AI',
    cableRoute: 'BDIX Core IXP Exchange Direct Ring',
    color: '#10B981',
    protectionLayers: ['Local BDIX Peering', 'CageFS Kernel Sandboxing', 'Imunify360 AI Heuristics'],
  },
  {
    id: 'sg',
    city: 'Singapore',
    country: 'Singapore',
    flag: '🇸🇬',
    facility: 'Equinix SG1 Tier-IV Primary Scrubbing Center',
    lat: 1.3521,
    lng: 103.8198,
    latencyToBD: '38ms (Submarine Transit)',
    scrubbingCapacity: '1.2 Tbps Anycast Terabit Scrubbing',
    uptime: '99.99%',
    hardware: 'Dual AMD EPYC 9654 • 1.5 TB DDR5 ECC • Corero SmartWall',
    cableRoute: 'SEA-ME-WE 5 & SMW4 Subsea Optical Express',
    color: '#06B6D4',
    protectionLayers: ['L3/L4 Corero SmartWall', 'ModSecurity OWASP Core', 'LiteSpeed Hardware WAF'],
  },
  {
    id: 'us',
    city: 'Ashburn, VA',
    country: 'United States',
    flag: '🇺🇸',
    facility: 'Equinix DC2 Tier-IV (Global Internet Alley)',
    lat: 39.0438,
    lng: -77.4874,
    latencyToBD: '185ms (Global Anycast)',
    scrubbingCapacity: '2.5 Tbps Multi-Carrier Core Defense',
    uptime: '99.99%',
    hardware: 'Enterprise AMD EPYC • Multi-Tbps Scrubbing Hardware Fabric',
    cableRoute: 'Transatlantic Apollo / Yellow Subsea Fiber Ring',
    color: '#3B82F6',
    protectionLayers: ['Anycast BGP4 FlowSpec', 'SYN Proxy Defense', 'Volumetric UDP Absorption'],
  },
  {
    id: 'lon',
    city: 'London',
    country: 'United Kingdom',
    flag: '🇬🇧',
    facility: 'Telehouse North Two (LINX Scrubbing)',
    lat: 51.5074,
    lng: -0.1278,
    latencyToBD: '125ms (European Core)',
    scrubbingCapacity: '800 Gbps LINX Anti-DDoS Fabric',
    uptime: '99.99%',
    hardware: 'Intel Xeon Platinum • Hardware Edge Filters',
    cableRoute: 'SMW-5 Cable to Marseille + Euro-Ring',
    color: '#8B5CF6',
    protectionLayers: ['HTTP/2 Rapid Reset Shield', 'TLS 1.3 Inspection', 'Rate-Limiting IP Reputation'],
  },
  {
    id: 'fra',
    city: 'Frankfurt',
    country: 'Germany',
    flag: '🇩🇪',
    facility: 'DE-CIX Interxion FRA Tier-IV',
    lat: 50.1109,
    lng: 8.6821,
    latencyToBD: '130ms (Central Europe)',
    scrubbingCapacity: '1.0 Tbps DE-CIX Scrubbing',
    uptime: '99.99%',
    hardware: 'Dual AMD EPYC 7763 • Imunify360 Herd Immunity',
    cableRoute: 'Trans-Eurasia Optical Terrestrial Express',
    color: '#6366F1',
    protectionLayers: ['DNS Amplification Filter', 'OWASP Top-10 Ruleset', 'KernelCare Live Patching'],
  },
  {
    id: 'tyo',
    city: 'Tokyo',
    country: 'Japan',
    flag: '🇯🇵',
    facility: 'Equinix TY2 Tier-IV',
    lat: 35.6762,
    lng: 139.6503,
    latencyToBD: '78ms (East Asia)',
    scrubbingCapacity: '600 Gbps JPIX Anycast Hub',
    uptime: '99.99%',
    hardware: 'AMD EPYC 9554 • Enterprise NVMe RAID',
    cableRoute: 'Asia Submarine-cable Express (ASE)',
    color: '#EC4899',
    protectionLayers: ['Automated BGP Blackholing', 'Botnet Fingerprinting', 'Zero-Day Vulnerability Patching'],
  },
];

const SECURITY_LINKS: [string, string][] = [
  ['dhaka', 'sg'],
  ['dhaka', 'fra'],
  ['sg', 'tyo'],
  ['fra', 'lon'],
  ['lon', 'us'],
  ['us', 'sg'],
];

function latLngToVector(lat: number, lng: number): [number, number, number] {
  const phi = (lat * Math.PI) / 180;
  const lambda = (lng * Math.PI) / 180;
  return [
    Math.cos(phi) * Math.sin(lambda),
    -Math.sin(phi),
    Math.cos(phi) * Math.cos(lambda),
  ];
}

function slerp(v1: [number, number, number], v2: [number, number, number], t: number): [number, number, number] {
  const dot = Math.max(-1, Math.min(1, v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2]));
  const omega = Math.acos(dot);
  if (omega < 0.001) return v1;
  const sinOmega = Math.sin(omega);
  const a = Math.sin((1 - t) * omega) / sinOmega;
  const b = Math.sin(t * omega) / sinOmega;
  return [
    a * v1[0] + b * v2[0],
    a * v1[1] + b * v2[1],
    a * v1[2] + b * v2[2],
  ];
}

function generateWorldLandDots(): { lat: number; lng: number }[] {
  const dots: { lat: number; lng: number }[] = [];
  const step = 3.6;

  function isLand(lat: number, lng: number): boolean {
    if (lat >= 15 && lat <= 70 && lng >= -168 && lng <= -52) {
      if (lat >= 50 && lng >= -165 && lng <= -55) return true;
      if (lat >= 25 && lat <= 49 && lng >= -125 && lng <= -68) {
        if (lat < 30 && lng > -85) return false;
        return true;
      }
      if (lat >= 14 && lat <= 32 && lng >= -115 && lng <= -85) return true;
      if (lat >= 8 && lat <= 16 && lng >= -90 && lng <= -77) return true;
    }
    if (lat >= -56 && lat <= 13 && lng >= -82 && lng <= -34) {
      if (lat > -20) return true;
      const width = (lat + 56) / 36;
      if (Math.abs(lng - (-65)) <= width * 25) return true;
    }
    if (lat >= 36 && lat <= 71 && lng >= -11 && lng <= 42) {
      if (lat >= 50 && lat <= 60 && lng >= -11 && lng <= 2) return true;
      if (lat >= 55 && lat <= 71 && lng >= 5 && lng <= 32) return true;
      if (lat >= 36 && lat <= 55 && lng >= -10 && lng <= 35) {
        if (lat < 42 && lng > 0 && lng < 12) return false;
        return true;
      }
    }
    if (lat >= -35 && lat <= 37 && lng >= -18 && lng <= 52) {
      if (lat >= 15 && lng >= -17 && lng <= 36) return true;
      if (lat >= -5 && lat < 15 && lng >= -15 && lng <= 44) return true;
      if (lat >= -35 && lat < -5 && lng >= 12 && lng <= 36) return true;
      if (lat >= -25 && lat <= -12 && lng >= 43 && lng <= 51) return true;
    }
    if (lat >= 5 && lat <= 75 && lng >= 35 && lng <= 180) {
      if (lat >= 12 && lat <= 35 && lng >= 35 && lng <= 60) return true;
      if (lat >= 7 && lat <= 36 && lng >= 68 && lng <= 93) return true;
      if (lat >= 20 && lat <= 55 && lng >= 75 && lng <= 135) return true;
      if (lat >= 30 && lat <= 46 && lng >= 129 && lng <= 146) return true;
      if (lat >= 34 && lat <= 42 && lng >= 124 && lng <= 130) return true;
      if (lat >= 50 && lat <= 75 && lng >= 40 && lng <= 175) return true;
    }
    if (lat >= -11 && lat <= 20 && lng >= 95 && lng <= 150) {
      if (lat >= 8 && lat <= 22 && lng >= 98 && lng <= 110) return true;
      if (lat >= 1 && lat <= 7 && lng >= 100 && lng <= 105) return true;
      if (lat >= -9 && lat <= 5 && lng >= 95 && lng <= 120) return true;
      if (lat >= -5 && lat <= 6 && lng >= 108 && lng <= 118) return true;
      if (lat >= 5 && lat <= 19 && lng >= 118 && lng <= 126) return true;
    }
    if (lat >= -45 && lat <= -10 && lng >= 112 && lng <= 180) {
      if (lat >= -39 && lat <= -11 && lng >= 113 && lng <= 154) return true;
      if (lat >= -47 && lat <= -34 && lng >= 166 && lng <= 179) return true;
    }
    return false;
  }

  for (let lat = -65; lat <= 75; lat += step) {
    const cosLat = Math.cos((lat * Math.PI) / 180);
    const lngStep = Math.max(step, step / (cosLat + 0.15));
    for (let lng = -180; lng <= 180; lng += lngStep) {
      if (isLand(lat, lng)) {
        dots.push({ lat: Math.round(lat * 10) / 10, lng: Math.round(lng * 10) / 10 });
      }
    }
  }

  return dots;
}

export default function SecurityPerimeterVisual() {
  const [selectedNode, setSelectedNode] = useState<SecurityNode>(SECURITY_NODES[0]);
  const [viewMode, setViewMode] = useState<'3d' | '2d'>('3d');
  const [isRotating, setIsRotating] = useState(true);
  const [isAttackMode, setIsAttackMode] = useState(false);
  const [blockedCount, setBlockedCount] = useState(1482030);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const yawRef = useRef<number>(-1.5);
  const pitchRef = useRef<number>(0.28);
  const targetYawRef = useRef<number>(-1.5);
  const targetPitchRef = useRef<number>(0.28);
  const isAnimatingToTargetRef = useRef<boolean>(false);

  const isDraggingRef = useRef<boolean>(false);
  const lastMousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const velocityRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const autoRotateTimerRef = useRef<NodeJS.Timeout | null>(null);

  const worldLandDots = useMemo(() => generateWorldLandDots(), []);
  const nodeVectors = useMemo(() => {
    const map = new Map<string, [number, number, number]>();
    SECURITY_NODES.forEach((n) => map.set(n.id, latLngToVector(n.lat, n.lng)));
    return map;
  }, []);

  const focusOnNode = useCallback((node: SecurityNode) => {
    setSelectedNode(node);
    const targetLngRad = (node.lng * Math.PI) / 180;
    const targetLatRad = (node.lat * Math.PI) / 180;
    targetYawRef.current = -targetLngRad;
    targetPitchRef.current = targetLatRad * 0.85;
    isAnimatingToTargetRef.current = true;
  }, []);

  // Increment blocked packets during simulated attack
  useEffect(() => {
    if (!isAttackMode) return;
    const interval = setInterval(() => {
      setBlockedCount((prev) => prev + Math.floor(Math.random() * 45000 + 15000));
    }, 400);
    return () => clearInterval(interval);
  }, [isAttackMode]);

  // Main 3D Canvas Engine with DDoS Threat Deflection Simulation
  useEffect(() => {
    if (viewMode !== '3d') return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let animId: number;
    let packetProgress = 0;

    // Simulated threat particles in orbit
    const threatParticles: {
      fromAngle: number;
      fromLat: number;
      progress: number;
      targetNodeId: string;
      speed: number;
    }[] = [];

    for (let i = 0; i < 28; i++) {
      threatParticles.push({
        fromAngle: Math.random() * Math.PI * 2,
        fromLat: (Math.random() - 0.5) * Math.PI,
        progress: Math.random(),
        targetNodeId: SECURITY_NODES[i % SECURITY_NODES.length].id,
        speed: 0.012 + Math.random() * 0.018,
      });
    }

    const render = () => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (width === 0 || height === 0) {
        animId = requestAnimationFrame(render);
        return;
      }

      const dpr = window.devicePixelRatio || 1;
      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      const cx = width / 2;
      const cy = height / 2;
      const radius = Math.max(120, Math.min(250, Math.min(width, height) * 0.38));

      // Handle rotation interpolation
      if (isAnimatingToTargetRef.current) {
        const dyaw = targetYawRef.current - yawRef.current;
        const dpitch = targetPitchRef.current - pitchRef.current;
        yawRef.current += dyaw * 0.08;
        pitchRef.current += dpitch * 0.08;
        if (Math.abs(dyaw) < 0.005 && Math.abs(dpitch) < 0.005) {
          isAnimatingToTargetRef.current = false;
        }
      } else if (!isDraggingRef.current && isRotating) {
        yawRef.current += velocityRef.current.x;
        pitchRef.current += velocityRef.current.y;
        velocityRef.current.x *= 0.95;
        velocityRef.current.y *= 0.95;
        yawRef.current -= 0.0035;
      }

      pitchRef.current = Math.max(-1.1, Math.min(1.1, pitchRef.current));
      const yaw = yawRef.current;
      const pitch = pitchRef.current;
      const cosYaw = Math.cos(yaw);
      const sinYaw = Math.sin(yaw);
      const cosPitch = Math.cos(pitch);
      const sinPitch = Math.sin(pitch);

      const projectPoint = (x0: number, y0: number, z0: number, r: number = radius) => {
        const x1 = x0 * cosYaw + z0 * sinYaw;
        const y1 = y0;
        const z1 = -x0 * sinYaw + z0 * cosYaw;
        const x2 = x1;
        const y2 = y1 * cosPitch - z1 * sinPitch;
        const z2 = y1 * sinPitch + z1 * cosPitch;
        const D = 3.6;
        const k = D / (D - z2);
        const px = cx + x2 * r * k;
        const py = cy + y2 * r * k;
        return { px, py, z: z2, isFront: z2 > -0.05, k };
      };

      // 1. Atmosphere / Threat Deflection Shield Aura
      const shieldPulse = isAttackMode ? 0.35 + Math.sin(Date.now() / 150) * 0.15 : 0.15;
      const auraGrad = ctx.createRadialGradient(cx, cy, radius * 0.8, cx, cy, radius * 1.35);
      if (isAttackMode) {
        auraGrad.addColorStop(0, 'rgba(16, 185, 129, 0.25)');
        auraGrad.addColorStop(0.6, 'rgba(239, 68, 68, 0.18)');
        auraGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      } else {
        auraGrad.addColorStop(0, 'rgba(16, 185, 129, 0.15)');
        auraGrad.addColorStop(0.6, 'rgba(6, 182, 212, 0.08)');
        auraGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      }
      ctx.fillStyle = auraGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 1.35, 0, Math.PI * 2);
      ctx.fill();

      // 2. 3D Body of Planet
      const bodyGrad = ctx.createRadialGradient(
        cx - radius * 0.3,
        cy - radius * 0.3,
        radius * 0.1,
        cx,
        cy,
        radius
      );
      bodyGrad.addColorStop(0, 'rgba(15, 23, 42, 0.98)');
      bodyGrad.addColorStop(0.7, 'rgba(2, 6, 23, 0.96)');
      bodyGrad.addColorStop(1, 'rgba(2, 6, 23, 0.85)');
      ctx.fillStyle = bodyGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();

      // Outer Shield Perimeter Ring
      ctx.strokeStyle = isAttackMode ? 'rgba(16, 185, 129, 0.9)' : 'rgba(56, 189, 248, 0.45)';
      ctx.lineWidth = isAttackMode ? 2.5 : 1.2;
      ctx.shadowColor = isAttackMode ? '#10B981' : '#38BDF8';
      ctx.shadowBlur = isAttackMode ? 14 : 4;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // 3. 3D Latitude Wireframe Grid
      const latCircles = [-45, -23.5, 0, 23.5, 45, 60];
      ctx.lineWidth = 0.5;
      latCircles.forEach((circleLat) => {
        const phi = (circleLat * Math.PI) / 180;
        const circleR = Math.cos(phi);
        const circleY = -Math.sin(phi);
        ctx.beginPath();
        let first = true;
        for (let a = 0; a <= Math.PI * 2 + 0.1; a += 0.15) {
          const x0 = circleR * Math.sin(a);
          const y0 = circleY;
          const z0 = circleR * Math.cos(a);
          const { px, py, isFront } = projectPoint(x0, y0, z0, radius);
          if (isFront) {
            ctx.strokeStyle = circleLat === 0 ? 'rgba(16, 185, 129, 0.3)' : 'rgba(148, 163, 184, 0.12)';
            if (first) {
              ctx.moveTo(px, py);
              first = false;
            } else {
              ctx.lineTo(px, py);
            }
          } else {
            first = true;
          }
        }
        ctx.stroke();
      });

      // 4. World Continent Dot-Matrix
      worldLandDots.forEach((d) => {
        const phi = (d.lat * Math.PI) / 180;
        const lambda = (d.lng * Math.PI) / 180;
        const x0 = Math.cos(phi) * Math.sin(lambda);
        const y0 = -Math.sin(phi);
        const z0 = Math.cos(phi) * Math.cos(lambda);

        const { px, py, z, isFront, k } = projectPoint(x0, y0, z0, radius);
        if (!isFront) return;

        const alpha = Math.max(0.12, Math.min(0.95, (z + 0.1) * 0.9));
        ctx.fillStyle = `rgba(56, 189, 248, ${alpha})`;
        ctx.beginPath();
        ctx.arc(px, py, Math.max(0.8, 1.4 * k), 0, Math.PI * 2);
        ctx.fill();
      });

      // 5. 3D Interconnect Fiber Arcs & Light Pulses
      packetProgress = (packetProgress + 0.007) % 1;
      const samplesPerArc = 28;

      SECURITY_LINKS.forEach(([fromId, toId]) => {
        const v1 = nodeVectors.get(fromId);
        const v2 = nodeVectors.get(toId);
        if (!v1 || !v2) return;

        ctx.beginPath();
        let hasStarted = false;
        const arcPoints: { px: number; py: number; z: number }[] = [];

        for (let i = 0; i <= samplesPerArc; i++) {
          const t = i / samplesPerArc;
          const vt = slerp(v1, v2, t);
          const altitude = Math.sin(Math.PI * t) * (radius * 0.22);
          const pt = projectPoint(vt[0], vt[1], vt[2], radius + altitude);
          arcPoints.push(pt);

          if (pt.isFront) {
            if (!hasStarted) {
              ctx.moveTo(pt.px, pt.py);
              hasStarted = true;
            } else {
              ctx.lineTo(pt.px, pt.py);
            }
          }
        }

        ctx.strokeStyle = fromId === 'dhaka' || toId === 'dhaka' ? 'rgba(16, 185, 129, 0.7)' : 'rgba(56, 189, 248, 0.45)';
        ctx.lineWidth = 1.4;
        ctx.stroke();

        // Photons
        const photonIdx = Math.floor(packetProgress * samplesPerArc);
        const pt = arcPoints[photonIdx];
        if (pt && pt.z > -0.05) {
          ctx.fillStyle = '#FFFFFF';
          ctx.shadowColor = '#10B981';
          ctx.shadowBlur = 8;
          ctx.beginPath();
          ctx.arc(pt.px, pt.py, 2.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      });

      // 6. Simulated DDoS Threat Particles Deflected by Edge Shield
      if (isAttackMode) {
        threatParticles.forEach((tp) => {
          tp.progress = (tp.progress + tp.speed) % 1;
          const targetVec = nodeVectors.get(tp.targetNodeId);
          if (!targetVec) return;

          // Parabolic attack vector from outer space toward target node
          const outerR = radius * (1.7 - tp.progress * 0.7);
          const { px, py, isFront, k } = projectPoint(targetVec[0], targetVec[1], targetVec[2], outerR);

          if (isFront) {
            // Threat packet
            ctx.fillStyle = '#EF4444';
            ctx.shadowColor = '#EF4444';
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.arc(px, py, 3 * k, 0, Math.PI * 2);
            ctx.fill();

            // When reaching perimeter (outerR ~ radius), draw green deflection spark
            if (tp.progress > 0.85) {
              ctx.strokeStyle = '#10B981';
              ctx.lineWidth = 1.5;
              ctx.shadowColor = '#10B981';
              ctx.shadowBlur = 12;
              ctx.beginPath();
              ctx.arc(px, py, (tp.progress - 0.85) * 45 * k, 0, Math.PI * 2);
              ctx.stroke();
            }
            ctx.shadowBlur = 0;
          }
        });
      }

      // 7. Security Nodes & Telemetry Pins
      SECURITY_NODES.forEach((node) => {
        const v = nodeVectors.get(node.id);
        if (!v) return;

        const isSelected = selectedNode.id === node.id;
        const { px, py, z, isFront, k } = projectPoint(v[0], v[1], v[2], radius);
        if (!isFront) return;

        // Pulse radar wave
        const wave = (Date.now() / 1200) % 1;
        ctx.strokeStyle = node.color;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(px, py, (8 + wave * 18) * k, 0, Math.PI * 2);
        ctx.stroke();

        // Solid Pin
        ctx.fillStyle = node.color;
        ctx.shadowColor = node.color;
        ctx.shadowBlur = isSelected ? 16 : 8;
        ctx.beginPath();
        ctx.arc(px, py, isSelected ? 6 * k : 4.5 * k, 0, Math.PI * 2);
        ctx.fill();

        // White specular core
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(px, py, isSelected ? 2.5 * k : 1.8 * k, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Floating HUD Label
        if (z > 0.1 || isSelected) {
          const labelText = `${node.city} (${node.latencyToBD.split(' ')[0]})`;
          ctx.font = isSelected
            ? 'bold 11px JetBrains Mono, monospace'
            : '10px JetBrains Mono, monospace';
          const textWidth = ctx.measureText(labelText).width;
          const boxW = textWidth + 14;
          const boxH = 20;
          const boxX = px - boxW / 2;
          const boxY = py - 26;

          ctx.fillStyle = isSelected ? 'rgba(15, 23, 42, 0.95)' : 'rgba(2, 6, 23, 0.85)';
          ctx.strokeStyle = isSelected ? node.color : 'rgba(255, 255, 255, 0.2)';
          ctx.lineWidth = isSelected ? 1.5 : 0.8;
          ctx.beginPath();
          ctx.roundRect(boxX, boxY, boxW, boxH, 6);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = isSelected ? '#FFFFFF' : '#E2E8F0';
          ctx.fillText(labelText, boxX + 7, boxY + 14);
        }
      });

      ctx.restore();
      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [viewMode, isRotating, isAttackMode, selectedNode, worldLandDots, nodeVectors]);

  // Pointer drag event handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    isDraggingRef.current = true;
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };
    velocityRef.current = { x: 0, y: 0 };
    if (autoRotateTimerRef.current) clearTimeout(autoRotateTimerRef.current);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - lastMousePosRef.current.x;
    const dy = e.clientY - lastMousePosRef.current.y;
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };
    const sensitivity = 0.0055;
    yawRef.current += dx * sensitivity;
    pitchRef.current -= dy * sensitivity;
    velocityRef.current = { x: dx * sensitivity * 0.6, y: -dy * sensitivity * 0.6 };
  };

  const handlePointerUp = () => {
    isDraggingRef.current = false;
    autoRotateTimerRef.current = setTimeout(() => {
      velocityRef.current = { x: 0, y: 0 };
    }, 3000);
  };

  return (
    <div className="w-full rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-zinc-950 p-5 sm:p-8 shadow-2xl relative overflow-hidden transition-all">
      {/* Header & Simulator Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 pb-6 border-b border-slate-100 dark:border-white/10">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-xs font-mono text-emerald-700 dark:text-emerald-300 font-semibold mb-2 shadow-xs">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>Terabit Anycast Perimeter &amp; BDIX DDoS Shield</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-100 flex items-center gap-2">
            <span>Global Anycast Backbone &amp; Tier-IV Facilities</span>
            <span className="hidden sm:inline-block px-2 py-0.5 rounded text-[10px] font-mono bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
              Corero + Imunify360 Active
            </span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 font-normal mt-1 max-w-2xl leading-relaxed">
            Drag the 3D security globe 360° to inspect Anycast scrubbing centers, live subsea fiber routing, and real-time threat deflection.
          </p>
        </div>

        {/* View Switcher & Attack Simulator Controls */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {/* Live Attack Simulator Button */}
          <button
            type="button"
            onClick={() => setIsAttackMode(!isAttackMode)}
            className={`px-3 py-1.5 rounded-xl font-mono text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              isAttackMode
                ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-600/30 animate-pulse'
                : 'bg-slate-100 hover:bg-slate-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-slate-800 dark:text-zinc-200 border border-slate-300 dark:border-white/10'
            }`}
          >
            <Flame className={`w-3.5 h-3.5 ${isAttackMode ? 'text-amber-300 animate-bounce' : 'text-rose-500'}`} />
            <span>{isAttackMode ? 'Scrubbing 1.5 Tbps Attack' : 'Simulate 1.5 Tbps DDoS'}</span>
          </button>

          {/* 3D / 2D Toggle */}
          <div className="inline-flex items-center p-1 rounded-xl bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-white/10 font-mono text-xs">
            <button
              type="button"
              onClick={() => setViewMode('3d')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-semibold transition-all cursor-pointer ${
                viewMode === '3d'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>3D Shield</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('2d')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-semibold transition-all cursor-pointer ${
                viewMode === '2d'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>2D Perimeter</span>
            </button>
          </div>

          {/* Auto-Rotation Play/Pause */}
          {viewMode === '3d' && (
            <button
              type="button"
              onClick={() => setIsRotating(!isRotating)}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-zinc-300 transition-colors cursor-pointer"
              title={isRotating ? 'Pause Rotation' : 'Resume Rotation'}
            >
              {isRotating ? <Pause className="w-4 h-4 text-amber-500" /> : <Play className="w-4 h-4 text-emerald-500" />}
            </button>
          )}
        </div>
      </div>

      {/* 3D Visualizer Viewport */}
      <div className="relative w-full aspect-[2/1] min-h-[360px] sm:min-h-[460px] mt-6 bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 shadow-inner flex items-center justify-center select-none">
        <div className="absolute inset-0 architectural-grid opacity-20 pointer-events-none" />

        {/* Live Attack Telemetry HUD Overlay in Top-Left Corner */}
        <div className="absolute top-4 left-4 z-30 font-mono text-[11px] space-y-1 bg-slate-900/85 backdrop-blur-md p-3 rounded-xl border border-white/10 text-slate-300 pointer-events-none shadow-lg">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${isAttackMode ? 'bg-rose-500 animate-ping' : 'bg-emerald-400 animate-pulse'}`} />
            <span className="text-white font-bold">
              {isAttackMode ? 'UNDER VOLUMETRIC ATTACK' : 'ANYCAST PERIMETER CLEAN'}
            </span>
          </div>
          <div className="text-[10px] text-slate-400">
            Scrubbed Threats: <span className="text-emerald-400 font-bold">{blockedCount.toLocaleString()} pkts</span>
          </div>
          <div className="text-[10px] text-cyan-400">
            Origin Load: <span className="text-white font-bold">0.00% (Clean Line)</span>
          </div>
        </div>

        {/* Selected Node HUD in Top-Right Corner */}
        <div className="absolute top-4 right-4 z-30 font-mono text-xs text-right bg-slate-900/85 backdrop-blur-md p-3 rounded-xl border border-white/10 shadow-lg max-w-[240px]">
          <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Protected Cluster:</div>
          <div className="text-sm font-bold text-white mt-0.5 flex items-center justify-end gap-1.5">
            <span>{selectedNode.flag}</span>
            <span>{selectedNode.city}</span>
          </div>
          <div className="text-[11px] font-semibold text-emerald-400 mt-1 flex items-center justify-end gap-1">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Capacity: {selectedNode.scrubbingCapacity.split(' ')[0]}</span>
          </div>
          <div className="text-[10px] text-cyan-400 truncate mt-0.5">
            {selectedNode.latencyToBD}
          </div>
        </div>

        {/* Drag Instruction */}
        {viewMode === '3d' && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 px-3 py-1 rounded-full bg-slate-900/80 backdrop-blur-md border border-white/10 text-slate-400 font-mono text-[10px] flex items-center gap-1.5 pointer-events-none">
            <RotateCw className="w-3 h-3 text-cyan-400 animate-spin" />
            <span>Click &amp; Drag to inspect 360° Threat Defense</span>
          </div>
        )}

        {/* 3D Canvas */}
        {viewMode === '3d' && (
          <canvas
            ref={canvasRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            className="w-full h-full cursor-grab active:cursor-grabbing touch-none z-10"
          />
        )}

        {/* 2D Planar SVG View */}
        {viewMode === '2d' && (
          <div className="relative w-full h-full flex items-center justify-center p-4">
            <svg viewBox="0 0 1000 500" className="w-full h-full object-contain">
              <line x1="0" y1="125" x2="1000" y2="125" stroke="rgba(255,255,255,0.06)" strokeDasharray="4 6" />
              <line x1="0" y1="250" x2="1000" y2="250" stroke="rgba(255,255,255,0.08)" strokeDasharray="4 6" />
              <line x1="0" y1="375" x2="1000" y2="375" stroke="rgba(255,255,255,0.06)" strokeDasharray="4 6" />

              {worldLandDots.map((d, i) => {
                const px = ((d.lng + 180) / 360) * 1000;
                const py = ((90 - d.lat) / 180) * 500;
                return <circle key={i} cx={px} cy={py} r="1.4" fill="rgba(56, 189, 248, 0.45)" />;
              })}

              {SECURITY_LINKS.map(([fromId, toId], idx) => {
                const from = SECURITY_NODES.find((n) => n.id === fromId);
                const to = SECURITY_NODES.find((n) => n.id === toId);
                if (!from || !to) return null;
                const x1 = ((from.lng + 180) / 360) * 1000;
                const y1 = ((90 - from.lat) / 180) * 500;
                const x2 = ((to.lng + 180) / 360) * 1000;
                const y2 = ((90 - to.lat) / 180) * 500;
                const midX = (x1 + x2) / 2;
                const midY = Math.min(y1, y2) - 35;
                return (
                  <path
                    key={idx}
                    d={`M ${x1} ${y1} Q ${midX} ${midY} ${x2} ${y2}`}
                    fill="none"
                    stroke="#10B981"
                    strokeWidth="2"
                    strokeDasharray="6 6"
                    className="animate-pipeline-beam"
                  />
                );
              })}

              {SECURITY_NODES.map((node) => {
                const px = ((node.lng + 180) / 360) * 1000;
                const py = ((90 - node.lat) / 180) * 500;
                const isSelected = selectedNode.id === node.id;
                return (
                  <g key={node.id} onClick={() => setSelectedNode(node)} className="cursor-pointer">
                    <circle cx={px} cy={py} r={isSelected ? '14' : '9'} fill={node.color} opacity="0.3" className="animate-ping" />
                    <circle cx={px} cy={py} r={isSelected ? '6' : '4.5'} fill={node.color} stroke="#FFFFFF" strokeWidth="2" />
                    <text x={px} y={py - 12} textAnchor="middle" fill="#FFFFFF" fontSize="10" fontFamily="monospace" fontWeight="bold">
                      {node.city} ({node.latencyToBD.split(' ')[0]})
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        )}
      </div>

      {/* Node Selector Pills */}
      <div className="flex flex-wrap items-center gap-2 mt-5">
        <span className="text-xs font-mono text-slate-500 dark:text-zinc-400 font-semibold mr-1 flex items-center gap-1">
          <MapPin className="w-3.5 h-3.5 text-blue-600" />
          <span>Inspect Scrubbing Node:</span>
        </span>
        {SECURITY_NODES.map((node) => {
          const isSelected = selectedNode.id === node.id;
          return (
            <button
              key={node.id}
              type="button"
              onClick={() => focusOnNode(node)}
              className={`px-3 py-1.5 rounded-xl text-xs font-mono font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                isSelected
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 scale-105'
                  : 'bg-slate-100 hover:bg-slate-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-white/10'
              }`}
            >
              <span>{node.flag}</span>
              <span>{node.city}</span>
              <span className={`text-[10px] font-bold ${isSelected ? 'text-white' : 'text-emerald-600 dark:text-emerald-400'}`}>
                {node.latencyToBD.split(' ')[0]}
              </span>
            </button>
          );
        })}
      </div>

      {/* Selected Node Security Architecture Card */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-100 dark:border-white/10 font-mono text-xs">
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-900/60 border border-slate-200 dark:border-white/10 space-y-1">
          <span className="text-slate-500 dark:text-zinc-400 text-[11px] block font-semibold uppercase tracking-wider">
            Scrubbing Facility:
          </span>
          <div className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-1.5">
            <span>{selectedNode.flag}</span>
            <span>{selectedNode.facility}</span>
          </div>
          <span className="text-[10px] text-slate-500 dark:text-zinc-500 block">
            Tier-IV Certified • Dual Redundant Feed
          </span>
        </div>

        <div className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-900/60 border border-slate-200 dark:border-white/10 space-y-1">
          <span className="text-slate-500 dark:text-zinc-400 text-[11px] block font-semibold uppercase tracking-wider">
            Mitigation Throughput:
          </span>
          <div className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">
            {selectedNode.scrubbingCapacity}
          </div>
          <span className="text-[10px] text-slate-500 dark:text-zinc-500 block">
            Automated BGP FlowSpec Scrubbing
          </span>
        </div>

        <div className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-900/60 border border-slate-200 dark:border-white/10 space-y-1">
          <span className="text-slate-500 dark:text-zinc-400 text-[11px] block font-semibold uppercase tracking-wider">
            Hardware Perimeter:
          </span>
          <div className="font-bold text-blue-600 dark:text-blue-400 text-sm">
            Corero SmartWall + Imunify360
          </div>
          <span className="text-[10px] text-slate-500 dark:text-zinc-500 block truncate">
            {selectedNode.hardware}
          </span>
        </div>

        <div className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-900/60 border border-slate-200 dark:border-white/10 space-y-1">
          <span className="text-slate-500 dark:text-zinc-400 text-[11px] block font-semibold uppercase tracking-wider">
            Subsea Fiber Backbone:
          </span>
          <div className="font-bold text-slate-900 dark:text-zinc-100 text-sm truncate">
            {selectedNode.cableRoute}
          </div>
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold block">
            BDIX Latency: {selectedNode.latencyToBD}
          </span>
        </div>
      </div>
    </div>
  );
}
