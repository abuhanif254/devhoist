'use client';

import React from 'react';

interface PipelineBeamProps {
  className?: string;
  horizontal?: boolean;
}

export default function PipelineBeam({
  className = '',
  horizontal = true,
}: PipelineBeamProps) {
  return (
    <div
      className={`relative flex items-center justify-center overflow-hidden pointer-events-none select-none ${className}`}
      aria-hidden="true"
    >
      {horizontal ? (
        <svg
          className="w-full h-4 overflow-visible"
          viewBox="0 0 200 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Base track */}
          <line
            x1="0"
            y1="8"
            x2="200"
            y2="8"
            stroke="rgba(255, 255, 255, 0.08)"
            strokeWidth="1.5"
          />
          {/* Animated data-packet flow */}
          <line
            x1="0"
            y1="8"
            x2="200"
            y2="8"
            stroke="rgba(16, 185, 129, 0.65)"
            strokeWidth="1.5"
            className="animate-pipeline-beam"
          />
        </svg>
      ) : (
        <svg
          className="w-4 h-full overflow-visible"
          viewBox="0 0 16 200"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <line
            x1="8"
            y1="0"
            x2="8"
            y2="200"
            stroke="rgba(255, 255, 255, 0.08)"
            strokeWidth="1.5"
          />
          <line
            x1="8"
            y1="0"
            x2="8"
            y2="200"
            stroke="rgba(16, 185, 129, 0.65)"
            strokeWidth="1.5"
            className="animate-pipeline-beam"
          />
        </svg>
      )}
    </div>
  );
}
