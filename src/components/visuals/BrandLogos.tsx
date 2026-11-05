'use client';

import React from 'react';

// Official SVG Brand Logos with authentic brand colors and responsive scaling
export const NextJsLogo = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 180 180" fill="none" xmlns="http://www.w3.org/2000/svg">
    <mask id="mask0_next" maskUnits="userSpaceOnUse" x="0" y="0" width="180" height="180" style={{ maskType: 'alpha' }}>
      <circle cx="90" cy="90" r="90" fill="black" />
    </mask>
    <g mask="url(#mask0_next)">
      <circle cx="90" cy="90" r="90" fill="currentColor" />
      <path d="M149.508 157.52L69.142 54H54V125.97H66.1136V69.3836L139.999 164.845C143.333 162.614 146.509 160.165 149.508 157.52Z" fill="url(#paint0_linear_next)" />
      <rect x="115" y="54" width="12" height="72" fill="url(#paint1_linear_next)" />
    </g>
    <defs>
      <linearGradient id="paint0_linear_next" x1="109" y1="116.5" x2="144.5" y2="160.5" gradientUnits="userSpaceOnUse">
        <stop stopColor="white" />
        <stop offset="1" stopColor="white" stopOpacity="0" />
      </linearGradient>
      <linearGradient id="paint1_linear_next" x1="121" y1="54" x2="120.799" y2="106.875" gradientUnits="userSpaceOnUse">
        <stop stopColor="white" />
        <stop offset="1" stopColor="white" stopOpacity="0" />
      </linearGradient>
    </defs>
  </svg>
);

export const ReactLogo = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg className={className} viewBox="-11.5 -10.23174 23 20.46348" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="0" cy="0" r="2.05" fill="#61DAFB" />
    <g stroke="#61DAFB" strokeWidth="1" fill="none">
      <ellipse rx="11" ry="4.2" />
      <ellipse rx="11" ry="4.2" transform="rotate(60)" />
      <ellipse rx="11" ry="4.2" transform="rotate(120)" />
    </g>
  </svg>
);

export const NodeJsLogo = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M16 2.5L3.5 9.7V24.3L16 31.5L28.5 24.3V9.7L16 2.5Z" fill="#5FA04E" />
    <path d="M16 4.3L5.1 10.6V23.2L16 29.5L26.9 23.2V10.6L16 4.3Z" fill="#333333" />
    <path d="M16 11V21M11 13.5L16 11L21 13.5V18.5L16 21L11 18.5V13.5Z" stroke="#83CD29" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const WordPressLogo = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="50" r="45" fill="#21759B" />
    <circle cx="50" cy="50" r="40" stroke="#FFFFFF" strokeWidth="3" />
    <path d="M21 50C21 64.2 31.2 76 45 78.4L30.5 38.6C24.6 41.7 21 45.5 21 50ZM68.2 48.6C68.2 43.8 66.5 40.5 65 37.9C63.1 34.6 61.2 31.8 61.2 27.5C61.2 22.8 64.8 18.4 69.8 18.4C70.2 18.4 70.6 18.4 71 18.5C64.6 12.8 56.2 9.5 47 9.5C36.6 9.5 27.2 13.7 20.6 20.6L44.8 86.8C58.8 81.3 68.2 65.6 68.2 48.6ZM52.4 56.4L42.2 26.6C44 26.5 45.9 26.3 45.9 26.3C47.8 26.1 47.6 23.2 45.7 23.3C45.7 23.3 39.8 23.8 35.8 23.8C32 23.8 26.3 23.3 26.3 23.3C24.4 23.2 24.2 26.1 26.1 26.3C26.1 26.3 27.9 26.5 29.6 26.6L43.8 65.1L52.4 56.4Z" fill="#FFFFFF" />
  </svg>
);

export const LaravelLogo = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2L2 7V17L12 22L22 17V7L12 2Z" fill="#FF2D20" />
    <path d="M12 6L6 9.5V14.5L12 18L18 14.5V9.5L12 6Z" fill="#FFFFFF" />
  </svg>
);

