'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Globe,
  Server,
  Activity,
  ShieldCheck,
  Zap,
  RotateCw,
  Play,
  Pause,
  Maximize2,
  Minimize2,
  Radio,
  ArrowRight,
  Cpu,
  Layers,
  MapPin,
  ExternalLink,
} from 'lucide-react';

interface DatacenterNode {
  id: string;
  city: string;
  country: string;
  flag: string;
  facility: string;
  lat: number;
  lng: number;
  latencyToBD: string;
  uptime: string;
  bandwidth: string;
  hardware: string;
  cableRoute: string;
  color: string;
  hops: string[];
}

const NODES: DatacenterNode[] = [
  {
    id: 'dhaka',
    city: 'Dhaka',
    country: 'Bangladesh',
    flag: '🇧🇩',
    facility: 'Direct BDIX Edge Cache & Scrubbing',
    lat: 23.8103,
    lng: 90.4125,
    latencyToBD: '4ms (Local BDIX)',
    uptime: '100%',
    bandwidth: '10 Gbps BDIX Fabric',
    hardware: 'Dual AMD EPYC 9654 • 768 GB DDR5 • NVMe RAID-10',
    cableRoute: 'Direct BDIX Interconnect (Kawran Bazar & Mohakhali PoPs)',
    color: '#10B981', // Emerald
    hops: [
      'Local ISP Fiber Terminal (1ms)',
      'BDIX Core IXP Exchange (2ms)',
      'DevHost Cloud BDIX Edge Server (4ms)',
    ],
  },
  {
    id: 'sg',
    city: 'Singapore',
    country: 'Singapore',
    flag: '🇸🇬',
    facility: 'Equinix SG1 Tier-IV International Hub',
    lat: 1.3521,
    lng: 103.8198,
    latencyToBD: '38ms (Ultra-Low Latency)',
    uptime: '99.99%',
    bandwidth: '40 Gbps Tier-1 Transit',
    hardware: 'Dual AMD EPYC 9654 • 1.5 TB DDR5 ECC • Pure NVMe Gen5',
    cableRoute: 'SEA-ME-WE 5 & SMW4 Submarine Fiber Express',
    color: '#06B6D4', // Cyan
    hops: [
      'Local Visitor Gateway (1ms)',
      'Dhaka International Gateway (4ms)',
      'SMW-5 Subsea Cable Line (28ms)',
      'Equinix SG1 Equinix Internet Exchange (38ms)',
    ],
  },
  {
    id: 'us',
    city: 'Ashburn, VA',
    country: 'United States',
    flag: '🇺🇸',
    facility: 'Equinix DC2 Tier-IV (Data Center Alley)',
    lat: 39.0438,
    lng: -77.4874,
    latencyToBD: '185ms (Global Anycast)',
    uptime: '99.99%',
    bandwidth: '100 Gbps Multi-Carrier Core',
    hardware: 'Enterprise AMD EPYC • 2 TB RAM • Enterprise Ceph & NVMe',
    cableRoute: 'Transatlantic Apollo / Yellow Subsea Fiber Backbone',
    color: '#3B82F6', // Blue
    hops: [
      'Dhaka Gateway (4ms)',
      'Singapore / Middle East Transit (42ms)',
      'European Central Gateway (120ms)',
      'Ashburn DC2 Core Switch (185ms)',
    ],
  },
  {
    id: 'lon',
    city: 'London',
    country: 'United Kingdom',
    flag: '🇬🇧',
    facility: 'Telehouse North Two (LINX Core)',
    lat: 51.5074,
    lng: -0.1278,
    latencyToBD: '125ms (European Hub)',
    uptime: '99.99%',
    bandwidth: '40 Gbps LINX & LonAP',
    hardware: 'Intel Xeon Platinum • 512 GB ECC • NVMe Storage',
    cableRoute: 'SMW-5 Cable to Marseille + Terrestrial Euro-Ring',
    color: '#8B5CF6', // Purple
    hops: [
      'Dhaka Gateway (4ms)',
      'Middle East Fiber Link (65ms)',
      'Marseille Landing Station (98ms)',
      'London Telehouse North Two (125ms)',
    ],
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
    uptime: '99.99%',
    bandwidth: '50 Gbps DE-CIX Fabric',
    hardware: 'Dual AMD EPYC 7763 • 1 TB DDR4 • NVMe RAID',
    cableRoute: 'Trans-Eurasia Optical Terrestrial Express',
    color: '#6366F1', // Indigo
    hops: [
      'Dhaka Gateway (4ms)',
      'Gulf Direct Transit (55ms)',
      'Istanbul Gateway (85ms)',
      'Frankfurt DE-CIX Core (130ms)',
    ],
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
    uptime: '99.99%',
    bandwidth: '40 Gbps JPIX & BBIX',
    hardware: 'AMD EPYC 9554 • 768 GB RAM • NVMe Gen4',
    cableRoute: 'Asia Submarine-cable Express (ASE) via Singapore',
    color: '#EC4899', // Pink
    hops: [
      'Dhaka Gateway (4ms)',
      'Singapore SG1 Interconnect (38ms)',
      'Asia Submarine Express (62ms)',
      'Tokyo TY2 Core (78ms)',
    ],
  },
  {
    id: 'syd',
    city: 'Sydney',
    country: 'Australia',
    flag: '🇦🇺',
    facility: 'Equinix SY1 Core',
    lat: -33.8688,
    lng: 151.2093,
    latencyToBD: '142ms (Oceania)',
    uptime: '99.99%',
    bandwidth: '20 Gbps Megaport Fabric',
    hardware: 'AMD EPYC 7543 • 512 GB RAM • NVMe',
    cableRoute: 'Indigo-West Subsea Cable via Singapore / Perth',
    color: '#F59E0B', // Amber
    hops: [
      'Dhaka Gateway (4ms)',
      'Singapore Hub (38ms)',
      'Indigo Subsea Cable (115ms)',
      'Sydney SY1 Core (142ms)',
    ],
  },
];

