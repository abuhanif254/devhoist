'use client';

import React, { useState, useEffect } from 'react';
import { Terminal, CheckCircle2, RotateCcw, GitBranch } from 'lucide-react';

interface TerminalStep {
  text: string;
  type: 'command' | 'system' | 'success' | 'highlight';
  delay: number;
}

const TERMINAL_STEPS: TerminalStep[] = [
  { text: '$ git commit -m "feat: ship new feature 🚀"', type: 'command', delay: 400 },
  { text: '$ git push origin main', type: 'command', delay: 700 },
  { text: '→ remote: GitHub Actions runner initialized [ubuntu-latest]', type: 'system', delay: 1100 },
  { text: '→ remote: Building Next.js standalone bundle (41.8 MB)...', type: 'system', delay: 1500 },
  { text: '→ remote: Running Smart In-Place Rsync to cPanel NVMe...', type: 'highlight', delay: 2000 },
  { text: '→ remote: Touching tmp/restart.txt [Passenger reload]', type: 'system', delay: 2400 },
  { text: '✔ Zero-downtime release completed in 2.8s! [200 OK]', type: 'success', delay: 2800 },
];

export default function HeroTerminal() {
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const isDone = currentStepIndex >= TERMINAL_STEPS.length;

  useEffect(() => {
    let timeout: NodeJS.Timeout;

    if (currentStepIndex < TERMINAL_STEPS.length) {
      timeout = setTimeout(() => {
        setCurrentStepIndex((prev) => prev + 1);
      }, TERMINAL_STEPS[currentStepIndex].delay);
    } else {
      // Loop after 4.5 seconds
      timeout = setTimeout(() => {
        setCurrentStepIndex(0);
      }, 4500);
    }

    return () => clearTimeout(timeout);
  }, [currentStepIndex]);

  const handleRestart = () => {
    setCurrentStepIndex(0);
  };

  return (
    <div className="w-full rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-900 dark:bg-zinc-950 shadow-xl overflow-hidden glass-card relative group">
      {/* Terminal Title Bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-zinc-900/60 border-b border-white/[0.08]">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
          <div className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
          <div className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
          <span className="text-[11px] font-mono text-zinc-400 ml-2 hidden sm:inline-block">
            bash — devhost-pipeline
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-zinc-800 border border-white/10 text-[10px] font-mono text-zinc-300">
            <GitBranch className="w-3 h-3 text-zinc-400" />
            <span>origin/main</span>
          </div>
          <button
            onClick={handleRestart}
            className="p-1 rounded text-zinc-500 hover:text-zinc-200 transition-colors"
            title="Replay animation"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Terminal Body */}
      <div className="p-4 sm:p-5 font-mono text-xs text-zinc-300 space-y-2 min-h-[240px] flex flex-col justify-start">
        {TERMINAL_STEPS.slice(0, currentStepIndex).map((step, idx) => {
          if (step.type === 'command') {
            return (
              <div key={idx} className="text-zinc-100 font-medium flex items-center gap-2">
                <span>{step.text}</span>
              </div>
            );
          }
          if (step.type === 'highlight') {
            return (
              <div key={idx} className="text-zinc-300 flex items-center gap-2">
                <span>{step.text}</span>
              </div>
            );
          }
          if (step.type === 'success') {
            return (
              <div
                key={idx}
                className="text-emerald-400 font-medium flex items-center gap-2 pt-1"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>{step.text}</span>
              </div>
            );
          }
          return (
            <div key={idx} className="text-zinc-500">
              {step.text}
            </div>
          );
        })}

        {/* Blinking Cursor */}
        {!isDone && (
          <div className="inline-block w-2 h-4 bg-zinc-400 animate-pulse ml-0.5" />
        )}
      </div>

      {/* Live Badge Bottom Bar */}
      <div className="px-4 py-2.5 bg-zinc-900/40 border-t border-white/[0.08] flex items-center justify-between text-[11px] font-mono text-zinc-400">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span>Equinix SG1 / US East NVMe</span>
        </div>
        <div className="text-zinc-400">
          Passenger 6.x • LiteSpeed Enterprise
        </div>
      </div>
    </div>
  );
}
