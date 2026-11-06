'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ShieldCheck, Lock, Activity, Sparkles, Terminal, RefreshCw } from 'lucide-react';

interface Point3D {
  x: number;
  y: number;
  z: number;
}

interface ProjectedPoint {
  x: number;
  y: number;
  z: number;
  scale: number;
  visible: boolean;
}

export default function Auth3DScene() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Live HUD telemetry
  const [telemetry, setTelemetry] = useState({
    rotX: '042°',
    rotY: '118°',
    rotZ: '204°',
    packets: '1,420 pps',
    bdixLatency: '3.8ms',
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let animId: number;
    let isVisible = true;

    // Rotation angles in radians
    let angleX = 0.4;
    let angleY = 0.6;
    let angleZ = 0.2;

    // Angular velocities (auto spin)
    const baseSpeedX = 0.005;
    const baseSpeedY = 0.008;
    const baseSpeedZ = 0.003;

    // Mouse drag & interaction state
    let isDragging = false;
    let lastMouseX = 0;
    let lastMouseY = 0;
    let mouseTiltX = 0;
    let mouseTiltY = 0;
    let targetTiltX = 0;
    let targetTiltY = 0;

    // Detect theme
    const isDark = () => document.documentElement.classList.contains('dark');

    // Generate Icosahedron vertices (Golden ratio phi)
    const phi = (1 + Math.sqrt(5)) / 2;
    const rawVertices: Point3D[] = [
      { x: -1, y: phi, z: 0 },
      { x: 1, y: phi, z: 0 },
      { x: -1, y: -phi, z: 0 },
      { x: 1, y: -phi, z: 0 },
      { x: 0, y: -1, z: phi },
      { x: 0, y: 1, z: phi },
      { x: 0, y: -1, z: -phi },
      { x: 0, y: 1, z: -phi },
      { x: phi, y: 0, z: -1 },
      { x: phi, y: 0, z: 1 },
      { x: -phi, y: 0, z: -1 },
      { x: -phi, y: 0, z: 1 },
    ];

    // Normalize vertices to unit sphere
    const icosahedronVertices: Point3D[] = rawVertices.map((v) => {
      const len = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
      return { x: v.x / len, y: v.y / len, z: v.z / len };
    });

    // Compute Icosahedron 30 edges
    const edges: [number, number][] = [];
    const edgeThreshold = 1.05 * (2 / Math.sqrt(1 + phi * phi));
    for (let i = 0; i < icosahedronVertices.length; i++) {
      for (let j = i + 1; j < icosahedronVertices.length; j++) {
        const dx = icosahedronVertices[i].x - icosahedronVertices[j].x;
        const dy = icosahedronVertices[i].y - icosahedronVertices[j].y;
        const dz = icosahedronVertices[i].z - icosahedronVertices[j].z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dist <= edgeThreshold * 1.1) {
          edges.push([i, j]);
        }
      }
    }

    // Concentric 3D Orbital Rings (Sample points along 3 gimbal axes)
    const RING_POINTS = 72;
    const generateRing = (tiltX: number, tiltY: number, tiltZ: number): Point3D[] => {
      const pts: Point3D[] = [];
      for (let i = 0; i < RING_POINTS; i++) {
        const theta = (i / RING_POINTS) * Math.PI * 2;
        let x = Math.cos(theta);
        let y = Math.sin(theta);
        let z = 0;

        // Apply initial gimbal tilt
        const cosX = Math.cos(tiltX);
        const sinX = Math.sin(tiltX);
        const cosY = Math.cos(tiltY);
        const sinY = Math.sin(tiltY);
        const cosZ = Math.cos(tiltZ);
        const sinZ = Math.sin(tiltZ);

        // Rotation X
        const y1 = y * cosX - z * sinX;
        const z1 = y * sinX + z * cosX;
        // Rotation Y
        const x2 = x * cosY + z1 * sinY;
        const z2 = -x * sinY + z1 * cosY;
        // Rotation Z
        const x3 = x2 * cosZ - y1 * sinZ;
        const y3 = x2 * sinZ + y1 * cosZ;

        pts.push({ x: x3, y: y3, z: z2 });
      }
      return pts;
    };

    const ring1 = generateRing(0.3, 0.2, 0); // Inner Gimbal
    const ring2 = generateRing(Math.PI / 3, 0, Math.PI / 4); // Mid Gimbal
    const ring3 = generateRing(-Math.PI / 4, Math.PI / 3, 0); // Outer Gimbal

    // Orbital data photon packets traveling along rings
    const photons = [
      { ring: 1, progress: 0.1, speed: 0.008, color: '#38BDF8' },
      { ring: 1, progress: 0.6, speed: 0.008, color: '#06B6D4' },
      { ring: 2, progress: 0.3, speed: -0.006, color: '#818CF8' },
      { ring: 2, progress: 0.8, speed: -0.006, color: '#34D399' },
      { ring: 3, progress: 0.2, speed: 0.005, color: '#F43F5E' },
      { ring: 3, progress: 0.7, speed: 0.005, color: '#38BDF8' },
    ];

    // Mouse event handlers
    const handleMouseDown = (e: MouseEvent) => {
      isDragging = true;
      lastMouseX = e.clientX;
      lastMouseY = e.clientY;
    };

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      targetTiltX = ((e.clientY - rect.top) / rect.height - 0.5) * 0.6;
      targetTiltY = ((e.clientX - rect.left) / rect.width - 0.5) * 0.6;

      if (isDragging) {
        const deltaX = e.clientX - lastMouseX;
        const deltaY = e.clientY - lastMouseY;
        angleY += deltaX * 0.008;
        angleX += deltaY * 0.008;
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
      }
    };

    const handleMouseUp = () => {
      isDragging = false;
    };

    const containerEl = containerRef.current;
    if (containerEl) {
      containerEl.addEventListener('mousedown', handleMouseDown);
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    // 3D Perspective Projection Function
    const project = (
      p: Point3D,
      scaleFactor: number,
      centerX: number,
      centerY: number,
      ax: number,
      ay: number,
      az: number
    ): ProjectedPoint => {
      // Rotation matrices (Euler X -> Y -> Z)
      const cosX = Math.cos(ax);
      const sinX = Math.sin(ax);
      const cosY = Math.cos(ay);
      const sinY = Math.sin(ay);
      const cosZ = Math.cos(az);
      const sinZ = Math.sin(az);

      // Rotate X
      const y1 = p.y * cosX - p.z * sinX;
      const z1 = p.y * sinX + p.z * cosX;

      // Rotate Y
      const x2 = p.x * cosY + z1 * sinY;
      const z2 = -p.x * sinY + z1 * cosY;

      // Rotate Z
      const x3 = x2 * cosZ - y1 * sinZ;
      const y3 = x2 * sinZ + y1 * cosZ;
      const z3 = z2;

      // Camera perspective distance
      const cameraDist = 3.6;
      const depth = cameraDist + z3;
      const fov = cameraDist / Math.max(0.2, depth);

      return {
        x: centerX + x3 * scaleFactor * fov,
        y: centerY + y3 * scaleFactor * fov,
        z: z3,
        scale: fov,
        visible: depth > 0.1,
      };
    };

    let frameCount = 0;

    const render = () => {
      if (!isVisible) {
        animId = requestAnimationFrame(render);
        return;
      }

      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (width === 0 || height === 0) {
        animId = requestAnimationFrame(render);
        return;
      }

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      // Smooth mouse tilt interpolation
      mouseTiltX += (targetTiltX - mouseTiltX) * 0.05;
      mouseTiltY += (targetTiltY - mouseTiltY) * 0.05;

      // Increment rotation angles
      if (!isDragging) {
        angleX += baseSpeedX;
        angleY += baseSpeedY;
        angleZ += baseSpeedZ;
      }

      const curAngleX = angleX + mouseTiltX;
      const curAngleY = angleY + mouseTiltY;
      const curAngleZ = angleZ;

      // Update HUD telemetry every 24 frames
      frameCount++;
      if (frameCount % 24 === 0) {
        const degX = (Math.round((curAngleX * 180) / Math.PI) % 360 + 360) % 360;
        const degY = (Math.round((curAngleY * 180) / Math.PI) % 360 + 360) % 360;
        const degZ = (Math.round((curAngleZ * 180) / Math.PI) % 360 + 360) % 360;
        setTelemetry({
          rotX: `${String(degX).padStart(3, '0')}°`,
          rotY: `${String(degY).padStart(3, '0')}°`,
          rotZ: `${String(degZ).padStart(3, '0')}°`,
          packets: `${(1400 + Math.floor(Math.sin(Date.now() * 0.002) * 80)).toLocaleString()} pps`,
          bdixLatency: `${(3.4 + Math.sin(Date.now() * 0.001) * 0.6).toFixed(1)}ms`,
        });
      }

      const centerX = width / 2;
      const centerY = height / 2;
      const baseRadius = Math.min(width, height) * 0.32;

      // ==========================================
      // 1. AMBIENT 3D BACKGROUND GLOW & RETICLES
      // ==========================================
      const bgGrad = ctx.createRadialGradient(
        centerX,
        centerY,
        0,
        centerX,
        centerY,
        baseRadius * 1.6
      );
      bgGrad.addColorStop(0, 'rgba(14, 165, 233, 0.16)');
      bgGrad.addColorStop(0.35, 'rgba(99, 102, 241, 0.09)');
      bgGrad.addColorStop(0.75, 'rgba(6, 182, 212, 0.03)');
      bgGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = bgGrad;
      ctx.beginPath();
      ctx.arc(centerX, centerY, baseRadius * 1.6, 0, Math.PI * 2);
      ctx.fill();

      // Outer Static Calibration Crosshair Ring
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.15)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 8]);
      ctx.beginPath();
      ctx.arc(centerX, centerY, baseRadius * 1.45, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // ==========================================
      // 2. RENDER 3 CONCENTRIC 3D ORBITAL GIMBALS
      // ==========================================
      const draw3DRing = (
        points: Point3D[],
        radius: number,
        color: string,
        glowColor: string,
        spinOffset: number
      ) => {
        const ringAx = curAngleX + spinOffset * 0.4;
        const ringAy = curAngleY + spinOffset * 0.8;
        const ringAz = curAngleZ - spinOffset * 0.3;

        const projected = points.map((p) =>
          project(p, radius, centerX, centerY, ringAx, ringAy, ringAz)
        );

        // Sort segments or draw continuous path with depth-based opacity
        ctx.beginPath();
        for (let i = 0; i < projected.length; i++) {
          const pt = projected[i];
          if (i === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        }
        ctx.closePath();

        // Stroke with neon glow
        ctx.strokeStyle = color;
        ctx.shadowColor = glowColor;
        ctx.shadowBlur = 8;
        ctx.lineWidth = 1.4;
        ctx.stroke();
        ctx.shadowBlur = 0;
      };

      // Ring 3 (Outer): Indigo / Violet
      draw3DRing(
        ring3,
        baseRadius * 1.35,
        'rgba(129, 140, 248, 0.65)',
        'rgba(99, 102, 241, 0.8)',
        0.8
      );

      // Ring 2 (Mid): Cyan / Sky Blue
      draw3DRing(
        ring2,
        baseRadius * 1.15,
        'rgba(56, 189, 248, 0.85)',
        'rgba(14, 165, 233, 0.9)',
        0.4
      );

      // Ring 1 (Inner): Emerald / Mint
      draw3DRing(
        ring1,
        baseRadius * 0.95,
        'rgba(52, 211, 153, 0.75)',
        'rgba(16, 185, 129, 0.85)',
        -0.5
      );

      // ==========================================
      // 3. RENDER 3D ICOSAHEDRON POLYHEDRAL CORE
      // ==========================================
      const coreScale = baseRadius * 0.65;
      const coreProjected = icosahedronVertices.map((v) =>
        project(v, coreScale, centerX, centerY, curAngleX, curAngleY, curAngleZ)
      );

      // Draw Polyhedron Wireframe Edges
      edges.forEach(([i, j]) => {
        const p1 = coreProjected[i];
        const p2 = coreProjected[j];
        if (!p1.visible || !p2.visible) return;

        // Depth alpha: Front edges brighter than back edges
        const avgZ = (p1.z + p2.z) / 2;
        const depthAlpha = Math.max(0.18, Math.min(0.9, 0.55 + avgZ * 0.35));

        ctx.strokeStyle = `rgba(56, 189, 248, ${depthAlpha})`;
        ctx.lineWidth = 1.2 * ((p1.scale + p2.scale) / 2);
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      });

      // Draw Polyhedron Vertices (Glowing Node Vertices)
      coreProjected.forEach((p) => {
        if (!p.visible) return;
        const vAlpha = Math.max(0.3, Math.min(1.0, 0.65 + p.z * 0.35));
        const r = 3.5 * p.scale;

        ctx.fillStyle = `rgba(255, 255, 255, ${vAlpha})`;
        ctx.shadowColor = '#38BDF8';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      // ==========================================
      // 4. INNER QUANTUM SINGULARITY (PULSING CORE)
      // ==========================================
      const pulseTime = Date.now() * 0.003;
      const pulseScale = 1 + Math.sin(pulseTime) * 0.12;
      const coreRadius = baseRadius * 0.22 * pulseScale;

      const innerCore = ctx.createRadialGradient(
        centerX,
        centerY,
        0,
        centerX,
        centerY,
        coreRadius
      );
      innerCore.addColorStop(0, '#FFFFFF');
      innerCore.addColorStop(0.25, 'rgba(56, 189, 248, 0.95)');
      innerCore.addColorStop(0.65, 'rgba(99, 102, 241, 0.5)');
      innerCore.addColorStop(1, 'rgba(6, 182, 212, 0)');

      ctx.fillStyle = innerCore;
      ctx.shadowColor = '#06B6D4';
      ctx.shadowBlur = 24;
      ctx.beginPath();
      ctx.arc(centerX, centerY, coreRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // ==========================================
      // 5. ORBITAL DATA PHOTONS & PACKET TRAILS
      // ==========================================
      photons.forEach((p) => {
        p.progress += p.speed;
        if (p.progress > 1) p.progress -= 1;
        if (p.progress < 0) p.progress += 1;

        const targetRing = p.ring === 1 ? ring1 : p.ring === 2 ? ring2 : ring3;
        const ringRad =
          p.ring === 1
            ? baseRadius * 0.95
            : p.ring === 2
            ? baseRadius * 1.15
            : baseRadius * 1.35;
        const ringOffset = p.ring === 1 ? -0.5 : p.ring === 2 ? 0.4 : 0.8;

        const idxFloat = p.progress * (targetRing.length - 1);
        const idx = Math.floor(idxFloat);
        const frac = idxFloat - idx;
        const nextIdx = (idx + 1) % targetRing.length;

        // Interpolate 3D position
        const p1 = targetRing[idx];
        const p2 = targetRing[nextIdx];
        const interX = p1.x + (p2.x - p1.x) * frac;
        const interY = p1.y + (p2.y - p1.y) * frac;
        const interZ = p1.z + (p2.z - p1.z) * frac;

        const ringAx = curAngleX + ringOffset * 0.4;
        const ringAy = curAngleY + ringOffset * 0.8;
        const ringAz = curAngleZ - ringOffset * 0.3;

        const proj = project(
          { x: interX, y: interY, z: interZ },
          ringRad,
          centerX,
          centerY,
          ringAx,
          ringAy,
          ringAz
        );

        if (proj.visible) {
          ctx.fillStyle = p.color;
          ctx.shadowColor = p.color;
          ctx.shadowBlur = 12;
          ctx.beginPath();
          ctx.arc(proj.x, proj.y, 4.5 * proj.scale, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      });

      ctx.restore();
      animId = requestAnimationFrame(render);
    };

    render();

    // Intersection observer for performance
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          isVisible = e.isIntersecting;
        });
      },
      { threshold: 0.05 }
    );
    if (containerEl) observer.observe(containerEl);

    const handleVisibility = () => {
      isVisible = !document.hidden;
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      cancelAnimationFrame(animId);
      if (containerEl) {
        containerEl.removeEventListener('mousedown', handleMouseDown);
        observer.disconnect();
      }
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full flex flex-col justify-between p-8 sm:p-12 lg:p-16 bg-slate-950 text-white overflow-hidden select-none cursor-grab active:cursor-grabbing border-l border-white/[0.08]"
    >
      {/* Background Architectural Grid & Subtle Nebula Glow */}
      <div className="absolute inset-0 architectural-grid opacity-15 pointer-events-none" />
      <div className="absolute -top-32 -right-32 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />

      {/* Top 3D Enclave Header Badge */}
      <div className="relative z-10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          <span className="text-xs font-mono font-bold tracking-widest text-cyan-400 uppercase">
            Quantum Security Enclave
          </span>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-[11px] font-mono text-cyan-300">
          <Sparkles className="w-3 h-3 text-cyan-400" />
          <span>Interactive 3D Engine</span>
        </div>
      </div>

      {/* Main 3D Canvas Viewport (Center) */}
      <div className="relative flex-1 w-full my-4 flex items-center justify-center min-h-[340px]">
        <canvas
          ref={canvasRef}
          className="w-full h-full max-w-[520px] max-h-[520px] object-contain"
        />

        {/* Minimal 3D HUD Reticle Indicators */}
        <div className="absolute top-2 left-2 text-[10px] font-mono text-cyan-400/80 space-y-1 pointer-events-none">
          <div className="flex items-center gap-1">
            <Activity className="w-3 h-3 text-cyan-400" />
            <span>REALTIME_3D_MATRIX</span>
          </div>
          <div className="text-slate-400">
            PITCH: {telemetry.rotX} | YAW: {telemetry.rotY} | ROLL: {telemetry.rotZ}
          </div>
        </div>

        <div className="absolute bottom-2 right-2 text-[10px] font-mono text-slate-400/90 text-right space-y-1 pointer-events-none">
          <div className="text-cyan-400 font-semibold">BDIX_FIBER: {telemetry.bdixLatency}</div>
          <div>INBOUND: {telemetry.packets}</div>
        </div>

        {/* Floating Interactive 360° Drag Cue */}
        <div className="absolute bottom-2 left-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-[10px] font-mono text-slate-300 backdrop-blur-xs pointer-events-none">
          <RefreshCw className="w-2.5 h-2.5 text-cyan-400 animate-spin" />
          <span>Drag to orbit in 360°</span>
        </div>
      </div>

      {/* Bottom Security Architecture Status Strip */}
      <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-mono text-slate-400 pt-5 border-t border-white/10">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span className="text-slate-300">POST-QUANTUM AES-256-GCM ENCRYPTED</span>
        </div>
        <div className="flex items-center gap-2">
          <Lock className="w-3.5 h-3.5 text-cyan-400" />
          <span>KERNEL ISOLATED RLS</span>
        </div>
      </div>
    </div>
  );
}