export const PythonLogo = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 110 110" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M54.5 9C41.8 9 42.6 14.5 42.6 14.5L42.7 20.2H55.4V22H33.4C24 22 21.2 27.7 21.2 37.1C21.2 46.5 27.2 47.2 27.2 47.2H32.4V41.7C32.4 34.6 38.6 34.6 38.6 34.6H55.2C61.4 34.6 61.4 28.6 61.4 28.6V15C61.4 15 62 9 54.5 9ZM48 14.3C49.9 14.3 51.4 15.8 51.4 17.7C51.4 19.6 49.9 21.1 48 21.1C46.1 21.1 44.6 19.6 44.6 17.7C44.6 15.8 46.1 14.3 48 14.3Z" fill="#3776AB" />
    <path d="M55.5 101C68.2 101 67.4 95.5 67.4 95.5L67.3 89.8H54.6V88H76.6C86 88 88.8 82.3 88.8 72.9C88.8 63.5 82.8 62.8 82.8 62.8H77.6V68.3C77.6 75.4 71.4 75.4 71.4 75.4H54.8C48.6 75.4 48.6 81.4 48.6 81.4V95C48.6 95 48 101 55.5 101ZM62 95.7C60.1 95.7 58.6 94.2 58.6 92.3C58.6 90.4 60.1 88.9 62 88.9C63.9 88.9 65.4 90.4 65.4 92.3C65.4 94.2 63.9 95.7 62 95.7Z" fill="#FFD43B" />
  </svg>
);

export const GitHubLogo = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
  </svg>
);

export const DockerLogo = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M4 11h2v2H4zm3 0h2v2H7zm3 0h2v2h-2zm3 0h2v2h-2zm-6-3h2v2H7zm3 0h2v2h-2zm3 0h2v2h-2zm-3-3h2v2h-2zm12.5 7.5c-.3-.2-1.5-.7-2.3-.2-.1-.7-.4-1.3-.9-1.8l-.5-.5-.4.5c-.5.7-.7 1.5-.7 2.3 0 .2 0 .4.1.6-1-.1-2.1.2-2.8.9-1.5 1.5-1.5 4 0 5.5 1.2 1.2 3.5 1.7 6.5 1.7 4.5 0 8-1.5 8-5 0-1.7-.8-3-2-3.8z" fill="#2496ED" />
  </svg>
);

export const CpanelLogo = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M16 2C8.3 2 2 8.3 2 16s6.3 14 14 14 14-6.3 14-14S23.7 2 16 2zm-2 20h-3v-8h3v8zm4 0h-2V10h2v12zm4 0h-3v-5h3v5z" fill="#FF6C2C" />
  </svg>
);

export const CloudflareLogo = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M25.7 15.6c-.6-3.2-3.4-5.6-6.7-5.6-2.5 0-4.7 1.4-5.9 3.5-1.1-.6-2.4-.9-3.8-.7-2.6.4-4.7 2.4-5.1 5-.1.5-.1 1.1 0 1.6H25c1.7 0 3-1.3 3-3 0-.4-.1-.7-.3-.8z" fill="#F38020" />
    <path d="M24.8 19.4H4.2c-.1-.3-.2-.6-.2-1 0-2.8 2.2-5 5-5 .4 0 .9.1 1.3.2 1.2-2 3.4-3.4 5.9-3.4 3.4 0 6.2 2.4 6.8 5.7.5-.3 1.1-.5 1.8-.5 1.7 0 3 1.3 3 3 0 .4-.1.7-.2 1z" fill="#FAAD3F" />
  </svg>
);

export const BkashBadge = ({ className = 'h-6' }: { className?: string }) => (
  <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[#E2136E]/10 border border-[#E2136E]/20 text-[#E2136E] font-semibold text-xs font-sans ${className}`}>
    <span className="w-2 h-2 rounded-full bg-[#E2136E]" />
    <span>bKash</span>
  </div>
);

export const NagadBadge = ({ className = 'h-6' }: { className?: string }) => (
  <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[#F7941D]/10 border border-[#F7941D]/20 text-[#F7941D] font-semibold text-xs font-sans ${className}`}>
    <span className="w-2 h-2 rounded-full bg-[#F7941D]" />
    <span>Nagad</span>
  </div>
);

export const StripeBadge = ({ className = 'h-6' }: { className?: string }) => (
  <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[#635BFF]/10 border border-[#635BFF]/20 text-[#635BFF] font-semibold text-xs font-sans ${className}`}>
    <span className="w-2 h-2 rounded-full bg-[#635BFF]" />
    <span>Stripe</span>
  </div>
);
