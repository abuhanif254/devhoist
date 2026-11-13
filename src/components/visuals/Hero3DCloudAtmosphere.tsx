'use client';

import React, { useEffect, useRef } from 'react';

interface Puff {
  offsetX: number; // offset from cloud center
  offsetY: number;
  radius: number;
  phase: number;
  morphSpeed: number;
  morphAmp: number;
}

interface CumulusCloud {
  x: number; // Center X
  y: number; // Center Y
  z: number; // 3D Depth layer: 0.8 (foreground) to 2.6 (distant horizon)
  width: number;
  height: number;
  speed: number; // Horizontal drift speed
  puffs: Puff[];
  density: number; // opacity multiplier
}

interface Star {
  x: number;
  y: number;
  size: number;
  twinklePhase: number;
  twinkleSpeed: number;
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

    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    let reduceMotion = reducedMotionQuery.matches;
    const handleMotionChange = () => {
      reduceMotion = reducedMotionQuery.matches;
      if (!reduceMotion) {
        cancelAnimationFrame(animId);
        render();
      }
    };
    reducedMotionQuery.addEventListener?.('change', handleMotionChange);

    const themeObserver = new MutationObserver(() => {
      isDark = checkIsDark();
      if (reduceMotion) {
        render();
      }
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    // Mouse movement listener on hero section
    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      mouseTargetX = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      mouseTargetY = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
    };
    window.addEventListener('mousemove', handleMouseMove, { passive: true });

    let clouds: CumulusCloud[] = [];
    let stars: Star[] = [];
    let lastWidth = 0;
    let lastHeight = 0;

    // Procedural Cumulus Cloud Generator
    const initAtmosphere = (width: number, height: number) => {
      clouds = [];
      stars = [];

      // 1. Generate Night Sky Stars for dark mode
      const starCount = width < 768 ? 40 : 85;
      for (let i = 0; i < starCount; i++) {
        stars.push({
          x: Math.random() * width,
          y: Math.random() * (height * 0.75),
          size: 0.6 + Math.random() * 1.6,
          twinklePhase: Math.random() * Math.PI * 2,
          twinkleSpeed: 0.02 + Math.random() * 0.04,
        });
      }

      // 2. Generate Real Volumetric Cumulus Clouds across 3 distinct depth planes
      // We create 7 to 10 distinct cloud formations spaced organically across the sky
      const cloudCount = width < 768 ? 6 : 9;

      // Realistic cumulus cloud presets: [depthZ, relativeY, baseScale, speedFactor]
      const layerPresets = [
        // Distant horizon layer (z: 2.2 - 2.8, slower, higher up or far horizon)
        { z: 2.5, speed: 0.18, scale: 0.7, density: 0.8 },
        { z: 2.3, speed: 0.22, scale: 0.8, density: 0.85 },
        { z: 2.1, speed: 0.25, scale: 0.9, density: 0.9 },
        // Mid-ground hero cumulus (z: 1.3 - 1.8, voluminous and puffy)
        { z: 1.6, speed: 0.38, scale: 1.25, density: 0.95 },
        { z: 1.4, speed: 0.42, scale: 1.4, density: 0.98 },
        { z: 1.5, speed: 0.40, scale: 1.3, density: 0.95 },
        { z: 1.7, speed: 0.35, scale: 1.2, density: 0.92 },
        // Foreground drifting wisps (z: 0.9 - 1.1, drifting faster across upper/lower sky)
        { z: 1.0, speed: 0.58, scale: 1.6, density: 0.88 },
        { z: 0.9, speed: 0.65, scale: 1.75, density: 0.85 },
      ];

      for (let i = 0; i < cloudCount; i++) {
        const preset = layerPresets[i % layerPresets.length];
        const baseW = (width < 768 ? 240 : 380) * preset.scale;
        const baseH = (width < 768 ? 110 : 160) * preset.scale;

        // Spread clouds along horizontal axis initially
        const initialX = ((i / cloudCount) * (width * 1.6)) - (width * 0.3) + (Math.random() - 0.5) * 120;
        // Distribute vertically: upper sky (15% - 40%), mid horizon (45% - 65%)
        const initialY = (height * 0.12) + (Math.random() * (height * 0.65));

        // Construct 18 - 26 overlapping puffs to form a natural cumulus profile:
        // - Wide horizontal flat base (fluffy underside)
        // - High rounded cauliflower domes in the middle and top
        const puffCount = 18 + Math.floor(Math.random() * 8);
        const puffs: Puff[] = [];

        // Center mound
        puffs.push({
          offsetX: 0,
          offsetY: -baseH * 0.25,
          radius: baseH * 0.65,
          phase: Math.random() * Math.PI * 2,
          morphSpeed: 0.0006 + Math.random() * 0.0008,
          morphAmp: 4 + Math.random() * 6,
        });

        // Top cumulus cauliflower crests
        const crestCount = 4 + Math.floor(Math.random() * 3);
        for (let c = 0; c < crestCount; c++) {
          const ratio = (c - (crestCount - 1) / 2) / (crestCount / 2);
          const cx = ratio * (baseW * 0.32);
          const cy = -baseH * 0.42 - (1 - Math.abs(ratio)) * (baseH * 0.28);
          const r = baseH * (0.42 + (1 - Math.abs(ratio)) * 0.25);
          puffs.push({
            offsetX: cx,
            offsetY: cy,
            radius: r,
            phase: Math.random() * Math.PI * 2,
            morphSpeed: 0.0008 + Math.random() * 0.001,
            morphAmp: 5 + Math.random() * 7,
          });
        }

        // Horizontal base lobes (forming the flatter cumulus underside)
        const baseLobeCount = 6 + Math.floor(Math.random() * 4);
        for (let b = 0; b < baseLobeCount; b++) {
          const ratio = (b - (baseLobeCount - 1) / 2) / (baseLobeCount / 2);
          const bx = ratio * (baseW * 0.45);
          const by = baseH * 0.08 + Math.sin(b * 1.5) * (baseH * 0.1);
          const r = baseH * (0.48 - Math.abs(ratio) * 0.16);
          puffs.push({
            offsetX: bx,
            offsetY: by,
            radius: r,
            phase: Math.random() * Math.PI * 2,
            morphSpeed: 0.0007 + Math.random() * 0.0009,
            morphAmp: 4 + Math.random() * 5,
          });
        }

        // Left and right flank wisps
        puffs.push({
          offsetX: -baseW * 0.46,
          offsetY: -baseH * 0.05,
          radius: baseH * 0.36,
          phase: Math.random() * Math.PI * 2,
          morphSpeed: 0.001,
          morphAmp: 6,
        });
        puffs.push({
          offsetX: baseW * 0.46,
          offsetY: -baseH * 0.05,
          radius: baseH * 0.36,
          phase: Math.random() * Math.PI * 2,
          morphSpeed: 0.001,
          morphAmp: 6,
        });

        clouds.push({
          x: initialX,
          y: initialY,
          z: preset.z,
          width: baseW,
          height: baseH,
          speed: preset.speed,
          puffs,
          density: preset.density,
        });
      }
    };

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

      if (Math.abs(width - lastWidth) > 60 || Math.abs(height - lastHeight) > 60) {
        initAtmosphere(width, height);
        lastWidth = width;
        lastHeight = height;
      }

      ctx.save();
      ctx.scale(dpr, dpr);

      // Smooth mouse interpolation for 3D parallax
      mouseX += (mouseTargetX - mouseX) * 0.04;
      mouseY += (mouseTargetY - mouseY) * 0.04;

      const time = Date.now() * 0.001;

      // ==========================================
      // 1. RENDER REAL SKY BACKGROUND
      // ==========================================
      if (isDark) {
        // Deep Cosmic Twilight / Midnight Sky
        const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
        skyGrad.addColorStop(0, '#030712'); // Rich deep cosmic space
        skyGrad.addColorStop(0.35, '#0a1128'); // Deep midnight blue
        skyGrad.addColorStop(0.7, '#111827'); // Twilight indigo
        skyGrad.addColorStop(1, '#090d16'); // Dark horizon
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, width, height);

        // Soft Lunar / Celestial Radiance at top right
        const moonX = width * 0.78;
        const moonY = height * 0.18;
        const moonGlow = ctx.createRadialGradient(moonX, moonY, 0, moonX, moonY, width * 0.45);
        moonGlow.addColorStop(0, 'rgba(199, 210, 254, 0.35)');
        moonGlow.addColorStop(0.2, 'rgba(129, 140, 248, 0.14)');
        moonGlow.addColorStop(0.55, 'rgba(56, 189, 248, 0.05)');
        moonGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = moonGlow;
        ctx.beginPath();
        ctx.arc(moonX, moonY, width * 0.45, 0, Math.PI * 2);
        ctx.fill();

        // Twinkling Night Stars
        stars.forEach((star) => {
          star.twinklePhase += star.twinkleSpeed;
          const alpha = 0.3 + Math.sin(star.twinklePhase) * 0.4;
          ctx.fillStyle = `rgba(248, 250, 252, ${Math.max(0.1, alpha)})`;
          ctx.beginPath();
          ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
          ctx.fill();
        });
      } else {
        // Authentic Daylight Sky: Deep cerulean / sky-blue zenith fading into warm horizon haze
        const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
        skyGrad.addColorStop(0, '#0284c7'); // Rich azure blue
        skyGrad.addColorStop(0.25, '#38bdf8'); // Brilliant sky blue
        skyGrad.addColorStop(0.55, '#7dd3fc'); // Light daylight cyan
        skyGrad.addColorStop(0.82, '#bae6fd'); // Atmospheric sky haze
        skyGrad.addColorStop(1, '#e0f2fe'); // Soft horizon blend
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, width, height);

