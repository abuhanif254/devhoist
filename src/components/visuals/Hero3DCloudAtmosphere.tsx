'use client';

import React, { useEffect, useRef } from 'react';

interface CloudPuff {
  baseOffsetX: number;
  baseOffsetY: number;
  radius: number;
  phase: number;
  morphSpeed: number;
  morphAmplitude: number;
}

interface CloudCluster {
  x: number;
  y: number;
  z: number; // 3D depth: 0.6 (foreground) to 2.8 (distant horizon)
  baseRadius: number;
  driftSpeed: number;
  puffs: CloudPuff[];
  hasGlowCore: boolean;
  coreColor: string; // Internal photon light pulse
  pulsePhase: number;
  pulseSpeed: number;
}

interface MicroPhoton {
  x: number;
  y: number;
  z: number;
  size: number;
  vx: number;
  vy: number;
  alpha: number;
  color: string;
}

export default function Hero3DCloudAtmosphere() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let animId: number;
    let isVisible = true;

    // Smooth mouse parallax target & current
    let mouseTargetX = 0;
    let mouseTargetY = 0;
    let mouseX = 0;
    let mouseY = 0;

    // Detect dark mode dynamically
    const checkIsDark = () => document.documentElement.classList.contains('dark');
    let isDark = checkIsDark();

    const themeObserver = new MutationObserver(() => {
      isDark = checkIsDark();
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    // Mouse movement listener on hero section
    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      // Normalized from -1 to 1
      mouseTargetX = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      mouseTargetY = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
    };
    window.addEventListener('mousemove', handleMouseMove, { passive: true });

    // Initialize 3D Cloud Clusters
    let clusters: CloudCluster[] = [];
    let photons: MicroPhoton[] = [];

    const initClouds = (width: number, height: number) => {
      clusters = [];
      const count = width < 768 ? 5 : 8; // Responsive density

      const coreColors = [
        'rgba(6, 182, 212, 0.45)', // Cyan
        'rgba(59, 130, 246, 0.40)', // Blue
        'rgba(16, 185, 129, 0.35)', // Emerald
        'rgba(99, 102, 241, 0.40)', // Indigo
      ];

      for (let i = 0; i < count; i++) {
        const puffCount = 7 + Math.floor(Math.random() * 5);
        const baseRadius = (width < 768 ? 70 : 110) + Math.random() * 80;
        const puffs: CloudPuff[] = [];

        for (let p = 0; p < puffCount; p++) {
          const angle = (p / puffCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
          const dist = (Math.random() * 0.65) * baseRadius;
          puffs.push({
            baseOffsetX: Math.cos(angle) * dist,
            baseOffsetY: Math.sin(angle) * dist * 0.5, // Natural horizontal cumulus spread
            radius: baseRadius * (0.65 + Math.random() * 0.55),
            phase: Math.random() * Math.PI * 2,
            morphSpeed: 0.0008 + Math.random() * 0.0012,
            morphAmplitude: 6 + Math.random() * 10,
          });
        }

        // Space clusters evenly across width with organic stagger
        const spreadX = ((i / count) - 0.5) * width * 1.5;
        const spreadY = ((i % 3) - 1) * (height * 0.35) + (Math.random() - 0.5) * 60;
        const depthZ = 0.7 + Math.random() * 1.8;

        clusters.push({
          x: spreadX,
          y: spreadY,
          z: depthZ,
          baseRadius,
          driftSpeed: (0.12 + Math.random() * 0.14) / depthZ, // Distant clouds drift slower
          puffs,
          hasGlowCore: i % 2 === 0,
          coreColor: coreColors[i % coreColors.length],
          pulsePhase: Math.random() * Math.PI * 2,
          pulseSpeed: 0.015 + Math.random() * 0.02,
        });
      }

      // Initialize ambient micro-photons (floating server particles)
      photons = [];
      const photonCount = width < 768 ? 16 : 30;
      for (let i = 0; i < photonCount; i++) {
        photons.push({
          x: (Math.random() - 0.5) * width * 1.2,
          y: (Math.random() - 0.5) * height * 1.1,
          z: 0.5 + Math.random() * 2,
          size: 1 + Math.random() * 2.2,
          vx: (Math.random() - 0.5) * 0.15,
          vy: -0.2 - Math.random() * 0.25, // Gentle upwards drift
          alpha: 0.2 + Math.random() * 0.6,
          color: Math.random() > 0.4 ? '#38BDF8' : '#34D399',
        });
      }
    };

    let lastWidth = 0;
    let lastHeight = 0;

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

      if (Math.abs(width - lastWidth) > 50 || Math.abs(height - lastHeight) > 50) {
        initClouds(width, height);
        lastWidth = width;
        lastHeight = height;
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      // Smooth mouse interpolation
      mouseX += (mouseTargetX - mouseX) * 0.04;
      mouseY += (mouseTargetY - mouseY) * 0.04;

      const cx = width / 2;
      const cy = height / 2;
      const time = Date.now() * 0.001;

      // Sort clusters by depth Z (distant first, foreground last for painter's algorithm)
      clusters.sort((a, b) => b.z - a.z);

      // 1. Draw 3D Cloud Clusters
      clusters.forEach((cluster) => {
        // Wind drift
        cluster.x += cluster.driftSpeed;
        const boundX = width * 0.85;
        if (cluster.x > boundX) {
          cluster.x = -boundX;
          cluster.y = (Math.random() - 0.5) * height * 0.7;
        }

        // Parallax offset based on depth Z: closer objects shift more
        const parallaxX = mouseX * (36 / cluster.z);
        const parallaxY = mouseY * (22 / cluster.z);

        const screenX = cx + cluster.x + parallaxX;
        const screenY = cy + cluster.y + parallaxY;

        // Skip rendering if completely offscreen
        const maxR = cluster.baseRadius * 1.8;
        if (
          screenX + maxR < 0 ||
          screenX - maxR > width ||
          screenY + maxR < 0 ||
          screenY - maxR > height
        ) {
          return;
        }

        // Perspective scale based on Z
        const scale = 1.3 / cluster.z;

        // Internal server light core pulse
        cluster.pulsePhase += cluster.pulseSpeed;
        const pulse = 0.5 + Math.sin(cluster.pulsePhase) * 0.5;

        if (cluster.hasGlowCore) {
          const coreGrad = ctx.createRadialGradient(
            screenX,
            screenY,
            0,
            screenX,
            screenY,
            cluster.baseRadius * 0.85 * scale
          );
          if (isDark) {
            coreGrad.addColorStop(0, cluster.coreColor);
            coreGrad.addColorStop(0.6, 'rgba(6, 182, 212, 0.12)');
            coreGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
          } else {
            coreGrad.addColorStop(0, 'rgba(56, 189, 248, 0.28)');
            coreGrad.addColorStop(0.6, 'rgba(147, 197, 253, 0.12)');
            coreGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
          }
          ctx.fillStyle = coreGrad;
          ctx.beginPath();
          ctx.arc(screenX, screenY, cluster.baseRadius * 0.85 * scale, 0, Math.PI * 2);
          ctx.fill();
        }

        // Draw overlapping Gaussian cloud puffs
        cluster.puffs.forEach((puff) => {
          // Subtle harmonic breathing motion
          const morphX = Math.sin(time * puff.morphSpeed * 1000 + puff.phase) * puff.morphAmplitude;
          const morphY = Math.cos(time * puff.morphSpeed * 800 + puff.phase) * (puff.morphAmplitude * 0.6);

          const puffX = screenX + (puff.baseOffsetX + morphX) * scale;
          const puffY = screenY + (puff.baseOffsetY + morphY) * scale;
          const puffR = puff.radius * scale;

          if (puffR <= 1) return;

          const puffGrad = ctx.createRadialGradient(
            puffX,
            puffY - puffR * 0.15, // Subtle top sun/light elevation
            0,
            puffX,
            puffY,
            puffR
          );

          if (isDark) {
            // Dark Mode: Deep digital nebula clouds with cyan edge-illumination
            const depthAlpha = Math.max(0.08, Math.min(0.28, 0.35 / cluster.z));
            puffGrad.addColorStop(0, `rgba(30, 58, 138, ${depthAlpha * 1.2})`); // Core deep blue
            puffGrad.addColorStop(0.45, `rgba(14, 116, 144, ${depthAlpha})`); // Mid cyan/azure
            puffGrad.addColorStop(0.8, `rgba(79, 70, 229, ${depthAlpha * 0.5})`); // Violet edge
            puffGrad.addColorStop(1, 'rgba(2, 6, 23, 0)');
          } else {
            // Light Mode: Ethereal, soft cumulus clouds with crisp silver/blue daylight tint
            const depthAlpha = Math.max(0.12, Math.min(0.40, 0.48 / cluster.z));
            puffGrad.addColorStop(0, `rgba(255, 255, 255, ${depthAlpha * 1.5})`); // Bright white core
            puffGrad.addColorStop(0.4, `rgba(224, 242, 254, ${depthAlpha * 1.1})`); // Sky azure
            puffGrad.addColorStop(0.75, `rgba(241, 245, 249, ${depthAlpha * 0.6})`); // Soft slate
            puffGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
          }

          ctx.fillStyle = puffGrad;
          ctx.beginPath();
          ctx.arc(puffX, puffY, puffR, 0, Math.PI * 2);
          ctx.fill();
        });
      });

      // 2. Draw Floating Micro-Photons (Network Data Particles)
      photons.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;

        // Wrap particles
        if (p.y < -height * 0.6) {
          p.y = height * 0.6;
          p.x = (Math.random() - 0.5) * width * 1.2;
        }

        const parallaxX = mouseX * (18 / p.z);
        const parallaxY = mouseY * (12 / p.z);
        const px = cx + p.x + parallaxX;
        const py = cy + p.y + parallaxY;

        if (px >= 0 && px <= width && py >= 0 && py <= height) {
          const pAlpha = isDark ? p.alpha : p.alpha * 0.5;
          ctx.fillStyle = p.color;
          ctx.globalAlpha = pAlpha;
          ctx.shadowColor = p.color;
          ctx.shadowBlur = isDark ? 6 : 2;
          ctx.beginPath();
          ctx.arc(px, py, p.size / p.z, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
          ctx.globalAlpha = 1;
        }
      });

      ctx.restore();
      animId = requestAnimationFrame(render);
    };

    render();

    // Pause when scrolled out of view (Battery & CPU conservation)
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          isVisible = entry.isIntersecting;
        });
      },
      { threshold: 0.05 }
    );
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    // Pause when tab is inactive
    const handleVisibilityChange = () => {
      isVisible = !document.hidden;
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      themeObserver.disconnect();
      observer.disconnect();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 pointer-events-none overflow-hidden select-none z-0 transition-opacity duration-500"
      aria-hidden="true"
    >
      {/* 3D Atmospheric Canvas Layer */}
      <canvas
        ref={canvasRef}
        className="w-full h-full object-cover opacity-90 dark:opacity-85"
      />

      {/* Subtle Ambient Radial Lighting Vignette */}
      <div className="absolute inset-0 bg-radial from-transparent via-transparent to-white/40 dark:to-zinc-950/60 pointer-events-none" />
    </div>
  );
}