// Fiber optic interconnect links between datacenters
const FIBER_LINKS: [string, string][] = [
  ['dhaka', 'sg'],   // Primary Asia Highway
  ['dhaka', 'fra'],  // Eurasia corridor
  ['sg', 'tyo'],     // East Asia express
  ['sg', 'syd'],     // Australia link
  ['fra', 'lon'],    // Euro-ring
  ['lon', 'us'],     // Transatlantic cable
  ['us', 'sg'],      // Trans-Pacific Anycast link
];

// 3D vector helper: convert lat/lng to unit sphere Cartesian coordinates
function latLngToVector(lat: number, lng: number): [number, number, number] {
  const phi = (lat * Math.PI) / 180;
  const lambda = (lng * Math.PI) / 180;
  return [
    Math.cos(phi) * Math.sin(lambda),
    -Math.sin(phi),
    Math.cos(phi) * Math.cos(lambda),
  ];
}

// Spherical linear interpolation between two unit vectors
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

// Procedural World Continent Dot Generator (Accurate Earth Silhouettes)
function generateWorldLandDots(): { lat: number; lng: number }[] {
  const dots: { lat: number; lng: number }[] = [];
  const step = 3.6;

  function isLand(lat: number, lng: number): boolean {
    // North America
    if (lat >= 15 && lat <= 70 && lng >= -168 && lng <= -52) {
      if (lat >= 50 && lng >= -165 && lng <= -55) return true;
      if (lat >= 25 && lat <= 49 && lng >= -125 && lng <= -68) {
        if (lat < 30 && lng > -85) return false;
        return true;
      }
      if (lat >= 14 && lat <= 32 && lng >= -115 && lng <= -85) return true;
      if (lat >= 8 && lat <= 16 && lng >= -90 && lng <= -77) return true;
    }

    // South America
    if (lat >= -56 && lat <= 13 && lng >= -82 && lng <= -34) {
      if (lat > -20) return true;
      const width = (lat + 56) / 36;
      if (Math.abs(lng - (-65)) <= width * 25) return true;
    }

    // Europe
    if (lat >= 36 && lat <= 71 && lng >= -11 && lng <= 42) {
      if (lat >= 50 && lat <= 60 && lng >= -11 && lng <= 2) return true; // UK/Ireland
      if (lat >= 55 && lat <= 71 && lng >= 5 && lng <= 32) return true; // Scandinavia
      if (lat >= 36 && lat <= 55 && lng >= -10 && lng <= 35) {
        if (lat < 42 && lng > 0 && lng < 12) return false;
        return true;
      }
    }

    // Africa
    if (lat >= -35 && lat <= 37 && lng >= -18 && lng <= 52) {
      if (lat >= 15 && lng >= -17 && lng <= 36) return true;
      if (lat >= -5 && lat < 15 && lng >= -15 && lng <= 44) return true;
      if (lat >= -35 && lat < -5 && lng >= 12 && lng <= 36) return true;
      if (lat >= -25 && lat <= -12 && lng >= 43 && lng <= 51) return true;
    }

    // Asia & Middle East
    if (lat >= 5 && lat <= 75 && lng >= 35 && lng <= 180) {
      if (lat >= 12 && lat <= 35 && lng >= 35 && lng <= 60) return true; // Arabian Peninsula
      if (lat >= 7 && lat <= 36 && lng >= 68 && lng <= 93) return true; // Indian Subcontinent / BD
      if (lat >= 20 && lat <= 55 && lng >= 75 && lng <= 135) return true; // China / East Asia
      if (lat >= 30 && lat <= 46 && lng >= 129 && lng <= 146) return true; // Japan
      if (lat >= 34 && lat <= 42 && lng >= 124 && lng <= 130) return true; // Korea
      if (lat >= 50 && lat <= 75 && lng >= 40 && lng <= 175) return true; // Siberia
    }

    // Southeast Asia & Maritime
    if (lat >= -11 && lat <= 20 && lng >= 95 && lng <= 150) {
      if (lat >= 8 && lat <= 22 && lng >= 98 && lng <= 110) return true;
      if (lat >= 1 && lat <= 7 && lng >= 100 && lng <= 105) return true; // Malaysia/Singapore
      if (lat >= -9 && lat <= 5 && lng >= 95 && lng <= 120) return true; // Indonesia
      if (lat >= -5 && lat <= 6 && lng >= 108 && lng <= 118) return true; // Borneo
      if (lat >= 5 && lat <= 19 && lng >= 118 && lng <= 126) return true; // Philippines
    }

    // Australia & New Zealand
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

export default function GlobalDatacenterMap() {
  const [selectedNode, setSelectedNode] = useState<DatacenterNode>(NODES[0]); // Default to Dhaka / Singapore
  const [viewMode, setViewMode] = useState<'3d' | '2d'>('3d');
  const [isRotating, setIsRotating] = useState(true);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [liveJitter, setLiveJitter] = useState<number>(0);

  // Canvas & 3D Math References
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Rotation angles: yaw (longitude) and pitch (latitude tilt)
  // Initial angle centered on Indian Ocean / Bangladesh / Singapore
  const yawRef = useRef<number>(-1.5);
  const pitchRef = useRef<number>(0.28);
  const targetYawRef = useRef<number>(-1.5);
  const targetPitchRef = useRef<number>(0.28);
  const isAnimatingToTargetRef = useRef<boolean>(false);

  // Drag interaction state
  const isDraggingRef = useRef<boolean>(false);
  const lastMousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const velocityRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const autoRotateResumeTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Precomputed continent points
  const worldLandDots = useMemo(() => generateWorldLandDots(), []);

  // Precomputed node unit vectors
  const nodeVectors = useMemo(() => {
    const map = new Map<string, [number, number, number]>();
    NODES.forEach((n) => {
      map.set(n.id, latLngToVector(n.lat, n.lng));
    });
    return map;
  }, []);

  // Smoothly center the 3D globe onto a clicked node
  const focusOnNode = useCallback((node: DatacenterNode) => {
    setSelectedNode(node);
    // Convert target node lat/lng to camera yaw and pitch
    const targetLngRad = (node.lng * Math.PI) / 180;
    const targetLatRad = (node.lat * Math.PI) / 180;
    // We want the point (lat, lng) to face camera (z = 1, x = 0, y = 0)
    targetYawRef.current = -targetLngRad;
    targetPitchRef.current = targetLatRad * 0.85;
    isAnimatingToTargetRef.current = true;
  }, []);

  // Live Jitter Simulation (realistic networking telemetry)
  useEffect(() => {
    const interval = setInterval(() => {
      setLiveJitter((Math.random() - 0.5) * 0.8);
    }, 1800);
    return () => clearInterval(interval);
  }, []);

  // Main 3D Canvas Rendering Engine
  useEffect(() => {
    if (viewMode !== '3d') return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let animationFrameId: number;
    let packetProgress = 0;

    const render = () => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (width === 0 || height === 0) {
        animationFrameId = requestAnimationFrame(render);
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

      // Sphere geometry
      const cx = width / 2;
      const cy = height / 2;
      const baseRadius = Math.min(width, height) * 0.38 * zoomLevel;
      const radius = Math.max(110, Math.min(260, baseRadius));

      // Update rotation
      if (isAnimatingToTargetRef.current) {
        // Smooth lerp to selected node target
        const dyaw = targetYawRef.current - yawRef.current;
        const dpitch = targetPitchRef.current - pitchRef.current;
        yawRef.current += dyaw * 0.08;
        pitchRef.current += dpitch * 0.08;
        if (Math.abs(dyaw) < 0.005 && Math.abs(dpitch) < 0.005) {
          isAnimatingToTargetRef.current = false;
        }
      } else if (isDraggingRef.current) {
        // Dragging is actively controlling yaw and pitch
      } else if (isRotating && !prefersReducedMotion) {
        // Inertia damping and continuous auto-rotation
        yawRef.current += velocityRef.current.x;
        pitchRef.current += velocityRef.current.y;
        velocityRef.current.x *= 0.95;
        velocityRef.current.y *= 0.95;
        yawRef.current -= 0.0035; // gentle continuous eastward spin
      }

      // Clamp pitch to avoid gimbal flip
      pitchRef.current = Math.max(-1.1, Math.min(1.1, pitchRef.current));

      const yaw = yawRef.current;
      const pitch = pitchRef.current;
      const cosYaw = Math.cos(yaw);
      const sinYaw = Math.sin(yaw);
      const cosPitch = Math.cos(pitch);
      const sinPitch = Math.sin(pitch);

      // 3D coordinate transform helper
      const projectPoint = (x0: number, y0: number, z0: number, r: number = radius) => {
        // Rotate around Y axis (yaw)
        const x1 = x0 * cosYaw + z0 * sinYaw;
        const y1 = y0;
        const z1 = -x0 * sinYaw + z0 * cosYaw;
        // Rotate around X axis (pitch)
        const x2 = x1;
        const y2 = y1 * cosPitch - z1 * sinPitch;
        const z2 = y1 * sinPitch + z1 * cosPitch;

        // Perspective depth projection
        const D = 3.6;
        const k = D / (D - z2);
        const px = cx + x2 * r * k;
        const py = cy + y2 * r * k;
        return { px, py, z: z2, isFront: z2 > -0.05, k };
      };

      // 1. Draw Outer Atmospheric Glow Aura
      const auraGrad = ctx.createRadialGradient(cx, cy, radius * 0.7, cx, cy, radius * 1.35);
      auraGrad.addColorStop(0, 'rgba(37, 99, 235, 0.16)');
      auraGrad.addColorStop(0.5, 'rgba(6, 182, 212, 0.08)');
      auraGrad.addColorStop(0.85, 'rgba(16, 185, 129, 0.03)');
      auraGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = auraGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 1.35, 0, Math.PI * 2);
      ctx.fill();

      // 2. Draw Sphere Background Body with deep shaded 3D volume
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

      // Subtle Cybernetic Outer Rim Ring
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.stroke();

      // 3. Draw 3D Latitude Wireframe Rings
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
            ctx.strokeStyle = circleLat === 0 ? 'rgba(56, 189, 248, 0.28)' : 'rgba(148, 163, 184, 0.12)';
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

      // 4. Render 3D World Continent Dots with Depth-Dependent Shading
      worldLandDots.forEach((d) => {
        const phi = (d.lat * Math.PI) / 180;
        const lambda = (d.lng * Math.PI) / 180;
        const x0 = Math.cos(phi) * Math.sin(lambda);
        const y0 = -Math.sin(phi);
        const z0 = Math.cos(phi) * Math.cos(lambda);

        const { px, py, z, isFront, k } = projectPoint(x0, y0, z0, radius);
        if (!isFront) return;

        // Front-facing illumination: closer to camera = brighter
        const alpha = Math.max(0.12, Math.min(0.95, (z + 0.1) * 0.9));
        const dotSize = Math.max(0.8, 1.4 * k);

        ctx.fillStyle = `rgba(56, 189, 248, ${alpha})`;
        ctx.beginPath();
        ctx.arc(px, py, dotSize, 0, Math.PI * 2);
        ctx.fill();
      });

      // 5. Draw 3D Great-Circle Fiber Arcs & Traveling Photons
      packetProgress = (packetProgress + 0.007) % 1;
      const samplesPerArc = 32;

      FIBER_LINKS.forEach(([fromId, toId]) => {
        const v1 = nodeVectors.get(fromId);
        const v2 = nodeVectors.get(toId);
        if (!v1 || !v2) return;

        const isBDIXHighway = fromId === 'dhaka' || toId === 'dhaka';
        const isSelectedLink = selectedNode.id === fromId || selectedNode.id === toId;

        // Draw parabolic arc elevated in 3D orbit above the sphere
        ctx.beginPath();
        let hasStarted = false;
        const arcPoints: { px: number; py: number; z: number }[] = [];

        for (let i = 0; i <= samplesPerArc; i++) {
          const t = i / samplesPerArc;
          const vt = slerp(v1, v2, t);
          // Parabolic height curve peaking at mid-flight
          const altitude = Math.sin(Math.PI * t) * (radius * 0.22);
          const rElevated = radius + altitude;
          const pt = projectPoint(vt[0], vt[1], vt[2], rElevated);
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

        // Arc line styling
        if (isSelectedLink) {
          ctx.strokeStyle = isBDIXHighway ? '#10B981' : '#38BDF8';
          ctx.lineWidth = 2.2;
          ctx.shadowColor = isBDIXHighway ? '#10B981' : '#38BDF8';
          ctx.shadowBlur = 8;
        } else {
          ctx.strokeStyle = isBDIXHighway ? 'rgba(16, 185, 129, 0.65)' : 'rgba(56, 189, 248, 0.45)';
          ctx.lineWidth = 1.4;
          ctx.shadowBlur = 0;
        }
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Draw animated light photon packets along the fiber line
        [packetProgress, (packetProgress + 0.5) % 1].forEach((t) => {
          const idx = Math.min(samplesPerArc - 1, Math.floor(t * samplesPerArc));
          const pt = arcPoints[idx];
          if (pt && pt.z > -0.05) {
            ctx.fillStyle = '#FFFFFF';
            ctx.shadowColor = isBDIXHighway ? '#10B981' : '#38BDF8';
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.arc(pt.px, pt.py, 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
          }
        });
      });

      // 6. Draw 3D Datacenter Node Pins, Pulse Ripples & Billboard HUDs
      NODES.forEach((node) => {
        const v = nodeVectors.get(node.id);
        if (!v) return;

        const isSelected = selectedNode.id === node.id;
        const { px, py, z, isFront, k } = projectPoint(v[0], v[1], v[2], radius);

        if (!isFront) return;

        // Expanding radar pulse wave
        const wave = (Date.now() / 1200) % 1;
        const waveR = (8 + wave * 18) * k;
        const waveAlpha = Math.max(0, 0.8 * (1 - wave));

        ctx.strokeStyle = node.color;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(px, py, waveR, 0, Math.PI * 2);
        ctx.stroke();

        // Glowing Core Pin
        ctx.fillStyle = node.color;
        ctx.shadowColor = node.color;
        ctx.shadowBlur = isSelected ? 16 : 8;
        ctx.beginPath();
        ctx.arc(px, py, isSelected ? 6 * k : 4.5 * k, 0, Math.PI * 2);
        ctx.fill();

        // White Center Specular Dot
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(px, py, isSelected ? 2.5 * k : 1.8 * k, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Floating 3D Billboard HUD Label
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

          // Background pill
          ctx.fillStyle = isSelected ? 'rgba(15, 23, 42, 0.95)' : 'rgba(2, 6, 23, 0.85)';
          ctx.strokeStyle = isSelected ? node.color : 'rgba(255, 255, 255, 0.2)';
          ctx.lineWidth = isSelected ? 1.5 : 0.8;
          ctx.beginPath();
          ctx.roundRect(boxX, boxY, boxW, boxH, 6);
          ctx.fill();
          ctx.stroke();

          // Text inside pill
          ctx.fillStyle = isSelected ? '#FFFFFF' : '#E2E8F0';
          ctx.fillText(labelText, boxX + 7, boxY + 14);
        }
      });

      ctx.restore();
      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [viewMode, isRotating, zoomLevel, selectedNode, worldLandDots, nodeVectors]);

  // Pointer & Drag Handlers for 360° Globe Rotation
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    isDraggingRef.current = true;
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };
    velocityRef.current = { x: 0, y: 0 };
    if (autoRotateResumeTimerRef.current) {
      clearTimeout(autoRotateResumeTimerRef.current);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - lastMousePosRef.current.x;
    const dy = e.clientY - lastMousePosRef.current.y;
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };

    // Apply sensitivity
    const sensitivity = 0.0055;
    yawRef.current += dx * sensitivity;
    pitchRef.current -= dy * sensitivity;
    velocityRef.current = { x: dx * sensitivity * 0.6, y: -dy * sensitivity * 0.6 };
  };

  const handlePointerUp = () => {
    isDraggingRef.current = false;
    // Resume auto-rotation after 3 seconds of stillness
    autoRotateResumeTimerRef.current = setTimeout(() => {
      velocityRef.current = { x: 0, y: 0 };
    }, 3000);
  };

  return (
    <div className="w-full rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#0B1120] p-4 sm:p-8 shadow-2xl relative overflow-hidden transition-all">
      {/* Top Header & Interactive Controls Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 sm:gap-5 pb-5 sm:pb-6 border-b border-slate-100 dark:border-white/[0.08]">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-xs font-mono text-blue-700 dark:text-blue-300 font-semibold mb-2 shadow-xs">
            <Radio className="w-3.5 h-3.5 text-emerald-500 animate-pulse motion-reduce:animate-none" />
            <span>High-Speed Global Anycast &amp; BDIX Peering Backbone</span>
          </div>
          <h3 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span>Tier-IV Datacenter Infrastructure &amp; Peering</span>
            <span className="hidden sm:inline-block px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
              Live Mesh
            </span>
          </h3>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-2xl font-normal leading-relaxed">
            Drag the 3D orbital sphere 360° to inspect global submarine fiber routes, BDIX direct interconnects, and real-time edge latency.
          </p>
        </div>

        {/* View Switcher, Rotation & Zoom HUD Controls */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {/* Mode Switcher: 3D Globe / 2D Cyber Map */}
          <div className="inline-flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-white/10 font-mono text-xs">
            <button
              type="button"
              onClick={() => setViewMode('3d')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-semibold transition-all cursor-pointer ${
                viewMode === '3d'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>3D Orbital</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('2d')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-semibold transition-all cursor-pointer ${
                viewMode === '2d'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>2D Topology</span>
            </button>
          </div>

          {/* Auto-Rotation Play/Pause Toggle */}
          {viewMode === '3d' && (
            <button
              type="button"
              onClick={() => setIsRotating(!isRotating)}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
              title={isRotating ? 'Pause Orbital Spin' : 'Resume Orbital Spin'}
              aria-label={isRotating ? 'Pause Orbital Spin' : 'Resume Orbital Spin'}
            >
              {isRotating ? <Pause className="w-4 h-4 text-amber-500" /> : <Play className="w-4 h-4 text-emerald-500" />}
            </button>
          )}

          {/* Quick Center on Dhaka / BDIX */}
          <button
            type="button"
            onClick={() => focusOnNode(NODES[0])}
            className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-mono font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Recenter 3D Globe onto Bangladesh BDIX Gateway"
          >
            <span>🇧🇩 Dhaka Hub</span>
          </button>
        </div>
      </div>

      {/* Compact Mobile Telemetry Bar (prevents top-left/top-right HUD overlap on narrow viewports) */}
      <div className="sm:hidden mt-4 flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-950 text-slate-200 border border-slate-800 font-mono text-[10px]">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse motion-reduce:animate-none" />
          <span className="font-bold text-white">ANYCAST MESH</span>
        </div>
        <span className="text-emerald-400 font-semibold">7 Nodes • BDIX 10G</span>
      </div>

      {/* Main Interactive Visualizer Viewport */}
      <div
        ref={containerRef}
        className="relative w-full aspect-[4/3] sm:aspect-[2/1] min-h-[290px] sm:min-h-[440px] mt-3 sm:mt-6 bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 shadow-inner flex items-center justify-center select-none"
      >
        {/* Subtle Background Architectural Grid */}
        <div className="absolute inset-0 architectural-grid opacity-20 pointer-events-none" />

        {/* Dynamic Telemetry HUD Overlay in Top-Left Corner */}
        <div className="hidden sm:block absolute top-4 left-4 z-30 font-mono text-[11px] space-y-1 bg-slate-900/80 backdrop-blur-md p-3 rounded-xl border border-white/10 text-slate-300 pointer-events-none shadow-lg">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping motion-reduce:animate-none" />
            <span className="text-white font-bold">ANYCAST AS13335 MESH</span>
          </div>
          <div className="text-[10px] text-slate-400">
            Active Nodes: <span className="text-emerald-400 font-bold">7 Worldwide</span> • BDIX: <span className="text-emerald-400 font-bold">Direct 10G</span>
          </div>
          <div className="text-[10px] text-cyan-400">
            Telemetry: <span className="text-white">60 FPS Hardware Rendered</span>
          </div>
        </div>

        {/* Dynamic Selected Node Telemetry HUD in Top-Right Corner */}
        <div className="absolute top-2.5 right-2.5 sm:top-4 sm:right-4 z-30 font-mono text-xs text-right bg-slate-900/85 backdrop-blur-md p-2 sm:p-3 rounded-xl border border-white/10 shadow-lg max-w-[180px] sm:max-w-[240px]">
          <div className="text-[9px] sm:text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Active Cluster:</div>
          <div className="text-xs sm:text-sm font-bold text-white mt-0.5 flex items-center justify-end gap-1.5">
            <span>{selectedNode.flag}</span>
            <span className="truncate">{selectedNode.city}</span>
          </div>
          <div className="text-[10px] sm:text-[11px] font-semibold text-emerald-400 mt-0.5 sm:mt-1 flex items-center justify-end gap-1">
            <Activity className="w-3 h-3 animate-pulse motion-reduce:animate-none" />
            <span>
              BD Ping: {(parseFloat(selectedNode.latencyToBD) + liveJitter).toFixed(1)}ms
            </span>
          </div>
          <div className="text-[9px] sm:text-[10px] text-cyan-400 truncate mt-0.5">
            {selectedNode.cableRoute}
          </div>
        </div>

        {/* Drag Instruction Floating Pill */}
        {viewMode === '3d' && (
          <div className="absolute bottom-3 sm:bottom-4 left-1/2 -translate-x-1/2 z-30 px-3 py-1 rounded-full bg-slate-900/80 backdrop-blur-md border border-white/10 text-slate-300 font-mono text-[10px] flex items-center gap-1.5 pointer-events-none whitespace-nowrap">
            <RotateCw className="w-3 h-3 text-cyan-400 animate-spin motion-reduce:animate-none" />
            <span>Drag to rotate 360°</span>
          </div>
        )}

        {/* VIEW A: 3D Canvas Orbital Sphere */}
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

        {/* VIEW B: 2D Planar World Topology View */}
        {viewMode === '2d' && (
          <div className="relative w-full h-full flex items-center justify-center p-4">
            <svg viewBox="0 0 1000 500" className="w-full h-full object-contain">
              <defs>
                <linearGradient id="cyberBeamGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#10B981" />
                  <stop offset="50%" stopColor="#38BDF8" />
                  <stop offset="100%" stopColor="#6366F1" />
                </linearGradient>
              </defs>

              {/* Grid Lines */}
              <line x1="0" y1="125" x2="1000" y2="125" stroke="rgba(255,255,255,0.06)" strokeDasharray="4 6" />
              <line x1="0" y1="250" x2="1000" y2="250" stroke="rgba(255,255,255,0.08)" strokeDasharray="4 6" />
              <line x1="0" y1="375" x2="1000" y2="375" stroke="rgba(255,255,255,0.06)" strokeDasharray="4 6" />
              <line x1="250" y1="0" x2="250" y2="500" stroke="rgba(255,255,255,0.06)" strokeDasharray="4 6" />
              <line x1="500" y1="0" x2="500" y2="500" stroke="rgba(255,255,255,0.08)" strokeDasharray="4 6" />
              <line x1="750" y1="0" x2="750" y2="500" stroke="rgba(255,255,255,0.06)" strokeDasharray="4 6" />

              {/* Flat Projected World Dots */}
              {worldLandDots.map((d, i) => {
                const px = ((d.lng + 180) / 360) * 1000;
                const py = ((90 - d.lat) / 180) * 500;
                return (
                  <circle
                    key={i}
                    cx={px}
                    cy={py}
                    r="1.4"
                    fill="rgba(56, 189, 248, 0.45)"
                  />
                );
              })}

              {/* Dynamic 2D Fiber Cable Routes */}
              {FIBER_LINKS.map(([fromId, toId], idx) => {
                const from = NODES.find((n) => n.id === fromId);
                const to = NODES.find((n) => n.id === toId);
                if (!from || !to) return null;

                const x1 = ((from.lng + 180) / 360) * 1000;
                const y1 = ((90 - from.lat) / 180) * 500;
                const x2 = ((to.lng + 180) / 360) * 1000;
                const y2 = ((90 - to.lat) / 180) * 500;
                const midX = (x1 + x2) / 2;
                const midY = Math.min(y1, y2) - 35;

                return (
                  <g key={idx}>
                    <path
                      d={`M ${x1} ${y1} Q ${midX} ${midY} ${x2} ${y2}`}
                      fill="none"
                      stroke={selectedNode.id === fromId || selectedNode.id === toId ? '#38BDF8' : 'rgba(56, 189, 248, 0.35)'}
                      strokeWidth={selectedNode.id === fromId || selectedNode.id === toId ? '2.5' : '1.5'}
                      strokeDasharray="6 6"
                      className="animate-pipeline-beam"
                    />
                  </g>
                );
              })}

              {/* 2D Interactive Node Markers */}
              {NODES.map((node) => {
                const px = ((node.lng + 180) / 360) * 1000;
                const py = ((90 - node.lat) / 180) * 500;
                const isSelected = selectedNode.id === node.id;

                return (
                  <g
                    key={node.id}
                    onClick={() => setSelectedNode(node)}
                    className="cursor-pointer group"
                  >
                    {/* Outer Radar Wave */}
                    <circle
                      cx={px}
                      cy={py}
                      r={isSelected ? '14' : '9'}
                      fill={node.color}
                      opacity={isSelected ? '0.35' : '0.2'}
                      className="animate-ping"
                    />
                    {/* Solid Node Core */}
                    <circle
                      cx={px}
                      cy={py}
                      r={isSelected ? '6' : '4.5'}
                      fill={node.color}
                      stroke="#FFFFFF"
                      strokeWidth="2"
                    />
                    {/* Node Text Label */}
                    <text
                      x={px}
                      y={py - 12}
                      textAnchor="middle"
                      fill="#FFFFFF"
                      fontSize="10"
                      fontFamily="monospace"
                      fontWeight="bold"
                      className="drop-shadow-md select-none"
                    >
                      {node.city} ({node.latencyToBD.split(' ')[0]})
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        )}
      </div>

      {/* Cluster Switcher Pills Bar */}
      <div className="flex items-center gap-2 mt-5 overflow-x-auto pb-1 sm:pb-0 sm:flex-wrap no-scrollbar">
        <span className="text-xs font-mono text-slate-500 dark:text-slate-400 font-semibold mr-1 flex items-center gap-1 shrink-0">
          <MapPin className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          <span>Select Datacenter:</span>
        </span>
        {NODES.map((node) => {
          const isSelected = selectedNode.id === node.id;
          return (
            <button
              key={node.id}
              type="button"
              onClick={() => focusOnNode(node)}
              className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-mono font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                isSelected
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 sm:scale-105'
                  : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/10'
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

      {/* Comprehensive Selected Node Hardware & Telemetry Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-100 dark:border-white/[0.08] font-mono text-xs">
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-white/[0.08] space-y-1">
          <span className="text-slate-500 dark:text-slate-400 text-[11px] block font-semibold uppercase tracking-wider">
            Facility &amp; Tier Level:
          </span>
          <div className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-1.5">
            <span>{selectedNode.flag}</span>
            <span>{selectedNode.facility}</span>
          </div>
          <span className="text-[10px] text-slate-500 dark:text-slate-500 block">
            ISO 27001, SOC 2 Type II Certified
          </span>
        </div>

        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-white/[0.08] space-y-1">
          <span className="text-slate-500 dark:text-slate-400 text-[11px] block font-semibold uppercase tracking-wider">
            Network Uplink &amp; Peering:
          </span>
          <div className="font-bold text-blue-600 dark:text-blue-400 text-sm">
            {selectedNode.bandwidth}
          </div>
          <span className="text-[10px] text-slate-500 dark:text-slate-500 block">
            BGP4 Multi-Homed Anycast Routing
          </span>
        </div>

        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-white/[0.08] space-y-1">
          <span className="text-slate-500 dark:text-slate-400 text-[11px] block font-semibold uppercase tracking-wider">
            Hardware &amp; SLA:
          </span>
          <div className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">
            {selectedNode.uptime} Uptime SLA
          </div>
          <span className="text-[10px] text-slate-500 dark:text-slate-500 block truncate">
            {selectedNode.hardware}
          </span>
        </div>

        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-white/[0.08] space-y-1">
          <span className="text-slate-500 dark:text-slate-400 text-[11px] block font-semibold uppercase tracking-wider">
            Subsea Cable Interconnect:
          </span>
          <div className="font-bold text-slate-900 dark:text-slate-100 text-sm truncate">
            {selectedNode.cableRoute}
          </div>
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold block">
            Direct BDIX Peer Latency: {selectedNode.latencyToBD}
          </span>
        </div>
      </div>

      {/* Traceroute Route Simulator Pathway */}
      <div className="mt-4 p-4 rounded-xl bg-slate-100/80 dark:bg-slate-900/50 border border-slate-200 dark:border-white/[0.08]">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>Simulated BDIX Traceroute to {selectedNode.city}:</span>
          </span>
          <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-bold">
            0.00% Packet Loss • Jitter: ±0.3ms
          </span>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-xs font-mono text-slate-600 dark:text-slate-400">
          {selectedNode.hops.map((hop, idx) => (
            <React.Fragment key={idx}>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-white dark:bg-slate-950 border border-slate-200 dark:border-white/10">
                <span className="w-4 h-4 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center text-[10px] font-bold">
                  {idx + 1}
                </span>
                <span>{hop}</span>
              </div>
              {idx < selectedNode.hops.length - 1 && (
                <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0 hidden sm:inline" />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}