        // Radiant Sun & Golden Solar Aura at top right
        const sunX = width * 0.76;
        const sunY = height * 0.16;

        // Broad Solar Flare & Warm Sunlight Wash
        const sunAura = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, width * 0.55);
        sunAura.addColorStop(0, 'rgba(255, 254, 235, 0.85)');
        sunAura.addColorStop(0.15, 'rgba(254, 240, 138, 0.45)');
        sunAura.addColorStop(0.4, 'rgba(186, 230, 253, 0.3)');
        sunAura.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = sunAura;
        ctx.beginPath();
        ctx.arc(sunX, sunY, width * 0.55, 0, Math.PI * 2);
        ctx.fill();

        // Brilliant Sun Core Disk
        const sunCore = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, 48);
        sunCore.addColorStop(0, '#ffffff');
        sunCore.addColorStop(0.4, '#fef9c3');
        sunCore.addColorStop(0.85, 'rgba(253, 224, 71, 0.4)');
        sunCore.addColorStop(1, 'rgba(254, 240, 138, 0)');
        ctx.fillStyle = sunCore;
        ctx.beginPath();
        ctx.arc(sunX, sunY, 48, 0, Math.PI * 2);
        ctx.fill();
      }

      // ==========================================
      // 2. RENDER REAL VOLUMETRIC CUMULUS CLOUDS
      // ==========================================
      // Sort clouds by depth Z (distant clouds drawn first, foreground clouds drawn last)
      clouds.sort((a, b) => b.z - a.z);

      clouds.forEach((cloud) => {
        // Continuous Horizontal Wind Drift ("movie" / moving continuously across sky)
        cloud.x += cloud.speed;

        // Wrap around seamlessly when cloud leaves right side of screen
        const halfW = cloud.width * 0.65;
        if (cloud.x - halfW > width) {
          cloud.x = -halfW - 40;
          cloud.y = height * 0.1 + Math.random() * (height * 0.65);
        }

        // 3D Parallax offset based on mouse position and depth
        const parallaxX = mouseX * (32 / cloud.z);
        const parallaxY = mouseY * (18 / cloud.z);

        const screenX = cloud.x + parallaxX;
        const screenY = cloud.y + parallaxY;

        // Skip rendering if completely outside bounds
        if (
          screenX + halfW < -80 ||
          screenX - halfW > width + 80 ||
          screenY + cloud.height < -80 ||
          screenY - cloud.height > height + 80
        ) {
          return;
        }

        // Perspective scale factor
        const scale = 1.2 / cloud.z;

        // Render each volumetric puff of this cumulus cloud
        cloud.puffs.forEach((puff) => {
          // Harmonic organic breathing (subtle fluid morphing)
          const morphX = Math.sin(time * puff.morphSpeed * 1000 + puff.phase) * puff.morphAmp;
          const morphY = Math.cos(time * puff.morphSpeed * 850 + puff.phase) * (puff.morphAmp * 0.7);

          const px = screenX + (puff.offsetX + morphX) * scale;
          const py = screenY + (puff.offsetY + morphY) * scale;
          const pr = puff.radius * scale;

          if (pr <= 2) return;

          // Directional Sunlight Gradient:
          // In nature, the top of the cloud facing the sun is pure brilliant white,
          // while the underside and core have atmospheric cool shadows.
          // Light direction: Top-right (dx: +0.22, dy: -0.28)
          const grad = ctx.createRadialGradient(
            px + pr * 0.22, // Focal center shifted toward top-right sun
            py - pr * 0.28,
            pr * 0.08,
            px,
            py,
            pr
          );

          if (isDark) {
            // Dark Mode Cloud: Silver lunar edge with deep navy/indigo body
            const d = cloud.density;
            grad.addColorStop(0, `rgba(241, 245, 249, ${0.75 * d})`); // Silver-white lunar crest
            grad.addColorStop(0.25, `rgba(147, 197, 253, ${0.55 * d})`); // Soft cyan midtone
            grad.addColorStop(0.65, `rgba(51, 65, 85, ${0.45 * d})`); // Slate-blue shadow
            grad.addColorStop(0.9, `rgba(30, 41, 59, ${0.25 * d})`); // Deep indigo base
            grad.addColorStop(1, 'rgba(15, 23, 42, 0)'); // Soft feathered border
          } else {
            // Light Mode Cloud: High-contrast, pure white sunlit cumulus with realistic shaded belly
            const d = cloud.density;
            grad.addColorStop(0, `rgba(255, 255, 255, ${0.98 * d})`); // Pure brilliant sunlit crest
            grad.addColorStop(0.35, `rgba(255, 255, 255, ${0.92 * d})`); // Fluffy white cumulus body
            grad.addColorStop(0.68, `rgba(241, 245, 249, ${0.82 * d})`); // Soft silver midtone
            grad.addColorStop(0.88, `rgba(148, 163, 184, ${0.42 * d})`); // Real cool atmospheric shadow underside
            grad.addColorStop(1, 'rgba(203, 213, 225, 0)'); // Feathered edge
          }

          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(px, py, pr, 0, Math.PI * 2);
          ctx.fill();
        });
      });

      ctx.restore();
      if (!reduceMotion) {
        animId = requestAnimationFrame(render);
      }
    };

    render();

    // Pause animation when scrolled out of view to preserve 60 FPS performance
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

    // Pause animation when browser tab is inactive
    const handleVisibilityChange = () => {
      isVisible = !document.hidden;
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      reducedMotionQuery.removeEventListener?.('change', handleMotionChange);
      themeObserver.disconnect();
      observer.disconnect();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 pointer-events-none overflow-hidden select-none z-0"
      aria-hidden="true"
    >
      {/* Real Sky & Moving Clouds Canvas */}
      <canvas
        ref={canvasRef}
        className="w-full h-full object-cover transition-opacity duration-700"
      />

      {/* Bottom atmospheric horizon fade into the page */}
      <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-b from-transparent via-white/40 to-white dark:via-[#090D16]/45 dark:to-[#090D16] pointer-events-none" />

      {/* Subtle hairline vignette for depth */}
      <div className="absolute inset-0 bg-radial from-transparent via-transparent to-black/[0.04] dark:to-black/30 pointer-events-none" />
    </div>
  );
}
